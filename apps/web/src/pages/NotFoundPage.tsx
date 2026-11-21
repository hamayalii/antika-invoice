import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home } from "lucide-react";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 text-center">
      <p className="text-6xl font-extrabold text-brand-orange">404</p>
      <p className="mt-4 text-lg font-bold text-slate-700">{t("common.noResults")}</p>
      <Link to="/" className="btn-primary mt-6">
        <Home className="h-4 w-4" />
        {t("nav.dashboard")}
      </Link>
    </div>
  );
}
