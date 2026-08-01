/**
 * DIAGNOSTIK — Angka pasca produksi Bubur (varian D & I)
 *
 * READ-ONLY. Menampilkan:
 * 1. Distribusi (permohonan_stok Disetujui) untuk p-bubur beberapa hari terakhir
 * 2. Penjualan (penjualan) untuk p-bubur dengan qty, sisa_gram, variant
 * 3. Produksi (realisasi) untuk p-bubur
 *
 * Cara pakai:
 *   npx tsx scripts/diagnostik-bubur2.ts [jumlah_hari=5]
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Parse .env
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

const days = Number(process.argv[2] || 5);
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - days);
const cutoffISO = cutoff.toISOString().slice(0, 10);
console.log(`=== DIAGNOSTIK BUBUR (sejak ${cutoffISO}, ${days} hari) ===\n`);

async function main() {
  // 1. Distribusi p-bubur
  const { data: dists, error: err1 } = await supabase
    .from("permohonan_stok")
    .select("tanggal_kirim, outlet_id, qty, catatan, status")
    .eq("produk_id", "p-bubur")
    .gte("tanggal_kirim", cutoffISO)
    .order("tanggal_kirim", { ascending: false });

  if (err1) console.error("ERR permohonan_stok:", err1.message);
  console.log(`\n--- 1. DISTRIBUSI (permohonan_stok p-bubur, ${dists?.length || 0} record) ---`);
  (dists || []).forEach((r) => {
    console.log(`  ${r.tanggal_kirim} | ${r.outlet_id} | qty=${r.qty} | status=${r.status} | catatan="${r.catatan || ""}"`);
  });

  // 2. Penjualan p-bubur
  const { data: sales, error: err2 } = await supabase
    .from("penjualan")
    .select("tanggal, outlet_id, qty, harga, sisa_gram, variant")
    .eq("produk_id", "p-bubur")
    .gte("tanggal", cutoffISO)
    .order("tanggal", { ascending: false })
    .order("outlet_id");

  if (err2) console.error("ERR penjualan:", err2.message);
  console.log(`\n--- 2. PENJUALAN / SISA (penjualan p-bubur, ${sales?.length || 0} record) ---`);
  (sales || []).forEach((r) => {
    console.log(`  ${r.tanggal} | ${r.outlet_id} | qty(terjual)=${r.qty} | sisa_gram=${r.sisa_gram} | variant=${r.variant} | harga=${r.harga}`);
  });

  // 3. Produksi realisasi p-bubur
  const { data: prods, error: err3 } = await supabase
    .from("produksi")
    .select("tanggal, produk_id, qty_rencana, qty_realisasi")
    .eq("produk_id", "p-bubur")
    .gte("tanggal", cutoffISO)
    .order("tanggal", { ascending: false });

  if (err3) console.error("ERR produksi:", err3.message);
  console.log(`\n--- 3. PRODUKSI REALISASI (p-bubur, ${prods?.length || 0} record) ---`);
  (prods || []).forEach((r) => {
    console.log(`  ${r.tanggal} | rencana=${r.qty_rencana} | realisasi=${r.qty_realisasi}`);
  });

  // 4. Jurnal OUT-SALES (siklus ditutup?)
  const { data: jurnal, error: err4 } = await supabase
    .from("jurnal")
    .select("tanggal, ref, keterangan, jumlah")
    .eq("ref", "OUT-SALES")
    .gte("tanggal", cutoffISO)
    .order("tanggal", { ascending: false });

  if (err4) console.error("ERR jurnal:", err4.message);
  console.log(`\n--- 4. JURNAL OUT-SALES (siklus ditutup, ${jurnal?.length || 0} record) ---`);
  (jurnal || []).forEach((j) => {
    console.log(`  ${j.tanggal} | ${j.keterangan} | jumlah=${j.jumlah}`);
  });

  console.log("\n=== SELESAI ===");
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
