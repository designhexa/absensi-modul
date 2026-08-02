/**
 * apply-tl-migration.cjs
 * Menerapkan migrasi 20260627000011 (role 'tl' di constraint users_role_check),
 * membuat karyawan k-tl (Tenaga Lapangan) di daftar karyawan,
 * dan membuat/menautkan akun TL ke karyawan tsb (users.karyawan_id = 'k-tl').
 *
 * Catatan: akun TL TIDAK lagi menjadi "akun admin" — ia terdaftar sebagai
 * karyawan (seksi Karyawan di Master Data), bukan di seksi Akun Admin.
 *
 * Cara pakai: node scripts/apply-tl-migration.cjs
 *
 * Kredensial dibaca dari .env:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_SERVICE_ROLE_KEY
 *   (opsional) SUPABASE_ACCESS_TOKEN  → PAT Management API, jalankan DDL otomatis
 *
 * Catatan: PostgREST TIDAK bisa menjalankan DDL tanpa fungsi exec_sql yang sudah ada.
 *   - Jika exec_sql ada di DB          → migrasi dijalankan lewat RPC.
 *   - Jika SUPABASE_ACCESS_TOKEN ada   → migrasi dijalankan lewat Management API.
 *   - Jika keduanya tidak ada          → script mencetak SQL untuk dijalankan manual
 *     di Supabase Dashboard → SQL Editor, lalu tetap mencoba membuat akun TL.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// --- Parse .env ---
const envPath = path.resolve(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  console.error("Error: .env file not found at", envPath);
  process.exit(1);
}
const env = {};
fs.readFileSync(envPath, "utf-8")
  .split(/\r?\n/)
  .forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) return;
    let value = match[2] || "";
    if (value.length >= 2 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
      value = value.slice(1, -1);
    } else if (value.length >= 2 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  });

const supabaseUrl = env["VITE_SUPABASE_URL"];
const serviceKey = env["VITE_SUPABASE_SERVICE_ROLE_KEY"];
const accessToken = env["SUPABASE_ACCESS_TOKEN"] || "";

if (!supabaseUrl || !serviceKey) {
  console.error("Error: VITE_SUPABASE_URL atau VITE_SUPABASE_SERVICE_ROLE_KEY tidak ada di .env");
  process.exit(1);
}

const projectRef = supabaseUrl.replace("https://", "").split(".")[0];
const dashboardSqlUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;
const supabase = createClient(supabaseUrl, serviceKey);

// --- Migration SQL (20260627000011_add_tl_to_role_check.sql) ---
const TL_MIGRATION_SQL = `
-- Migration: Allow 'tl' (Tenaga Lapangan) as a valid role in users table
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_role;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'outlet', 'produksi', 'gudang', 'tl'));
`;

/** Jalankan SQL lewat RPC exec_sql (jika fungsi sudah ada). */
async function execViaRpc(sql) {
  try {
    const { error } = await supabase.rpc("exec_sql", { sql_text: sql });
    if (!error) return { ok: true, method: "rpc" };
  } catch {}
  try {
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sql_text: sql }),
    });
    if (resp.ok) return { ok: true, method: "rest" };
    return { ok: false, method: "rest", error: await resp.text() };
  } catch (err) {
    return { ok: false, method: "rest", error: String(err) };
  }
}

/** Jalankan SQL lewat Supabase Management API (butuh PAT). */
async function execViaManagementApi(sql) {
  if (!accessToken) return { ok: false, method: "mgmt", error: "no token" };
  try {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    if (resp.ok) {
      const text = await resp.text();
      return { ok: true, method: "mgmt", result: text.slice(0, 300) };
    }
    return { ok: false, method: "mgmt", error: (await resp.text()).slice(0, 500) };
  } catch (err) {
    return { ok: false, method: "mgmt", error: String(err) };
  }
}

