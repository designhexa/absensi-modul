/**
 * FIX DATA — Distribusi Pending → Disetujui agar outlet bisa input OH
 *
 * Latar belakang: form "Sisa (OH)" di Laporan hanya membaca permohonan_stok
 * ber-status "Disetujui". Jika distribusi tersimpan tapi masih "Pending"
 * (mis. karena re-save rencana Step 1 yang me-reset status), outlet tidak
 * bisa menginput OH. Script ini menyetujui record distribusi yang sudah
 * punya qty > 0 untuk tanggal tertentu.
 *
 * Cara pakai:
 *   npx tsx scripts/fix-oh-distribusi-disetujui.ts [YYYY-MM-DD]
 *   (default: hari ini)
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
  const tanggal = process.argv[2] || todayLocal();
  console.log(`=== FIX DISTRIBUSI Pending → Disetujui untuk ${tanggal} ===\n`);

  const { data, error } = await supabase
    .from("permohonan_stok")
    .select("id, tanggal_kirim, outlet_id, produk_id, qty, status")
    .eq("tanggal_kirim", tanggal)
    .in("produk_id", PROD_IDS);

  if (error) {
    console.error("Query error:", error);
    process.exit(1);
  }

  const pendingWithQty = (data || []).filter((r: any) => r.status === "Pending" && Number(r.qty) > 0);

  console.log(`Total record distribusi ${tanggal}: ${(data || []).length}`);
  console.log(`Pending & qty>0 (akan di-set Disetujui): ${pendingWithQty.length}`);

  if (pendingWithQty.length === 0) {
    console.log("Tidak ada yang perlu diubah.");
    return;
  }

  pendingWithQty.forEach((r: any) => {
    console.log(`  → ${r.outlet_id} | ${r.produk_id} | qty=${r.qty}`);
  });

  const { error: updErr } = await supabase
    .from("permohonan_stok")
    .update({ status: "Disetujui" })
    .in(
      "id",
      pendingWithQty.map((r: any) => r.id)
    );

  if (updErr) {
    console.error("Update error:", updErr);
    process.exit(1);
  }

  // Verifikasi
  const { data: after } = await supabase
    .from("permohonan_stok")
    .select("status")
    .eq("tanggal_kirim", tanggal)
    .in("produk_id", PROD_IDS);
  const statuses = [...new Set((after || []).map((r: any) => r.status))];
  console.log(`\n✅ ${pendingWithQty.length} record di-set menjadi Disetujui.`);
  console.log(`Status ${tanggal} sekarang: ${statuses.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
