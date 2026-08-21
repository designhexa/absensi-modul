-- =============================================================================
-- Tabel: outlets
-- =============================================================================
CREATE TABLE IF NOT EXISTS outlets (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  lokasi TEXT DEFAULT '-'
);

-- =============================================================================
-- Tabel: users (akun login)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  nama TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'karyawan',
  outlet_id TEXT REFERENCES outlets(id) ON DELETE SET NULL,
  karyawan_id TEXT
);

-- =============================================================================
-- Tabel: karyawan
-- =============================================================================
CREATE TABLE IF NOT EXISTS karyawan (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  posisi TEXT NOT NULL DEFAULT 'Kasir',
  role TEXT NOT NULL DEFAULT 'karyawan',
  outlet_id TEXT REFERENCES outlets(id) ON DELETE SET NULL,
  gaji_pokok NUMERIC NOT NULL DEFAULT 0,
  bonus_omset NUMERIC NOT NULL DEFAULT 0,
  bonus_ulasan NUMERIC NOT NULL DEFAULT 0,
  bonus_oh NUMERIC NOT NULL DEFAULT 0,
  tunjangan_harian NUMERIC NOT NULL DEFAULT 0,
  overtime_rate NUMERIC NOT NULL DEFAULT 0,
  jam_masuk TEXT,
  jam_pulang TEXT
);

-- =============================================================================
-- Tabel: absensi
-- =============================================================================
CREATE TABLE IF NOT EXISTS absensi (
  id TEXT PRIMARY KEY,
  tanggal TEXT NOT NULL,
  karyawan_id TEXT NOT NULL REFERENCES karyawan(id) ON DELETE CASCADE,
  jam_masuk TEXT,
  jam_pulang TEXT,
  status TEXT NOT NULL DEFAULT 'Hadir',
  catatan TEXT,
  bonus NUMERIC DEFAULT 0,
  tunjangan NUMERIC DEFAULT 0,
  overtime NUMERIC DEFAULT 0
);

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_absensi_tanggal ON absensi(tanggal);
CREATE INDEX IF NOT EXISTS idx_absensi_karyawan ON absensi(karyawan_id);
CREATE INDEX IF NOT EXISTS idx_users_karyawan ON users(karyawan_id);
CREATE INDEX IF NOT EXISTS idx_karyawan_outlet ON karyawan(outlet_id);

-- =============================================================================
-- Seed data: Admin
-- =============================================================================
INSERT INTO users (username, password, nama, role) VALUES
  ('admin', 'admin123', 'Administrator', 'admin'),
  ('khazana', 'Fazana@10', 'Super Admin', 'admin')
ON CONFLICT (username) DO NOTHING;

-- =============================================================================
-- Seed data: 13 Outlet + Karyawan + Users
-- =============================================================================
DO $$
DECLARE
  outlet_names TEXT[] := ARRAY[
    'Gunung Gangsir', 'Randu Pitu', 'Kuti', 'Sidohwayah', 'Gempeng',
    'Kesambi', 'Permata', 'MCA', 'Sugihwaras', 'Sidokare',
    'Kenongo', 'Kepadangan', 'Pagerwojo'
  ];
  i INT;
  o_id TEXT;
  o_slug TEXT;
BEGIN
  FOR i IN 1..array_length(outlet_names, 1) LOOP
    -- Generate slug
    o_slug := lower(regexp_replace(regexp_replace(outlet_names[i], '[^a-z0-9]+', '-', 'g'), '^-|-$', '', 'g'));
    o_id := 'o-' || o_slug;

    -- Insert outlet
    INSERT INTO outlets (id, nama, lokasi)
    VALUES (o_id, outlet_names[i], '-')
    ON CONFLICT (id) DO NOTHING;

    -- Insert karyawan
    INSERT INTO karyawan (id, nama, posisi, role, outlet_id, gaji_pokok, tunjangan_harian, overtime_rate, jam_masuk, jam_pulang)
    VALUES (
      'k-' || o_id || '-1',
      'Staff ' || outlet_names[i] || ' A',
      'Kasir',
      'karyawan',
      o_id,
      17500,
      5000,
      10000,
      '07:00',
      '14:00'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Insert user account
    INSERT INTO users (username, password, nama, role, outlet_id, karyawan_id)
    VALUES (
      'pegawai' || i,
      'pegawai123',
      outlet_names[i],
      'karyawan',
      o_id,
      'k-' || o_id || '-1'
    )
    ON CONFLICT (username) DO NOTHING;
  END LOOP;
END $$;

-- =============================================================================
-- Enable Realtime (opsional, untuk sync real-time)
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE outlets;
ALTER PUBLICATION supabase_realtime ADD TABLE karyawan;
ALTER PUBLICATION supabase_realtime ADD TABLE absensi;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
