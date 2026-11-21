import { Navigate, Outlet, useLocation } from "react-router-dom";
import { PageLoader } from "../components/Ui";
import { useAuth } from "../lib/auth";
import { useTranslation } from "react-i18next";

export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (isLoading) return <PageLoader label={t("common.loading")} />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}
