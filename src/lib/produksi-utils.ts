// =============================================================================
// LOCK / DEADLINE — penguncian input sisa (OH) outlet
// =============================================================================
//
// Default batas waktu input sisa produksi harian. Dulu 11:00, sekarang 13:00.
// Nilai ini dipakai sebagai fallback bila setting belum disimpan di localStorage.
export const DEFAULT_LOCK_DEADLINE = "13:00";

// True jika tanggal yg dipilih = hari ini DAN waktu sekarang sudah lewat deadline.
// Dipakai outlet view supaya bisa diuji terpisah dari React.
export function isPastLockDeadline(
  lockDeadlineTime: string | undefined,
  tanggal: string,
  today: string,
  now: Date
): boolean {
  if (tanggal !== today) return false;
  const [h, m] = (lockDeadlineTime || DEFAULT_LOCK_DEADLINE).split(":").map(Number);
  const hour = now.getHours();
  const minute = now.getMinutes();
  return hour > h || (hour === h && minute >= m);
}

// Status penguncian final: terkunci hanya jika (sudah lewat deadline DAN
// penguncian diaktifkan admin) ATAU siklus sudah ditutup. Saat toggle
// penguncian NONAKTIF, outlet TETAP bisa input meski sudah lewat deadline.
export function computeIsLocked(opts: {
  lockEnabled: boolean;
  lockDeadlineTime: string | undefined;
  tanggal: string;
  today: string;
  now: Date;
  isCycleClosed: boolean;
}): boolean {
  return (isPastLockDeadline(opts.lockDeadlineTime, opts.tanggal, opts.today, opts.now) && opts.lockEnabled) || opts.isCycleClosed;
}

// =============================================================================
// BASE RATIOS & HELPERS for Bubur & Nasi Tim calculations
// =============================================================================
//
// Base ratio: Beras:Daging:Air:S.Hijau:Buah:Protein = 100:5:700:8:5:1.5
// Rasio 100/6 menghasilkan sekitar 16.67 g per cup, jadi hasil dapat berisi desimal.

export const BUBUR_BASE = {
  beras: 100,
  daging: 5,
  air: 700,
  sayurHijau: 8,
  sayurBuah: 5,
  sayurProtein: 1.5, // = 3/2
};

export const formatDecimal = (value: number) => {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2).replace(/(?:\.0+|0+)$/, "");
};

export const buburCalc = (cups: number, baseAmount: number) => (cups * baseAmount) / 6;

// Parse [D:X, I:Y] split from catatan
export const parseSplit = (catatan: string) => {
  const match = catatan?.match(/D:(\d+),I:(\d+)/);
  if (match) {
    return { d: Number(match[1]), i: Number(match[2]) };
  }
  return { d: 0, i: 0 };
};

// Serialize split + variant names into catatan
// Format: [D:X,I:Y] [V:v1Name,v2Name] rest
export const serializeSplit = (d: number, i: number, originalCatatan = "", variant1 = "", variant2 = "") => {
  const cleanCat = originalCatatan.replace(/\[D:\d+,I:\d+\]\s*/, "").replace(/\[V:[^\]]*\]\s*/, "");
  const variantPart = (variant1 || variant2) ? `[V:${variant1},${variant2}] ` : "";
  return `[D:${d},I:${i}] ${variantPart}${cleanCat}`.trim();
};

// Parse variant names from catatan
export const parseVariants = (catatan: string) => {
  const match = catatan?.match(/\[V:([^,\]]+),([^,\]]+)\]/);
  if (match) {
    return { v1: match[1], v2: match[2] };
  }
  return { v1: "", v2: "" };
};

// Helper to get variant names from a date's permohonanStok records
export function getVariantNamesForDate(
  permohonanStok: any[],
  tanggal: string,
  buburFallback1 = "Daging",
  buburFallback2 = "Ikan",
  timFallback1 = "Daging",
  timFallback2 = "Ikan"
): { bubur1: string; bubur2: string; tim1: string; tim2: string } {
  const reqs = permohonanStok.filter((r: any) => r.tanggalKirim === tanggal);
  const buburReq = reqs.find((r: any) => r.produkId === "p-bubur");
  const timReq = reqs.find((r: any) => r.produkId === "p-nasitim");

  const buburVariants = buburReq ? parseVariants(buburReq.catatan || "") : { v1: "", v2: "" };
  const timVariants = timReq ? parseVariants(timReq.catatan || "") : { v1: "", v2: "" };

  return {
    bubur1: buburVariants.v1 || buburFallback1,
    bubur2: buburVariants.v2 || buburFallback2,
    tim1: timVariants.v1 || timFallback1,
    tim2: timVariants.v2 || timFallback2,
  };
}

