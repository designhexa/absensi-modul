/**
 * Migration Script: Konversi stok_movement.qty dari unit ke gram
 * 
 * Karena saldoBahan() sekarang menginterpretasikan stok_movement.qty sebagai gram
 * (untuk bahan yang memiliki konversiGram), maka data stok_movement lama yang
 * masih dalam unit (Pack, sachet, pcs) perlu dikonversi ke gram.
 * 
 * Cara pakai:
 *   npx ts-node scripts/migrasi-ke-gram.js
 *   atau
 *   node scripts/migrasi-ke-gram.js
 * 
 * Bahan dengan konversiGram:
 *   - b-brs01 (BERAS):    700 gr/Pack
 *   - b-dg01 (DAGING):    35 gr/sachet
 *   - b-ay01 (AYAM):      35 gr/sachet
 *   - b-tn01 (TUNA):      35 gr/sachet
 *   - b-tg01 (TENGIRI):   35 gr/sachet
 *   - b-sl01 (SALMON):    35 gr/sachet
 *   - b-gr01 (GURAMI):    35 gr/sachet
 *   - b-kk01 (KAKAP):     35 gr/sachet
 *   - b-dr01 (DORI):      35 gr/sachet
 *   - b-pud01 (PUDING):   130 gr/sachet
 *   - b-oat01 (OAT):      154 gr/sachet
 *   - b-ab01 (ABON):      10 gr/pcs
 * 
 * Bahan TANPA konversiGram (tetap pakai unit):
 *   - b-cb01 (CUP BUBUR): biji
 *   - b-ttp01 (TUTUP): biji
 *   - b-sen01 (SENDOK): Pack
 *   - b-ts01 (TISU): pcs
 *   - b-krs01 (KRESEK): PACK
 *   - b-bl01 (BALON): biji
 *   - b-plas01 (PLASTIK SELER): pcs
 *   - b-cupoat1 (CUP OAT): biji
 *   - b-cuppud01 (CUP PUDING): biji
 *   - b-sh01 (SAYUR HIJAU): gr (already in grams)
 *   - b-sb01 (SAYUR BUAH): gr (already in grams)
 *   - b-sp01 (SAYUR PROTEIN): gr (already in grams)
 */

const { createClient } = require('@supabase/supabase-js');

// Konfigurasi — ganti dengan URL Supabase project kamu
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('ERROR: VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY harus di-set di environment variables!');
  console.error('Atau jalankan dari project root dengan: npx ts-node scripts/migrasi-ke-gram.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mapping bahanId → konversiGram
const KONVERSI_GRAM = {
  'b-brs01': 700,  // BERAS Pack
  'b-dg01': 35,    // DAGING sachet
  'b-ay01': 35,    // AYAM sachet
  'b-tn01': 35,    // TUNA sachet
  'b-tg01': 35,    // TENGIRI sachet
  'b-sl01': 35,    // SALMON sachet
  'b-gr01': 35,    // GURAMI sachet
  'b-kk01': 35,    // KAKAP sachet
  'b-dr01': 35,    // DORI sachet
  'b-pud01': 130,  // PUDING sachet
  'b-oat01': 154,  // OAT sachet
  'b-ab01': 10,    // ABON pcs
};

async function main() {
  console.log('=== MIGRASI DATA STOK MOVEMENT: UNIT → GRAM ===\n');

  // 1. Ambil semua stok_movement
  const { data: allMov, error: fetchErr } = await supabase
    .from('stok_movement')
    .select('*')
    .order('id');

  if (fetchErr) {
    console.error('Gagal fetch stok_movement:', fetchErr);
    process.exit(1);
  }

  console.log(`Total stok_movement: ${allMov.length}\n`);

  // 2. Filter movement yang perlu dikonversi
  const toUpdate = allMov.filter(m => KONVERSI_GRAM[m.bahan_id] && KONVERSI_GRAM[m.bahan_id] > 0);
  const skip = allMov.filter(m => !KONVERSI_GRAM[m.bahan_id]);

  console.log(`Bahan dengan konversiGram: ${toUpdate.length} movement akan dikonversi`);
  console.log(`Bahan tanpa konversiGram: ${skip.length} movement (tidak perlu dikonversi)\n`);

  if (skip.length > 0) {
    console.log('Bahan tanpa konversiGram (skip):');
    const uniqueBahan = [...new Set(skip.map(m => `${m.bahan_id}`))];
    uniqueBahan.forEach(id => console.log(`  - ${id}`));
    console.log('');
  }

  // 3. Konversi dan update
  let updated = 0;
  let errors = 0;

  for (const m of toUpdate) {
    const kg = KONVERSI_GRAM[m.bahan_id];
    const newQty = m.qty * kg;

    const { error: updErr } = await supabase
      .from('stok_movement')
      .update({ qty: newQty })
      .eq('id', m.id);

    if (updErr) {
      console.error(`  ❌ Gagal update ${m.id} (${m.bahan_id}): ${updErr.message}`);
      errors++;
    } else {
      console.log(`  ✅ ${m.id}: ${m.bahan_id} qty ${m.qty} → ${newQty} (×${kg} gr/${getSatuan(m.bahan_id)})`);
      updated++;
    }
  }

  console.log(`\n=== SELESAI ===`);
  console.log(`✅ Berhasil diupdate: ${updated}`);
  console.log(`❌ Gagal: ${errors}`);
  console.log(`⏭️  Skip (tanpa konversiGram): ${skip.length}`);
  console.log(`\n📌 Refresh browser untuk melihat perubahan saldo.`);
}

function getSatuan(bahanId) {
  const satuanMap = {
    'b-brs01': 'Pack',
    'b-dg01': 'sachet',
    'b-ay01': 'sachet',
    'b-tn01': 'sachet',
    'b-tg01': 'sachet',
    'b-sl01': 'sachet',
    'b-gr01': 'sachet',
    'b-kk01': 'sachet',
    'b-dr01': 'sachet',
    'b-pud01': 'sachet',
    'b-oat01': 'sachet',
    'b-ab01': 'pcs',
  };
  return satuanMap[bahanId] || 'unit';
}

main().catch(console.error);
