export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const monthKey = (iso: string) => iso.slice(0, 7);

export interface DateRange {
  from?: string;
  to?: string;
}

export const inRange = (iso: string, r: DateRange) => {
  if (r.from && iso < r.from) return false;
  if (r.to && iso > r.to) return false;
  return true;
};

export const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// Hitung harga per gram dari harga beli per satuan dan konversi gram
// Contoh: hargaBeli=15500 (per pack), konversiGram=700 → Rp22.14/g
export const hargaPerGram = (hargaBeli: number, konversiGram?: number | null): number => {
  if (!konversiGram || konversiGram <= 0) return hargaBeli; // fallback: treat satuan as 1
  return hargaBeli / konversiGram;
};

// Hitung nilai persediaan berdasarkan gramasi (presisi HPP)
// saldo dalam gram (untuk bahan dengan konversiGram), hargaBeli per satuan, konversiGram g/satuan
export const nilaiBahan = (saldo: number, hargaBeli: number, konversiGram?: number | null): number => {
  if (!konversiGram || konversiGram <= 0) return saldo * hargaBeli; // fallback: unit-based
  // saldo sudah dalam gram, hitung nilai = gram × (harga_per_satuan / gram_per_satuan)
  return saldo * (hargaBeli / konversiGram);
};