// Create an empty grid for all outlets
export type OutletGrid = Record<string, {
  bubur_d: number; bubur_i: number;
  tim_d: number; tim_i: number;
  oatmeal: number; puding: number; abon: number;
}>;

export function createEmptyGrid(outlets: { id: string }[]): OutletGrid {
  const grid: OutletGrid = {};
  outlets.forEach(o => {
    grid[o.id] = {
      bubur_d: 0, bubur_i: 0, tim_d: 0, tim_i: 0,
      oatmeal: 0, puding: 0, abon: 0
    };
  });
  return grid;
}

// Load grid from permohonanStok records for a given date
export function loadGridFromReqs(
  outlets: { id: string }[],
  permohonanStok: any[],
  tanggal: string
): OutletGrid {
  const grid = createEmptyGrid(outlets);
  const dayReqs = permohonanStok.filter((r: any) => r.tanggalKirim === tanggal);
  dayReqs.forEach((r: any) => {
    if (!grid[r.outletId]) return;
    const split = parseSplit(r.catatan || "");
    if (r.produkId === "p-bubur") {
      grid[r.outletId].bubur_d = split.d || r.qty;
      grid[r.outletId].bubur_i = split.i || 0;
    } else if (r.produkId === "p-nasitim") {
      grid[r.outletId].tim_d = split.d || r.qty;
      grid[r.outletId].tim_i = split.i || 0;
    } else if (r.produkId === "p-oatmeal") {
      grid[r.outletId].oatmeal = r.qty;
    } else if (r.produkId === "p-puding") {
      grid[r.outletId].puding = r.qty;
    } else if (r.produkId === "p-abon") {
      grid[r.outletId].abon = r.qty;
    }
  });
  return grid;
}

// Calculate totals from a grid
export function sumGrid(grid: OutletGrid) {
  let buburD = 0, buburI = 0, timD = 0, timI = 0;
  let oatmeal = 0, puding = 0, abon = 0;
  Object.values(grid).forEach((v: any) => {
    buburD += v.bubur_d || 0;
    buburI += v.bubur_i || 0;
    timD += v.tim_d || 0;
    timI += v.tim_i || 0;
    oatmeal += v.oatmeal || 0;
    puding += v.puding || 0;
    abon += v.abon || 0;
  });
  return { buburD, buburI, timD, timI, oatmeal, puding, abon };
}

// =============================================================================
// VARIANT MAPPING & DISTRIBUTION SCALING (referensi pasca produksi)
// =============================================================================
//
// Masalah lama: tabel `produksi` menyimpan Bubur 1 & Bubur 2 (dan Tim 1 & Tim 2)
// sebagai 2 baris identik dengan produk_id sama (p-bubur / p-nasitim), dibedakan
// hanya oleh qty_rencana (rencana D vs rencana I). Saat load ulang, kode lama
// mengandalkan urutan array [0]/[1] yang TIDAK dijamin (fetch tanpa ORDER BY,
// id string acak) sehingga realisasi D/I bisa tertukar → error palsu
// "Distribusi melebihi hasil masak aktual!" dan outlet terkunci (status Pending).
//
// Solusi: petakan record ke varian D/I berdasarkan qty_rencana, bukan posisi array.

// Petakan record produksi (bubur/tim) ke varian 1 (D) dan varian 2 (I)
// berdasarkan qty_rencana yang disimpan saat saveStep3 (= rencana D vs rencana I).
// Fallback ke urutan array jika rencana tidak bisa membedakan (mis. D == I).
export function matchVariantRecords(
  records: any[],
  plan1: number, // rencana D (bubur_1 / tim_1)
  plan2: number  // rencana I (bubur_2 / tim_2)
): { rec1?: any; rec2?: any } {
  const recs = [...(records || [])];
  if (recs.length === 0) return {};
  const getRencana = (r: any) => Number(r?.qtyRencana ?? r?.qty_rencana ?? 0);
  if (plan1 !== plan2) {
    const rec1 = recs.find((r) => getRencana(r) === plan1);
    const rec2 = recs.find((r) => getRencana(r) === plan2);
    if (rec1 && rec2) return { rec1, rec2 };
    // Hanya satu yang cocok — varian satunya pakai urutan array sebagai fallback
    if (rec1) return { rec1, rec2: recs.find((r) => r !== rec1) };
    if (rec2) return { rec1: recs.find((r) => r !== rec2), rec2 };
  }
  // Fallback: urutan array (record di-insert berurutan D, I saat saveStep3)
  return { rec1: recs[0], rec2: recs[1] };
}

