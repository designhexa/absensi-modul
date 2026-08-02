/**
 * Verifikasi akar masalah: o-gunung-gangsir 2026-08-01 abon
 * qty(terjual)=2 + sisa(OH)=3 = 5, padahal distribusi Disetujui = 4.
 * Cek semua record permohonan_stok (semua status) utk outlet+produk+periode,
 * dan bandingkan pola qty+sisa vs distribusi utk SEMUA produk (bukan cuma abon).
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

async function main() {
  console.log("=== PERMOHONAN_STOK o-gunung-gangsir (semua status, 07-30 s/d 08-03) ===");
  const { data: dists, error: e1 } = await supabase
    .from("permohonan_stok")
    .select("id, tanggal_kirim, produk_id, qty, status, catatan")
    .eq("outlet_id", "o-gunung-gangsir")
    .gte("tanggal_kirim", "2026-07-30")
    .lte("tanggal_kirim", "2026-08-03")
    .order("tanggal_kirim", { ascending: false });

  if (e1) { console.error("Err:", e1.message); return; }
  dists?.forEach((d) => {
    console.log(
      `${d.tanggal_kirim} | ${String(d.produk_id).padEnd(12)} | qty=${String(d.qty).padEnd(3)} | ${String(d.status).padEnd(10)} | ${d.catatan ?? "-"} | ${d.id}`
    );
  });

  console.log("\n=== PENJUALAN o-gunung-gangsir (07-30 s/d 08-03, SEMUA produk) ===");
  const { data: sales, error: e2 } = await supabase
    .from("penjualan")
    .select("id, tanggal, produk_id, qty, sisa_gram, variant, harga")
    .eq("outlet_id", "o-gunung-gangsir")
    .gte("tanggal", "2026-07-30")
    .lte("tanggal", "2026-08-03")
    .order("tanggal", { ascending: false });
  if (e2) { console.error("Err:", e2.message); return; }
  sales?.forEach((s) => {
    console.log(
      `${s.tanggal} | ${String(s.produk_id).padEnd(12)} | qty=${String(s.qty).padEnd(3)} | sisa=${String(s.sisa_gram).padEnd(5)} | variant=${s.variant ?? "-"} | harga=${s.harga} | ${s.id}`
    );
  });

  // Cek pola di SEMUA outlet: produk apa saja yang qty+sisa != dist
  console.log("\n=== SEMUA outlet: perbandingan dist vs qty+sisa per produk (08-01) ===");
  const { data: dists2 } = await supabase
    .from("permohonan_stok")
    .select("tanggal_kirim, outlet_id, produk_id, qty, status")
    .eq("tanggal_kirim", "2026-08-01")
    .eq("status", "Disetujui");
  const { data: sales2 } = await supabase
    .from("penjualan")
    .select("tanggal, outlet_id, produk_id, qty, sisa_gram, variant")
    .eq("tanggal", "2026-08-01");

  const distMap = new Map<string, number>();
  dists2?.forEach((d) => {
    const k = `${d.outlet_id}|${d.produk_id}`;
    distMap.set(k, (distMap.get(k) || 0) + d.qty);
  });
  const saleMap = new Map<string, { qty: number; sisa: number; recs: any[] }>();
  sales2?.forEach((s) => {
    const k = `${s.outlet_id}|${s.produk_id}`;
    const g = saleMap.get(k) || { qty: 0, sisa: 0, recs: [] };
    g.qty += s.qty;
    if (s.sisa_gram != null) g.sisa += s.sisa_gram;
    g.recs.push(s);
    saleMap.set(k, g);
  });

  const keys = new Set([...distMap.keys(), ...saleMap.keys()]);
  keys.forEach((k) => {
    const [outletId, produkId] = k.split("|");
    const dist = distMap.get(k) || 0;
    const g = saleMap.get(k);
    const sum = g ? g.qty + g.sisa : 0;
    const status = !g ? "no-sale" : g.recs.some((r) => !r.variant) ? "no-variant!" : "ok";
    if (!g || sum !== dist) {
      console.log(
        `${outletId.padEnd(18)} | ${String(produkId).padEnd(12)} | dist=${String(dist).padEnd(3)} | qty=${String(g?.qty ?? 0).padEnd(3)} | sisa=${String(g?.sisa ?? 0).padEnd(3)} | sum=${sum} | ${status}`
      );
    }
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
