/**
 * HAPUS DATA SEBELUM TANGGAL TERTENTU — bersihkan data lama agar perhitungan
 * hanya dimulai dari tanggal cutoff (default: 2026-08-01).
 *
 * Tabel yang dibersihkan (hanya record dgn tanggal < cutoff):
 *   penjualan, stok_movement, produksi, permohonan_stok, jurnal, absensi
 *
 * PERINGATAN: ini MENGHAPUS data permanen dari database. Jalankan tanpa --apply
 * untuk melihat jumlah record yang akan dihapus terlebih dahulu.
 *
 * Cara pakai:
 *   npx tsx scripts/hapus-data-sebelum-tanggal.ts                 # dry-run, cutoff 2026-08-01
 *   npx tsx scripts/hapus-data-sebelum-tanggal.ts --before=2026-08-01
 *   npx tsx scripts/hapus-data-sebelum-tanggal.ts --apply          # benar-benar menghapus
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  console.error("Error: .env file not found at", envPath);
  process.exit(1);
}
const envContent = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"')
      value = value.substring(1, value.length - 1);
    else if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'")
      value = value.substring(1, value.length - 1);
    env[match[1]] = value;
  }
});

const supabaseUrl = env["VITE_SUPABASE_URL"];
const supabaseKey = env["VITE_SUPABASE_SERVICE_ROLE_KEY"] || env["VITE_SUPABASE_ANON_KEY"];
if (!supabaseUrl || !supabaseKey) {
  console.error("❌ VITE_SUPABASE_URL dan Service Role / Anon Key harus di-set di .env");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Kolom tanggal per tabel
const TABLES: { table: string; col: string }[] = [
  { table: "penjualan", col: "tanggal" },
  { table: "stok_movement", col: "tanggal" },
  { table: "produksi", col: "tanggal" },
  { table: "permohonan_stok", col: "tanggal_kirim" },
  { table: "jurnal", col: "tanggal" },
  { table: "absensi", col: "tanggal" },
];

async function main() {
  const args = process.argv.slice(2);
  const APPLY = args.includes("--apply");
  const beforeArg = args.find((a) => a.startsWith("--before="));
  const CUTOFF = beforeArg ? beforeArg.split("=")[1] : "2026-08-01";

  console.log(`=== HAPUS DATA SEBELUM ${CUTOFF} ===`);
  console.log(`Mode: ${APPLY ? "✅ MENGHAPUS (--apply)" : "🔍 DRY-RUN (hanya laporan, tidak menghapus)"}\n`);

  let totalToDelete = 0;
  const results: { table: string; count: number }[] = [];

  for (const t of TABLES) {
    const { count, error } = await supabase
      .from(t.table)
      .select("*", { count: "exact", head: true })
      .lt(t.col, CUTOFF);
    if (error) {
      console.error(`  ❌ ${t.table}: ${error.message}`);
      continue;
    }
    results.push({ table: t.table, count: count || 0 });
    totalToDelete += count || 0;
    console.log(`  ${t.table}.${t.col} < ${CUTOFF}: ${count} record`);
  }

  console.log(`\nTOTAL yang akan dihapus: ${totalToDelete} record`);

  if (totalToDelete === 0) {
    console.log("\n👉 Tidak ada data sebelum " + CUTOFF + " — tidak ada yang perlu dihapus. Perhitungan memang sudah dimulai dari " + CUTOFF + ".");
    return;
  }

  if (!APPLY) {
    console.log("\n👉 Jalankan dengan --apply untuk benar-benar menghapus.");
    return;
  }

  // Eksekusi penghapusan — urutan: transaksi anak dulu, induk terakhir
  const order = [...TABLES].reverse(); // absensi, jurnal, permohonan_stok, produksi, stok_movement, penjualan
  for (const t of order) {
    const r = results.find((x) => x.table === t.table);
    if (!r || r.count === 0) continue;
    const { error } = await supabase.from(t.table).delete().lt(t.col, CUTOFF);
    if (error) console.error(`  ❌ Gagal hapus ${t.table}: ${error.message}`);
    else console.log(`  ✅ ${t.table}: ${r.count} record dihapus`);
  }
  console.log("\n✅ Selesai. Data sebelum " + CUTOFF + " telah dihapus.");
}

main().catch((e) => { console.error(e); process.exit(1); });
