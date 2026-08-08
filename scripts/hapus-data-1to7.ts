/**
 * HAPUS SEMUA DATA SIKLUS 1-7 AGUSTUS 2026 (reset bersih)
 *
 * Menghapus seluruh data tanggal 1-7 Agustus agar bisa diinput ulang lewat aplikasi:
 *   1. penjualan        → tanggal 1-7
 *   2. produksi         → tanggal 1-7
 *   3. jurnal           → tanggal 1-7
 *   4. stok_movement    → tanggal 1-7 (SEMUA tipe: potongan bahan/kemasan, RUSAK:OH,
 *                          retur, pembelian supplier) — stok akan diinput ulang.
 *                          + jaring pengaman: movement tertanggal HARI INI ber-label
 *                          "Pemakaian Produksi/Kemasan [2026-08-0X]" utk X=1..7
 *                          (entri nyasar dari re-save aplikasi).
 *   5. permohonan_stok  → tanggal_kirim 1-7 (rencana produksi + request perlengkapan outlet)
 *
 * Tanggal 8 Agustus TIDAK disentuh (data penjualan & siklusnya sudah benar).
 *
 * Cara pakai:
 *   npx tsx scripts/hapus-data-1to7.ts                     # DRY-RUN (hitung dulu)
 *   npx tsx scripts/hapus-data-1to7.ts --apply             # eksekusi
 * Opsi: --dari=YYYY-MM-DD --sampai=YYYY-MM-DD
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const c = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
c.split(/\r?\n/).forEach((l) => { const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/); if (m) env[m[1]] = (m[2] || "").replace(/^["']|["']$/g, ""); });
const supabase = createClient(env["VITE_SUPABASE_URL"], env["VITE_SUPABASE_SERVICE_ROLE_KEY"] || env["VITE_SUPABASE_ANON_KEY"]);

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const dariArg = args.find((a) => a.startsWith("--dari="));
const sampaiArg = args.find((a) => a.startsWith("--sampai="));
const DARI = dariArg ? dariArg.split("=")[1] : "2026-08-01";
const SAMPAI = sampaiArg ? sampaiArg.split("=")[1] : "2026-08-07";

const parseDate = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtDate = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

async function main() {
  console.log(`=== HAPUS DATA SIKLUS ${DARI} s.d. ${SAMPAI} ===`);
  console.log(`Mode: ${APPLY ? "✅ MENGHAPUS DARI DATABASE (--apply)" : "🔍 DRY-RUN (hanya hitung)"}\n`);

  // Daftar tanggal
  const dates: string[] = [];
  let d = parseDate(DARI);
  const end = parseDate(SAMPAI);
  while (d <= end) { dates.push(fmtDate(d)); d.setDate(d.getDate() + 1); }

  // Jaring pengaman label nyasar (dibuat hari ini utk tanggal 1-7)
  const strayPrefixes = dates.map((t) => [`Pemakaian Produksi [${t}]`, `Pemakaian Kemasan [${t}]`]).flat();

  const tables: { name: string; col: string }[] = [
    { name: "penjualan", col: "tanggal" },
    { name: "produksi", col: "tanggal" },
    { name: "jurnal", col: "tanggal" },
    { name: "stok_movement", col: "tanggal" },
    { name: "permohonan_stok", col: "tanggal_kirim" },
  ];

  let grandTotal = 0;
  const today = fmtDate(new Date());

  for (const t of tables) {
    let q = supabase.from(t.name).select("id").gte(t.col, DARI).lte(t.col, SAMPAI);
    if (t.name === "permohonan_stok") q = supabase.from(t.name).select("id").gte("tanggal_kirim", DARI).lte("tanggal_kirim", SAMPAI);
    const { data, error } = await q;
    if (error) { console.error(`  ❌ ${t.name}: ${error.message}`); process.exit(1); }
    const ids = (data || []).map((r: any) => r.id);
    console.log(`  ${t.name} (${t.col} ${DARI}..${SAMPAI}): ${ids.length} record`);

    // Jaring pengaman hanya untuk stok_movement (label nyasar bertanggal hari ini)
    let strayIds: string[] = [];
    if (t.name === "stok_movement" && today > SAMPAI) {
      const { data: stray } = await supabase
        .from("stok_movement").select("id, keterangan")
        .eq("tanggal", today);
      strayIds = (stray || [])
        .filter((m: any) => strayPrefixes.includes(m.keterangan))
        .map((m: any) => m.id);
      if (strayIds.length > 0) console.log(`  stok_movement label nyasar (${today}): ${strayIds.length} record`);
    }

    const all = [...new Set([...ids, ...strayIds])];
    grandTotal += all.length;

    if (APPLY && all.length > 0) {
      // hapus per batch 400
      let ok = 0;
      for (let i = 0; i < all.length; i += 400) {
        const batch = all.slice(i, i + 400);
        const { error: delErr } = await supabase.from(t.name).delete().in("id", batch);
        if (delErr) { console.error(`  ❌ gagal hapus ${t.name}: ${delErr.message}`); process.exit(1); }
        ok += batch.length;
      }
      console.log(`  ✅ ${t.name}: ${ok} record dihapus`);
    }
  }

  console.log(`\n=== RINGKASAN ===`);
  console.log(`  Total record sasaran: ${grandTotal}`);
  if (!APPLY) console.log(`\n👉 DRY-RUN selesai. Jalankan dengan --apply untuk menghapus.`);
  else console.log(`\n✅ Selesai — data ${DARI} s.d. ${SAMPAI} sudah dikosongkan. Tanggal lain tidak disentuh.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
