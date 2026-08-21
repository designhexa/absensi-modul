// =============================================================================
// Tipe Data Aplikasi Absensi Master Data
// =============================================================================

export interface Outlet {
  id: string;
  nama: string;
  lokasi: string;
}

export const EMPLOYEE_ROLES = [
  "management",
  "supervisi",
  "staff",
] as const;

export type Role = "admin" | (typeof EMPLOYEE_ROLES)[number];

export interface UserAccount {
  username: string;
  password: string;
  nama: string;
  role: Role;
  outletId?: string;
  karyawanId?: string;
}

// === Karyawan ===
export interface Karyawan {
  id: string;
  nama: string;
  role: Role;
  outletId?: string;
  gajiPokok: number; // per hari
  bonus?: number;
  tunjanganHarian?: number;
  overtimeRate?: number;
  jamMasuk?: string; // "HH:mm"
  jamPulang?: string; // "HH:mm"
  username?: string;
  password?: string;
}

export type StatusAbsen = "Hadir" | "Izin" | "Sakit" | "Alpha";

export interface Absensi {
  id: string;
  tanggal: string;
  karyawanId: string;
  jamMasuk?: string; // "HH:mm"
  jamPulang?: string;
  status: StatusAbsen;
  catatan?: string;
  bonus?: number;
  tunjangan?: number;
  overtime?: number; // hours
}
