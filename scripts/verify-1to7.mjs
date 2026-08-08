// Script verifikasi sementara: snapshot / status / check / restore DB untuk tanggal uji 08-01.
// Dipakai untuk uji "input ulang penjualan → cek DB penjualan, jurnal, stok terupdate otomatis".
// USAGE: node scripts/verify-1to7.mjs <status|snapshot|gangsir|jurnal-stok|restore>
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf-8")
    .split(/\r?\n/)
    .map((l) => {
      const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      return m ? [m[1], (m[2] || "").replace(/^['"]|['"]$/g, "")] : null;
    })
    .filter(Boolean)
);
const sb = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY
);
const DATE = "2026-08-01";
const SNAP = "scripts/verify-snapshot-0801.json";

async function status() {
  const { data: pen } = await sb.from("penjualan").select("tanggal");
  const dates = [...new Set((pen || []).map((p) => p.tanggal))].sort();
  const { data: js } = await sb.from("jurnal").select("tanggal, ref, jumlah").order("tanggal");
  const closed = new Set((js || []).filter((j) => j.ref === "OUT-SALES").map((j) => j.tanggal));
  console.log("=== STATUS SIKLUS ===");
  dates.forEach((d) => console.log(" ", d, closed.has(d) ? "TERTUTUP" : "terbuka"));
  const { count } = await sb.from("jurnal").select("*", { count: "exact", head: true });
  console.log("Jurnal total:", count, "| OUT-SALES:", (js || []).filter((j) => j.ref === "OUT-SALES").length);
}

async function snapshot() {
  const { data: pen } = await sb
    .from("penjualan").select("*").eq("tanggal", DATE).order("outlet_id").order("produk_id");
  const { data: sm } = await sb
    .from("stok_movement").select("*").eq("tanggal", DATE).order("keterangan");
  const { data: js } = await sb.from("jurnal").select("*").eq("tanggal", DATE).order("id");
  fs.writeFileSync(SNAP, JSON.stringify({ pen: pen || [], sm: sm || [], js: js || [] }, null, 2));
  console.log(`SNAPSHOT ${DATE}: ${(pen || []).length} penjualan, ${(sm || []).length} stok_movement, ${(js || []).length} jurnal -> ${SNAP}`);
  console.log("=== PENJUALAN (ringkas) ===");
  (pen || []).forEach((p) =>
    console.log(" ", p.outlet_id, "|", p.produk_id, "|", p.variant || "-", "| qty=" + p.qty, "| sisa=" + p.sisa_gram, "| harga=" + p.harga, "| id=" + p.id)
  );
}

async function gangsir() {
  const { data: p } = await sb
    .from("penjualan").select("id,outlet_id,produk_id,variant,qty,harga,sisa_gram")
    .eq("tanggal", DATE).eq("outlet_id", "o-gunung-gangsir").order("produk_id");
  console.log(`PENJUALAN GUNUNG GANGSIR ${DATE}:`);
  (p || []).forEach((x) =>
    console.log(" ", x.produk_id, "|", x.variant || "-", "| qty=" + x.qty, "| sisa=" + x.sisa_gram, "| harga=" + x.harga, "| id=" + x.id)
  );
  const { data: sm } = await sb
    .from("stok_movement").select("bahan_id,tipe,qty,keterangan")
    .eq("tanggal", DATE).eq("keterangan", `OH abon dari o-gunung-gangsir tanggal ${DATE}`);
  console.log("STOK OH ABON gangsir:", (sm || []).length, "record");
}

async function jurnalStok() {
  const { data: js } = await sb.from("jurnal").select("tanggal,ref,kode_akun,akun,jumlah,tipe").eq("tanggal", DATE).order("id");
  console.log(`=== JURNAL ${DATE} (${(js || []).length}) ===`);
  (js || []).forEach((j) => console.log(" ", j.ref, "|", j.kode_akun, "|", j.akun, "|", j.tipe, "|", Number(j.jumlah).toLocaleString()));
  const { data: sm } = await sb
    .from("stok_movement").select("bahan_id,tipe,qty,keterangan").eq("tanggal", DATE).order("keterangan");
  console.log(`=== STOK MOV ${DATE} (${(sm || []).length}) ===`);
  (sm || []).forEach((m) => console.log(" ", m.tipe, "|", m.bahan_id, "|", m.qty, "|", m.keterangan.slice(0, 70)));
}

async function restore() {
  if (!fs.existsSync(SNAP)) { console.log("Snapshot tidak ada:", SNAP); return; }
  const snap = JSON.parse(fs.readFileSync(SNAP, "utf-8"));
  for (const [table] of [["penjualan"], ["stok_movement"], ["jurnal"]]) {
    const { data: cur } = await sb.from(table).select("id").eq("tanggal", DATE);
    for (const r of cur || []) {
      const { error } = await sb.from(table).delete().eq("id", r.id);
      if (error) { console.log(`ERR delete ${table}:`, error.message); return; }
    }
  }
  let okP = 0, okS = 0, okJ = 0;
  for (const p of snap.pen || []) {
    const { id, created_at, ...rest } = p;
    const { error } = await sb.from("penjualan").insert(rest);
    if (error) { console.log("ERR insert penjualan:", error.message); return; }
    okP++;
  }
  for (const m of snap.sm || []) {
    const { id, created_at, ...rest } = m;
    const { error } = await sb.from("stok_movement").insert(rest);
    if (error) { console.log("ERR insert stok_movement:", error.message); return; }
    okS++;
  }
  for (const j of snap.js || []) {
    const { id, created_at, ...rest } = j;
    const { error } = await sb.from("jurnal").insert(rest);
    if (error) { console.log("ERR insert jurnal:", error.message); return; }
    okJ++;
  }
  console.log(`RESTORE ${DATE}: ${okP} penjualan + ${okS} stok_movement + ${okJ} jurnal dikembalikan persis snapshot`);
}

const cmd = process.argv[2];
if (cmd === "status") status();
else if (cmd === "snapshot") snapshot();
else if (cmd === "gangsir") gangsir();
else if (cmd === "jurnal-stok") jurnalStok();
else if (cmd === "restore") restore();
else console.log("usage: node scripts/verify-1to7.mjs <status|snapshot|gangsir|jurnal-stok|restore>");
