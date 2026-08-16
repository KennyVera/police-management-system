import { Navigate } from "react-router-dom";
import RoleShell from "../../shared/components/RoleShell";
import { getRoleConfig } from "../../shared/constants/roles";
import { useAuth } from "../../auth/AuthContext";
import "./DetectiveDark.css";

export default function Layout() {
  const role = getRoleConfig("detective");
  const { user } = useAuth();

  if (!role) return <Navigate to="/login" replace />;
  if (user?.role_slug !== role.slug) {
    const target = user?.role_slug
      ? `/app/${user.role_slug}/dashboard`
      : "/login";
    return <Navigate to={target} replace />;
  }

  return <RoleShell role={role} />;
}
