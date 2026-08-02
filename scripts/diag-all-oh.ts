/**
 * Scan 14 hari SEMUA produk: cari outlet+tanggal+produk di mana
 * qty(terjual)+sisa(OH) != distribusi Disetujui (konsistensi rusak).
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const c = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
c.split(/\r?\n/).forEach((l) => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || "").replace(/^["']|["']$/g, "");
});
const supabase = createClient(
  env["VITE_SUPABASE_URL"],
  env["VITE_SUPABASE_SERVICE_ROLE_KEY"] || env["VITE_SUPABASE_ANON_KEY"]
);

const days = Number(process.argv[2] || 14);
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - days);
const cutoffISO = new Date(cutoff.getTime() - cutoff.getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 10);

const PROD_IDS = ["p-bubur", "p-nasitim", "p-oatmeal", "p-puding", "p-abon"];

async function main() {
  const { data: dists } = await supabase
    .from("permohonan_stok")
    .select("id, tanggal_kirim, outlet_id, produk_id, qty, status, catatan")
    .in("produk_id", PROD_IDS)
    .eq("status", "Disetujui")
    .gte("tanggal_kirim", cutoffISO);

  const { data: sales } = await supabase
    .from("penjualan")
    .select("id, tanggal, outlet_id, produk_id, qty, sisa_gram, variant")
    .in("produk_id", PROD_IDS)
    .gte("tanggal", cutoffISO);

  console.log(`=== SCAN ${cutoffISO} s/d hari ini — konsistensi qty+sisa vs dist ===`);

  // dist per outlet|tanggal|produk
  const distMap = new Map<string, number>();
  dists?.forEach((d) => {
    const k = `${d.outlet_id}|${d.tanggal_kirim}|${d.produk_id}`;
    distMap.set(k, (distMap.get(k) || 0) + d.qty);
  });

  // sales per outlet|tanggal|produk (all variants)
  const saleMap = new Map<string, { qty: number; sisa: number; variantCount: number; recs: any[] }>();
  sales?.forEach((s) => {
    const k = `${s.outlet_id}|${s.tanggal}|${s.produk_id}`;
    const g = saleMap.get(k) || { qty: 0, sisa: 0, variantCount: 0, recs: [] };
    g.qty += s.qty;
    if (s.sisa_gram !== null && s.sisa_gram !== undefined) g.sisa += s.sisa_gram;
    if (s.variant) g.variantCount++;
    g.recs.push(s);
    saleMap.set(k, g);
  });

  let mismatch = 0;
  const keys = new Set([...distMap.keys(), ...saleMap.keys()]);
  keys.forEach((k) => {
    const [outletId, tanggal, produkId] = k.split("|");
    const dist = distMap.get(k) || 0;
    const g = saleMap.get(k);
    if (!g) {
      // Ada distribusi tapi TIDAK ada penjualan (outlet belum input)
      console.log(`[BELUM INPUT] ${tanggal} ${outletId.padEnd(18)} ${String(produkId).padEnd(12)} dist=${dist} → tanpa record penjualan`);
      return;
    }
    const sum = g.qty + g.sisa;
    const diff = sum - dist;
    if (diff !== 0) {
      mismatch++;
      const hasVariant = g.variantCount === g.recs.length && g.variantCount > 0;
      console.log(
        `[${diff > 0 ? "OVER" : "KURANG"} ${diff > 0 ? "+" : ""}${diff}] ${tanggal} ${outletId.padEnd(18)} ${String(produkId).padEnd(12)} dist=${dist} qty=${g.qty} sisa=${g.sisa} sum=${sum} variant=${hasVariant ? "ya" : "TIDAK!"} recs=${g.recs.length}`
      );
    }
  });

  console.log(`\nTotal ketidaksesuaian (qty+sisa != dist): ${mismatch}`);
  console.log("Catatan: 'BELUM INPUT' = outlet belum input OH (normal, tidak dihitung di OH%).");
}

main().catch((e) => { console.error(e); process.exit(1); });
