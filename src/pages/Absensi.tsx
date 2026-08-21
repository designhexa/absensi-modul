import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { db, useDB } from "@/lib/store";
import { todayISO, DateRange, inRange, rupiah } from "@/lib/format";
import {
  Plus,
  UserCheck,
  Users,
  CalendarCheck,
  Check,
  CheckCircle2,
  MapPin,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { DateInput } from "@/components/DateInput";
import { ExportButtons } from "@/components/ExportButtons";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { useAuth } from "@/lib/auth";
import { StatusAbsen } from "@/lib/types";

const STATUSES: StatusAbsen[] = ["Hadir"];

export default function Absensi() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { karyawan = [], absensi = [], outlets = [] } = useDB();

  const visibleKaryawan = useMemo(() => {
    if (isAdmin) return karyawan;
    return karyawan.filter((k) => k.outletId === user?.outletId);
  }, [karyawan, isAdmin, user]);

  const [tanggal, setTanggal] = useState(todayISO());
  const [karyawanId, setKaryawanId] = useState(
    visibleKaryawan[0]?.id ?? ""
  );

  const getJamForKaryawan = (kid: string) => {
    const k = karyawan.find((x) => x.id === kid);
    return {
      jamMasuk: k?.jamMasuk || (k?.outletId ? "07:00" : "07:30"),
      jamPulang: k?.jamPulang || (k?.outletId ? "14:00" : "15:00"),
    };
  };

  const [jamMasuk, setJamMasuk] = useState("07:30");
  const [jamPulang, setJamPulang] = useState("15:00");

  useEffect(() => {
    if (karyawanId) {
      const j = getJamForKaryawan(karyawanId);
      setJamMasuk(j.jamMasuk);
      setJamPulang(j.jamPulang);
    }
  }, [karyawanId, karyawan]);

  useEffect(() => {
    setRecordedJamMasuk(null);
    setRecordedJamPulang(null);
  }, [karyawanId, tanggal]);

  const [status, setStatus] = useState<StatusAbsen>("Hadir");
  const [bonusInput, setBonusInput] = useState(0);
  const [tunjanganInput, setTunjanganInput] = useState(0);
  const [overtimeInput, setOvertimeInput] = useState(0);
  const [range, setRange] = useState<DateRange>({});

  // GPS State
  const [gpsLoading, setGpsLoading] = useState(true);
  const [recordedJamMasuk, setRecordedJamMasuk] = useState<string | null>(
    null
  );
  const [recordedJamPulang, setRecordedJamPulang] = useState<string | null>(
    null
  );
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [address, setAddress] = useState("Mencari lokasi GPS...");

  const myOutletLocation = useMemo(() => {
    if (user?.role !== "karyawan" || !user?.outletId) return null;
    const myOutlet = outlets.find((o: any) => o.id === user.outletId);
    if (!myOutlet || !myOutlet.lokasi) return null;

    const parts = (myOutlet.lokasi || "").split(" @ ");
    const alamat = parts[0] || "";
    let lat = -7.641234;
    let lng = 112.906123;
    let radius = 100;

    if (parts[1]) {
      const coords = parts[1].split(",");
      if (coords[0]) lat = parseFloat(coords[0]) || lat;
      if (coords[1]) lng = parseFloat(coords[1]) || lng;
      if (coords[2]) radius = parseInt(coords[2]) || radius;
    }

    return { alamat, lat, lng, radius, nama: myOutlet.nama };
  }, [user, outlets]);

  const getOutletAddress = (lat: number, lng: number) => {
    const loc = myOutletLocation;
    if (loc) {
      return `${loc.nama}, ${loc.alamat || "-"} (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
    }
    const outletNama =
      user?.role === "karyawan"
        ? user?.nama || "Lokasi"
        : "Dapur Utama";
    return `${outletNama} (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
  };

  const fetchGPSLocation = () => {
    setGpsLoading(true);
    setAddress("Sedang mengambil lokasi...");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCoordinates({ lat, lng });
          setAddress(getOutletAddress(lat, lng));
          setGpsLoading(false);
          toast.success("GPS berhasil mengunci lokasi!");
        },
        (error) => {
          console.error("GPS error:", error);
          setCoordinates(null);
          setAddress("Gagal mendapatkan lokasi GPS — absensi diblokir");
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setCoordinates(null);
      setAddress("Perangkat tidak mendukung GPS — absensi diblokir");
      setGpsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "karyawan") {
      fetchGPSLocation();
    }
  }, [user]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const kid = karyawanId || visibleKaryawan[0]?.id;
    if (!kid) return toast.error("Pilih karyawan");
    setRecordedJamMasuk(status === "Hadir" ? jamMasuk : null);
    setRecordedJamPulang(status === "Hadir" ? jamPulang : null);
    db.addAbsensi({
      tanggal,
      karyawanId: kid,
      jamMasuk: status === "Hadir" ? jamMasuk : undefined,
      jamPulang: status === "Hadir" ? jamPulang : undefined,
      status,
      bonus: bonusInput,
      tunjangan: tunjanganInput,
      overtime: overtimeInput,
    });
    toast.success("Absensi disimpan");
    setBonusInput(0);
    setTunjanganInput(0);
    setOvertimeInput(0);
  };

  const currentTime = () => {
    const w = new Date();
    return `${String(w.getHours()).padStart(2, "0")}:${String(w.getMinutes()).padStart(2, "0")}`;
  };

  const todayRecord = useMemo(() => {
    const kid =
      user?.role === "karyawan"
        ? `k-${user.outletId}-1`
        : karyawanId || visibleKaryawan[0]?.id;
    if (!kid) return null;
    return absensi.find(
      (a) => a.tanggal === todayISO() && a.karyawanId === kid
    );
  }, [absensi, karyawanId, visibleKaryawan, user]);

  const getDistanceMeters = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000;
  };

  const validateGPSDistance = () => {
    if (user?.role !== "karyawan" || !user?.outletId) return true;
    const myOutlet = outlets.find((o: any) => o.id === user.outletId);
    if (
      !myOutlet ||
      !myOutlet.lokasi ||
      !myOutlet.lokasi.includes("@")
    ) {
      toast.info(
        "Koordinat GPS outlet belum diatur — absensi diterima tanpa verifikasi lokasi."
      );
      return true;
    }

    const parts = myOutlet.lokasi.split(" @ ");
    const [latStr, lngStr, radStr] = parts[1].split(",");
    const targetLat = parseFloat(latStr);
    const targetLng = parseFloat(lngStr);
    const radius = parseFloat(radStr || "100");

    if (isNaN(targetLat) || isNaN(targetLng)) {
      toast.error("Koordinat GPS outlet tidak valid.");
      return false;
    }

    if (!coordinates) {
      toast.error(
        "Gagal mendapatkan koordinat GPS Anda! Pastikan GPS aktif."
      );
      return false;
    }

    const dist = getDistanceMeters(
      coordinates.lat,
      coordinates.lng,
      targetLat,
      targetLng
    );
    if (dist > radius) {
      toast.error(
        `Gagal Absen! Anda berada di luar area outlet. Jarak: ${Math.round(dist)} meter (Maks: ${radius} meter).`
      );
      return false;
    }

    return true;
  };

  const handleClockInGPS = () => {
    if (gpsLoading)
      return toast.error("Menunggu GPS mengunci lokasi...");
    if (!validateGPSDistance()) return;
    const jam = currentTime();
    const kid = `k-${user?.outletId}-1`;
    setRecordedJamMasuk(jam);
    db.addAbsensi({
      tanggal: todayISO(),
      karyawanId: kid,
      jamMasuk: jam,
      status: "Hadir",
      catatan: `GPS Check-in: ${address} @ ${jam}`,
    });
    toast.success(`Berhasil Absen Masuk (GPS) pukul ${jam}`);
  };

  const handleClockOutGPS = () => {
    if (!todayRecord) return toast.error("Data absensi tidak ditemukan");
    if (gpsLoading)
      return toast.error("Menunggu GPS mengunci lokasi...");
    if (!validateGPSDistance()) return;
    const jam = currentTime();
    setRecordedJamPulang(jam);
    db.updateAbsensi(todayRecord.id, {
      jamPulang: jam,
      catatan: `${todayRecord.catatan || ""} | GPS Check-out: ${address} @ ${jam}`,
    });
    toast.success(`Berhasil Absen Pulang (GPS) pukul ${jam}`);
  };

  const handleClockIn = () => {
    const kid = karyawanId || visibleKaryawan[0]?.id;
    if (!kid) return toast.error("Pilih karyawan terlebih dahulu");
    const jam = currentTime();
    setRecordedJamMasuk(jam);
    db.addAbsensi({
      tanggal: todayISO(),
      karyawanId: kid,
      jamMasuk: jam,
      status: "Hadir",
      catatan: `Absen Masuk: ${jam}`,
    });
    toast.success(`Berhasil Absen Masuk pukul ${jam}!`);
  };

  const handleClockOut = () => {
    if (!todayRecord) return toast.error("Data absensi tidak ditemukan");
    const jam = currentTime();
    setRecordedJamPulang(jam);
    db.updateAbsensi(todayRecord.id, {
      jamPulang: jam,
      catatan: `${todayRecord.catatan || ""} | Absen Pulang: ${jam}`,
    });
    toast.success(`Berhasil Absen Pulang pukul ${jam}!`);
  };

  const visibleIds = new Set(visibleKaryawan.map((k) => k.id));
  const filtered = useMemo(
    () =>
      absensi
        .filter((a) => visibleIds.has(a.karyawanId) && inRange(a.tanggal, range))
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    [absensi, visibleIds, range]
  );

  // Rekap gaji per karyawan
  const rekap = useMemo(() => {
    return visibleKaryawan.map((k) => {
      const list = filtered.filter((a) => a.karyawanId === k.id);
      const hadir = list.filter((a) => a.status === "Hadir").length;
      const tunjanganHarianKaryawan = k.tunjanganHarian ?? 0;
      const overtimeRateKaryawan =
        k.overtimeRate ?? Math.round((k.gajiPokok / 8) * 1.5);
      const employeeJamMasuk =
        k.jamMasuk || (k.outletId ? "07:00" : "07:30");
      const lateLogs = list.filter(
        (a) => a.jamMasuk && a.jamMasuk > employeeJamMasuk
      );
      const terlambatCount = lateLogs.length;
      const overtimeHours = list.reduce(
        (sum, a) => sum + (a.overtime ?? 0),
        0
      );
      const dailyTunjanganTotal = list.reduce(
        (sum, a) => sum + (a.tunjangan ?? 0),
        0
      );
      const dailyBonusTotal = list.reduce(
        (sum, a) => sum + (a.bonus ?? 0),
        0
      );
      const tunjanganTotal =
        dailyTunjanganTotal + tunjanganHarianKaryawan * hadir;
      const overtimePay = Math.round(overtimeHours * overtimeRateKaryawan);
      const flatBonusOmset = k.bonusOmset ?? 0;
      const flatBonusUlasan = k.bonusUlasan ?? 0;
      const flatBonusOH = k.bonusOH ?? 0;
      const totalBonus =
        dailyBonusTotal + flatBonusOmset + flatBonusUlasan + flatBonusOH;
      const totalGaji =
        hadir * k.gajiPokok + tunjanganTotal + totalBonus + overtimePay;

      return {
        k,
        hadir,
        terlambatCount,
        overtimeHours,
        tunjanganTotal,
        totalBonus,
        totalGaji,
      };
    });
  }, [visibleKaryawan, filtered]);

  const totalHadir = rekap.reduce((s, r) => s + r.hadir, 0);
  const totalGajiAll = rekap.reduce((s, r) => s + r.totalGaji, 0);
  const rekapPg = usePagination(rekap, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gradient">
          Absensi Karyawan
        </h1>
        <p className="text-sm text-muted-foreground">
          Catat kehadiran & rekap penggajian harian
        </p>
      </div>

      {isAdmin ? (
        <Card className="glass border-0 shadow-card">
          <CardHeader>
            <CardTitle>Input Absensi</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={submit}
              className="grid gap-3 md:grid-cols-2 lg:grid-cols-6 lg:items-end"
            >
              <div className="space-y-2 lg:col-span-2">
                <Label>Tanggal</Label>
                <DateInput value={tanggal} onChange={setTanggal} />
              </div>
              <div className="space-y-2">
                <Label>Karyawan</Label>
                <Select
                  value={karyawanId || visibleKaryawan[0]?.id || ""}
                  onValueChange={setKaryawanId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleKaryawan.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.nama} ({k.posisi})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as StatusAbsen)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jam Masuk</Label>
                <Input
                  type="time"
                  value={jamMasuk}
                  onChange={(e) => setJamMasuk(e.target.value)}
                  disabled={status !== "Hadir"}
                />
              </div>
              <div className="space-y-2">
                <Label>Jam Pulang</Label>
                <Input
                  type="time"
                  value={jamPulang}
                  onChange={(e) => setJamPulang(e.target.value)}
                  disabled={status !== "Hadir"}
                />
              </div>
              <div className="space-y-2">
                <Label>Bonus (Rp)</Label>
                <Input
                  type="number"
                  min={0}
                  value={bonusInput || ""}
                  onChange={(e) => setBonusInput(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Tunjangan (Rp)</Label>
                <Input
                  type="number"
                  min={0}
                  value={tunjanganInput || ""}
                  onChange={(e) =>
                    setTunjanganInput(Number(e.target.value))
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Overtime (Jam)</Label>
                <Input
                  type="number"
                  min={0}
                  value={overtimeInput || ""}
                  onChange={(e) =>
                    setOvertimeInput(Number(e.target.value))
                  }
                  placeholder="0"
                />
              </div>
              <Button
                type="submit"
                className="gradient-primary text-primary-foreground hover-lift lg:col-span-2"
              >
                <Plus className="mr-1 h-4 w-4" />
                Simpan Absensi
              </Button>
            </form>

            {(todayRecord || recordedJamMasuk) && (
              <div className="mt-6 bg-muted/40 p-4 rounded-2xl border text-xs text-muted-foreground space-y-1">
                <span className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Status Absensi Hari Ini —{" "}
                  {karyawan.find(
                    (k) =>
                      k.id ===
                      (karyawanId || visibleKaryawan[0]?.id)
                  )?.nama ?? "Karyawan"}
                </span>
                <div>
                  • Jam Masuk:{" "}
                  <span className="font-semibold text-foreground">
                    {recordedJamMasuk ??
                      todayRecord?.jamMasuk ??
                      "-"}
                  </span>
                </div>
                <div>
                  • Jam Pulang:{" "}
                  <span className="font-semibold text-foreground">
                    {recordedJamPulang ??
                      todayRecord?.jamPulang ??
                      "Belum Checkout (Pulang)"}
                  </span>
                </div>
                <div>
                  • Status Data:{" "}
                  <span className="font-semibold text-foreground">
                    {recordedJamPulang ?? todayRecord?.jamPulang
                      ? "Komplit"
                      : "Sementara"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : user?.role === "karyawan" ? (
        /* GPS Attendance for Karyawan */
        <Card className="glass border-0 shadow-card overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-500 animate-pulse" />
              Absensi Mandiri GPS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Map Area */}
            <div className="relative w-full h-[220px] rounded-2xl overflow-hidden bg-sky-100 dark:bg-sky-950 border shadow-inner">
              <svg
                className="absolute inset-0 w-full h-full text-sky-400 dark:text-sky-800 opacity-30"
                xmlns="http://www.w3.org/2000/svg"
              >
                <line
                  x1="0"
                  y1="50"
                  x2="1000"
                  y2="50"
                  stroke="currentColor"
                  strokeWidth="8"
                />
                <line
                  x1="0"
                  y1="120"
                  x2="1000"
                  y2="150"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeDasharray="5,5"
                />
                <line
                  x1="0"
                  y1="200"
                  x2="1000"
                  y2="180"
                  stroke="currentColor"
                  strokeWidth="6"
                />
                <line
                  x1="120"
                  y1="0"
                  x2="100"
                  y2="1000"
                  stroke="currentColor"
                  strokeWidth="10"
                />
                <line
                  x1="280"
                  y1="0"
                  x2="300"
                  y2="1000"
                  stroke="currentColor"
                  strokeWidth="6"
                />
                <line
                  x1="450"
                  y1="0"
                  x2="420"
                  y2="1000"
                  stroke="currentColor"
                  strokeWidth="16"
                />
                <circle
                  cx="200"
                  cy="100"
                  r="50"
                  fill="currentColor"
                  opacity="0.1"
                />
              </svg>

              {/* Safe area ripple */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 animate-pulse pointer-events-none" />

              {/* Pin Marker */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+12px)] flex flex-col items-center">
                <div className="relative flex flex-col items-center animate-bounce">
                  <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center shadow-md p-1">
                    <div className="w-full h-full rounded-full bg-amber-400 border-2 border-white flex items-center justify-center p-0.5">
                      <svg
                        className="w-full h-full text-foreground"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <circle cx="8" cy="11" r="1.5" fill="currentColor" />
                        <circle cx="16" cy="11" r="1.5" fill="currentColor" />
                        <path
                          d="M 7 15 Q 12 18 17 15"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-500 -mt-[1px] drop-shadow-sm" />
                </div>
                <div className="w-3.5 h-1 bg-black/20 rounded-full blur-[1px] mt-1.5" />
              </div>

              {/* Lokasi overlay */}
              <div className="absolute bottom-3 inset-x-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-3 rounded-xl border border-border/40 shadow-soft">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Lokasi Anda</span>
                  <button
                    type="button"
                    onClick={fetchGPSLocation}
                    className="text-primary hover:underline text-[9px] uppercase tracking-normal"
                  >
                    Perbarui GPS
                  </button>
                </div>
                <div className="text-xs font-semibold text-foreground truncate mt-1 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{address}</span>
                </div>
              </div>
            </div>

            {/* GPS Status */}
            <div className="text-center space-y-1">
              {gpsLoading ? (
                <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Sedang mengambil lokasi...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 py-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-success">
                    <div className="h-2 w-2 rounded-full bg-success animate-ping" />
                    GPS Terkunci (Presisi Tinggi)
                  </div>
                  {(() => {
                    const loc = myOutletLocation;
                    const gpsSet = !!(
                      user?.role === "karyawan" &&
                      outlets.find(
                        (o: any) => o.id === user.outletId
                      )?.lokasi?.includes("@")
                    );
                    if (!gpsSet) {
                      return (
                        <p className="text-[10px] text-amber-600">
                          GPS outlet belum diatur — absensi tanpa
                          verifikasi lokasi
                        </p>
                      );
                    }
                    if (coordinates && loc) {
                      const dist = getDistanceMeters(
                        coordinates.lat,
                        coordinates.lng,
                        loc.lat,
                        loc.lng
                      );
                      return (
                        <p className="text-[10px] text-muted-foreground">
                          Anda berada ±{Math.round(dist)} meter dari
                          lokasi outlet
                        </p>
                      );
                    }
                    return (
                      <p className="text-[10px] text-destructive">
                        Lokasi tidak terkunci — absensi diblokir
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Clock-in Info */}
            <div className="bg-muted/30 rounded-2xl p-4 border flex items-center justify-between shadow-sm">
              <div className="bg-white dark:bg-slate-900 border rounded-xl p-2.5 flex flex-col items-center justify-center min-w-[72px] shadow-sm">
                <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-widest">
                  {(() => {
                    const months = [
                      "JAN", "FEB", "MAR", "APR", "MEI", "JUN",
                      "JUL", "AGS", "SEP", "OKT", "NOP", "DES",
                    ];
                    return months[new Date().getMonth()];
                  })()}
                </span>
                <span className="text-2xl font-black text-foreground my-0.5 leading-none">
                  {new Date().getDate()}
                </span>
                <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-widest">
                  {(() => {
                    const daysIndo = [
                      "MINGGU", "SENIN", "SELASA", "RABU",
                      "KAMIS", "JUMAT", "SABTU",
                    ];
                    return daysIndo[new Date().getDay()].slice(0, 3);
                  })()}
                </span>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-2 text-center border-l ml-4 pl-4">
                <div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                    Masuk
                  </div>
                  <div className="text-base font-extrabold text-foreground mt-0.5">
                    {recordedJamMasuk ??
                      todayRecord?.jamMasuk ??
                      "--:--"}
                  </div>
                </div>
                <div className="border-l">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                    Keluar
                  </div>
                  <div className="text-base font-extrabold text-foreground mt-0.5">
                    {recordedJamPulang ??
                      todayRecord?.jamPulang ??
                      "--:--"}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full space-y-3">
              {!todayRecord ? (
                <Button
                  onClick={handleClockInGPS}
                  disabled={gpsLoading}
                  className="w-full h-12 gradient-primary text-primary-foreground hover-lift font-bold text-sm shadow-md"
                >
                  <Plus className="mr-2 h-5 w-5" /> Absen Masuk (GPS)
                </Button>
              ) : !todayRecord.jamPulang ? (
                <Button
                  onClick={handleClockOutGPS}
                  disabled={gpsLoading}
                  className="w-full h-12 bg-success text-success-foreground hover:bg-success/90 hover-lift font-bold text-sm shadow-md"
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" /> Absen Pulang
                  (GPS)
                </Button>
              ) : (
                <div className="h-12 w-full flex items-center justify-center bg-success/10 border border-success/30 rounded-xl text-sm font-semibold text-success shadow-inner">
                  <Check className="mr-2 h-5 w-5 shrink-0" /> Absensi
                  Hari Ini Lengkap (
                  {recordedJamMasuk ?? todayRecord.jamMasuk} -{" "}
                  {recordedJamPulang ?? todayRecord.jamPulang})
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Rekap Tabel */}
      <Card className="glass border-0 shadow-card">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Rekap Kehadiran
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Total hadir: <span className="font-bold text-foreground">{totalHadir}</span> | Total gaji:{" "}
              <span className="font-bold text-foreground">{rupiah(totalGajiAll)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangeFilter value={range} onChange={setRange} />
            <ExportButtons
              data={rekap.map((r) => ({
                Nama: r.k.nama,
                Posisi: r.k.posisi,
                Hadir: r.hadir,
                Terlambat: r.terlambatCount,
                Tunjangan: r.tunjanganTotal,
                Bonus: r.totalBonus,
                "Total Gaji": r.totalGaji,
              }))}
              filename="rekap-absensi"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="text-left p-3 font-semibold text-xs">
                      Nama
                    </th>
                    <th className="text-left p-3 font-semibold text-xs">
                      Posisi
                    </th>
                    <th className="text-center p-3 font-semibold text-xs">
                      Hadir
                    </th>
                    <th className="text-center p-3 font-semibold text-xs">
                      Terlambat
                    </th>
                    <th className="text-right p-3 font-semibold text-xs">
                      Tunjangan
                    </th>
                    <th className="text-right p-3 font-semibold text-xs">
                      Bonus
                    </th>
                    <th className="text-right p-3 font-semibold text-xs">
                      Total Gaji
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rekapPg.paged.map((r) => (
                    <tr
                      key={r.k.id}
                      className="border-t hover:bg-muted/20 transition-colors"
                    >
                      <td className="p-3 font-medium">{r.k.nama}</td>
                      <td className="p-3 text-muted-foreground">
                        {r.k.posisi}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant="outline"
                          className="bg-success/10 text-success border-success/20"
                        >
                          {r.hadir}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        {r.terlambatCount > 0 ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-600 border-amber-500/20"
                          >
                            {r.terlambatCount}x
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {rupiah(r.tunjanganTotal)}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {rupiah(r.totalBonus)}
                      </td>
                      <td className="p-3 text-right font-bold text-primary">
                        {rupiah(r.totalGaji)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-3 flex justify-center">
            <TablePagination
              page={rekapPg.page}
              totalPages={rekapPg.totalPages}
              total={rekapPg.total}
              pageSize={rekapPg.pageSize}
              onChange={rekapPg.setPage}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
