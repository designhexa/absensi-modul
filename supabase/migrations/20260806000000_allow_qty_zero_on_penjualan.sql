-- Izinkan qty = 0 pada penjualan (kasus OH abon / seluruh stok tidak laku → terjual = 0).
--
-- Latar belakang: commit 17c0659 sengaja menyimpan record penjualan dengan qty=0 agar
-- sisa_gram (OH) tidak hilang saat outlet menginput sisa = seluruh distribusi. Namun
-- constraint DB "penjualan_qty_check" (qty > 0) menolak insert qty=0 → error 23514
-- ("violates check constraint penjualan_qty_check") → seluruh simpanan OH outlet GAGAL.
--
-- Solusi: longgarkan menjadi qty >= 0 (qty negatif tetap tidak boleh).
ALTER TABLE penjualan DROP CONSTRAINT IF EXISTS penjualan_qty_check;
ALTER TABLE penjualan ADD CONSTRAINT penjualan_qty_check CHECK (qty >= 0);
