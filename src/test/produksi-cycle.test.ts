import { describe, it, expect } from "vitest";
import { saldoBahan } from "@/lib/store";
import { SEED_BAHAN } from "@/lib/seed";
import { BahanBaku, StokMovement } from "@/lib/types";

/**
 * Test siklus produksi — Tutup Oat:
 * 1. Seed data Tutup Oat tersedia dengan stok awal 1000
 * 2. Stok Movement OUT untuk produksi Oatmeal mengurangi saldo Tutup Oat
 * 3. Saldo bahan baku berkurang dengan benar
 */
describe("Siklus Produksi — Tutup Oat", () => {
  it("seed data Tutup Oat (TTOAT01) tersedia dengan stok awal 1000", () => {
    const tutupOat = SEED_BAHAN.find((b) => b.id === "b-ttoat01");
    expect(tutupOat).toBeDefined();
    expect(tutupOat!.nama).toBe("TUTUP OAT");
    expect(tutupOat!.kode).toBe("TTOAT01");
    expect(tutupOat!.stokAwal).toBe(1000);
    expect(tutupOat!.satuan).toBe("biji");
  });

  it("saldoBahan menghitung stok awal dengan benar tanpa movement", () => {
    // Mock state dengan hanya seed data
    const mockState = {
      bahan: SEED_BAHAN,
      stokMov: [] as StokMovement[],
    } as any;

    const saldo = saldoBahan("b-ttoat01", mockState);
    expect(saldo).toBe(1000); // stok awal
  });

  it("pemotongan stok (OUT movement) mengurangi saldo Tutup Oat", () => {
    // Seed: TUTUP OAT stokAwal = 1000, unit-based (tidak ada konversiGram)
    // Tidak masuk GRAM_EXCLUDED_BAHAN karena tidak memiliki konversiGram
    
    const mockState = {
      bahan: SEED_BAHAN,
      stokMov: [
        {
          id: "m-1",
          tanggal: "2026-07-28",
          bahanId: "b-ttoat01",
          tipe: "OUT",
          qty: 50,
          keterangan: "Pemakaian Produksi [2026-07-28]",
        },
      ] as StokMovement[],
    } as any;

    const saldo = saldoBahan("b-ttoat01", mockState);
    expect(saldo).toBe(950); // 1000 - 50
  });

  it("beberapa pemotongan stok mengurangi saldo dengan benar (siklus lengkap)", () => {
    const mockState = {
      bahan: SEED_BAHAN,
      stokMov: [
        {
          id: "m-1",
          tanggal: "2026-07-28",
          bahanId: "b-ttoat01",
          tipe: "OUT",
          qty: 30,
          keterangan: "Pemakaian Produksi [batch 1]",
        },
        {
          id: "m-2",
          tanggal: "2026-07-28",
          bahanId: "b-ttoat01",
          tipe: "OUT",
          qty: 45,
          keterangan: "Pemakaian Produksi [batch 2]",
        },
        {
          id: "m-3",
          tanggal: "2026-07-28",
          bahanId: "b-ttoat01",
          tipe: "IN",
          qty: 10,
          keterangan: "Retur dari outlet",
        },
      ] as StokMovement[],
    } as any;

    const saldo = saldoBahan("b-ttoat01", mockState);
    // 1000 (stok awal) - 30 (OUT) - 45 (OUT) + 10 (IN) = 935
    expect(saldo).toBe(935);
  });

  it("bahan lain tidak terpengaruh oleh movement Tutup Oat", () => {
    const mockState = {
      bahan: SEED_BAHAN,
      stokMov: [
        {
          id: "m-1",
          tanggal: "2026-07-28",
          bahanId: "b-ttoat01",
          tipe: "OUT",
          qty: 100,
        },
      ] as StokMovement[],
    } as any;

    // OAT (b-oat01) memiliki stokAwal=25 dan masuk GRAM_EXCLUDED_BAHAN
    // sehingga perhitungan unit-based: saldo = stokAwal + movement
    // Tidak ada movement OAT, jadi saldo tetap 25
    const saldoOat = saldoBahan("b-oat01", mockState);
    expect(saldoOat).toBe(25);
  });

  it("Tutup Oat sudah terdaftar di SEED_BAHAN dengan ID b-ttoat01", () => {
    const ids = SEED_BAHAN.map((b) => b.id);
    expect(ids).toContain("b-ttoat01");

    // Verifikasi tidak konflik dengan TUTUP (TTP01) yang sudah ada
    const tutupOat = SEED_BAHAN.find((b) => b.id === "b-ttoat01");
    const tutup = SEED_BAHAN.find((b) => b.id === "b-ttp01");
    expect(tutupOat).toBeDefined();
    expect(tutup).toBeDefined();
    expect(tutupOat!.id).not.toBe(tutup!.id);
  });
});
