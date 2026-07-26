#!/usr/bin/env node
/**
 * Backup Database — Ekspor semua data Supabase ke JSON
 *
 * Usage:
 *   npx tsx scripts/backup-db.ts                    → backup ke backups/YYYY-MM-DD_HHmmss.json
 *   npx tsx scripts/backup-db.ts --name mybackup    → backup ke backups/mybackup.json
 *   npx tsx scripts/backup-db.ts --tables penjualan,produksi  → backup tabel tertentu saja
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

// ── Semua tabel yang di-backup ──────────────────────────────
const ALL_TABLES = [
  "outlets",
  "produk",
  "coa",
  "bahan_baku",
  "karyawan",
  "users",
  "jurnal",
  "penjualan",
  "produksi",
  "stok_movement",
  "absensi",
  "permohonan_stok",
];

// ── Parse args ──────────────────────────────────────────────
const args = process.argv.slice(2);
let backupName = "";
let tableFilter: string[] | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--name" && args[i + 1]) {
    backupName = args[++i];
  }
  if (args[i] === "--tables" && args[i + 1]) {
    tableFilter = args[++i].split(",").map((t) => t.trim());
  }
}

// ── Fetch semua data dari tabel (dengan pagination) ─────────
const PAGE_SIZE = 1000;
async function fetchTable(table: string): Promise<any[]> {
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error(`  ⚠️  Gagal fetch ${table}: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  const tables = tableFilter || ALL_TABLES;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = backupName || `backup-${timestamp}`;
  const backupDir = path.resolve(process.cwd(), "backups");

  // Buat folder backups jika belum ada
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log("📁 Folder backups/ dibuat");
  }

  console.log("═══════════════════════════════════════");
  console.log("  🔒 BACKUP DATABASE");
  console.log("═══════════════════════════════════════\n");

  const backup: Record<string, any[]> = {};
  let totalRecords = 0;

  for (const table of tables) {
    process.stdout.write(`  📋 ${table}...`);
    const data = await fetchTable(table);
    backup[table] = data;
    totalRecords += data.length;
    console.log(` ${data.length} records`);
  }

  // Tulis ke file
  const filePath = path.join(backupDir, `${fileName}.json`);
  const backupPayload = {
    _meta: {
      createdAt: new Date().toISOString(),
      source: supabaseUrl,
      tables: tables,
      totalRecords,
    },
    ...backup,
  };

  fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2), "utf-8");

  console.log("\n═══════════════════════════════════════");
  console.log(`  ✅ BACKUP BERHASIL`);
  console.log(`  📄 File: ${filePath}`);
  console.log(`  📊 ${tables.length} tabel, ${totalRecords} records total`);
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error("\n❌ ERROR:", err);
  process.exit(1);
});
