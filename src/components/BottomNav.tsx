import { LayoutDashboard, UserCheck, User, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function BottomNav() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const items = [
    { title: "Home", url: "/", icon: LayoutDashboard },
    { title: "Absen", url: "/absensi", icon: UserCheck, highlighted: true },
    ...(isAdmin
      ? [{ title: "Master", url: "/master", icon: Settings }]
      : []),
    { title: "Profile", url: "/profile", icon: User },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 glass-strong border-t border-border/50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex justify-around items-center">
        {items.map((item) => (
          <li key={item.title} className="flex-1 min-w-[64px]">
            <NavLink
              to={item.url}
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-all ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`h-9 w-9 flex items-center justify-center rounded-2xl transition-all ${
                      isActive
                        ? "gradient-primary text-primary-foreground shadow-soft scale-105"
                        : ""
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span>{item.title}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
