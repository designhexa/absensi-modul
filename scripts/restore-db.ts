#!/usr/bin/env node
/**
 * Restore Database — Import data dari file backup JSON ke Supabase
 *
 * Usage:
 *   npx tsx scripts/restore-db.ts backups/backup-2026-07-26T12-00-00.json        → restore semua tabel
 *   npx tsx scripts/restore-db.ts backups/backup.json --tables penjualan,produksi → restore tabel tertentu
 *   npx tsx scripts/restore-db.ts backups/backup.json --clear                     → clear dulu, lalu restore
 *   npx tsx scripts/restore-db.ts backups/backup.json --dry-run                   → preview tanpa ubah data
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// ── Parse .env ──────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  console.error("❌ File .env tidak ditemukan");
  process.exit(1);
}
const envContent = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabaseUrl = env["VITE_SUPABASE_URL"];
const supabaseKey = env["VITE_SUPABASE_SERVICE_ROLE_KEY"] || env["VITE_SUPABASE_ANON_KEY"];
if (!supabaseUrl || !supabaseKey) {
  console.error("❌ VITE_SUPABASE_URL atau SUPABASE_KEY tidak ditemukan di .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Table metadata: delete condition column per table ────────
const TABLE_DELETE_KEY: Record<string, string> = {
  outlets: "id",
  produk: "id",
  coa: "kode",
  bahan_baku: "id",
  karyawan: "id",
  users: "username",
  jurnal: "id",
  penjualan: "id",
  produksi: "id",
  stok_movement: "id",
  absensi: "id",
  permohonan_stok: "id",
};

// Urutan delete yang aman (foreign key dependencies)
const DELETE_ORDER = [
  "penjualan",
  "produksi",
  "jurnal",
  "stok_movement",
  "absensi",
  "permohonan_stok",
  "karyawan",
  "users",
  "produk",
  "outlets",
  "coa",
  "bahan_baku",
];

// ── Parse args ──────────────────────────────────────────────
const args = process.argv.slice(2);
let backupFile = "";
let tableFilter: string[] | null = null;
let doClear = false;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--tables" && args[i + 1]) {
    tableFilter = args[++i].split(",").map((t) => t.trim());
  } else if (args[i] === "--clear") {
    doClear = true;
  } else if (args[i] === "--dry-run") {
    dryRun = true;
  } else if (!args[i].startsWith("--")) {
    backupFile = args[i];
  }
}

// ── Clear table ─────────────────────────────────────────────
async function clearTable(table: string): Promise<number> {
  const key = TABLE_DELETE_KEY[table] || "id";
  let totalDeleted = 0;
  // Loop in batches of 1000
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(key)
      .limit(1000);
    if (error || !data || data.length === 0) break;
    const ids = data.map((r: any) => r[key]);
    const { error: delErr } = await supabase
      .from(table)
      .delete()
      .in(key, ids);
    if (delErr) {
      console.error(`    ⚠️  Gagal hapus ${table}: ${delErr.message}`);
      break;
    }
    totalDeleted += ids.length;
    if (ids.length < 1000) break;
  }
  return totalDeleted;
}

// ── Insert data ke tabel (batch 500, safe fallback) ─────────
async function insertTable(table: string, rows: any[]): Promise<number> {
  if (!rows || rows.length === 0) return 0;
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(batch);
    if (!error) {
      inserted += batch.length;
    } else {
      // Batch gagal — coba satu per satu (hanya baris yang BELUM ter-insert)
      for (const row of batch) {
        const { error: singleErr } = await supabase.from(table).insert(row);
        if (!singleErr) inserted++;
      }
    }
  }
  return inserted;
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  if (!backupFile) {
    console.error("❌ Harap tentukan file backup:");
    console.error("   npx tsx scripts/restore-db.ts <path/to/backup.json>");
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), backupFile);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ File tidak ditemukan: ${resolvedPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  const meta = raw._meta || {};
  const availableTables = Object.keys(raw).filter((k) => !k.startsWith("_"));
  const tables = tableFilter || availableTables;

  console.log("═══════════════════════════════════════");
  console.log("  📥 RESTORE DATABASE");
  console.log("═══════════════════════════════════════");
  console.log(`  📄 File: ${backupFile}`);
  if (meta.createdAt) console.log(`  🕐 Dibuat: ${meta.createdAt}`);
  console.log(`  📊 Tabel: ${tables.join(", ")}`);
  if (dryRun) console.log(`  🔍 MODE: DRY RUN (tidak mengubah data)`);
  if (doClear) console.log(`  🧹 MODE: CLEAR dulu sebelum restore`);
  console.log("");

  if (dryRun) {
    // Preview saja
    for (const table of tables) {
      const rows = raw[table] || [];
      console.log(`  📋 ${table}: ${rows.length} records`);
    }
    console.log("\n  ℹ️  Dry run selesai. Tidak ada perubahan.");
    return;
  }

  // Konfirmasi
  console.log("  ⚠️  PERINGATAN: Semua data di tabel berikut akan DIHAPUS dan diganti:");
  for (const table of tables) {
    const rows = raw[table] || [];
    console.log(`     - ${table} (${rows.length} records dari backup)`);
  }
  console.log("");

  // Clear jika diminta
  if (doClear) {
    console.log("  🧹 Membersihkan tabel...");
    const clearOrder = DELETE_ORDER.filter((t) => tables.includes(t));
    // Juga clear tabel yang ada di backup tapi tidak di DELETE_ORDER
    for (const t of tables) {
      if (!clearOrder.includes(t)) clearOrder.push(t);
    }
    for (const table of clearOrder) {
      process.stdout.write(`    ${table}...`);
      const deleted = await clearTable(table);
      console.log(` ${deleted} records dihapus`);
    }
    console.log("");
  }

  // Insert data
  console.log("  📥 Restoring data...");
  let totalInserted = 0;

  // Insert sesuai urutan yang aman
  const insertOrder = DELETE_ORDER.filter((t) => tables.includes(t));
  for (const t of tables) {
    if (!insertOrder.includes(t)) insertOrder.push(t);
  }

  for (const table of insertOrder) {
    const rows = raw[table] || [];
    if (rows.length === 0) {
      console.log(`    ${table}: 0 records (skip)`);
      continue;
    }
    process.stdout.write(`    ${table}...`);
    const inserted = await insertTable(table, rows);
    totalInserted += inserted;
    console.log(` ${inserted}/${rows.length} records`);
  }

  console.log("\n═══════════════════════════════════════");
  console.log(`  ✅ RESTORE BERHASIL`);
  console.log(`  📊 ${tables.length} tabel, ${totalInserted} records di-insert`);
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error("\n❌ ERROR:", err);
  process.exit(1);
});
