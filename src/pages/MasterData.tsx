import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db, useDB } from "@/lib/store";
import { rupiah } from "@/lib/format";
import { Plus, RotateCcw, Pencil, Store, UserCheck, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";

const parseLokasi = (s: string) => {
  const p = (s || "").split(" @ ");
  const a = p[0] || "";
  let lat = "", lng = "", rad = "100";
  if (p[1]) { const c = p[1].split(","); lat = c[0] || ""; lng = c[1] || ""; rad = c[2] || "100"; }
  return { alamat: a, lat, lng, rad };
};

function genUsername(n: string): string {
  return n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
}

function uniqueUsername(b: string, ex: string[]): string {
  if (!ex.includes(b)) return b;
  let i = 1;
  while (ex.includes(b + i)) i++;
  return b + i;
}

export default function MasterData() {
  const { user } = useAuth();
  const { outlets = [], karyawan = [], users = [] } = useDB();
  const [os, setOs] = useState("");
  const [ks, setKs] = useState("");

  const fO = useMemo(() => {
    if (!os.trim()) return outlets;
    return outlets.filter((o: any) => o.nama.toLowerCase().includes(os.toLowerCase()));
  }, [outlets, os]);
  const fK = useMemo(() => {
    if (!ks.trim()) return karyawan;
    return karyawan.filter((k: any) => k.nama.toLowerCase().includes(ks.toLowerCase()));
  }, [karyawan, ks]);
  const oPg = usePagination(fO, 10);
  const kPg = usePagination(fK, 10);
  const [oN, setON] = useState("");
  const [oL, setOL] = useState("");
  const [oLt, setOLt] = useState("");
  const [oLn, setOLn] = useState("");
  const [oR, setOR] = useState("100");

  if (user?.role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Master Data</h1>
          <p className="text-muted-foreground">Kelola outlet, karyawan, dan akun pengguna</p>
        </div>
        <Button variant="outline" onClick={() => { if (confirm("Reset semua data?")) { db.reset(); toast.success("Data direset"); } }}>
          <RotateCcw className="mr-2 h-4 w-4" />Reset
        </Button>
      </div>

      <Accordion type="single" collapsible className="space-y-2">
        <AccordionItem value="outlet" className="rounded-xl border bg-card overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center"><Store className="h-4 w-4 text-primary-foreground" /></div>
              <div className="text-left"><div className="font-semibold text-sm">Outlet</div><div className="text-[11px] text-muted-foreground">{outlets.length} terdaftar</div></div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="grid gap-4">
              <Card className="border shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-bold">Tambah Outlet</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!oN) return toast.error("Nama outlet diperlukan");
                    const lc = oLt && oLn ? `${oL} @ ${oLt},${oLn},${oR || 100}` : oL || "-";
                    db.addOutlet({ nama: oN, lokasi: lc });
                    setON(""); setOL(""); setOLt(""); setOLn(""); setOR("100");
                    toast.success("Outlet ditambahkan");
                  }} className="space-y-2">
                    <Input value={oN} onChange={(e) => setON(e.target.value)} placeholder="Nama Outlet" />
                    <Input value={oL} onChange={(e) => setOL(e.target.value)} placeholder="Alamat" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={oLt} onChange={(e) => setOLt(e.target.value)} placeholder="Latitude GPS" />
                      <Input value={oLn} onChange={(e) => setOLn(e.target.value)} placeholder="Longitude GPS" />
                    </div>
                    <Input type="number" value={oR} onChange={(e) => setOR(e.target.value)} placeholder="Radius Absensi (M)" />
                    <p className="text-[10px] text-muted-foreground">Lat &amp; Lng opsional — diisi untuk batasan absensi GPS outlet.</p>
                    <Button className="w-full h-9 text-xs gradient-primary text-primary-foreground"><Plus className="mr-1.5 h-3.5 w-3.5" />Tambah Outlet</Button>
                  </form>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardContent className="p-3">
                  <div className="mb-3">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                      <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                        <h3 className="text-sm font-bold px-1 shrink-0">Daftar Outlet</h3>
                        <Input placeholder="Cari outlet..." value={os} onChange={(e) => { setOs(e.target.value); oPg.setPage(1); }} className="h-8 w-40 text-xs shrink-0" />
                      </div>
                      <div className="flex justify-center lg:justify-end shrink-0"><TablePagination page={oPg.page} totalPages={oPg.totalPages} total={oPg.total} pageSize={oPg.pageSize} onChange={oPg.setPage} /></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {oPg.paged.map((o) => {
                      const p = parseLokasi(o.lokasi);
                      return (
                        <div key={o.id} className="rounded-lg border p-3 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{o.nama}</span>
                            <div className="flex gap-1">
                              <EditOutletDialog outlet={o} />
                              <ConfirmDeleteButton className="h-7 w-7" onConfirm={() => db.deleteOutlet(o.id)} title="Hapus Outlet" description={`Outlet ${o.nama} akan dihapus permanen.`} />
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">{p.alamat || "-"}</div>
                          {p.lat !== "" && p.lng !== "" ? (
                            <div className="text-[10px] text-primary font-mono">GPS: {p.lat}, {p.lng} (R:{p.rad}m)</div>
                          ) : (
                            <div className="text-[10px] font-medium text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> GPS belum diatur</div>
                          )}
                        </div>
                      );
                    })}
                    {oPg.paged.length === 0 && <div className="text-center text-muted-foreground py-6 text-sm">Belum ada outlet</div>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="karyawan" className="rounded-xl border bg-card overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center"><UserCheck className="h-4 w-4 text-primary-foreground" /></div>
              <div className="text-left"><div className="font-semibold text-sm">Karyawan</div><div className="text-[11px] text-muted-foreground">{karyawan.length} terdaftar</div></div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="grid gap-4">
              <div className="flex justify-end"><TambahKaryawanDialog outlets={outlets} /></div>
              <Card className="border shadow-sm">
                <CardContent className="p-3">
                  <div className="mb-3">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                      <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                        <h3 className="text-sm font-bold px-1 shrink-0">Daftar Karyawan</h3>
                        <Input placeholder="Cari karyawan..." value={ks} onChange={(e) => { setKs(e.target.value); kPg.setPage(1); }} className="h-8 w-40 text-xs shrink-0" />
                      </div>
                      <div className="flex justify-center lg:justify-end shrink-0"><TablePagination page={kPg.page} totalPages={kPg.totalPages} total={kPg.total} pageSize={kPg.pageSize} onChange={kPg.setPage} /></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {kPg.paged.map((k) => {
                      const o = outlets.find((x) => x.id === k.outletId);
                      return (
                        <div key={k.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{k.nama}</span>
                            <div className="flex gap-1">
                              <EditKaryawanDialog karyawan={k} outlets={outlets} />
                              <ConfirmDeleteButton className="h-7 w-7" onConfirm={() => db.deleteKaryawan(k.id)} title="Hapus Karyawan" description={`Karyawan ${k.nama} akan dihapus permanen.`} />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="capitalize bg-muted px-1.5 py-0.5 rounded text-[10px]">{k.role}</span>
                            <span>{k.posisi}</span><span>&bull;</span><span>{o?.nama ?? "Pusat"}</span><span>&bull;</span><span className="font-semibold">{rupiah(k.gajiPokok)}/hr</span>
                          </div>
                          {k.username && <div className="mt-1.5 text-[10px] text-primary flex items-center gap-1"><Users className="h-3 w-3" /><span>Akun: {k.username}</span></div>}
                        </div>
                      );
                    })}
                    {kPg.paged.length === 0 && <div className="text-center text-muted-foreground py-6 text-sm">Belum ada karyawan</div>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pengguna" className="rounded-xl border bg-card overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center"><Users className="h-4 w-4 text-primary-foreground" /></div>
              <div className="text-left"><div className="font-semibold text-sm">Akun Pengguna</div><div className="text-[11px] text-muted-foreground">{users.length} akun</div></div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <Card className="border shadow-sm">
              <CardContent className="p-3">
                <p className="text-[11px] text-muted-foreground mb-3">Akun admin &amp; akun karyawan.</p>
                <div className="space-y-2">
                  {users.filter((u: any) => u.username !== "khazana").map((u: any) => (
                    <div key={u.username} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div><span className="font-semibold">{u.username}</span><span className="text-xs text-muted-foreground ml-2">{u.nama}</span></div>
                        <EditUserDialog userAccount={u} outlets={outlets} />
                      </div>
                      <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="capitalize bg-muted px-1.5 py-0.5 rounded">{u.role}</span>
                        <span>PW: {u.password}</span>
                      </div>
                    </div>
                  ))}
                  {users.filter((u: any) => u.username !== "khazana").length === 0 && <div className="text-center text-muted-foreground py-6 text-sm">Tidak ada akun</div>}
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// =============================================================================
// Dialog Components
// =============================================================================

function TambahKaryawanDialog({ outlets }: { outlets: any[] }) {
  const { users } = useDB();
  const [open, setOpen] = useState(false);
  const [nama, setNama] = useState("");
  const [username, setUsername] = useState("");
  const [ume, setUme] = useState(false);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("karyawan");
  const [posisi, setPosisi] = useState("Kasir");
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "none");
  const [gajiPokok, setGajiPokok] = useState(17500);
  const [bonusOmset, setBonusOmset] = useState(0);
  const [bonusUlasan, setBonusUlasan] = useState(0);
  const [bonusOH, setBonusOH] = useState(0);
  const [tunjanganHarian, setTunjanganHarian] = useState(0);
  const [overtimeRate, setOvertimeRate] = useState(0);
  const [jamMasuk, setJamMasuk] = useState("07:30");
  const [jamPulang, setJamPulang] = useState("15:00");

  useEffect(() => {
    if (!ume) {
      const eu = users.map((u: any) => u.username);
      const b = genUsername(nama);
      setUsername(b ? uniqueUsername(b, eu) : "");
    }
  }, [nama, ume, users]);

  const rf = () => {
    setNama(""); setUsername(""); setUme(false); setPassword(""); setRole("karyawan");
    setPosisi("Kasir"); setOutletId(outlets[0]?.id ?? "none"); setGajiPokok(17500);
    setBonusOmset(0); setBonusUlasan(0); setBonusOH(0); setTunjanganHarian(0);
    setOvertimeRate(0); setJamMasuk("07:30"); setJamPulang("15:00");
  };

  return (
    <>
      <Button onClick={() => { setOpen(true); rf(); }} className="gradient-primary text-primary-foreground h-9 text-xs">
        <Plus className="mr-1.5 h-3.5 w-3.5" />Tambah Karyawan
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Tambah Karyawan</DialogTitle></DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!nama) return toast.error("Nama diperlukan");
            if (!username) return toast.error("Username diperlukan");
            if (!password) return toast.error("Password diperlukan");
            const fu = username.toLowerCase().trim();
            if (users.some((u: any) => u.username === fu)) return toast.error("Username sudah terdaftar");
            try {
              await db.addKaryawan({ nama, posisi, role, outletId: outletId === "none" ? undefined : outletId, gajiPokok, bonusOmset, bonusUlasan, bonusOH, tunjanganHarian, overtimeRate, jamMasuk, jamPulang }, { username: fu, password, role });
              toast.success("Karyawan ditambahkan"); setOpen(false); rf();
            } catch (err: any) { toast.error(err?.message || "Gagal"); }
          }} className="space-y-3">
            <div><Label>Nama</Label><Input value={nama} onChange={(e) => setNama(e.target.value)} /></div>
            <div className="border-t pt-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-muted-foreground italic">Akun Pengguna</p>
                {ume && <button type="button" className="text-[10px] text-primary underline" onClick={() => setUme(false)}>Reset</button>}
              </div>
              <div className="grid grid-cols-2 gap-2 items-end">
                <div><Label>Username {!ume && username && <span className="text-[9px] font-normal text-blue-600 bg-blue-50 border border-blue-200 rounded px-1 py-0.5">auto</span>}</Label><Input value={username} onChange={(e) => { setUme(true); setUsername(e.target.value.toLowerCase().trim()); }} /></div>
                <div><Label>Password *</Label><Input value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              </div>
            </div>
            <div><Label>Role</Label><Select value={role} onValueChange={setRole}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="karyawan">Karyawan</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
            <div><Label>Posisi</Label><Select value={posisi} onValueChange={setPosisi}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Kasir">Kasir</SelectItem><SelectItem value="Kurir">Kurir</SelectItem><SelectItem value="Helper">Helper</SelectItem></SelectContent></Select></div>
            <div><Label>Outlet</Label><Select value={outletId} onValueChange={(v) => { setOutletId(v); const p = v === "none"; setJamMasuk(p ? "07:30" : "07:00"); setJamPulang(p ? "15:00" : "14:00"); }}><SelectTrigger className="h-10"><SelectValue placeholder="Pilih" /></SelectTrigger><SelectContent><SelectItem value="none">Kantor Pusat</SelectItem>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.nama}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Gaji Pokok/Hari</Label><Input type="number" value={gajiPokok} onChange={(e) => setGajiPokok(Number(e.target.value))} /></div>
            <div className="grid grid-cols-2 gap-2"><div><Label>Bonus Omset</Label><Input type="number" value={bonusOmset} onChange={(e) => setBonusOmset(Number(e.target.value))} /></div><div><Label>Bonus Ulasan</Label><Input type="number" value={bonusUlasan} onChange={(e) => setBonusUlasan(Number(e.target.value))} /></div></div>
            <div><Label>Bonus OH</Label><Input type="number" value={bonusOH} onChange={(e) => setBonusOH(Number(e.target.value))} /></div>
            <div className="border-t pt-3 mt-3"><div className="grid grid-cols-2 gap-2"><div><Label>Tunjangan/Hari</Label><Input type="number" value={tunjanganHarian} onChange={(e) => setTunjanganHarian(Number(e.target.value))} /></div><div><Label>Tarif Lembur/Jam</Label><Input type="number" value={overtimeRate} onChange={(e) => setOvertimeRate(Number(e.target.value))} /></div></div></div>
            <div className="border-t pt-3 mt-3"><div className="grid grid-cols-2 gap-2"><div><Label>Jam Masuk</Label><Input type="time" value={jamMasuk} onChange={(e) => setJamMasuk(e.target.value)} /></div><div><Label>Jam Pulang</Label><Input type="time" value={jamPulang} onChange={(e) => setJamPulang(e.target.value)} /></div></div></div>
            <DialogFooter className="pt-4"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button type="submit">Simpan</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditOutletDialog({ outlet }: { outlet: any }) {
  const [open, setOpen] = useState(false);
  const [nama, setNama] = useState(outlet.nama);
  const p = parseLokasi(outlet.lokasi);
  const [alamat, setAlamat] = useState(p.alamat);
  const [lat, setLat] = useState(p.lat);
  const [lng, setLng] = useState(p.lng);
  const [rad, setRad] = useState(p.rad);

  return (
    <>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(true)}><Pencil className="h-3.5 w-3.5 text-primary" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Outlet</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const lc = lat && lng ? `${alamat} @ ${lat},${lng},${rad || 100}` : alamat || "-"; db.updateOutlet(outlet.id, { nama, lokasi: lc }); toast.success("Outlet diperbarui"); setOpen(false); }} className="space-y-3">
            <div><Label>Nama</Label><Input value={nama} onChange={(e) => setNama(e.target.value)} /></div>
            <div><Label>Alamat</Label><Input value={alamat} onChange={(e) => setAlamat(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2"><div><Label>Latitude</Label><Input value={lat} onChange={(e) => setLat(e.target.value)} /></div><div><Label>Longitude</Label><Input value={lng} onChange={(e) => setLng(e.target.value)} /></div></div>
            <div><Label>Radius (m)</Label><Input type="number" value={rad} onChange={(e) => setRad(e.target.value)} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button type="submit">Simpan</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditKaryawanDialog({ karyawan, outlets }: { karyawan: any; outlets: any[] }) {
  const { users } = useDB();
  const [open, setOpen] = useState(false);
  const [nama, setNama] = useState(karyawan.nama);
  const [posisi, setPosisi] = useState(karyawan.posisi);
  const [role, setRole] = useState(karyawan.role || "karyawan");
  const [username, setUsername] = useState(karyawan.username || "");
  const [np, setNp] = useState("");
  const [outletId, setOutletId] = useState(karyawan.outletId ?? "none");
  const [gajiPokok, setGajiPokok] = useState(karyawan.gajiPokok);
  const [bonusOmset, setBonusOmset] = useState(karyawan.bonusOmset ?? 0);
  const [bonusUlasan, setBonusUlasan] = useState(karyawan.bonusUlasan ?? 0);
  const [bonusOH, setBonusOH] = useState(karyawan.bonusOH ?? 0);
  const [tunjanganHarian, setTunjanganHarian] = useState(karyawan.tunjanganHarian ?? 0);
  const [overtimeRate, setOvertimeRate] = useState(karyawan.overtimeRate ?? 0);
  const [jamMasuk, setJamMasuk] = useState(karyawan.jamMasuk || "07:30");
  const [jamPulang, setJamPulang] = useState(karyawan.jamPulang || "15:00");
  const has = !!karyawan.username;

  return (
    <>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setOpen(true); setNp(""); }}><Pencil className="h-3.5 w-3.5 text-primary" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Karyawan</DialogTitle></DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fu = username.toLowerCase().trim();
            if (fu !== karyawan.username && users.some((u: any) => u.username === fu && u.karyawanId !== karyawan.id)) return toast.error("Username sudah dipakai");
            try {
              await db.updateKaryawan(karyawan.id, { nama, posisi, role, username: username || undefined, outletId: outletId === "none" ? undefined : outletId, gajiPokok, bonusOmset, bonusUlasan, bonusOH, tunjanganHarian, overtimeRate, jamMasuk, jamPulang }, np || undefined);
              toast.success(np ? "Diperbarui + password" : "Diperbarui"); setOpen(false);
            } catch (err: any) { toast.error(err?.message || "Gagal"); }
          }} className="space-y-3">
            <div><Label>Nama</Label><Input value={nama} onChange={(e) => setNama(e.target.value)} /></div>
            <div className="border rounded-lg bg-muted/30 p-3 space-y-2">
              <p className="text-[11px] text-muted-foreground font-medium mb-1">{has ? "Akun Terkait" : "Buat Akun"}</p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[11px]">Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().trim())} className="text-xs" required /></div>
                <div><Label className="text-[11px]">{has ? "Password Baru" : "Password"}</Label><Input type="text" value={has ? np : password} onChange={(e) => { if (has) setNp(e.target.value); }} placeholder={has ? "Kosongkan jika tetap" : ""} className="text-xs" required={!has} /></div>
              </div>
            </div>
            <div><Label>Role</Label><Select value={role} onValueChange={(v) => setRole(v)}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="karyawan">Karyawan</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
            <div><Label>Posisi</Label><Select value={posisi} onValueChange={setPosisi}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Kasir">Kasir</SelectItem><SelectItem value="Kurir">Kurir</SelectItem><SelectItem value="Helper">Helper</SelectItem></SelectContent></Select></div>
            <div><Label>Outlet</Label><Select value={outletId} onValueChange={setOutletId}><SelectTrigger className="h-10"><SelectValue placeholder="Pilih" /></SelectTrigger><SelectContent><SelectItem value="none">Pusat</SelectItem>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.nama}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Gaji/Hari</Label><Input type="number" value={gajiPokok} onChange={(e) => setGajiPokok(Number(e.target.value))} /></div>
            <div className="grid grid-cols-2 gap-2"><div><Label>Bonus Omset</Label><Input type="number" value={bonusOmset} onChange={(e) => setBonusOmset(Number(e.target.value))} /></div><div><Label>Bonus Ulasan</Label><Input type="number" value={bonusUlasan} onChange={(e) => setBonusUlasan(Number(e.target.value))} /></div></div>
            <div><Label>Bonus OH</Label><Input type="number" value={bonusOH} onChange={(e) => setBonusOH(Number(e.target.value))} /></div>
            <div className="border-t pt-3 mt-3"><div className="grid grid-cols-2 gap-2"><div><Label>Tunjangan/Hari</Label><Input type="number" value={tunjanganHarian} onChange={(e) => setTunjanganHarian(Number(e.target.value))} /></div><div><Label>Lembur/Jam</Label><Input type="number" value={overtimeRate} onChange={(e) => setOvertimeRate(Number(e.target.value))} /></div></div></div>
            <div className="border-t pt-3 mt-3"><div className="grid grid-cols-2 gap-2"><div><Label>Jam Masuk</Label><Input type="time" value={jamMasuk} onChange={(e) => setJamMasuk(e.target.value)} /></div><div><Label>Jam Pulang</Label><Input type="time" value={jamPulang} onChange={(e) => setJamPulang(e.target.value)} /></div></div></div>
            <DialogFooter className="pt-4"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button type="submit">Simpan</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditUserDialog({ userAccount, outlets }: { userAccount: any; outlets: any[] }) {
  const [open, setOpen] = useState(false);
  const [nama, setNama] = useState(userAccount.nama);
  const [password, setPassword] = useState(userAccount.password);
  const [role, setRole] = useState(userAccount.role);
  const [outletId, setOutletId] = useState(userAccount.outletId ?? "none");

  return (
    <>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(true)}><Pencil className="h-3.5 w-3.5 text-primary" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Akun</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); db.updateUser(userAccount.username, { nama, password, role: role as any, outletId: role === "admin" ? undefined : outletId === "none" ? undefined : outletId }); toast.success("Diperbarui"); setOpen(false); }} className="space-y-3">
            <div><Label>Username</Label><Input value={userAccount.username} disabled /></div>
            <div><Label>Nama</Label><Input value={nama} onChange={(e) => setNama(e.target.value)} /></div>
            <div><Label>Password</Label><Input value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div><Label>Role</Label><Select value={role} onValueChange={(v) => setRole(v)}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="karyawan">Karyawan</SelectItem></SelectContent></Select></div>
            {role === "karyawan" && <div><Label>Outlet</Label><Select value={outletId} onValueChange={setOutletId}><SelectTrigger className="h-10"><SelectValue placeholder="Pilih" /></SelectTrigger><SelectContent><SelectItem value="none">Pusat</SelectItem>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.nama}</SelectItem>)}</SelectContent></Select></div>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button type="submit">Simpan</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
