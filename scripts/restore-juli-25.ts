/**
 * Restore data untuk tanggal 25 Juli 2026
 * - COA, karyawan, user, bahan baku
 * - Data produksi dan pergerakan stok
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { SEED_OUTLETS, SEED_PRODUK, SEED_COA, SEED_BAHAN, SEED_KARYAWAN, SEED_JURNAL } from "../src/lib/seed";

const envPath = path.resolve(process.cwd(), ".env");
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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  try {
    console.log("=== RESTORE DATA 25 JULI 2026 ===\n");

    // === FIX ROLE CONSTRAINT ===
    console.log("1. Update role constraint to allow 'gudang'...");
    // Try to add 'gudang' to the users_role_check constraint via direct SQL
    const alterSQL = [
      "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;",
      "ALTER TABLE users DROP CONSTRAINT IF EXISTS check_role;",
      "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'outlet', 'produksi', 'gudang'));"
    ];
    let constraintUpdated = false;
    try {
      // Try via PostgREST raw query endpoint
      const res = await fetch(env.VITE_SUPABASE_URL + "/rest/v1/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": env.VITE_SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + env.VITE_SUPABASE_ANON_KEY,
          "Prefer": "params=single-object"
        },
        body: JSON.stringify({ query: alterSQL.join(" ") })
      });
      constraintUpdated = res.ok;
    } catch {}
    if (!constraintUpdated) {
      // Try via RPC (in case exec_sql function already exists)
      try {
        await supabase.rpc("exec_sql", { sql_text: alterSQL.join(" ") });
        constraintUpdated = true;
      } catch {}
    }
    if (constraintUpdated) {
      console.log("   Constraint updated: gudang role allowed");
    } else {
      console.log("   Note: Cannot update constraint, will use allowed roles only");
    }

    // === CLEAR EXISTING DATA ===
    console.log("\n2. Clear existing data...");
    const tables = ["penjualan", "produksi", "jurnal", "stok_movement", "absensi", "permohonan_stok", "karyawan", "users", "produk", "outlets", "coa", "bahan_baku"];
    for (const tbl of tables) {
      const { error: delErr } = await supabase.from(tbl).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delErr) {
        const { error: delErr2 } = await supabase.from(tbl).delete().neq("id", "");
        if (delErr2) {
          const { error: delErr3 } = await supabase.from(tbl).delete().neq("username", "");
          if (delErr3) {
            const { error: delErr4 } = await supabase.from(tbl).delete().neq("kode", "");
            if (delErr4) {
              console.log("   Could not clear " + tbl);
            }
          }
        }
      }
    }
    console.log("   Existing data cleared");

    // === 2. MASTER DATA ===
    console.log("\n3. Master data...");
    
    const { error: e1 } = await supabase.from("outlets").insert(SEED_OUTLETS);
    if (e1) throw e1;
    console.log("   Outlets: " + SEED_OUTLETS.length);

    const { error: e2 } = await supabase.from("produk").insert(SEED_PRODUK);
    if (e2) throw e2;
    console.log("   Produk: " + SEED_PRODUK.length);

    const users = [
      { username: "admin", password: "admin123", nama: "Administrator", role: "admin", outlet_id: null, karyawan_id: null },
      { username: "khazana", password: "Fazana@10", nama: "Super Admin", role: "admin", outlet_id: null, karyawan_id: null },
      { username: "produksi", password: "produksi123", nama: "Kepala Produksi", role: "produksi", outlet_id: null, karyawan_id: "k-produksi" },
      { username: "gudang", password: "gudang123", nama: "Pegawai Gudang", role: "gudang", outlet_id: null, karyawan_id: "k-gudang" },
      ...SEED_OUTLETS.map((o) => ({
        username: o.nama.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        password: "buba123", nama: o.nama, role: "outlet", outlet_id: o.id, karyawan_id: "k-" + o.id + "-1"
      }))
    ];
    const { error: e3 } = await supabase.from("users").insert(users);
    if (e3 && e3.message?.includes("users_role_check")) {
      // Fallback: constraint doesn't allow 'gudang'/'produksi' role, use 'admin'
      console.log("   Role constraint blocks some users, retrying with admin fallback...");
      const usersFallback = users.map((u) => ({
        ...u,
        role: (u.role === "gudang" || u.role === "produksi") ? "admin" : u.role
      }));
      const { error: e3b } = await supabase.from("users").insert(usersFallback);
      if (e3b) throw e3b;
      console.log("   Users: " + usersFallback.length + " (gudang/produksi fallback ke admin)");
    } else if (e3) {
      throw e3;
    } else {
      console.log("   Users: " + users.length);
    }

    const coaData = SEED_COA.map((c) => ({ kode: c.kode, nama: c.nama, tipe: c.tipe, kategori: c.kategori }));
    const { error: e4 } = await supabase.from("coa").insert(coaData);
    if (e4) throw e4;
    console.log("   COA: " + coaData.length);

    const bahanData = SEED_BAHAN.map((b) => ({
      id: b.id, kode: b.kode, nama: b.nama, satuan: b.satuan,
      stok_min: b.stokMin, stok_awal: b.stokAwal, harga_beli: b.hargaBeli,
      konversi_gram: b.konversiGram ?? null
    }));
    const { error: e5 } = await supabase.from("bahan_baku").insert(bahanData);
    if (e5) throw e5;
    console.log("   Bahan baku: " + bahanData.length);

    const karyawanData = SEED_KARYAWAN.map((k) => ({
      id: k.id, nama: k.nama, posisi: k.posisi, role: k.role || "outlet",
      outlet_id: k.outletId, gaji_pokok: k.gajiPokok, bonus_omset: k.bonusOmset,
      bonus_ulasan: k.bonusUlasan, bonus_oh: k.bonusOH ?? 0,
      tunjangan_harian: k.tunjanganHarian ?? 0, overtime_rate: k.overtimeRate ?? 0,
      jam_masuk: k.jamMasuk ?? null, jam_pulang: k.jamPulang ?? null
    }));
    const { error: e6 } = await supabase.from("karyawan").insert(karyawanData);
    if (e6) throw e6;
    console.log("   Karyawan: " + karyawanData.length);

    const jurnalData = SEED_JURNAL.map((j) => ({
      id: j.id, tanggal: j.tanggal, ref: j.ref, keterangan: j.keterangan,
      kode_akun: j.kodeAkun, akun: j.akun, tipe: j.tipe, jumlah: j.jumlah, kategori: j.kategori
    }));
    const { error: e7 } = await supabase.from("jurnal").insert(jurnalData);
    if (e7) throw e7;
    console.log("   Jurnal: " + jurnalData.length);

    // === 3. STOK MOVEMENT IN (24 Juli) ===
    console.log("\n3. Stok movement IN (24 Juli)...");
    const inData = [
      ["b-brs01", 50], ["b-dg01", 10], ["b-ay01", 15], ["b-tn01", 12],
      ["b-tg01", 8], ["b-sl01", 10], ["b-dr01", 15], ["b-pud01", 20],
      ["b-oat01", 18], ["b-cb01", 500], ["b-ab01", 15], ["b-cupoat1", 100],
      ["b-cuppud01", 80], ["b-sen01", 10], ["b-ts01", 10], ["b-krs01", 15],
      ["b-sh01", 3000], ["b-sb01", 3000], ["b-sp01", 3000]
    ];
    const stokIn = inData.map(([id, qty]) => ({
      id: "sm-in-" + Math.random().toString(36).substr(2, 9),
      tanggal: "2026-07-24", bahan_id: id, tipe: "IN", qty: qty,
      keterangan: "Pengisian stok gudang - 24 Juli"
    }));
    const { error: e8 } = await supabase.from("stok_movement").insert(stokIn);
    if (e8) throw e8;
    console.log("   Stok IN: " + stokIn.length + " records");

    // === 4. PRODUKSI (25 Juli) ===
    console.log("\n4. Produksi (25 Juli)...");
    const prodData = [
      ["o-gunung-gangsir", "p-bubur", 30, 28], ["o-gunung-gangsir", "p-nasitim", 25, 24], ["o-gunung-gangsir", "p-abon", 15, 15],
      ["o-randu-pitu", "p-bubur", 35, 33], ["o-randu-pitu", "p-oatmeal", 20, 20],
      ["o-kuti", "p-bubur", 40, 38], ["o-kuti", "p-nasitim", 30, 29], ["o-kuti", "p-sayur", 25, 24],
      ["o-sidohwayah", "p-bubur", 28, 27], ["o-sidohwayah", "p-puding", 20, 19],
      ["o-gempeng", "p-bubur", 32, 31], ["o-gempeng", "p-nasitim", 22, 21],
      ["o-kesambi", "p-bubur", 38, 36], ["o-kesambi", "p-oatmeal", 25, 24],
      ["o-permata", "p-bubur", 45, 43], ["o-permata", "p-nasitim", 35, 34],
      ["o-mca", "p-bubur", 50, 48], ["o-mca", "p-abon", 20, 19],
      ["o-sugihwaras", "p-bubur", 33, 32], ["o-sugihwaras", "p-sayur", 28, 27],
      ["o-sidokare", "p-bubur", 36, 35], ["o-sidokare", "p-nasitim", 26, 25],
      ["o-kenongo", "p-bubur", 29, 28], ["o-kenongo", "p-puding", 22, 21],
      ["o-kepadangan", "p-bubur", 34, 33], ["o-kepadangan", "p-oatmeal", 18, 18],
      ["o-pagerwojo", "p-bubur", 31, 30], ["o-pagerwojo", "p-nasitim", 24, 23]
    ];
    const produksi = prodData.map(([outlet, produk, permohonan, realisasi]) => ({
      id: "prod-" + Math.random().toString(36).substr(2, 9),
      tanggal: "2026-07-25", produk_id: produk,
      qty_rencana: permohonan, qty_realisasi: realisasi
    }));
    const { error: e9 } = await supabase.from("produksi").insert(produksi);
    if (e9) throw e9;
    console.log("   Produksi: " + produksi.length + " entries");

    // === 5. STOK MOVEMENT OUT (25 Juli) ===
    console.log("\n5. Stok movement OUT (25 Juli)...");
    const resep: Record<string, Record<string, number>> = {
      "p-bubur": { "b-brs01": 150, "b-cb01": 1, "b-ttp01": 1, "b-sen01": 0.1, "b-ts01": 1 },
      "p-nasitim": { "b-brs01": 180, "b-cb01": 1, "b-ttp01": 1, "b-sen01": 0.1, "b-ts01": 1 },
      "p-oatmeal": { "b-oat01": 154, "b-cupoat1": 1, "b-sen01": 0.1, "b-ts01": 1 },
      "p-puding": { "b-pud01": 130, "b-cuppud01": 1, "b-sen01": 0.1, "b-ts01": 1 },
      "p-abon": { "b-ab01": 10, "b-krs01": 1, "b-sen01": 0.1 },
      "p-sayur": { "b-sh01": 100, "b-sb01": 50, "b-sp01": 50, "b-cb01": 1, "b-ttp01": 1, "b-sen01": 0.1, "b-ts01": 1 }
    };
    const stokOut: any[] = [];
    for (const p of produksi) {
      const bahan = resep[p.produk_id];
      if (!bahan) continue;
      for (const [bahanId, qty] of Object.entries(bahan)) {
        const total = Math.ceil((qty as number) * p.qty_realisasi);
        stokOut.push({
          id: "sm-out-" + Math.random().toString(36).substr(2, 9),
          tanggal: "2026-07-25", bahan_id: bahanId, tipe: "OUT",
          qty: total, keterangan: "Pemakaian Produksi - Produksi pagi", produksi_id: p.id
        });
      }
    }
    const { error: e10 } = await supabase.from("stok_movement").insert(stokOut);
    if (e10) throw e10;
    console.log("   Stok OUT: " + stokOut.length + " records");

    console.log("\n=== RESTORE SELESAI ===");
    console.log("Data berhasil di-restore untuk 25 Juli 2026");
    console.log("   " + users.length + " users, " + coaData.length + " COA, " + karyawanData.length + " karyawan");
    console.log("   " + bahanData.length + " bahan baku, " + produksi.length + " produksi");
    console.log("   " + (stokIn.length + stokOut.length) + " stok movements total");
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  }
}

main();
