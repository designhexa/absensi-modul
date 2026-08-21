import { useSyncExternalStore } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import { Outlet, Karyawan, Absensi, UserAccount } from "./types";
import { SEED_OUTLETS, SEED_KARYAWAN, SEED_USERS } from "./seed";

// =============================================================================
// STATE GLOBAL
// =============================================================================

interface DB {
  outlets: Outlet[];
  karyawan: Karyawan[];
  absensi: Absensi[];
  users: UserAccount[];
}

const initial = (): DB => ({
  outlets: SEED_OUTLETS,
  karyawan: SEED_KARYAWAN,
  absensi: [],
  users: SEED_USERS,
});

let state: DB = initial();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => state;

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Helper: fetch a single table and return { data, error }. Never throws.
async function safeFetch(table: string) {
  try {
    const res = await supabase.from(table).select("*");
    if (res.error) {
      console.warn(`safeFetch(${table}):`, res.error);
      return { data: null, error: res.error };
    }
    return { data: res.data, error: null };
  } catch (err) {
    console.warn(`safeFetch(${table}) exception:`, err);
    return { data: null, error: err };
  }
}

function hasData<T>(result: { data: T[] | null }) {
  return Array.isArray(result.data);
}

// Fetch all tables from Supabase and update state cache.
export async function fetchFromSupabase() {
  if (!isSupabaseConfigured) {
    console.warn(
      "Supabase belum dikonfigurasi. Gunakan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada environment hosting."
    );
    return;
  }

  const [departemenRes, karyawanRes, absensiRes, usersRes] = await Promise.all([
    safeFetch("departemen"),
    safeFetch("karyawan"),
    safeFetch("absensi"),
    safeFetch("users"),
  ]);

  state = {
    outlets: hasData(departemenRes)
      ? departemenRes.data!
      : state.outlets,
    karyawan: hasData(karyawanRes)
      ? karyawanRes.data!.map((k: any) => {
      const linkedUser = (usersRes.data || []).find(
        (u: any) => u.karyawan_id === k.id
      );
      return {
        id: k.id,
        nama: k.nama,
        posisi: k.posisi,
        role: k.role || linkedUser?.role || "operational",
        outletId: k.departemen_id,
        gajiPokok: Number(k.gaji_pokok),
        bonusOmset: Number(k.bonus_omset),
        bonusUlasan: Number(k.bonus_ulasan),
        bonusOH: Number(k.bonus_oh ?? 0),
        tunjanganHarian: k.tunjangan_harian
          ? Number(k.tunjangan_harian)
          : 0,
        overtimeRate: k.overtime_rate ? Number(k.overtime_rate) : 0,
        jamMasuk: k.jam_masuk || undefined,
        jamPulang: k.jam_pulang || undefined,
        username: linkedUser?.username || undefined,
        password: linkedUser?.password || undefined,
      };
    })
      : state.karyawan,
    absensi: hasData(absensiRes)
      ? absensiRes.data!.map((a: any) => ({
      id: a.id,
      tanggal: a.tanggal,
      karyawanId: a.karyawan_id,
      jamMasuk: a.jam_masuk,
      jamPulang: a.jam_pulang,
      status: a.status,
      catatan: a.catatan,
      bonus: a.bonus ? Number(a.bonus) : 0,
      tunjangan: a.tunjangan ? Number(a.tunjangan) : 0,
      overtime: a.overtime ? Number(a.overtime) : 0,
    }))
      : state.absensi,
    users: hasData(usersRes)
      ? usersRes.data!.map((u: any) => ({
      username: u.username,
      password: u.password,
      nama: u.nama,
      role: u.role,
      outletId: u.departemen_id,
      karyawanId: u.karyawan_id,
    }))
      : state.users,
  };
  notify();
}

// Initial fetch when module loads
fetchFromSupabase();