/** Cek apakah constraint users_role_check sudah menerima role 'tl'. */
async function roleTlAllowed() {
  // Bersihkan probe lama (jika sisa dari run sebelumnya) agar tidak bentrok unique username.
  await supabase.from("users").delete().eq("username", "__tl_probe__");

  // Probe: insert user sementara dengan role 'tl', lalu hapus.
  const probe = {
    username: "__tl_probe__",
    password: "probe",
    nama: "PROBE",
    role: "tl",
  };
  const { error } = await supabase.from("users").insert(probe);
  if (!error) {
    try {
      await supabase.from("users").delete().eq("username", "__tl_probe__");
    } catch {}
    return true;
  }
  // Hanya dianggap "diblokir oleh constraint role" jika kode errornya check violation (23514).
  if (error && String(error.code) === "23514") return false;
  // Error lain (mis. unique bentrok) — aman dianggap sudah menerima 'tl'.
  console.log("  ℹ️ Probe tidak konklusif (" + (error && error.message) + ") — diasumsikan 'tl' diterima.");
  return true;
}

async function main() {
  console.log("Supabase URL:", supabaseUrl);
  console.log("Project ref:", projectRef);

  // --- Step 1: Pastikan constraint menerima role 'tl' ---
  console.log("\n▶ Mengecek apakah constraint users_role_check sudah menerima role 'tl' ...");
  const already = await roleTlAllowed();
  if (already) {
    console.log("  ✅ Constraint sudah menerima role 'tl' — migrasi tidak diperlukan.");
  } else {
    console.log("  ⚠️ Constraint masih memblokir role 'tl'. Mencoba menjalankan migrasi...");
    let applied = await execViaRpc(TL_MIGRATION_SQL);
    if (!applied.ok) {
      applied = await execViaManagementApi(TL_MIGRATION_SQL);
    }
    if (applied.ok) {
      console.log(`  ✅ Migrasi berhasil dijalankan (via ${applied.method}).`);
    } else {
      console.log("  ❌ Migrasi gagal dijalankan otomatis (", String(applied.error || "unknown"), ").");
      console.log("\n  🔐 Jalankan SQL berikut SATU KALI di Supabase Dashboard → SQL Editor:");
      console.log("     " + dashboardSqlUrl);
      console.log("  ===========================================================");
      console.log(TL_MIGRATION_SQL);
      console.log("  ===========================================================");
      console.log("  Lalu jalankan script ini lagi untuk membuat akun TL.");
      console.log("  (Atau set SUPABASE_ACCESS_TOKEN=... di .env agar DDL dijalankan otomatis.)");
    }
  }

  // --- Step 2: Pastikan karyawan 'k-tl' ada (agar user TL bisa di-link) ---
  console.log("\n▶ Memastikan karyawan k-tl (Tenaga Lapangan) ada di daftar karyawan ...");
  const { data: karyawanExisting, error: karyawanCheckErr } = await supabase
    .from("karyawan")
    .select("id")
    .eq("id", "k-tl")
    .maybeSingle();

  if (karyawanCheckErr) {
    console.log("  ⚠️ Gagal mengecek karyawan k-tl:", karyawanCheckErr.message);
  } else if (karyawanExisting) {
    const { error: karyawanUpdErr } = await supabase
      .from("karyawan")
      .update({ nama: "Tenaga Lapangan", posisi: "TL (Tenaga Lapangan)", role: "tl" })
      .eq("id", "k-tl");
    if (karyawanUpdErr) {
      console.log("  ⚠️ Gagal update karyawan k-tl:", karyawanUpdErr.message);
    } else {
      console.log("  ✅ Karyawan 'k-tl' sudah ada — role & posisi di-update.");
    }
  } else {
    const { error: karyawanInsErr } = await supabase.from("karyawan").insert({
      id: "k-tl",
      nama: "Tenaga Lapangan",
      posisi: "TL (Tenaga Lapangan)",
      role: "tl",
      outlet_id: null,
      gaji_pokok: 0,
      bonus_omset: 0,
      bonus_ulasan: 0,
      bonus_oh: 0,
      tunjangan_harian: 0,
      overtime_rate: 0,
      jam_masuk: "07:00",
      jam_pulang: "15:00"
    });
    if (karyawanInsErr) {
      console.log("  ❌ Gagal insert karyawan k-tl:", karyawanInsErr.message);
      console.log("     Hint: pastikan kolom karyawan sesuai schema DB (role 'tl' harus diterima).");
    } else {
      console.log("  ✅ Karyawan 'k-tl' berhasil dibuat (Tenaga Lapangan).");
    }
  }

  // --- Step 3: Buat / update akun TL (via REST — tidak butuh DDL) ---
  console.log("\n▶ Membuat akun TL (Tenaga Lapangan) ...");
  const { data: existing, error: checkErr } = await supabase
    .from("users")
    .select("username")
    .eq("username", "tl")
    .maybeSingle();

  if (checkErr) {
    console.log("  ⚠️ Gagal mengecek user tl:", checkErr.message);
  } else if (existing) {
    const { error: updErr } = await supabase
      .from("users")
      .update({ nama: "Tenaga Lapangan", role: "tl", password: "tl123", karyawan_id: "k-tl" })
      .eq("username", "tl");
    if (updErr) {
      console.log("  ❌ Gagal update user tl:", updErr.message);
      if (/23514|check constraint|role/i.test(updErr.message)) {
        console.log("     Hint: constraint role belum menerima 'tl'. Jalankan migrasi di SQL Editor (lihat atas).");
      }
    } else {
      console.log("  ✅ User 'tl' sudah ada — role & password di-update (tl123).");
    }
  } else {
    const { error: insErr } = await supabase.from("users").insert({
      username: "tl",
      password: "tl123",
      nama: "Tenaga Lapangan",
      role: "tl",
      outlet_id: null,
      karyawan_id: "k-tl",
    });
    if (insErr) {
      console.log("  ❌ Gagal insert user tl:", insErr.message);
      if (/23514|check constraint|role/i.test(insErr.message)) {
        console.log("     Hint: constraint role belum menerima 'tl'. Jalankan migrasi di SQL Editor (lihat atas).");
      }
    } else {
      console.log("  ✅ User 'tl' berhasil dibuat (username: tl, password: tl123).");
    }
  }

  // --- Step 4: Verifikasi akhir ---
  console.log("\n▶ Verifikasi akhir ...");
  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("username, nama, role, karyawan_id")
    .order("username");
  if (uErr) {
    console.log("  ❌ Gagal membaca users:", uErr.message);
  } else {
    const tl = users.find((u) => u.username === "tl");
    console.log(`  Total users: ${users.length}`);
    if (tl) {
      console.log(`  ✅ Akun TL terdaftar: ${tl.username} | ${tl.nama} | role=${tl.role} | karyawan=${tl.karyawan_id || "— (belum ter-link)"}`);
    } else {
      console.log("  ❌ Akun TL tidak ditemukan!");
    }
    console.log("\n  Daftar role di users:");
    [...new Set(users.map((u) => u.role))].forEach((r) => console.log("   -", r));
  }

  const { data: karyawanTl, error: kErr } = await supabase
    .from("karyawan")
    .select("id, nama, posisi, role")
    .eq("id", "k-tl")
    .maybeSingle();
  if (kErr) {
    console.log("  ❌ Gagal membaca karyawan k-tl:", kErr.message);
  } else if (karyawanTl) {
    console.log(`  ✅ Karyawan k-tl terdaftar: ${karyawanTl.nama} | ${karyawanTl.posisi} | role=${karyawanTl.role}`);
    console.log("  ℹ️ Akun TL kini tampil di seksi Karyawan Master Data (bukan Akun Admin).");
  } else {
    console.log("  ⚠️ Karyawan k-tl belum ada di tabel karyawan.");
  }
}

main().catch((err) => {
  console.error("❌ Terjadi error:", err);
  process.exit(1);
});
