import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileText,
  Plus,
  Receipt,
  ReceiptText,
  Users,
} from "lucide-react";
import { formatMoney, type InvoiceDto, type VoucherDto } from "@antika/shared";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { markPrintStarted, reloadIfPrintedRecently } from "../lib/printGuard";
import { DotBanner } from "../components/DotBanner";
import { PageLoader } from "../components/Ui";

interface DashboardData {
  counts: { invoices: number; vouchers: number; customers: number };
  invoices: InvoiceDto[];
  vouchers: VoucherDto[];
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  useEffect(() => {
    document.title = `${t("dashboard.title")} | ${t("app.name")}`;
  }, [t]);

  /*
   * Print safety net: if this tab ever entered print mode (Ctrl+P, or the
   * same-tab fallback when a popup was blocked) Chromium can leave the glyph
   * cache broken until a refresh. Reload exactly once when the dialog closes
   * or the tab becomes visible again.
   */
  useEffect(() => {
    const onBeforePrint = () => markPrintStarted();
    const onAfterPrint = () => {
      reloadIfPrintedRecently();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") reloadIfPrintedRecently();
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    document.addEventListener("visibilitychange", onVisibilityChange);
    reloadIfPrintedRecently();
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/dashboard"),
    staleTime: 30_000,
  });

  const actions = [
    {
      to: "/invoices/new",
      title: t("dashboard.newInvoice"),
      description: t("nav.invoices"),
      icon: FileText,
      className: "bg-brand-orange text-white",
    },
    {
      to: "/vouchers/new",
      title: t("dashboard.newVoucher"),
      description: t("nav.vouchers"),
      icon: Receipt,
      className: "bg-brand-orange text-white",
    },
  ];

  const counts = dashboardQuery.data?.counts;
  const stats = [
    { label: t("dashboard.totalInvoices"), value: counts?.invoices, icon: FileText, tone: "text-brand-orange bg-brand-orange-soft" },
    { label: t("dashboard.totalVouchers"), value: counts?.vouchers, icon: Receipt, tone: "text-brand-orange bg-brand-orange-soft" },
    { label: t("dashboard.totalCustomers"), value: counts?.customers, icon: Users, tone: "text-emerald-600 bg-emerald-50" },
  ];

  return (
    <div>
      <DotBanner
        label={t("dashboard.heroLabel")}
        titleStrong={t("dashboard.heroGreeting")}
        titleSoft={user?.fullName || user?.username || ""}
        subtitle={t("dashboard.heroSubtitle")}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card flex items-center gap-4 p-5">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.tone}`}>
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-400">{stat.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900" dir="ltr">
                  {dashboardQuery.isLoading ? "—" : (stat.value ?? 0).toLocaleString("en-US")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.to}
              to={action.to}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-orange/40"
            >
              <div className="flex items-start gap-4">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${action.className}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-slate-900">{action.title}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{action.description}</p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-brand-orange-soft group-hover:text-brand-orange">
                  <Plus className="h-4 w-4" />
                </span>
              </div>
              <span className="mt-5 flex items-center gap-1 text-xs font-bold text-brand-orange">
                {t("common.open")}
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              </span>
            </Link>
          );
        })}
      </div>

      {dashboardQuery.isLoading ? (
        <PageLoader label={t("common.loading")} />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange">
                  <FileText className="h-4.5 w-4.5" />
                </span>
                <h2 className="text-sm font-extrabold text-slate-900">{t("dashboard.recentInvoices")}</h2>
              </div>
              <Link to="/invoices" className="btn-link text-xs">
                {t("dashboard.openList")}
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              </Link>
            </div>
            {(dashboardQuery.data?.invoices ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-xs font-semibold text-slate-400">
                {t("dashboard.noData")}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {dashboardQuery.data!.invoices.map((invoice) => (
                  <li key={invoice.id}>
                    <Link
                      to={`/invoices/${invoice.id}/edit`}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                          #{invoice.number} · {invoice.customerName || t("common.none")}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-400" dir="ltr">
                          {invoice.date}
                        </p>
                      </div>
                      <span className="text-xs font-extrabold text-brand-orange" dir="ltr">
                        {formatMoney(invoice.total)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange">
                  <ReceiptText className="h-4.5 w-4.5" />
                </span>
                <h2 className="text-sm font-extrabold text-slate-900">{t("dashboard.recentVouchers")}</h2>
              </div>
              <Link to="/vouchers" className="btn-link text-xs">
                {t("dashboard.openList")}
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              </Link>
            </div>
            {(dashboardQuery.data?.vouchers ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-xs font-semibold text-slate-400">
                {t("dashboard.noData")}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {dashboardQuery.data!.vouchers.map((voucher) => (
                  <li key={voucher.id}>
                    <Link
                      to={`/vouchers/${voucher.id}/edit`}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <Receipt className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                          #{voucher.number} · {voucher.receivedFrom || t("common.none")}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-400" dir="ltr">
                          {voucher.date}
                        </p>
                      </div>
                      <span className="text-xs font-extrabold text-brand-orange" dir="ltr">
                        {formatMoney(voucher.amount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
