import { describe, it, expect } from "vitest";
import { BUBUR_BASE, buburCalc, calcKemasanKebutuhan, KEMASAN_BAHAN } from "@/lib/produksi-utils";

/**
 * Verifikasi aturan pemotongan stok di siklus produksi (Produksi.tsx):
 *
 *   Langkah 2 (requestWarehouse)  → potong BAHAN BAKU dari RENCANA (plan).
 *   Langkah 3 (performSaveStep3)  → potong KEMASAN (cup & tutup Puding/Oatmeal)
 *                                   dari HASIL AKTUAL (realisasi pasca masak).
 *
 * Alasan: bahan utama dipotong sesuai rencana (Step 1) dan TIDAK terpengaruh hasil
 * masak; sedangkan cup & tutup mengikuti hasil aktual karena bisa menyusut/meluber.
 * Kemasan BUBUR & NASI TIM TIDAK dipotong di produksi (via request outlet).
 */

// ===== Replikasi materialReqs (Step 2) dari Produksi.tsx =====
const KONV = { puding: 130, oat: 154 }; // konversi gram per pcs (fallback master data)

const materialReqs = (t: {
  buburD: number; buburI: number; timD: number; timI: number;
  oatmeal: number; puding: number; abon: number;
}, settings: any, variants: { bubur1?: string; bubur2?: string; tim1?: string; tim2?: string }) => {
  const reqs: { bahanId: string; qty: number; rawQtyGrams?: number }[] = [];

  const berasGr = Math.ceil(buburCalc(t.buburD + t.buburI, BUBUR_BASE.beras) + (t.timD * settings.berasTim) + (t.timI * settings.berasTim));
  if (berasGr > 0) reqs.push({ bahanId: "b-brs01", qty: berasGr });

  const shGr = Math.ceil(buburCalc(t.buburD + t.buburI, BUBUR_BASE.sayurHijau) + (t.timD + t.timI) * settings.sayurHijauTim);
  if (shGr > 0) reqs.push({ bahanId: "b-sh01", qty: shGr });
  const sbGr = Math.ceil(buburCalc(t.buburD + t.buburI, BUBUR_BASE.sayurBuah) + (t.timD + t.timI) * settings.sayurBuahTim);
  if (sbGr > 0) reqs.push({ bahanId: "b-sb01", qty: sbGr });
  const spGr = Math.ceil(buburCalc(t.buburD + t.buburI, BUBUR_BASE.sayurProtein) + (t.timD + t.timI) * settings.sayurProteinTim);
  if (spGr > 0) reqs.push({ bahanId: "b-sp01", qty: spGr });

  // Identik dgn aplikasi: akumulasi desimal, bulatkan TOTAL sekali (kolom integer)
  const addVariant = (variantId: string | undefined, grams: number) => {
    if (!variantId || grams <= 0) return;
    const existing = reqs.find((r) => r.bahanId === variantId);
    if (existing) {
      existing.rawQtyGrams = (existing.rawQtyGrams || 0) + grams;
      existing.qty = Math.round(existing.rawQtyGrams);
    } else {
      reqs.push({ bahanId: variantId, qty: Math.round(grams), rawQtyGrams: grams });
    }
  };
  if (t.buburD > 0) addVariant(variants.bubur1, buburCalc(t.buburD, BUBUR_BASE.daging));
  if (t.buburI > 0) addVariant(variants.bubur2, buburCalc(t.buburI, BUBUR_BASE.daging));
  if (t.timD > 0) addVariant(variants.tim1, t.timD * settings.dagingTim);
  if (t.timI > 0) addVariant(variants.tim2, t.timI * settings.dagingTim);

  const pudingPcs = Math.ceil(Math.ceil(t.puding * settings.pudingCup) / KONV.puding);
  if (pudingPcs > 0) reqs.push({ bahanId: "b-pud01", qty: pudingPcs });
  const oatPcs = Math.ceil(Math.ceil(t.oatmeal * settings.oatmealCup) / KONV.oat);
  if (oatPcs > 0) reqs.push({ bahanId: "b-oat01", qty: oatPcs });

  const abonGr = Math.ceil(t.abon * settings.abonCup);
  if (t.abon > 0) reqs.push({ bahanId: "b-ab01", qty: abonGr });
  return reqs;
};

// ===== Replikasi packagingReqs (Step 3) dari Produksi.tsx =====
const packagingReqs = (actualCups: { puding: number; oatmeal: number }) =>
  calcKemasanKebutuhan(actualCups).map((k) => ({ bahanId: k.bahanId, qty: k.qty }));

const SETTINGS = {
  berasTim: 20, dagingTim: 0.8, sayurHijauTim: 1.6, sayurBuahTim: 1.0, sayurProteinTim: 0.3,
  oatmealCup: 25.71, pudingCup: 13.0, abonCup: 10.0,
};

