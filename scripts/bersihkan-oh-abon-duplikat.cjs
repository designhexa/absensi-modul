/**
 * bersihkan-oh-abon-duplikat.cjs
 * Hapus stok_movement 'OH abon dari ...' yang DUPLIKAT (data lama sebelum fix idempotensi).
 * Keep 1 movement per keterangan (outlet + tanggal), hapus sisanya.
 *
 * Cara pakai: node scripts/bersihkan-oh-abon-duplikat.cjs
 * Membaca kredensial dari .env (VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY).
 *
 * ⚠️ HANYA menghapus duplikat movement OH abon — TIDAK menyentuh data lain.
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
if (!supabaseUrl || !serviceKey) {
  console.error("Error: VITE_SUPABASE_URL atau VITE_SUPABASE_SERVICE_ROLE_KEY tidak ada di .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log("=== BERSIHKAN DUPLIKAT OH ABON ===\n");

  // 1. Ambil semua movement OH abon
  const { data: movs, error: qErr } = await supabase
    .from("stok_movement")
    .select("id, tanggal, bahan_id, tipe, qty, keterangan")
    .ilike("keterangan", "%OH abon%")
    .order("tanggal", { ascending: true });

  if (qErr) {
    console.error("❌ Gagal query stok_movement:", qErr.message);
    process.exit(1);
  }
  if (!movs || movs.length === 0) {
    console.log("ℹ️  Tidak ada movement OH abon ditemukan. Selesai.");
    return;
  }

  console.log(`Ditemukan ${movs.length} movement OH abon.\n`);

  // 2. Group by keterangan (outlet + tanggal)
  const groups = new Map();
  for (const m of movs) {
    const key = m.keterangan;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  let totalKept = 0;
  let totalDeleted = 0;

  for (const [keterangan, items] of groups) {
    if (items.length === 1) {
      console.log(`✅ ${items.length}x  ${keterangan}  (qty=${items[0].qty})`);
      totalKept += 1;
      continue;
    }
    // Duplikat: keep yang PERTAMA (paling lama), hapus sisanya
    const [keep, ...dupes] = items;
    console.log(`⚠️ GANDA x${items.length}: ${keterangan}`);
    console.log(`   Keep: ${keep.id} (qty=${keep.qty})`);
    for (const d of dupes) {
      const { error: delErr } = await supabase.from("stok_movement").delete().eq("id", d.id);
      if (delErr) {
        console.log(`   ❌ Gagal hapus ${d.id}: ${delErr.message}`);
      } else {
        console.log(`   🗑️  Hapus: ${d.id} (qty=${d.qty})`);
        totalDeleted += 1;
      }
    }
    totalKept += 1;
  }

  console.log(`\n=== SELESAI ===`);
  console.log(`Total movement tersisa: ${totalKept} (dari ${movs.length})`);
  console.log(`Total duplikat dihapus: ${totalDeleted}`);

  // 3. Verifikasi akhir
  const { data: after, error: vErr } = await supabase
    .from("stok_movement")
    .select("id, tanggal, bahan_id, tipe, qty, keterangan")
    .ilike("keterangan", "%OH abon%")
    .order("tanggal", { ascending: true });
  if (vErr) {
    console.error("❌ Gagal verifikasi:", vErr.message);
    return;
  }
  console.log("\n-- Verifikasi akhir --");
  for (const m of after || []) {
    console.log(`✅ ${m.keterangan}  (qty=${m.qty}, id=${m.id})`);
  }
}

main().catch((err) => {
  console.error("❌ Terjadi error:", err);
  process.exit(1);
});
