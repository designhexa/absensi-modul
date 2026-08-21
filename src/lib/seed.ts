import { Outlet, UserAccount, Karyawan } from "./types";

const OUTLET_NAMES = [
  "Gunung Gangsir",
  "Randu Pitu",
  "Kuti",
  "Sidohwayah",
  "Gempeng",
  "Kesambi",
  "Permata",
  "MCA",
  "Sugihwaras",
  "Sidokare",
  "Kenongo",
  "Kepadangan",
  "Pagerwojo",
];

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const SEED_OUTLETS: Outlet[] = OUTLET_NAMES.map((name) => ({
  id: `o-${slug(name)}`,
  nama: name,
  lokasi: "-",
}));

export const SEED_USERS: UserAccount[] = [
  { username: "admin", password: "admin123", nama: "Administrator", role: "admin" },
  { username: "khazana", password: "Fazana@10", nama: "Super Admin", role: "admin" },
  ...SEED_OUTLETS.map((o, i) => ({
    username: `pegawai${i + 1}`,
    password: "pegawai123",
    nama: o.nama,
    role: (i % 4 === 0 ? "operational" : i % 4 === 1 ? "development" : i % 4 === 2 ? "management" : "marketing") as const,
    outletId: o.id,
    karyawanId: `k-${o.id}-1`,
  })),
];

export const SEED_KARYAWAN: Karyawan[] = [
  ...SEED_OUTLETS.map((o, i) => ({
    id: `k-${o.id}-1`,
    nama: `Staff ${o.nama} A`,
    posisi: "Kasir",
    role: i % 4 === 0 ? "operational" : i % 4 === 1 ? "development" : i % 4 === 2 ? "management" : "marketing",
    outletId: o.id,
    gajiPokok: 17500,
    bonusOmset: 0,
    bonusUlasan: 0,
    bonusOH: 0,
    tunjanganHarian: 5000,
    overtimeRate: 10000,
    jamMasuk: "07:00",
    jamPulang: "14:00",
    username: `pegawai${i + 1}`,
    password: "pegawai123",
  })),
];
