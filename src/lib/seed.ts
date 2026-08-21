import { EMPLOYEE_ROLES, Outlet, UserAccount, Karyawan } from "./types";

const DEPARTMENT_NAMES = [
  "management",
  "supervisi",
  "staff",
];

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const SEED_OUTLETS: Outlet[] = DEPARTMENT_NAMES.map((name) => ({
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
    nama: `Pegawai ${o.nama}`,
    role: EMPLOYEE_ROLES[i % EMPLOYEE_ROLES.length],
    outletId: o.id,
    karyawanId: `k-${o.id}-1`,
  })),
];

export const SEED_KARYAWAN: Karyawan[] = [
  ...SEED_OUTLETS.map((o, i) => ({
    id: `k-${o.id}-1`,
    nama: `Pegawai ${o.nama}`,
    role: EMPLOYEE_ROLES[i % EMPLOYEE_ROLES.length],
    outletId: o.id,
    gajiPokok: 17500,
    bonus: 0,
    tunjanganHarian: 5000,
    overtimeRate: 10000,
    jamMasuk: "07:00",
    jamPulang: "14:00",
    username: `pegawai${i + 1}`,
    password: "pegawai123",
  })),
];
