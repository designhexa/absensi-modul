/**
 * DIAGNOSA: Abon terhitung "terjual" padahal seharusnya retur/OH.
 * Membandingkan distribusi (permohonan_stok Disetujui) vs record penjualan (qty + sisa_gram)
 * per outlet+tanggal, serta mendeteksi duplikat / record tanpa variant.
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

async function main() {
  console.log(`=== ABON: DISTRIBUSI vs PENJUALAN (${cutoffISO} s/d hari ini) ===`);

  const { data: dists, error: e1 } = await supabase
    .from("permohonan_stok")
    .select("id, tanggal_kirim, outlet_id, qty, status, catatan")
    .eq("produk_id", "p-abon")
    .eq("status", "Disetujui")
    .gte("tanggal_kirim", cutoffISO)
    .order("tanggal_kirim", { ascending: false });

  const { data: sales, error: e2 } = await supabase
    .from("penjualan")
    .select("id, tanggal, outlet_id, produk_id, qty, sisa_gram, variant, harga")
    .eq("produk_id", "p-abon")
    .gte("tanggal", cutoffISO)
    .order("tanggal", { ascending: false });

  if (e1 || e2) {
    console.error("Query error:", e1?.message || e2?.message);
    return;
  }

  console.log(`Distribusi abon Disetujui: ${dists?.length ?? 0} record`);
  console.log(`Penjualan abon: ${sales?.length ?? 0} record`);
  console.log("");

  // Group dists per outlet+date
  const distMap = new Map<string, number>();
  dists?.forEach((d) => {
    const key = `${d.tanggal_kirim}|${d.outlet_id}`;
    distMap.set(key, (distMap.get(key) || 0) + d.qty);
  });

  // Group sales per outlet+date, split into with-sisaGram and without
  const saleGroups = new Map<string, { qty: number; sisa?: number; recs: any[] }>();
  sales?.forEach((s) => {
    const key = `${s.tanggal}|${s.outlet_id}`;
    const g = saleGroups.get(key) || { qty: 0, sisa: undefined, recs: [] };
    g.qty += s.qty;
    if (s.sisa_gram !== null && s.sisa_gram !== undefined) g.sisa = s.sisa_gram;
    g.recs.push(s);
    saleGroups.set(key, g);
  });

  const keys = new Set([...distMap.keys(), ...saleGroups.keys()]);
  const rows: any[] = [];
  keys.forEach((key) => {
    const [tanggal, outletId] = key.split("|");
    const dist = distMap.get(key) || 0;
    const g = saleGroups.get(key);
    const qty = g?.qty || 0;
    const sisa = g?.sisa;
    const sum = sisa !== undefined ? qty + sisa : qty;
    const ok = sisa === undefined ? "tanpa-OH" : sum === dist ? "OK" : sum > dist ? "⚠️ OVER" : "⚠️ KURANG";
    rows.push({ tanggal, outletId, dist, qty, sisa: sisa ?? "-", sum: sisa !== undefined ? sum : "-", ok, recCount: g?.recs.length || 0 });
  });

  rows.sort((a, b) => (a.tangjal || a.tanggal).localeCompare(b.tanggal || b.tangjal) || a.outletId.localeCompare(b.outletId));

  // header
  console.log("tanggal     | outlet             | dist | qty(terjual) | sisa(OH) | qty+sisa | status | #rec");
  console.log("------------|--------------------|------|--------------|----------|----------|--------|-----");
  rows.forEach((r) => {
    console.log(
      `${r.tanggal} | ${r.outletId.padEnd(18)} | ${String(r.dist).padEnd(4)} | ${String(r.qty).padEnd(12)} | ${String(r.sisa).padEnd(8)} | ${String(r.sum).padEnd(8)} | ${r.ok.padEnd(6)} | ${r.recCount}`
    );
  });

  // Detail duplicate records (more than 1 penjualan record for same outlet+date)
  console.log("\n=== DETAIL DUPLIKAT / MULTI-RECORD PER OUTLET+TANGGAL ===");
  let dupFound = false;
  saleGroups.forEach((g, key) => {
    if (g.recs.length > 1) {
      dupFound = true;
      console.log(`\n[${key}] ${g.recs.length} record:`);
      g.recs.forEach((r) => {
        console.log(`  id=${r.id} qty=${r.qty} sisa=${r.sisa_gram} variant=${r.variant ?? "-"} harga=${r.harga}`);
      });
    }
  });
  if (!dupFound) console.log("(tidak ada duplikat)");

  // Records tanpa variant (kemungkinan dibuat oleh saveStep5 auto-create admin)
  const noVariant = sales?.filter((s) => !s.variant);
  console.log(`\n=== RECORD ABON TANPA VARIANT (kemungkinan auto-create Step 5) ===`);
  if (noVariant && noVariant.length > 0) {
    noVariant.forEach((r) => {
      console.log(`  id=${r.id} tanggal=${r.tanggal} outlet=${r.outlet_id} qty=${r.qty} sisa=${r.sisa_gram}`);
    });
  } else {
    console.log("(tidak ada)");
  }

  // Ringkasan statistik
  console.log("\n=== RINGKASAN ===");
  const over = rows.filter((r) => r.ok === "⚠️ OVER");
  const kurang = rows.filter((r) => r.ok === "⚠️ KURANG");
  console.log(`Total kombinasi outlet+tanggal: ${rows.length}`);
  console.log(`qty+sisa > dist (OVER): ${over.length}`);
  console.log(`qty+sisa < dist (KURANG): ${kurang.length}`);
  over.forEach((r) => console.log(`  OVER: ${r.tanggal} ${r.outletId} dist=${r.dist} qty=${r.qty} sisa=${r.sisa} sum=${r.sum}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
