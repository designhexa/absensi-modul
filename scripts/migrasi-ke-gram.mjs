#!/usr/bin/env node
/**
 * Migration script: Convert existing stok_movement.qty from unit-based to gram-based
 * for bahan baku that have konversiGram.
 *
 * Items with konversiGram, EXCEPT Oat & Puding (yang tetap sachet-based):
 * - BRS01 (BERAS) → 600 gr/Pack
 * - DG01 (DAGING) → 35 gr/sachet
 * - AY01 (AYAM) → 35 gr/sachet
 * - TN01 (TUNA) → 35 gr/sachet
 * - TG01 (TENGIRI) → 35 gr/sachet
 * - SL01 (SALMON) → 35 gr/sachet
 * - GR01 (GURAMI) → 35 gr/sachet
 * - KK01 (KAKAP) → 35 gr/sachet
 * - DR01 (DORI) → 35 gr/sachet
 * - AB01 (ABON) → 10 gr/pcs
 *
 * Items dengan konversiGram tapi TIDAK dikonversi (tetap sachet):
 * - PUD01 (PUDING) → 130 gr/sachet — tetap sachet
 * - OAT01 (OAT) → 154 gr/sachet — tetap sachet
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Bahan yang akan dikonversi dari unit → gram
const CONVERT_BAHAN = new Map([
  ['b-brs01', 600],  // BERAS
  ['b-dg01', 35],    // DAGING
  ['b-ay01', 35],    // AYAM
  ['b-tn01', 35],    // TUNA
  ['b-tg01', 35],    // TENGIRI
  ['b-sl01', 35],    // SALMON
  ['b-gr01', 35],    // GURAMI
  ['b-kk01', 35],    // KAKAP
  ['b-dr01', 35],    // DORI
  ['b-ab01', 10],    // ABON
]);

async function main() {
  console.log('=== Migrasi stok_movement.qty: unit → gram ===\n');

  for (const [bahanId, konversiGram] of CONVERT_BAHAN) {
    // Cek data bahan
    const { data: bahan, error: bahanErr } = await supabase
      .from('bahan_baku')
      .select('*')
      .eq('id', bahanId)
      .single();

    if (bahanErr || !bahan) {
      console.warn(`⚠ Bahan ${bahanId} tidak ditemukan, skip`);
      continue;
    }

    // Ambil semua movement untuk bahan ini
    const { data: movements, error: movErr } = await supabase
      .from('stok_movement')
      .select('id, qty, keterangan')
      .eq('bahan_id', bahanId);

    if (movErr) {
      console.error(`❌ Gagal fetch movement untuk ${bahanId}:`, movErr.message);
      continue;
    }

    if (!movements || movements.length === 0) {
      console.log(`  ${bahan.kode} (${bahan.nama}): ${bahan.stok_awal} ${bahan.satuan} awal × ${konversiGram} gr = ${bahan.stok_awal * konversiGram} gr stok awal. Tidak ada movement.`);
      
      // Update stok_awal menjadi gram
      const newStokAwal = bahan.stok_awal * konversiGram;
      const { error: updateErr } = await supabase
        .from('bahan_baku')
        .update({ stok_awal: newStokAwal })
        .eq('id', bahanId);
      
      if (updateErr) {
        console.error(`  ❌ Gagal update stok_awal: ${updateErr.message}`);
      } else {
        console.log(`  ✅ stok_awal diupdate: ${bahan.stok_awal} ${bahan.satuan} → ${newStokAwal} gr`);
      }
      continue;
    }

    console.log(`\n${bahan.kode} (${bahan.nama}): ${movements.length} movements ditemukan`);
    
    // Update stok_awal menjadi gram
    const newStokAwal = bahan.stok_awal * konversiGram;
    const { error: updateStokErr } = await supabase
      .from('bahan_baku')
      .update({ stok_awal: newStokAwal })
      .eq('id', bahanId);
    
    if (updateStokErr) {
      console.error(`  ❌ Gagal update stok_awal: ${updateStokErr.message}`);
      continue;
    }
    console.log(`  ✅ stok_awal: ${bahan.stok_awal} ${bahan.satuan} → ${newStokAwal} gr`);

    // Update setiap movement qty menjadi gram
    let updated = 0;
    for (const mov of movements) {
      const newQty = Math.round(mov.qty * konversiGram);
      const { error: updateMovErr } = await supabase
        .from('stok_movement')
        .update({ qty: newQty })
        .eq('id', mov.id);
      
      if (updateMovErr) {
        console.error(`  ❌ Gagal update movement ${mov.id}: ${updateMovErr.message}`);
      } else {
        updated++;
      }
    }
    console.log(`  ✅ ${updated}/${movements.length} movement diupdate ke gram`);
  }

  console.log('\n=== Migrasi selesai! ===');
  console.log('Catatan: PUDING (PUD01) dan OAT (OAT01) TIDAK dikonversi — tetap sachet-based.');
}

main().catch(console.error);