if (isSupabaseConfigured) {
  // Polling keeps the browser client independent from Realtime/WebSocket access.
  setInterval(() => {
    fetchFromSupabase();
  }, 30_000);
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const db = {
  // =========================================================================
  // OUTLETS
  // =========================================================================
  async addOutlet(o: Omit<Outlet, "id">) {
    const id = uid();
    const { error } = await supabase
      .from("departemen")
      .insert([{ ...o, id }]);
    if (error) throw error;
    await fetchFromSupabase();
  },
  async updateOutlet(id: string, o: Partial<Outlet>) {
    const { error } = await supabase
      .from("departemen")
      .update(o)
      .eq("id", id);
    if (error) throw error;
    await fetchFromSupabase();
  },
  async deleteOutlet(id: string) {
    const { error } = await supabase
      .from("departemen")
      .delete()
      .eq("id", id);
    if (error) throw error;
    await fetchFromSupabase();
  },

  // =========================================================================
  // KARYAWAN
  // =========================================================================
  async addKaryawan(
    k: Omit<Karyawan, "id">,
    userAccount: { username: string; password: string; role: string }
  ) {
    // Check for duplicate username in DB first
    const { data: existing } = await supabase
      .from("users")
      .select("username")
      .eq("username", userAccount.username)
      .maybeSingle();
    if (existing) {
      throw new Error("Username sudah terdaftar di database");
    }

    const id = uid();
    const role = k.role || userAccount.role || "operational";

    const { error: errK } = await supabase.from("karyawan").insert([
      {
        id,
        nama: k.nama,
        posisi: k.posisi,
        role,
        departemen_id: k.outletId,
        gaji_pokok: k.gajiPokok,
        bonus_omset: k.bonusOmset,
        bonus_ulasan: k.bonusUlasan,
        bonus_oh: k.bonusOH ?? 0,
        tunjangan_harian: k.tunjanganHarian ?? 0,
        overtime_rate: k.overtimeRate ?? 0,
        jam_masuk: k.jamMasuk ?? null,
        jam_pulang: k.jamPulang ?? null,
      },
    ]);
    if (errK) throw errK;

    // Always create linked user account
    const { error: errU } = await supabase.from("users").insert([
      {
        username: userAccount.username,
        password: userAccount.password,
        nama: k.nama,
        role,
        departemen_id: k.outletId ?? null,
        karyawan_id: id,
      },
    ]);
    if (errU) {
      // Rollback: delete the karyawan if user insert fails
      await supabase.from("karyawan").delete().eq("id", id);
      throw errU;
    }

    await fetchFromSupabase();
  },
  async updateKaryawan(
    id: string,
    k: Partial<Karyawan>,
    newPassword?: string
  ) {
    // Check username uniqueness if username is being changed
    if (k.username) {
      const { data: existing } = await supabase
        .from("users")
        .select("username, karyawan_id")
        .eq("username", k.username)
        .maybeSingle();
      if (existing && existing.karyawan_id !== id) {
        throw new Error("Username sudah digunakan oleh karyawan lain");
      }
    }

    const mapped: any = {};
    if (k.nama !== undefined) mapped.nama = k.nama;
    if (k.posisi !== undefined) mapped.posisi = k.posisi;
    if (k.role !== undefined) mapped.role = k.role;
    if (k.outletId !== undefined) mapped.departemen_id = k.outletId;
    if (k.gajiPokok !== undefined) mapped.gaji_pokok = k.gajiPokok;
    if (k.bonusOmset !== undefined) mapped.bonus_omset = k.bonusOmset;
    if (k.bonusUlasan !== undefined) mapped.bonus_ulasan = k.bonusUlasan;
    if (k.bonusOH !== undefined) mapped.bonus_oh = k.bonusOH;
    if (k.tunjanganHarian !== undefined)
      mapped.tunjangan_harian = k.tunjanganHarian;
    if (k.overtimeRate !== undefined) mapped.overtime_rate = k.overtimeRate;
    if (k.jamMasuk !== undefined) mapped.jam_masuk = k.jamMasuk;
    if (k.jamPulang !== undefined) mapped.jam_pulang = k.jamPulang;
    const { data: updatedEmployee, error: employeeUpdateError } = await supabase
      .from("karyawan")
      .update(mapped)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (employeeUpdateError) throw employeeUpdateError;

    if (updatedEmployee) {
      const nextEmployee = updatedEmployee;
      state = {
        ...state,
        karyawan: state.karyawan.map((employee) =>
          employee.id === id
            ? {
                ...employee,
                nama: nextEmployee.nama,
                posisi: nextEmployee.posisi,
                role: nextEmployee.role,
                outletId: nextEmployee.departemen_id,
                gajiPokok: Number(nextEmployee.gaji_pokok),
                bonusOmset: Number(nextEmployee.bonus_omset),
                bonusUlasan: Number(nextEmployee.bonus_ulasan),
                bonusOH: Number(nextEmployee.bonus_oh ?? 0),
                tunjanganHarian: Number(nextEmployee.tunjangan_harian ?? 0),
                overtimeRate: Number(nextEmployee.overtime_rate ?? 0),
                jamMasuk: nextEmployee.jam_masuk || undefined,
                jamPulang: nextEmployee.jam_pulang || undefined,
              }
            : employee
        ),
      };
      notify();
    }

    // Check if linked user account exists, then update or create
    const { data: linkedUser } = await supabase
      .from("users")
      .select("username")
      .eq("karyawan_id", id)
      .maybeSingle();

    const username = k.username || linkedUser?.username;
    const password = newPassword;

    if (linkedUser) {
      const userMapped: any = {};
      if (k.nama !== undefined) userMapped.nama = k.nama;
      if (k.role !== undefined) userMapped.role = k.role;
      if (k.outletId !== undefined)
        userMapped.departemen_id = k.outletId ?? null;
      if (k.username !== undefined) userMapped.username = k.username;
      if (password !== undefined) userMapped.password = password;
      if (Object.keys(userMapped).length > 0) {
        const { error: userUpdateError } = await supabase
          .from("users")
          .update(userMapped)
          .eq("karyawan_id", id);
        if (userUpdateError) throw userUpdateError;
      }
    } else if (username && password) {
      const { error: err } = await supabase.from("users").insert([
        {
          username,
          password,
          nama: k.nama || "",
          role: k.role || "operational",
          departemen_id: k.outletId ?? null,
          karyawan_id: id,
        },
      ]);
      if (err) throw err;
    }
    await fetchFromSupabase();
  },
  async deleteKaryawan(id: string) {
    // Delete associated user account first, then karyawan
    const { error: errU } = await supabase
      .from("users")
      .delete()
      .eq("karyawan_id", id);
    if (errU) throw errU;
    const { error: errK } = await supabase
      .from("karyawan")
      .delete()
      .eq("id", id);
    if (errK) throw errK;
    await fetchFromSupabase();
  },

  // =========================================================================
  // ABSENSI
  // =========================================================================
  async addAbsensi(a: Omit<Absensi, "id">) {
    // Idempoten: hapus dulu absensi lama utk (tanggal, karyawan) yg sama
    const { error: delErr } = await supabase
      .from("absensi")
      .delete()
      .eq("tanggal", a.tanggal)
      .eq("karyawan_id", a.karyawanId);
    if (delErr) {
      console.error(
        `addAbsensi delete lama error (tanggal=${a.tanggal}, karyawan=${a.karyawanId}):`,
        delErr
      );
      throw delErr;
    }

    const id = uid();
    await supabase.from("absensi").insert([
      {
        id,
        tanggal: a.tanggal,
        karyawan_id: a.karyawanId,
        jam_masuk: a.jamMasuk,
        jam_pulang: a.jamPulang,
        status: a.status,
        catatan: a.catatan,
        bonus: a.bonus ?? 0,
        tunjangan: a.tunjangan ?? 0,
        overtime: a.overtime ?? 0,
      },
    ]);
    fetchFromSupabase();
  },
  async deleteAbsensi(id: string) {
    await supabase.from("absensi").delete().eq("id", id);
    fetchFromSupabase();
  },
  async updateAbsensi(id: string, a: Partial<Absensi>) {
    const mapped: any = {};
    if (a.tanggal !== undefined) mapped.tanggal = a.tanggal;
    if (a.karyawanId !== undefined) mapped.karyawan_id = a.karyawanId;
    if (a.jamMasuk !== undefined) mapped.jam_masuk = a.jamMasuk;
    if (a.jamPulang !== undefined) mapped.jam_pulang = a.jamPulang;
    if (a.status !== undefined) mapped.status = a.status;
    if (a.catatan !== undefined) mapped.catatan = a.catatan;
    if (a.bonus !== undefined) mapped.bonus = a.bonus;
    if (a.tunjangan !== undefined) mapped.tunjangan = a.tunjangan;
    if (a.overtime !== undefined) mapped.overtime = a.overtime;
    await supabase.from("absensi").update(mapped).eq("id", id);
    fetchFromSupabase();
  },

  // =========================================================================
  // USERS
  // =========================================================================
  async addUser(u: UserAccount) {
    const { error } = await supabase.from("users").insert([
      {
        username: u.username,
        password: u.password,
        nama: u.nama,
        role: u.role,
        departemen_id:
          u.outletId === "none" || !u.outletId ? null : u.outletId,
      },
    ]);
    if (error) throw error;
    await fetchFromSupabase();
  },
  async updateUser(username: string, u: Partial<UserAccount>) {
    const mapped: any = {};
    if (u.password !== undefined) mapped.password = u.password;
    if (u.nama !== undefined) mapped.nama = u.nama;
    if (u.role !== undefined) mapped.role = u.role;
    if (u.outletId !== undefined)
      mapped.departemen_id =
        u.outletId === "none" || !u.outletId ? null : u.outletId;
    const { error } = await supabase
      .from("users")
      .update(mapped)
      .eq("username", username);
    if (error) throw error;
    await fetchFromSupabase();
  },
  async deleteUser(username: string) {
    const { error } = await supabase
      .from("users")
      .delete()
      .eq("username", username);
    if (error) throw error;
    await fetchFromSupabase();
  },

  async reset() {
    try {
      await Promise.all([
        supabase.from("absensi").delete().neq("id", ""),
        supabase.from("karyawan").delete().neq("id", ""),
        supabase.from("users").delete().neq("username", ""),
        supabase.from("departemen").delete().neq("id", ""),
      ]);

      // re-seed
      await supabase.from("departemen").insert(SEED_OUTLETS);

      const seedUsers = [
        {
          username: "admin",
          password: "admin123",
          nama: "Administrator",
          role: "admin",
          departemen_id: null,
          karyawan_id: null,
        },
        {
          username: "khazana",
          password: "Fazana@10",
          nama: "Super Admin",
          role: "admin",
          departemen_id: null,
          karyawan_id: null,
        },
        ...SEED_OUTLETS.map((o, i) => ({
          username: `pegawai${i + 1}`,
          password: "pegawai123",
          nama: o.nama,
          role: "operational",
          departemen_id: o.id,
          karyawan_id: `k-${o.id}-1`,
        })),
      ];
      await supabase.from("users").insert(seedUsers);

      const seedKaryawanMapped = SEED_KARYAWAN.map((k) => ({
        id: k.id,
        nama: k.nama,
        posisi: k.posisi,
        role: k.role || "karyawan",
        departemen_id: k.outletId,
        gaji_pokok: k.gajiPokok,
        bonus_omset: k.bonusOmset,
        bonus_ulasan: k.bonusUlasan,
        bonus_oh: k.bonusOH ?? 0,
        tunjangan_harian: k.tunjanganHarian ?? 0,
        overtime_rate: k.overtimeRate ?? 0,
        jam_masuk: k.jamMasuk ?? null,
        jam_pulang: k.jamPulang ?? null,
      }));
      await supabase.from("karyawan").insert(seedKaryawanMapped);

      fetchFromSupabase();
    } catch (err) {
      console.error("Failed to reset database:", err);
    }
  },
};
