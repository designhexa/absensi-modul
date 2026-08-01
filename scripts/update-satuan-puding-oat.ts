/**
 * Update Satuan Puding & Oat → pcs
 *
 * Memperbarui satuan bahan baku PUDING (PUD01) dan OAT (OAT01)
 * dari 'sachet' menjadi 'pcs' di tabel bahan_baku.
 *
 * Cara pakai:
 *   npx tsx scripts/update-satuan-puding-oat.ts
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Parse .env file manually
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

// Kode bahan yang satuan-nya harus diubah
const TARGETS = [
  { kode: "PUD01", nama: "PUDING" },
  { kode: "OAT01", nama: "OAT" },
];

async function main() {
  console.log("============================================");
  console.log("  UPDATE SATUAN PUDING & OAT → pcs");
  console.log("============================================\n");

  let totalUpdated = 0;

  for (const t of TARGETS) {
    const { data: rows, error: fetchErr } = await supabase
      .from("bahan_baku")
      .select("id, kode, nama, satuan")
      .eq("kode", t.kode);

    if (fetchErr) {
      console.error(`  ❌ Gagal fetch ${t.kode}: ${fetchErr.message}`);
      continue;
    }

    if (!rows || rows.length === 0) {
      console.log(`  ⏭️  ${t.kode} (${t.nama}): tidak ditemukan`);
      continue;
    }

    for (const row of rows) {
      if (row.satuan === "pcs") {
        console.log(`  ⏭️  ${t.kode} (${t.nama}): sudah 'pcs', skip`);
        continue;
      }

      const { error: updateErr } = await supabase
        .from("bahan_baku")
        .update({ satuan: "pcs" })
        .eq("id", row.id);

      if (updateErr) {
        console.error(`  ❌ Gagal update ${t.kode} (${row.id}): ${updateErr.message}`);
        continue;
      }

      console.log(`  ✅ ${t.kode} (${t.nama}) id=${row.id}: '${row.satuan}' → 'pcs'`);
      totalUpdated++;
    }
  }

  console.log("\n============================================");
  if (totalUpdated > 0) {
    console.log(`✅ Total ${totalUpdated} record berhasil diupdate!`);
    console.log("   Refresh browser untuk melihat perubahan.");
  } else {
    console.log("✅ Semua data sudah menggunakan satuan 'pcs'.");
    console.log("   Tidak ada perubahan yang diperlukan.");
  }
  console.log("============================================\n");
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
