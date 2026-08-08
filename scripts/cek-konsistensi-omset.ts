/**
 * CEK KONSISTENSI OMSET — membandingkan angka di tiga tab Laporan Penjualan
 *
 * Tab Sisa (OH) & Riwayat menghitung omset = qty TERSIMPAN × harga TERSIMPAN.
 * Tab Rekap menghitung omset = total TERSIMPAN (kolom total).
 *
 * Agar ketiganya sama, harus berlaku: total === qty × harga untuk SETIAP record,
 * dan setiap record penjualan terlihat di Riwayat (punya distribusi Disetujui
 * yang cocok).
 *
 * CATATAN CAKUPAN: skrip memeriksa 5 produk produksi (p-bubur, p-nasitim,
 * p-oatmeal, p-puding, p-abon) — semua produk yang pernah ditulis aplikasi ke
 * tabel penjualan. Tab Rekap sebenarnya menjumlahkan SEMUA record penjualan;
 * jika di kemudian hari ada produk lain, jalankan tanpa filter produk.
 * Skrip ini read-only — hanya melaporkan (kecuali dengan --apply).
 *
 * Jalankan: npx tsx scripts/cek-konsistensi-omset.ts [--dari=YYYY-MM-DD] [--sampai=YYYY-MM-DD]
 * Perbaiki total yang salah (total := qty × harga, tanpa mengubah qty):
 *   npx tsx scripts/cek-konsistensi-omset.ts [opsi] --apply
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  console.error("Error: .env not found");
  process.exit(1);
}
const envContent = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((line) => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || "").replace(/^["']|["']$/g, "");
});
const supabase = createClient(
  env["VITE_SUPABASE_URL"],
  env["VITE_SUPABASE_SERVICE_ROLE_KEY"] || env["VITE_SUPABASE_ANON_KEY"]
);

const PROD_IDS = ["p-bubur", "p-nasitim", "p-oatmeal", "p-puding", "p-abon"];
const GRAM_PER_CUP: Record<string, number> = { "p-bubur": 118, "p-nasitim": 108, "p-oatmeal": 100, "p-puding": 80, "p-abon": 10 };

async function main() {
  const args = process.argv.slice(2);
  const dariArg = args.find((a) => a.startsWith("--dari="));
  const sampaiArg = args.find((a) => a.startsWith("--sampai="));
  const APPLY = args.includes("--apply");
  const DARI = dariArg ? dariArg.split("=")[1] : null;
  const SAMPAI = sampaiArg ? sampaiArg.split("=")[1] : null;

  // ===== 1. Penjualan =====
  let sq = supabase
    .from("penjualan")
    .select("id, tanggal, outlet_id, produk_id, qty, harga, total, sisa_gram, variant")
    .in("produk_id", PROD_IDS);
  if (DARI) sq = sq.gte("tanggal", DARI);
  if (SAMPAI) sq = sq.lte("tanggal", SAMPAI);
  const { data: sales, error: errS } = await sq.order("tanggal", { ascending: false });
  if (errS) { console.error("❌ penjualan:", errS.message); process.exit(1); }

  // ===== 2. Distribusi Disetujui (sumber baris Riwayat) =====
  let dq = supabase
    .from("permohonan_stok")
    .select("tanggal_kirim, outlet_id, produk_id, qty, status, catatan")
    .in("produk_id", PROD_IDS)
    .eq("status", "Disetujui");
  if (DARI) dq = dq.gte("tanggal_kirim", DARI);
  if (SAMPAI) dq = dq.lte("tanggal_kirim", SAMPAI);
  const { data: dists, error: errD } = await dq;
  if (errD) { console.error("❌ permohonan:", errD.message); process.exit(1); }

  const distKeys = new Set<string>();
  (dists || []).forEach((r: any) => {
    distKeys.add(`${r.tanggal_kirim}|${r.outlet_id}|${r.produk_id}`);
  });

  // ===== 3. Analisis =====
  let totalQtyHarga = 0;   // omset versi Sisa OH & Riwayat (qty × harga)
  let totalStored = 0;     // omset versi Rekap (kolom total)
  let totalQtyHargaCup = 0, totalStoredCup = 0;
  let mismatches = 0, noDist = 0, zeroTotal = 0;
  const detail: string[] = [];

  for (const p of (sales || [])) {
    const qh = p.qty * p.harga;
    const isCup = p.produk_id === "p-oatmeal" || p.produk_id === "p-puding" || p.produk_id === "p-abon";

    totalQtyHarga += qh;
    totalStored += Number(p.total) || 0;
    if (isCup) { totalQtyHargaCup += qh; totalStoredCup += Number(p.total) || 0; }

    const distKey = `${p.tanggal}|${p.outlet_id}|${p.produk_id}`;
    if (!distKeys.has(distKey)) {
      noDist++;
      detail.push(`🔸 NO-DIST ${p.tanggal} | ${p.outlet_id} | ${p.produk_id}${p.variant ? ` [${p.variant}]` : ""} | qty ${p.qty} × harga ${p.harga} = ${qh} | total ${p.total}`);
    }

    // Cek nilai mentah dulu: NULL/undefined/NaN di DB (Number(null)=0 sehingga
    // konversi dulu akan menyamarkan total yang benar-benar hilang).
    const totalRaw = p.total;
    if (totalRaw === null || totalRaw === undefined || isNaN(Number(totalRaw))) {
      zeroTotal++;
      detail.push(`🔹 NULL-TOTAL ${p.tanggal} | ${p.outlet_id} | ${p.produk_id}${p.variant ? ` [${p.variant}]` : ""} | qty ${p.qty} × harga ${p.harga} = ${qh} | total ${p.total}`);
    } else if (Math.abs(Number(totalRaw) - qh) > 0.01) {
      mismatches++;
      detail.push(`⚠️ TOTAL≠Q×H ${p.tanggal} | ${p.outlet_id} | ${p.produk_id}${p.variant ? ` [${p.variant}]` : ""} | qty ${p.qty} × harga ${p.harga} = ${qh} | total ${p.total}`);
    }
  }

  const rangeLabel = DARI || SAMPAI ? `${DARI || "awal"} s.d. ${SAMPAI || "akhir"}` : "SEMUA DATA";
  console.log(`=== CEK KONSISTENSI OMSET — ${rangeLabel} ===`);
  console.log(`Record penjualan: ${(sales || []).length} | Distribusi Disetujui: ${(dists || []).length}\n`);

  console.log(`Omset versi Sisa OH & Riwayat (Σ qty×harga): Rp ${totalQtyHarga.toLocaleString()}`);
  console.log(`Omset versi Rekap (Σ kolom total):           Rp ${totalStored.toLocaleString()}`);
  console.log(`Selisih:                                     Rp ${(totalStored - totalQtyHarga).toLocaleString()}\n`);

  console.log(`Σ qty×harga item cup/pcs (oatmeal/puding/abon): Rp ${totalQtyHargaCup.toLocaleString()}`);
  console.log(`Σ total     item cup/pcs:                        Rp ${totalStoredCup.toLocaleString()}\n`);

  console.log(`⚠️  total ≠ qty×harga: ${mismatches} record`);
  console.log(`🔹 total NULL/NaN:       ${zeroTotal} record`);
  console.log(`🔸 penjualan tanpa dist (tidak terlihat di Riwayat): ${noDist} record`);
  console.log(`\n--- Detail ---`);
  if (detail.length === 0) console.log("(semua record konsisten ✅)");
  detail.forEach((d) => console.log(d));

  // ===== 4. Perbaikan (opsional): total = qty × harga =====
  const toFix = (sales || []).filter((p: any) => {
    const qh = p.qty * p.harga;
    const t = p.total;
    // NULL/NaN atau selisih > 0.01 → perlu diperbaiki (qty & harga TIDAK diubah).
    return t === null || t === undefined || isNaN(Number(t)) || Math.abs(Number(t) - qh) > 0.01;
  });
  if (toFix.length === 0) {
    console.log("\n👉 Tidak ada total yang perlu diperbaiki.");
    return;
  }
  if (!APPLY) {
    console.log(`\n👉 ${toFix.length} record akan diperbaiki (total := qty × harga). Jalankan dengan --apply untuk menulis.`);
    return;
  }
  console.log(`\n👉 Memperbaiki ${toFix.length} record...`);
  let ok = 0;
  for (const p of toFix) {
    const newTotal = p.qty * p.harga;
    const { error } = await supabase
      .from("penjualan")
      .update({ total: newTotal })
      .eq("id", p.id);
    if (error) {
      console.error(`  ❌ Gagal update id=${p.id}: ${error.message}`);
    } else {
      ok++;
      console.log(`  ✅ ${p.tanggal} | ${p.outlet_id} | ${p.produk_id} [${p.variant || "-"}] total ${p.total} → ${newTotal}`);
    }
  }
  console.log(`  ✅ ${ok}/${toFix.length} berhasil diperbaiki.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
