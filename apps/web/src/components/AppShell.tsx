import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FileText,
  FileWarning,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Users,
  X,
  Languages,
  CircleHelp,
} from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { BrandLockup, Logo } from "./Brand";
import { DotCanvas } from "./DotCanvas";
import { SidebarCrane } from "./SidebarCrane";
import { useAuth } from "../lib/auth";
import { useLanguage } from "../lib/i18nHooks";
import { useToast } from "./Toast";

const navItems = [
  { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, end: true },
  { to: "/invoices", labelKey: "nav.invoices", icon: FileText },
  { to: "/vouchers", labelKey: "nav.vouchers", icon: Receipt },
  { to: "/reports/number-gaps", labelKey: "nav.numberGaps", icon: FileWarning, admin: true },
  { to: "/users", labelKey: "nav.users", icon: Users, admin: true },
  { to: "/settings", labelKey: "nav.settings", icon: Settings, admin: true },
  { to: "/help", labelKey: "nav.help", icon: CircleHelp },
] as const;

export function AppShell() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDashboard = location.pathname === "/";

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    toast.info(t("auth.signedOut"));
    navigate("/login", { replace: true });
  };

  const sidebar = (
    <div data-sidebar="" className="relative flex h-full flex-col overflow-hidden bg-white">
      <SidebarCrane />
      <div className="relative z-[1] flex h-[76px] items-center justify-between border-b border-slate-100 px-5">
        <BrandLockup compact logoSrc="/assets/logo-nav.svg" />
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label={t("common.close")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="relative z-[1] flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems
          .filter((item) => !("admin" in item) || user?.role === "admin")
          .map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={"end" in item ? item.end : false}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition",
                    isActive
                      ? "bg-brand-orange text-white shadow-sm shadow-brand-orange/25"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )
                }
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            );
          })}
      </nav>

      <div className="relative z-[1] border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-orange text-sm font-extrabold text-white">
            {(user?.fullName || user?.username || "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-800">
              {user?.fullName || user?.username}
            </p>
            <p className="truncate text-[11px] font-semibold text-slate-500">
              {t(`roles.${user?.role ?? "staff"}`)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-red-600"
            aria-label={t("nav.logout")}
            title={t("nav.logout")}
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 border-s border-slate-200 lg:block">
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t("common.close")}
            className="absolute inset-0 h-full w-full bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="animate-in absolute inset-y-0 start-0 w-[288px] max-w-[86vw] shadow-pop">
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-[76px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <Logo className="w-10" />
              <span className="truncate text-sm font-extrabold text-slate-800">{t("app.name")}</span>
            </div>
            <div className="hidden items-center gap-2 text-sm font-semibold text-slate-400 lg:flex">
              <Languages className="h-4 w-4" />
              <span>{t("app.factory")}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(["ku", "ar"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={clsx(
                    "rounded-lg px-3 py-1.5 text-xs font-extrabold transition",
                    language === lang
                      ? "bg-brand-orange text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  {lang === "ku" ? "کوردی" : "العربية"}
                </button>
              ))}
            </div>
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-orange-soft text-xs font-extrabold text-brand-orange">
                {(user?.fullName || user?.username || "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-[140px] truncate text-sm font-bold text-slate-700">
                {user?.fullName || user?.username}
              </span>
            </div>
          </div>
        </header>

        <main
          className={clsx(
            "relative flex-1 px-4 py-6 sm:px-6 lg:px-8",
            isDashboard && "dot-surface",
          )}
        >
          {isDashboard ? <DotCanvas clearSelector="[data-dot-clear]" /> : null}
          <div className="relative z-[1] mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
