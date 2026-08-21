# Absensi Karyawan

Sistem Absensi & Master Data Karyawan — GPS check-in/out untuk karyawan, admin dashboard.

## Fitur

- **Dashboard** — Stats kehadiran karyawan (hadir hari ini, bulanan, tren)
- **Absensi GPS** — Check-in/out dari HP dengan verifikasi lokasi GPS
- **Master Data** — Kelola Outlet, Karyawan (CRUD + akun), Akun Pengguna
- **Slip Gaji** — Rekap gaji bulanan dari data absensi
- **Mobile Responsive** — Bottom nav untuk karyawan di HP

## Setup Supabase

### 1. Buat Project Supabase

1. Buka [supabase.com](https://supabase.com) → **New Project**
2. Isi nama project, database password, region terdekat
3. Tunggu hingga project selesai dibuat

### 2. Buat Tabel Database

Buka **SQL Editor** di Supabase Dashboard, lalu paste isi file:

```
supabase/migrations/20260821_init_absensi_schema.sql
supabase/migrations/20260821_add_test_employees.sql
supabase/migrations/20260821_rename_outlets_to_departemen.sql
```

Klik **Run** untuk membuat tabel + seed data.

### 3. Set Environment Variables

Buat file `.env` di root project:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Ambil values dari: **Supabase Dashboard → Project Settings → API**

- `VITE_SUPABASE_URL` → Project URL
- `VITE_SUPABASE_ANON_KEY` → `anon` `public` key

### 4. Install & Run

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`

## Login

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Karyawan | `pegawai1` | `pegawai123` |
| Karyawan | `pegawai2` | `pegawai123` |
| ... | `pegawai13` | `pegawai123` |

## Database Schema

### Tabel `departemen`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | text (PK) | ID departemen |
| nama | text | Nama departemen |
| lokasi | text | Alamat @ lat,lng,radius |

### Tabel `users`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| username | text (PK) | Username login |
| password | text | Password |
| nama | text | Nama lengkap |
| role | text | `admin`, `operational`, `development`, `management`, atau `marketing` |
| departemen_id | text (FK) | Departemen penugasan |
| karyawan_id | text (FK) | Link ke tabel karyawan |

### Tabel `karyawan`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | text (PK) | ID karyawan |
| nama | text | Nama karyawan |
| posisi | text | Posisi/jabatan |
| role | text | Role |
| departemen_id | text (FK) | Departemen penugasan |
| gaji_pokok | numeric | Gaji per hari |
| bonus_omset | numeric | Bonus omset bulanan |
| bonus_ulasan | numeric | Bonus ulasan bulanan |
| bonus_oh | numeric | Bonus OH bulanan |
| tunjangan_harian | numeric | Tunjangan per hari |
| overtime_rate | numeric | Tarif lembur per jam |
| jam_masuk | text | Jam masuk (HH:mm) |
| jam_pulang | text | Jam pulang (HH:mm) |

### Tabel `absensi`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | text (PK) | ID absensi |
| tanggal | text | Tanggal (YYYY-MM-DD) |
| karyawan_id | text (FK) | Karyawan |
| jam_masuk | text | Jam check-in |
| jam_pulang | text | Jam check-out |
| status | text | Hadir/Izin/Sakit/Alpha |
| catatan | text | Catatan GPS |
| bonus | numeric | Bonus harian |
| tunjangan | numeric | Tunjangan harian |
| overtime | numeric | Jam lembur |

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL + Realtime)
- React Router v6
- Recharts (grafik)
- Lucide React (icons)
