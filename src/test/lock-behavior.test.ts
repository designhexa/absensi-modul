import { describe, it, expect } from "vitest";
import {
  DEFAULT_LOCK_DEADLINE,
  isPastLockDeadline,
  computeIsLocked,
} from "@/lib/produksi-utils";

describe("DEFAULT_LOCK_DEADLINE", () => {
  it("harus 13:00 (bukan 11:00)", () => {
    expect(DEFAULT_LOCK_DEADLINE).toBe("13:00");
  });
});

describe("isPastLockDeadline", () => {
  const today = "2026-08-03";

  it("menggunakan default 13:00 bila lockDeadlineTime kosong", () => {
    const now = new Date("2026-08-03T14:00:00"); // lewat 13:00
    expect(isPastLockDeadline(undefined, today, today, now)).toBe(true);
    expect(isPastLockDeadline("", today, today, now)).toBe(true);
  });

  it("false sebelum 13:00", () => {
    const now = new Date("2026-08-03T10:00:00");
    expect(isPastLockDeadline("13:00", today, today, now)).toBe(false);
  });

  it("true saat tepat pukul 13:00 (hour sama, minute >= 0)", () => {
    const now = new Date("2026-08-03T13:00:00");
    expect(isPastLockDeadline("13:00", today, today, now)).toBe(true);
  });

  it("true setelah 13:00", () => {
    const now = new Date("2026-08-03T13:30:00");
    expect(isPastLockDeadline("13:00", today, today, now)).toBe(true);
  });

  it("false untuk tanggal selain hari ini (tidak dikunci)", () => {
    const now = new Date("2026-08-03T14:00:00");
    expect(isPastLockDeadline("13:00", "2026-08-04", today, now)).toBe(false);
  });

  it("menghormati deadline custom (mis. 11:00)", () => {
    const now = new Date("2026-08-03T11:30:00");
    expect(isPastLockDeadline("11:00", today, today, now)).toBe(true);
  });
});

describe("computeIsLocked", () => {
  const today = "2026-08-03";
  const afterDeadline = new Date("2026-08-03T14:00:00"); // lewat 13:00

  const base = {
    lockDeadlineTime: "13:00",
    tanggal: today,
    today,
    now: afterDeadline,
    isCycleClosed: false,
  };

  it("toggle OFF + lewat deadline → TIDAK terkunci (outlet tetap bisa input)", () => {
    const locked = computeIsLocked({ ...base, lockEnabled: false });
    expect(locked).toBe(false);
  });

  it("toggle OFF + lewat deadline + lockDeadlineTime kosong → TIDAK terkunci", () => {
    const locked = computeIsLocked({
      ...base,
      lockEnabled: false,
      lockDeadlineTime: undefined,
    });
    expect(locked).toBe(false);
  });

  it("toggle ON + sebelum deadline → TIDAK terkunci", () => {
    const locked = computeIsLocked({
      ...base,
      lockEnabled: true,
      now: new Date("2026-08-03T10:00:00"),
    });
    expect(locked).toBe(false);
  });

  it("toggle ON + lewat deadline → terkunci", () => {
    const locked = computeIsLocked({ ...base, lockEnabled: true });
    expect(locked).toBe(true);
  });

  it("siklus ditutup → terkunci meskipun toggle OFF", () => {
    const locked = computeIsLocked({
      ...base,
      lockEnabled: false,
      isCycleClosed: true,
    });
    expect(locked).toBe(true);
  });

  it("toggle ON + tanggal bukan hari ini → TIDAK terkunci", () => {
    const locked = computeIsLocked({
      ...base,
      lockEnabled: true,
      tanggal: "2026-08-04",
    });
    expect(locked).toBe(false);
  });
});
