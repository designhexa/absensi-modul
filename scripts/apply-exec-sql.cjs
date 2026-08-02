/**
 * apply-exec-sql.cjs
 * Bootstrap fungsi exec_sql di database Supabase (migration 20260627000009).
 *
 * Fungsi exec_sql memungkinkan run-migration.ts menjalankan migrasi .sql otomatis
 * via RPC (supabase.rpc("exec_sql", { sql_text })). Tanpa fungsi ini, semua
 * migrasi harus dijalankan manual di SQL Editor.
 *
 * Cara pakai: node scripts/apply-exec-sql.cjs
 *
 * Kredensial dibaca dari .env:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_SERVICE_ROLE_KEY
 *   (opsional) SUPABASE_ACCESS_TOKEN  → PAT Management API, jalankan DDL otomatis
 *
 * Alur:
 *   1. Probe: apakah exec_sql sudah ada? (rpc SELECT 1)
 *   2. Belum ada + SUPABASE_ACCESS_TOKEN ada  → buat via Management API.
 *   3. Belum ada + tanpa token                → cetak SQL untuk dijalankan manual
 *      di Supabase Dashboard → SQL Editor, lalu jalankan script ini lagi.
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

// --- Bootstrap SQL (20260627000009_create_exec_sql_function.sql) ---
const BOOTSTRAP_SQL = fs.readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/20260627000009_create_exec_sql_function.sql"),
  "utf-8"
);

/** Cek apakah exec_sql sudah tersedia. */
async function execSqlExists() {
  try {
    const { error } = await supabase.rpc("exec_sql", { sql_text: "SELECT 1" });
    return !error;
  } catch {
    return false;
  }
}

/** Jalankan DDL via Supabase Management API (butuh PAT). */
async function execViaManagementApi(sql) {
  if (!accessToken) return { ok: false, error: "no token" };
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
      return { ok: true, result: text.slice(0, 300) };
    }
    return { ok: false, error: (await resp.text()).slice(0, 500) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function main() {
  console.log("Supabase URL:", supabaseUrl);
  console.log("Project ref:", projectRef);

  // --- Step 1: Probe ---
  console.log("\n▶ Mengecek apakah fungsi exec_sql sudah ada ...");
  if (await execSqlExists()) {
    console.log("  ✅ exec_sql sudah tersedia — run-migration.ts bisa jalan otomatis.");
    return;
  }
  console.log("  ⚠️ exec_sql belum ada.");

  // --- Step 2: Coba via Management API (jika ada PAT) ---
  if (accessToken) {
    console.log("\n▶ Mencoba membuat exec_sql via Management API (SUPABASE_ACCESS_TOKEN ada) ...");
    const res = await execViaManagementApi(BOOTSTRAP_SQL);
    if (res.ok) {
      console.log("  ✅ exec_sql berhasil dibuat via Management API.");
      if (await execSqlExists()) {
        console.log("  ✅ Verifikasi: exec_sql aktif — run-migration.ts siap dipakai.");
      }
      return;
    }
    console.log("  ❌ Management API gagal:", String(res.error));
    console.log("     (Periksa apakah SUPABASE_ACCESS_TOKEN valid & punya akses ke project ini.)");
  } else {
    console.log("\n  ℹ️ SUPABASE_ACCESS_TOKEN tidak ada di .env — tidak bisa buat otomatis via API.");
  }

  // --- Step 3: Cetak SQL untuk manual ---
  console.log("\n🔐 Jalankan SQL berikut SATU KALI di Supabase Dashboard → SQL Editor:");
  console.log("   " + dashboardSqlUrl);
  console.log("  ===========================================================");
  console.log(BOOTSTRAP_SQL);
  console.log("  ===========================================================");
  console.log("\n  Lalu jalankan script ini lagi untuk verifikasi:");
  console.log("     node scripts/apply-exec-sql.cjs");
  console.log("  (Atau set SUPABASE_ACCESS_TOKEN=... di .env agar otomatis.)");
}

main().catch((err) => {
  console.error("❌ Terjadi error:", err);
  process.exit(1);
});
