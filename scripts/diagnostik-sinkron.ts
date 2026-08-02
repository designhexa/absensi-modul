/**
 * DIAGNOSTIK SINKRONISASI — Laporan Penjualan (Sisa OH, Riwayat, Rekap)
 *
 * READ-ONLY. Membandingkan untuk setiap (tanggal, outlet, produk produksi):
 *   1. Distribusi  (permohonan_stok Disetujui) — qty & split D/I dari catatan
 *   2. Penjualan tersimpan (penjualan) — qty (terjual) & sisa_gram per variant
 *   3. Perhitungan Riwayat — stokAwal, sisaCups (floor gram/gramPerCup), terjual
 *
 * Menandai MISMATCH: qty tersimpan != dist - sisaCups (hitungan riwayat)
 * dan sisa_gram > dist * gramPerCup (sisa melebihi stok).
 *
 * Cara pakai:
 *   npx tsx scripts/diagnostik-sinkron.ts [jumlah_hari=14]
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

// Gramasi per cup — SAMA dengan Laporan.tsx
const GRAM_PER_CUP: Record<string, number> = {
  "p-bubur": 118,
  "p-nasitim": 108,
  "p-oatmeal": 100,
  "p-puding": 80,
  "p-abon": 10,
};
const PROD_IDS = ["p-bubur", "p-nasitim", "p-oatmeal", "p-puding", "p-abon"];
// Cup/pcs-based items: sisa_gram menyimpan jumlah cup/pcs, bukan gram
const CUP_ITEMS = new Set(["oatmeal", "puding", "abon"]);

const parseSplit = (catatan?: string | null) => {
  const match = catatan?.match(/D:(\d+),I:(\d+)/);
  if (match) return { d: Number(match[1]), i: Number(match[2]) };
  return { d: 0, i: 0 };
};

async function main() {
  const days = Number(process.argv[2] || 14);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  console.log(`=== DIAGNOSTIK SINKRONISASI (sejak ${cutoffISO}, ${days} hari) ===\n`);

  const { data: outlets } = await supabase.from("outlets").select("id, nama");
  const outletNames = new Map((outlets || []).map((o: any) => [o.id, o.nama]));

  const { data: dists, error: errD } = await supabase
    .from("permohonan_stok")
    .select("tanggal_kirim, outlet_id, produk_id, qty, status, catatan")
    .in("produk_id", PROD_IDS)
    .gte("tanggal_kirim", cutoffISO)
    .order("tanggal_kirim", { ascending: false });
  if (errD) console.error("ERR permohonan_stok:", errD.message);

  const { data: sales, error: errS } = await supabase
    .from("penjualan")
    .select("tanggal, outlet_id, produk_id, qty, sisa_gram, variant")
    .in("produk_id", PROD_IDS)
    .gte("tanggal", cutoffISO)
    .order("tanggal", { ascending: false });
  if (errS) console.error("ERR penjualan:", errS.message);

  const approved = (dists || []).filter((r: any) => r.status === "Disetujui");
  const salesList = sales || [];

  console.log(`Distribusi disetujui: ${approved.length} record | Penjualan: ${salesList.length} record\n`);

  // ===== 1. Ringkasan per (tanggal, outlet, produk) =====
  const byKey = new Map<string, any>();
  approved.forEach((r: any) => {
    const key = `${r.tanggal_kirim}|${r.outlet_id}|${r.produk_id}`;
    if (!byKey.has(key)) byKey.set(key, { tanggal: r.tanggal_kirim, outletId: r.outlet_id, produkId: r.produk_id, distQty: 0, splits: [] });
    const rec = byKey.get(key);
    rec.distQty += r.qty;
    const s = parseSplit(r.catatan);
    rec.splits.push(s);
  });

  const mismatchRows: string[] = [];
  let mismatchCount = 0;

  for (const [key, rec] of byKey) {
    const [tanggal, outletId, produkId] = key.split("|");
    const gpc = GRAM_PER_CUP[produkId] || 118;
    const recSales = salesList.filter((p: any) => p.tanggal === tanggal && p.outletId === outletId && p.produkId === produkId);

    // Distribusi per variant (D/I split atau qty penuh)
    const distByVariant = new Map<string, number>();
    rec.splits.forEach((s: any) => {
      const base = produkId === "p-bubur" ? "bubur" : produkId === "p-nasitim" ? "tim" : produkId;
      if (produkId === "p-bubur" || produkId === "p-nasitim") {
        distByVariant.set(`${base}_d`, (distByVariant.get(`${base}_d`) || 0) + s.d);
        distByVariant.set(`${base}_i`, (distByVariant.get(`${base}_i`) || 0) + s.i);
      } else {
        distByVariant.set(base, (distByVariant.get(base) || 0) + rec.distQty);
      }
    });

    // Penjualan tersimpan per variant
    const soldByVariant = new Map<string, number>();
    const sisaByVariant = new Map<string, number>();
    recSales.forEach((p: any) => {
      const v = p.variant || (produkId === "p-bubur" ? "bubur_d" : produkId === "p-nasitim" ? "tim_d" : produkId);
      soldByVariant.set(v, (soldByVariant.get(v) || 0) + p.qty);
      if (p.sisa_gram !== null && p.sisa_gram !== undefined) {
        sisaByVariant.set(v, p.sisa_gram);
      }
    });

    for (const [variant, distQty] of distByVariant) {
      const soldStored = soldByVariant.get(variant) ?? 0;
      const sisaGram = sisaByVariant.get(variant);
      let sisaCups: number;
      if (sisaGram === undefined) {
        sisaCups = Math.max(0, distQty - soldStored);
      } else if (CUP_ITEMS.has(variant)) {
        sisaCups = sisaGram; // cup/pcs disimpan langsung
      } else {
        sisaCups = Math.floor(sisaGram / gpc);
      }
      const soldRiwayat = Math.max(0, distQty - Math.min(sisaCups, distQty));

      const problems: string[] = [];
      if (soldStored !== soldRiwayat) {
        problems.push(`TERJUAL mismatch: stored=${soldStored} vs riwayat=${soldRiwayat}`);
      }
      if (sisaGram !== undefined && !CUP_ITEMS.has(variant) && sisaGram > distQty * gpc) {
        problems.push(`SISA > stok: sisa=${sisaGram}g max=${distQty * gpc}g`);
      }
      if (CUP_ITEMS.has(variant) && sisaGram !== undefined && sisaGram > distQty) {
        problems.push(`SISA > stok: sisa=${sisaGram}${variant === "abon" ? "pcs" : "cup"} max=${distQty}`);
      }
      if (problems.length > 0) {
        mismatchCount++;
        mismatchRows.push(
          `  [MISMATCH] ${tanggal} | ${outletNames.get(outletId) || outletId} | ${produkId} (${variant}) | dist=${distQty} | stored(qty,sisa)=(${soldStored},${sisaGram ?? "-"}) | sisaCups=${sisaCups} | ${problems.join("; ")}`
        );
      }
    }
  }

  console.log(`===== MISMATCH (${mismatchCount} baris variant) =====`);
  mismatchRows.forEach((r) => console.log(r));
  if (mismatchRows.length === 0) console.log("  (tidak ada mismatch) ✓");

  // ===== 2. Distribusi TANPA penjualan sama sekali (outlet belum input) =====
  console.log(`\n===== DISTRIBUSI TANPA RECORD PENJUALAN (outlet belum input OH) =====`);
  let noSale = 0;
  for (const [key, rec] of byKey) {
    const [tanggal, outletId, produkId] = key.split("|");
    const recSales = salesList.filter((p: any) => p.tanggal === tanggal && p.outletId === outletId && p.produkId === produkId);
    if (recSales.length === 0) {
      noSale++;
      console.log(`  ${tanggal} | ${outletNames.get(outletId) || outletId} | ${produkId} (dist=${rec.distQty}) — BELUM INPUT`);
    }
  }
  if (noSale === 0) console.log("  (semua distribusi sudah ada penjualan) ✓");

  // ===== 3. Penjualan TANPA distribusi disetujui (yatim/piatu) =====
  console.log(`\n===== PENJUALAN TANPA DISTRIBUSI DISETUJUI (rekap menghitung, riwayat tidak) =====`);
  let orphan = 0;
  const distKeys = new Set(approved.map((r: any) => `${r.tanggal_kirim}|${r.outlet_id}|${r.produk_id}`));
  for (const p of salesList) {
    const key = `${p.tanggal}|${p.outlet_id}|${p.produk_id}`;
    if (!distKeys.has(key)) {
      orphan++;
      console.log(`  ${p.tanggal} | ${outletNames.get(p.outlet_id) || p.outlet_id} | ${p.produk_id} | qty=${p.qty} sisa=${p.sisa_gram} variant=${p.variant}`);
    }
  }
  if (orphan === 0) console.log("  (tidak ada penjualan yatim) ✓");

  // ===== 4. Ringkasan agregat =====
  console.log(`\n===== RINGKASAN AGREGAT (14 hari) =====`);
  const prodNames: Record<string, string> = { "p-bubur": "Bubur", "p-nasitim": "Nasi Tim", "p-oatmeal": "Oatmeal", "p-puding": "Puding", "p-abon": "Abon" };
  for (const pid of PROD_IDS) {
    const totalDist = approved.filter((r: any) => r.produk_id === pid).reduce((s, r: any) => s + r.qty, 0);
    const totalSold = salesList.filter((p: any) => p.produk_id === pid).reduce((s, p: any) => s + p.qty, 0);
    const oh = Math.max(0, totalDist - totalSold);
    const pct = totalDist > 0 ? ((oh / totalDist) * 100).toFixed(2) : "0";
    console.log(`  ${prodNames[pid]}: dist=${totalDist} terjual=${totalSold} OH=${oh} (${pct}%)`);
  }

  console.log("\n=== SELESAI ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
