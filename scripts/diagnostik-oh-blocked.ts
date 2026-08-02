/**
 * DIAGNOSTIK — Mengapa outlet tidak bisa mengisi OH padahal distribusi sudah disimpan?
 *
 * READ-ONLY. Memeriksa semua kondisi yang memblokir input OH di tab "Sisa (OH)" Laporan:
 *   1. permohonan_stok: status harus "Disetujui", tanggal_kirim cocok, produk_id produk produksi
 *   2. users: role=outlet → outlet_id harus terpetakan & cocok dengan record distribusi
 *   3. jurnal: ref=OUT-SALES untuk tanggal tsb → siklus ditutup (input diblokir)
 *   4. penjualan: apakah outlet sudah pernah input OH untuk tanggal tsb
 *
 * Cara pakai:
 *   npx tsx scripts/diagnostik-oh-blocked.ts [jumlah_hari=7]
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

const PROD_IDS = ["p-bubur", "p-nasitim", "p-oatmeal", "p-puding", "p-abon"];

const todayLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

async function main() {
  const days = Number(process.argv[2] || 7);
  const today = todayLocal();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffISO = new Date(cutoff.getTime() - cutoff.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
  const now = new Date();
  const nowStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  console.log(`=== DIAGNOSTIK OH BLOCKED (${cutoffISO} .. ${today}, sekarang ${nowStr}) ===\n`);

  // ---- 1. Outlets ----
  const { data: outlets } = await supabase.from("outlets").select("id, nama");
  const outletNames = new Map((outlets || []).map((o: any) => [o.id, o.nama]));

  // ---- 2. Users role=outlet ----
  const { data: users } = await supabase
    .from("users")
    .select("username, nama, role, outlet_id");
  const outletUsers = (users || []).filter((u: any) => u.role === "outlet");
  console.log(`--- User role=outlet (${outletUsers.length}) ---`);
  outletUsers.forEach((u: any) => {
    const on = u.outlet_id ? outletNames.get(u.outlet_id) : "(TIDAK ADA outlet_id!)";
    console.log(`  @${u.username} (${u.nama || "-"}) → outlet_id=${u.outlet_id || "❌ NULL"} = ${on || "❌ tidak cocok outlet mana pun"}`);
  });

  // ---- 3. Distribusi (permohonan_stok) ----
  const { data: dists } = await supabase
    .from("permohonan_stok")
    .select("tanggal_kirim, outlet_id, produk_id, qty, status, catatan")
    .gte("tanggal_kirim", cutoffISO)
    .order("tanggal_kirim", { ascending: false });
  const distsProd = (dists || []).filter((d: any) => PROD_IDS.includes(d.produk_id));
  console.log(`\n--- Distribusi permohonan_stok produk produksi sejak ${cutoffISO} (${distsProd.length} record) ---`);
  if (distsProd.length === 0) {
    console.log("  ⚠️ TIDAK ADA record distribusi produk produksi dalam rentang ini!");
  }
  distsProd.forEach((d: any) => {
    const statusOk = d.status === "Disetujui" ? "✅ Disetujui" : `❌ ${d.status}`;
    const on = outletNames.get(d.outlet_id) || "?";
    console.log(`  ${d.tanggal_kirim} | ${on} (${d.outlet_id}) | ${d.produk_id} | qty=${d.qty} | ${statusOk} | catatan="${(d.catatan || "").slice(0, 40)}"`);
  });

  // ---- 4. Distribusi ber-status Pending (potensi penyebab) ----
  const pending = (dists || []).filter((d: any) => d.status !== "Disetujui");
  if (pending.length > 0) {
    console.log(`\n⚠️ ${pending.length} record distribusi BELUM ber-status Disetujui (outlet tidak akan melihatnya di form OH):`);
    pending.forEach((d: any) => {
      const on = outletNames.get(d.outlet_id) || "?";
      console.log(`  ${d.tanggal_kirim} | ${on} (${d.outlet_id}) | ${d.produk_id} | status=${d.status}`);
    });
  }

  // ---- 5. Jurnal OUT-SALES (siklus ditutup = input diblokir) ----
  const { data: jurnals } = await supabase
    .from("jurnal")
    .select("tanggal, ref")
    .eq("ref", "OUT-SALES")
    .gte("tanggal", cutoffISO);
  const closedDates = new Set((jurnals || []).map((j: any) => j.tanggal));
  console.log(`\n--- Jurnal OUT-SALES (siklus ditutup) sejak ${cutoffISO} (${closedDates.size} tanggal) ---`);
  if (closedDates.size > 0) {
    console.log(`  ${Array.from(closedDates).sort().join(", ")}`);
  } else {
    console.log("  (tidak ada)");
  }

  // ---- 6. Penjualan (OH sudah diinput outlet) ----
  const { data: penjualan } = await supabase
    .from("penjualan")
    .select("tanggal, outlet_id, produk_id, qty, sisa_gram, variant")
    .gte("tanggal", cutoffISO)
    .order("tanggal", { ascending: false });
  const salesProd = (penjualan || []).filter((p: any) => PROD_IDS.includes(p.produk_id));
  const inputByOutletDate = new Map<string, number>();
  salesProd.forEach((p: any) => {
    const key = `${p.tanggal}|${p.outlet_id}`;
    inputByOutletDate.set(key, (inputByOutletDate.get(key) || 0) + 1);
  });
  console.log(`\n--- Penjualan / input OH sejak ${cutoffISO} (${salesProd.length} record) ---`);
  if (salesProd.length === 0) {
    console.log("  (belum ada)");
  }
  Array.from(inputByOutletDate.entries()).sort().forEach(([key, cnt]) => {
    const [tgl, oid] = key.split("|");
    const on = outletNames.get(oid) || "?";
    console.log(`  ${tgl} | ${on} (${oid}) | ${cnt} record`);
  });

  // ---- 7. SINTESIS per outlet per tanggal terakhir (hari ini & kemarin) ----
  console.log(`\n--- SINTESIS: bisakah outlet input OH hari ini/kemarin? ---`);
  const checkDates = [today, new Date(new Date().getTime() - 86400000).toISOString().slice(0, 10)];
  outletUsers.forEach((u: any) => {
    const oid = u.outlet_id;
    if (!oid) {
      console.log(`  @${u.username}: ❌ user ini TIDAK punya outlet_id → form OH outlet tidak akan menampilkan distribusi apa pun!`);
      return;
    }
    checkDates.forEach((tgl) => {
      const hasDist = (distsProd || []).some((d: any) => d.outlet_id === oid && d.tanggal_kirim === tgl && d.status === "Disetujui");
      const hasDistAnyStatus = (dists || []).some((d: any) => d.outlet_id === oid && d.tanggal_kirim === tgl);
      const closed = closedDates.has(tgl);
      const hasInput = inputByOutletDate.has(`${tgl}|${oid}`);
      const parts: string[] = [];
      parts.push(hasDist ? "✅ ada distribusi Disetujui" : hasDistAnyStatus ? "⚠️ ada distribusi TAPI status belum Disetujui" : "❌ TIDAK ada distribusi");
      if (closed) parts.push("🔒 siklus DITUTUP (OUT-SALES)");
      if (hasInput) parts.push("✅ sudah input OH");
      if (tgl === today) parts.push(`(hari ini, jam ${nowStr})`);
      console.log(`  @${u.username} (${outletNames.get(oid)}) ${tgl}: ${parts.join(" | ")}`);
    });
  });

  console.log("\nSelesai. Semua query read-only.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
