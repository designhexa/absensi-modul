import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDB } from "@/lib/store";
import { rupiah, todayISO, monthKey, DateRange, daysAgoISO } from "@/lib/format";
import { UserCheck, Users, CalendarCheck, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { EMPLOYEE_ROLES } from "@/lib/types";

export default function Dashboard() {
  const { karyawan = [], absensi = [], outlets = [] } = useDB();
  const { user } = useAuth();
  const today = todayISO();
  const m = monthKey(today);
  const [range, setRange] = useState<DateRange>({
    from: daysAgoISO(13),
    to: today,
  });

  const isAdmin = user?.role === "admin";

  // Today's attendance
  const todayAbsensi = useMemo(
    () => absensi.filter((a) => a.tanggal === today),
    [absensi, today]
  );
  const hadirToday = todayAbsensi.filter((a) => a.status === "Hadir").length;
  const izinToday = todayAbsensi.filter((a) => a.status === "Izin").length;
  const sakitToday = todayAbsensi.filter((a) => a.status === "Sakit").length;
  const alphaToday = todayAbsensi.filter((a) => a.status === "Alpha").length;

  // Monthly stats
  const monthAbsensi = useMemo(
    () => absensi.filter((a) => monthKey(a.tanggal) === m),
    [absensi, m]
  );
  const hadirMonth = monthAbsensi.filter((a) => a.status === "Hadir").length;

  // Attendance trend by range
  const days = useMemo(() => {
    const start = range.from ?? daysAgoISO(13);
    const end = range.to ?? today;
    const result: { tanggal: string; hadir: number; total: number }[] = [];
    const cur = new Date(start);
    const last = new Date(end);
    while (cur <= last) {
      const iso = cur.toISOString().slice(0, 10);
      const dayAbs = absensi.filter((a) => a.tanggal === iso);
      result.push({
        tanggal: iso.slice(5),
        hadir: dayAbs.filter((a) => a.status === "Hadir").length,
        total: dayAbs.length,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return result.slice(-31);
  }, [absensi, range, today]);

  const stats = [
    {
      label: "Hadir Hari Ini",
      value: `${hadirToday}`,
      icon: UserCheck,
      sub: `dari ${karyawan.length} karyawan`,
    },
    {
      label: "Total Karyawan",
      value: `${karyawan.length}`,
      icon: Users,
      sub: `${outlets.length} lokasi`,
    },
    {
      label: "Hadir Bulan Ini",
      value: `${hadirMonth}`,
      icon: CalendarCheck,
      sub: m,
    },
    {
      label: "Izin / Sakit / Alpha",
      value: `${izinToday} / ${sakitToday} / ${alphaToday}`,
      icon: TrendingUp,
      sub: "Hari Ini",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Dashboard</h1>
          <p className="text-muted-foreground">
            Ringkasan kehadiran karyawan
          </p>
        </div>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="glass hover-lift border-0 shadow-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">
                    {s.label}
                  </div>
                  <div className="text-2xl font-bold mt-1">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {s.sub}
                  </div>
                </div>
                <div className="h-11 w-11 rounded-2xl gradient-primary flex items-center justify-center shadow-soft">
                  <s.icon className="h-5 w-5 text-primary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass border-0 shadow-card">
          <CardHeader>
            <CardTitle>Tren Kehadiran</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={days}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="tanggal"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                  }}
                />
                <Bar
                  dataKey="hadir"
                  fill="hsl(var(--primary))"
                  radius={[8, 8, 0, 0]}
                  name="Hadir"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="glass border-0 shadow-card">
            <CardHeader>
              <CardTitle>Karyawan per Departemen</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={EMPLOYEE_ROLES.map((role) => ({
                    nama: role.charAt(0).toUpperCase() + role.slice(1),
                    karyawan: karyawan.filter((k) => k.role === role).length,
                  }))}
                  layout="vertical"
                  margin={{ top: 10, right: 15, left: -30, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    type="number"
                    fontSize={11}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    dataKey="nama"
                    type="category"
                    width={90}
                    fontSize={11}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                    }}
                  />
                  <Bar
                    dataKey="karyawan"
                    fill="hsl(var(--primary))"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
