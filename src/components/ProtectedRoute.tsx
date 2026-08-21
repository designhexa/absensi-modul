import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";

interface Props {
  adminOnly?: boolean;
  allowedRoles?: ("admin" | "karyawan")[];
}

export default function ProtectedRoute({ adminOnly, allowedRoles }: Props) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/welcome" replace />;

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role as any)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
