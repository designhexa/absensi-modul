/**
 * Update Satuan Database
 * 
 * Memperbarui nilai satuan di database yang masih menggunakan istilah lama:
 * - 'biji' → 'pcs' (di tabel bahan_baku dan produk)
 * - 'Pack' → 'pack', 'PACK' → 'pack' (di tabel bahan_baku dan produk)
 * 
 * Cara pakai:
 *   npx tsx scripts/update-satuan-db.ts
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

async function updateTable(
  table: string,
  oldValue: string,
  newValue: string
): Promise<number> {
  const { data: rows, error: fetchErr } = await supabase
    .from(table)
    .select("id")
    .eq("satuan", oldValue);

  if (fetchErr) {
    console.error(`  ❌ Gagal fetch ${table} (${oldValue}): ${fetchErr.message}`);
    return 0;
  }

  if (!rows || rows.length === 0) {
    console.log(`  ⏭️  ${table}: tidak ada data dengan satuan '${oldValue}'`);
    return 0;
  }

  const { error: updateErr } = await supabase
    .from(table)
    .update({ satuan: newValue })
    .eq("satuan", oldValue);

  if (updateErr) {
    console.error(`  ❌ Gagal update ${table}: ${updateErr.message}`);
    return 0;
  }

  console.log(`  ✅ ${table}: ${rows.length} record '${oldValue}' → '${newValue}'`);
  return rows.length;
}

async function main() {
  console.log("============================================");
  console.log("  UPDATE SATUAN DATABASE");
  console.log("  'biji' → 'pcs', 'Pack'/'PACK' → 'pack'");
  console.log("============================================\n");

  const tables = ["bahan_baku", "produk"];
  const replacements: { old: string; new: string }[] = [
    { old: "biji", new: "pcs" },
    { old: "Pack", new: "pack" },
    { old: "PACK", new: "pack" },
  ];

  let totalUpdated = 0;

  for (const table of tables) {
    console.log(`\n📋 Tabel: ${table}`);
    for (const r of replacements) {
      const updated = await updateTable(table, r.old, r.new);
      totalUpdated += updated;
    }
  }

  console.log("\n============================================");
  if (totalUpdated > 0) {
    console.log(`✅ Total ${totalUpdated} record berhasil diupdate!`);
    console.log("   Refresh browser untuk melihat perubahan.");
  } else {
    console.log("✅ Semua data sudah menggunakan satuan yang benar.");
    console.log("   Tidak ada perubahan yang diperlukan.");
  }
  console.log("============================================\n");
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