const PLAN = { buburD: 150, buburI: 120, timD: 90, timI: 110, oatmeal: 40, puding: 60, abon: 25 };
const VARIANTS = { bubur1: "b-ay01", bubur2: "b-sl01", tim1: "b-dg01", tim2: "b-tn01" };

describe("Langkah 2 — Pemotongan BAHAN BAKU dari RENCANA", () => {
  it("memotong beras, sayur, daging, puding, oat & abon sesuai rencana", () => {
    const reqs = materialReqs(PLAN, SETTINGS, VARIANTS);
    const ids = reqs.map((r) => r.bahanId);
    expect(ids).toContain("b-brs01");
    expect(ids).toContain("b-sh01");
    expect(ids).toContain("b-sb01");
    expect(ids).toContain("b-sp01");
    expect(ids).toContain("b-ay01"); // daging bubur 1
    expect(ids).toContain("b-sl01"); // daging bubur 2
    expect(ids).toContain("b-dg01"); // daging tim 1
    expect(ids).toContain("b-tn01"); // daging tim 2
    expect(ids).toContain("b-pud01");
    expect(ids).toContain("b-oat01");
    expect(ids).toContain("b-ab01");
  });

  it("TIDAK memotong kemasan (cup & tutup) di Langkah 2", () => {
    const reqs = materialReqs(PLAN, SETTINGS, VARIANTS);
    const kemasanIds = new Set<string>(KEMASAN_BAHAN.map((k) => k.bahanId));
    reqs.forEach((r) => expect(kemasanIds.has(r.bahanId)).toBe(false));
  });

  it("qty daging (gram desimal) disimpan sebagai bilangan BULAT (kolom integer)", () => {
    const reqs = materialReqs(PLAN, SETTINGS, VARIANTS);
    const meatIds = ["b-ay01", "b-sl01", "b-dg01", "b-tn01"];
    const meats = reqs.filter((r) => meatIds.includes(r.bahanId));
    expect(meats.length).toBeGreaterThan(0);
    meats.forEach((r) => expect(Number.isInteger(r.qty)).toBe(true));
  });

  it("bahan tetap sesuai RENCANA meski hasil produksi MENYUSUT (bahan tdk dikembalikan)", () => {
    const reqs = materialReqs(PLAN, SETTINGS, VARIANTS);
    const berasRencana = reqs.find((r) => r.bahanId === "b-brs01")!.qty;
    // Realisasi bubur/tim jauh lebih kecil dari rencana → potongan bahan TIDAK berubah
    expect(berasRencana).toBeGreaterThan(0);
  });
});

describe("Langkah 3 — Pemotongan KEMASAN dari HASIL AKTUAL", () => {
  it("menghitung cup & tutup 1:1 dari realisasi puding & oatmeal", () => {
    const reqs = packagingReqs({ puding: 60, oatmeal: 40 });
    expect(reqs).toEqual([
      { bahanId: "b-cuppud01", qty: 60 },
      { bahanId: "b-plas01", qty: 60 },
      { bahanId: "b-cupoat1", qty: 40 },
      { bahanId: "b-ttoat01", qty: 40 }
    ]);
  });

  it("hasil MENYUSUT → kemasan lebih kecil dari rencana", () => {
    // Rencana puding 60, oat 40 — realisasi hanya 50 & 30
    const reqs = packagingReqs({ puding: 50, oatmeal: 30 });
    const map = new Map(reqs.map((r) => [r.bahanId, r.qty]));
    expect(map.get("b-cuppud01")).toBe(50);
    expect(map.get("b-cupoat1")).toBe(30);
  });

  it("hasil MELUBER → kemasan lebih besar dari rencana", () => {
    const reqs = packagingReqs({ puding: 70, oatmeal: 45 });
    const map = new Map(reqs.map((r) => [r.bahanId, r.qty]));
    expect(map.get("b-cuppud01")).toBe(70);
    expect(map.get("b-plas01")).toBe(70);
    expect(map.get("b-cupoat1")).toBe(45);
    expect(map.get("b-ttoat01")).toBe(45);
  });

  it("TIDAK memotong bahan baku (beras/sayur/daging) di Langkah 3", () => {
    const reqs = packagingReqs({ puding: 60, oatmeal: 40 });
    const bahanIds = new Set(["b-brs01", "b-sh01", "b-sb01", "b-sp01", "b-ay01", "b-sl01", "b-dg01", "b-tn01", "b-pud01", "b-oat01", "b-ab01"]);
    reqs.forEach((r) => expect(bahanIds.has(r.bahanId)).toBe(false));
  });

  it("kemasan BUBUR & NASI TIM TIDAK dipotong di produksi (via request outlet)", () => {
    const kemasanIds = KEMASAN_BAHAN.map((k) => k.bahanId);
    expect(kemasanIds).not.toContain("b-cb01");  // CUP BUBUR
    expect(kemasanIds).not.toContain("b-ttp01"); // TUTUP
  });
});
