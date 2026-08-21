import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useDB } from "@/lib/store";
import { LogOut, User, ShieldCheck, UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Profile() {
  const { user, logout } = useAuth();
  const { outlets } = useDB();

  if (!user) return null;

  const userOutlet = outlets.find((o) => o.id === user.outletId);
  const isAdmin = user.role === "admin";

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "operational":
        return "Operational";
      case "development":
        return "Development";
      case "management":
        return "Management";
      case "marketing":
        return "Marketing";
      default:
        return "Pegawai";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gradient">
          Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Informasi akun dan profil Anda
        </p>
      </div>

      <Card className="glass border-0 shadow-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="h-20 w-20 rounded-full gradient-primary flex items-center justify-center shadow-soft">
              {isAdmin ? (
                <ShieldCheck className="h-10 w-10 text-primary-foreground" />
              ) : (
                <UserCircle className="h-10 w-10 text-primary-foreground" />
              )}
            </div>
            <div className="text-center sm:text-left space-y-2">
              <h2 className="text-xl font-bold">{user.nama}</h2>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/20"
                >
                  {getRoleLabel(user.role)}
                </Badge>
                {userOutlet && (
                  <Badge variant="outline" className="bg-muted">
                    {userOutlet.nama}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Username: <span className="font-mono text-foreground">{user.username}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-0 shadow-card">
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Detail Akun
          </h3>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between py-2 border-b border-border/40">
              <span className="text-muted-foreground">Nama</span>
              <span className="font-medium">{user.nama}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/40">
              <span className="text-muted-foreground">Username</span>
              <span className="font-mono font-medium">{user.username}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/40">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium">{getRoleLabel(user.role)}</span>
            </div>
            {userOutlet && (
              <div className="flex justify-between py-2 border-b border-border/40">
                <span className="text-muted-foreground">Lokasi</span>
                <span className="font-medium">{userOutlet.nama}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Button
        variant="destructive"
        onClick={logout}
        className="w-full sm:w-auto"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Keluar
      </Button>
    </div>
  );
}
