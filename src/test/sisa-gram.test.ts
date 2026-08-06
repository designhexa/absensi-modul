import { describe, it, expect } from "vitest";
import { sisaGramToCups, OH_MIN_GRAM } from "@/lib/produksi-utils";

/**
 * SOP Menghitung Produk Bubur & Nasi Tim Terjual:
 *   Terjual = (Stok Awal gr − OH gr) ÷ Berat Rumus (118 Bubur / 108 Nasi Tim), dibulatkan
 *   Sisa gram ≤ 50 gr → dianggap terjual semua (0 cup sisa)
 *   Sisa gram > 50 gr → dianggap sisa minimal 1 cup (dibulatkan NAIK)
 *   Pecahan < 0,5 tidak dibulatkan naik — batas minimal sisa 50 gr.
 */

const terjual = (distCups: number, ohGram: number, gramPerCup: number) =>
  Math.max(0, distCups - Math.min(sisaGramToCups(ohGram, gramPerCup), distCups));

describe("sisaGramToCups — aturan OH 50g (Bubur/Nasi Tim)", () => {
  it("batas minimal sisa adalah 50 gram", () => {
    expect(OH_MIN_GRAM).toBe(50);
  });

  it("sisa 0 gr → 0 cup (semua terjual)", () => {
    expect(sisaGramToCups(0, 118)).toBe(0);
    expect(sisaGramToCups(0, 108)).toBe(0);
  });

  it("sisa ≤ 50 gr → 0 cup (dianggap terjual)", () => {
    expect(sisaGramToCups(50, 118)).toBe(0);
    expect(sisaGramToCups(49, 118)).toBe(0);
    expect(sisaGramToCups(30, 118)).toBe(0);
  });

  it("sisa > 50 gr tapi kurang dari 1 cup → 1 cup sisa", () => {
    expect(sisaGramToCups(51, 118)).toBe(1);
    expect(sisaGramToCups(85, 118)).toBe(1); // contoh SOP
    expect(sisaGramToCups(90, 108)).toBe(1);
  });

  it("sisa pas 1 cup → 1 cup", () => {
    expect(sisaGramToCups(118, 118)).toBe(1);
    expect(sisaGramToCups(108, 108)).toBe(1);
  });

  it("sisa lebih dari 1 cup → dibulatkan naik (ceil)", () => {
    expect(sisaGramToCups(130, 118)).toBe(2);
    expect(sisaGramToCups(590, 118)).toBe(5); // 590/118 = 5 cup
    expect(sisaGramToCups(540, 108)).toBe(5);
  });

  it("nilai negatif / NaN diperlakukan sebagai 0", () => {
    expect(sisaGramToCups(-10, 118)).toBe(0);
    expect(sisaGramToCups(Number.NaN, 118)).toBe(0);
  });
});

describe("SOP hitung terjual Bubur & Nasi Tim", () => {
  it("contoh SOP 1: stok awal 590g (5 cup), OH 85g → terjual 4, OH 1, omzet 14K", () => {
    const dist = 5; // 590 / 118
    const sisaCups = sisaGramToCups(85, 118);
    const sold = terjual(dist, 85, 118);
    expect(sisaCups).toBe(1);
    expect(sold).toBe(4);
    expect(sold * 3500).toBe(14000);
  });

  it("contoh SOP 2: stok awal 3.120g (26 cup), OH 90g → terjual 25 BUKAN 26", () => {
    const dist = 26; // 3.120 / 120 (berat rumus contoh)
    const sisaCups = sisaGramToCups(90, 120);
    const sold = terjual(dist, 90, 120);
    expect(sisaCups).toBe(1);
    expect(sold).toBe(25);
    expect(sold).not.toBe(26);
  });

  it("OH ≤ 50 gr → semua terjual (sisa 0 cup)", () => {
    expect(terjual(5, 40, 118)).toBe(5);
    expect(terjual(5, 50, 118)).toBe(5);
  });

  it("OH tidak boleh melebihi distribusi (clamp)", () => {
    expect(terjual(5, 9999, 118)).toBe(0);
  });
});