// Alokasikan `total` ke item-item secara proporsional (largest remainder)
// sehingga jumlah persis sama dengan `total`.
export function allocateProportionally(
  items: { key: string; weight: number }[],
  total: number
): Record<string, number> {
  const weighted = items.filter((it) => it.weight > 0);
  const result: Record<string, number> = {};
  const sumWeight = weighted.reduce((s, w) => s + w.weight, 0);
  if (sumWeight <= 0 || total <= 0) return result;
  const floors = weighted.map((it) => {
    const share = (it.weight * total) / sumWeight;
    return { key: it.key, value: Math.floor(share), frac: share - Math.floor(share) };
  });
  const allocated = floors.reduce((s, f) => s + f.value, 0);
  // Clamp ke 0 jika error float membuat sisa negatif — total tidak boleh terlampaui
  let remaining = Math.max(0, total - allocated);
  floors.sort((a, b) => b.frac - a.frac);
  let i = 0;
  while (remaining > 0 && floors.length > 0) {
    floors[i % floors.length].value += 1;
    remaining -= 1;
    i += 1;
  }
  floors.forEach((f) => { result[f.key] = f.value; });
  return result;
}

// Skala grid distribusi agar total per produk mengikuti hasil masak aktual
// (pasca produksi), proporsional per outlet. Outlet dengan alokasi 0 tetap 0.
// Hasilnya total == target (tidak akan memicu validasi "melebihi hasil masak").
export function scaleGridToActual<T extends Record<string, any>>(
  grid: T,
  actualCups: { bubur_1: number; bubur_2: number; tim_1: number; tim_2: number; oatmeal: number; puding: number; abon: number }
): T {
  const out: Record<string, any> = {};
  Object.keys(grid).forEach((k) => { out[k] = { ...grid[k] }; });
  const fieldPairs: [string, keyof typeof actualCups][] = [
    ["bubur_d", "bubur_1"],
    ["bubur_i", "bubur_2"],
    ["tim_d", "tim_1"],
    ["tim_i", "tim_2"],
    ["oatmeal", "oatmeal"],
    ["puding", "puding"],
    ["abon", "abon"]
  ];
  fieldPairs.forEach(([gridField, actualField]) => {
    const target = actualCups[actualField] ?? 0;
    const currentTotal = Object.values(grid).reduce((s: number, v: any) => s + (v?.[gridField] || 0), 0);
    if (currentTotal <= 0) return;
    const items = Object.keys(grid)
      .filter((k) => (grid[k]?.[gridField] || 0) > 0)
      .map((k) => ({ key: k, weight: grid[k]?.[gridField] || 0 }));
    const alloc = allocateProportionally(items, target);
    Object.keys(grid).forEach((k) => {
      out[k][gridField] = alloc[k] ?? 0;
    });
  });
  return out as T;
}

// Kembalikan salinan grid yang sudah diklamp ke hasil masak aktual: hanya
// menurunkan field yang totalnya MELEBIHI aktual (skala proporsional per outlet).
// Field yang sudah ≤ aktual dibiarkan apa adanya (tidak menaikkan distribusi).
// Dipakai di saveStep4 agar distribusi tidak hard-block saat realisasi < rencana
// (produk tidak sesuai rencana) — stok awal tetap bisa terkirim ke outlet.
export function clampGridToActual<T extends Record<string, any>>(
  grid: T,
  actualCups: { bubur_1: number; bubur_2: number; tim_1: number; tim_2: number; oatmeal: number; puding: number; abon: number }
): T {
  const out: Record<string, any> = {};
  Object.keys(grid).forEach((k) => { out[k] = { ...grid[k] }; });
  const fieldPairs: [string, keyof typeof actualCups][] = [
    ["bubur_d", "bubur_1"],
    ["bubur_i", "bubur_2"],
    ["tim_d", "tim_1"],
    ["tim_i", "tim_2"],
    ["oatmeal", "oatmeal"],
    ["puding", "puding"],
    ["abon", "abon"]
  ];
  fieldPairs.forEach(([gridField, actualField]) => {
    const target = actualCups[actualField] ?? 0;
    const currentTotal = Object.values(grid).reduce((s: number, v: any) => s + (v?.[gridField] || 0), 0);
    if (currentTotal <= target) return; // sudah aman — jangan ubah
    const items = Object.keys(grid)
      .filter((k) => (grid[k]?.[gridField] || 0) > 0)
      .map((k) => ({ key: k, weight: grid[k]?.[gridField] || 0 }));
    const alloc = allocateProportionally(items, target);
    Object.keys(grid).forEach((k) => {
      out[k][gridField] = alloc[k] ?? 0;
    });
  });
  return out as T;
}
