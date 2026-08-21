import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserCheck, Users, Settings, Smartphone, LogIn, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.jpg";

const features = [
  { icon: UserCheck, title: "Absensi GPS", desc: "Karyawan bisa absen masuk & pulang langsung dari HP dengan verifikasi lokasi GPS." },
  { icon: Users, title: "Data Karyawan", desc: "Kelola data karyawan, posisi, gaji, dan jam kerja dalam satu tempat." },
  { icon: Settings, title: "Master Data", desc: "Atur lokasi outlet, koordinat GPS, dan pengaturan sistem absensi." },
  { icon: Smartphone, title: "Mobile Ready", desc: "Tampilan responsif yang nyaman digunakan di HP maupun desktop." },
];

const stats = [
  { k: "13", v: "Lokasi outlet" },
  { k: "GPS", v: "Verifikasi lokasi" },
  { k: "100%", v: "Mobile ready" },
];

export default function Landing() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  if (user) return <Navigate to="/" replace />;
  if (isMobile) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen ambient-bg">
      {/* Nav */}
      <header className="sticky top-0 z-30 glass border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={logo}
              alt="Absensi"
              className="h-9 w-9 rounded-xl object-cover bg-white shadow-soft"
            />
            <div className="leading-tight">
              <div className="font-bold text-sm">Absensi Karyawan</div>
              <div className="text-[10px] text-muted-foreground">
                Sistem Absensi & Master Data
              </div>
            </div>
          </div>
          <Button
            asChild
            size="sm"
            className="gradient-primary text-primary-foreground hover-lift"
          >
            <Link to="/login">
              <LogIn className="mr-1.5 h-4 w-4" />Masuk
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-10 pb-12 md:pt-20 md:pb-20 grid md:grid-cols-2 gap-10 items-center">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 text-accent-foreground text-xs font-medium border border-accent/30">
            <UserCheck className="h-3.5 w-3.5 text-accent" />
            Sistem Absensi Karyawan
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-[1.1]">
            Kelola kehadiran karyawan{" "}
            <span className="text-gradient">13 lokasi</span> dalam satu dasbor.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-md">
            Absensi GPS dari HP, rekap otomatis untuk admin. Tanpa setup rumit, jalan langsung di browser & HP.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              asChild
              size="lg"
              className="gradient-primary text-primary-foreground hover-lift"
            >
              <Link to="/login">
                Mulai Sekarang{" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="hover-lift"
            >
              <a href="#fitur">Lihat Fitur</a>
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-4 max-w-md">
            {stats.map((s) => (
              <div key={s.v} className="glass rounded-2xl p-3 text-center hover-lift">
                <div className="text-xl md:text-2xl font-bold text-primary">
                  {s.k}
                </div>
                <div className="text-[10px] md:text-xs text-muted-foreground">
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mock mobile preview */}
        <div className="relative">
          <div className="absolute -inset-4 gradient-primary rounded-3xl opacity-20 blur-2xl" />
          <div className="relative glass-strong rounded-3xl p-4 shadow-soft border border-border/50 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-destructive" />
              <div className="h-2 w-2 rounded-full bg-warning" />
              <div className="h-2 w-2 rounded-full bg-success" />
              <div className="ml-auto text-[10px] text-muted-foreground">
                absensi.app
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { l: "Hadir Hari Ini", v: "12" },
                { l: "Total Karyawan", v: "15" },
                { l: "Lokasi Aktif", v: "13" },
                { l: "GPS Verified", v: "100%" },
              ].map((c) => (
                <div key={c.l} className="rounded-2xl bg-card border p-3">
                  <div className="text-[10px] text-muted-foreground">
                    {c.l}
                  </div>
                  <div className="text-lg font-bold text-primary mt-0.5">
                    {c.v}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-card border p-3">
              <div className="text-xs text-muted-foreground mb-2">
                Kehadiran Minggu Ini
              </div>
              <div className="flex items-end gap-1 h-20">
                {[12, 10, 13, 11, 12, 0, 0].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md gradient-primary opacity-90"
                    style={{ height: `${(h / 15) * 100}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[8px] text-muted-foreground mt-1">
                <span>Sen</span>
                <span>Sel</span>
                <span>Rab</span>
                <span>Kam</span>
                <span>Jum</span>
                <span>Sab</span>
                <span>Min</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="fitur" className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl md:text-3xl font-bold">
            Fitur <span className="text-gradient">lengkap</span> untuk
            kehadiran karyawan
          </h2>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Dirancang untuk admin & karyawan — sederhana diinput, akurat
            dilaporkan.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="glass rounded-2xl p-5 hover-lift border border-border/50"
            >
              <div className="h-11 w-11 rounded-2xl gradient-primary flex items-center justify-center shadow-soft mb-3">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="font-semibold mb-1">{f.title}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="glass-strong rounded-3xl p-6 md:p-10 text-center border border-border/50">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Siap memulai?
          </h2>
          <p className="text-muted-foreground text-sm md:text-base mb-6 max-w-md mx-auto">
            Masuk sekarang untuk mengelola kehadiran karyawan Anda.
          </p>
          <Button
            asChild
            size="lg"
            className="gradient-primary text-primary-foreground hover-lift"
          >
            <Link to="/login">
              Masuk Sekarang <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <p>&copy; 2026 Absensi Karyawan. Sistem Absensi & Master Data.</p>
      </footer>
    </div>
  );
}
