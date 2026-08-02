/**
 * Cek konsistensi utk produk berbasis cup/pcs (oatmeal, puding, abon):
 * sisa_gram menyimpan CUPS/PCS langsung (bukan gram), jadi qty + sisa = dist valid.
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

const CUP_PROD = ["p-oatmeal", "p-puding", "p-abon"];

async function main() {
  const { data: dists } = await supabase
    .from("permohonan_stok")
    .select("tanggal_kirim, outlet_id, produk_id, qty, status")
    .in("produk_id", CUP_PROD)
    .eq("status", "Disetujui")
    .gte("tanggal_kirim", cutoffISO);

  const { data: sales } = await supabase
    .from("penjualan")
    .select("id, tanggal, outlet_id, produk_id, qty, sisa_gram, variant")
    .in("produk_id", CUP_PROD)
    .gte("tanggal", cutoffISO);

  const distMap = new Map<string, number>();
  dists?.forEach((d) => {
    const k = `${d.outlet_id}|${d.tanggal_kirim}|${d.produk_id}`;
    distMap.set(k, (distMap.get(k) || 0) + d.qty);
  });

  const saleMap = new Map<string, { qty: number; sisa: number; recs: any[] }>();
  sales?.forEach((s) => {
    const k = `${s.outlet_id}|${s.tanggal}|${s.produk_id}`;
    const g = saleMap.get(k) || { qty: 0, sisa: 0, recs: [] };
    g.qty += s.qty;
    if (s.sisa_gram !== null && s.sisa_gram !== undefined) g.sisa += s.sisa_gram;
    g.recs.push(s);
    saleMap.set(k, g);
  });

  console.log(`=== CUP/PCS ITEMS (${cutoffISO}+): qty+sisa vs dist ===`);
  let mismatch = 0;
  const keys = new Set([...distMap.keys(), ...saleMap.keys()]);
  keys.forEach((k) => {
    const [outletId, tanggal, produkId] = k.split("|");
    const dist = distMap.get(k) || 0;
    const g = saleMap.get(k);
    if (!g) return; // belum input — skip
    const sum = g.qty + g.sisa;
    if (sum !== dist) {
      mismatch++;
      console.log(
        `[${sum > dist ? "OVER" : "KURANG"}] ${tanggal} ${outletId.padEnd(18)} ${String(produkId).padEnd(10)} dist=${dist} qty=${g.qty} sisa=${g.sisa} sum=${sum}`
      );
      g.recs.forEach((r) => console.log(`    id=${r.id} qty=${r.qty} sisa=${r.sisa_gram} variant=${r.variant ?? "-"}`));
    }
  });
  console.log(`\nTotal inkonsistensi cup/pcs: ${mismatch}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
