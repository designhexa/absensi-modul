/**
 * RESTORE PENJUALAN 2026-08-08 — kembalikan ke kondisi SEBELUM PENGHAPUSAN
 * (persis seperti di backups/sebelum-hapus-1to7.json).
 *
 * Latar belakang: perbaikan konsistensi omset sebelumnya mengubah kolom total
 * pada 2 record tanggal 8 (yang seharusnya TIDAK disentuh — user menyatakan
 * penjualan 8 Agustus sudah sesuai). Skrip ini membandingkan record penjualan
 * tanggal 8 saat ini dengan backup, lalu mengembalikan field yang berbeda
 * (qty, harga, total, sisa_gram, variant) ke nilai backup.
 *
 * Cara pakai:
 *   npx tsx scripts/restore-penjualan-0808.ts          (DRY-RUN)
 *   npx tsx scripts/restore-penjualan-0808.ts --apply  (menulis ke DB)
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (!fs.existsSync(envPath)) { console.error("❌ .env tidak ditemukan"); process.exit(1); }
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

const BACKUP_PATH = path.resolve(process.cwd(), "backups/sebelum-hapus-1to7.json");
const TANGGAL = "2026-08-08";

async function main() {
  const APPLY = process.argv.includes("--apply");

  // 1. Backup → record tgl 8
  const bak = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf-8"));
  const bakSales = (bak.penjualan || []).filter((p: any) => p.tanggal === TANGGAL);
  const bakById = new Map(bakSales.map((p: any) => [p.id, p]));

  // 2. DB sekarang → record tgl 8
  const { data: curSales, error } = await supabase
    .from("penjualan")
    .select("id, tanggal, outlet_id, produk_id, qty, harga, total, sisa_gram, variant")
    .eq("tanggal", TANGGAL);
  if (error) { console.error("❌ Gagal baca penjualan:", error.message); process.exit(1); }

  console.log(`=== RESTORE PENJUALAN ${TANGGAL} → kondisi sebelum penghapusan ===`);
  console.log(`Mode: ${APPLY ? "✅ MENULIS KE DATABASE (--apply)" : "🔍 DRY-RUN (tidak menulis)"}`);
  console.log(`Backup: ${bakSales.length} record | DB sekarang: ${(curSales || []).length} record\n`);

  const FIELDS = ["qty", "harga", "total", "sisa_gram", "variant"] as const;
  const diffs: { id: string; outlet: string; produk: string; variant: string | null; changes: string[] }[] = [];
  const missingInBackup: string[] = [];
  const missingInDb: string[] = [];

  for (const p of bakSales) missingInDb.push(p.id);
  for (const c of (curSales || [])) {
    const i = missingInDb.indexOf(c.id);
    if (i >= 0) missingInDb.splice(i, 1);
    const b = bakById.get(c.id);
    if (!b) { missingInBackup.push(c.id); continue; }
    const changes: string[] = [];
    for (const f of FIELDS) {
      const bv = b[f];
      const cv = c[f];
      const same = bv === cv || (bv === null && cv === null) || (bv === undefined && cv === null);
      if (!same) changes.push(`${f}: ${cv} → ${bv}`);
    }
    if (changes.length > 0) {
      diffs.push({
        id: c.id,
        outlet: c.outlet_id,
        produk: c.produk_id,
        variant: c.variant,
        changes,
      });
    }
  }

  for (const d of diffs) {
    console.log(`🔄 ${d.id} | ${d.outlet} | ${d.produk} [${d.variant || "-"}]\n     ${d.changes.join(" | ")}`);
  }
  if (missingInDb.length > 0) console.log(`⚠️  Ada di backup tapi TIDAK ada di DB: ${missingInDb.join(", ")}`);
  if (missingInBackup.length > 0) console.log(`⚠️  Ada di DB tapi TIDAK ada di backup: ${missingInBackup.join(", ")}`);

  console.log(`\nTotal berbeda: ${diffs.length} record`);

  if (diffs.length === 0) {
    console.log("👉 Tidak ada perbedaan — data sudah sama dengan backup.");
    return;
  }
  if (!APPLY) {
    console.log(`👉 Jalankan dengan --apply untuk mengembalikan ${diffs.length} record.`);
    return;
  }

  let ok = 0;
  for (const d of diffs) {
    const b = bakById.get(d.id)!;
    const { error: uErr } = await supabase
      .from("penjualan")
      .update({
        qty: b.qty,
        harga: b.harga,
        total: b.total,
        sisa_gram: b.sisa_gram,
        variant: b.variant,
      })
      .eq("id", d.id);
    if (uErr) {
      console.error(`  ❌ Gagal restore id=${d.id}: ${uErr.message}`);
    } else {
      ok++;
      console.log(`  ✅ ${d.id} di-restore ke backup`);
    }
  }
  console.log(`\n✅ ${ok}/${diffs.length} record berhasil di-restore.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
