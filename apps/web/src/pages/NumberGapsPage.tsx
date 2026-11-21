import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, FileText, ReceiptText, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { useApiErrorMessage } from "../lib/i18nHooks";
import { ErrorState, PageHeader, PageLoader } from "../components/Ui";

interface GapReport {
  start: number;
  end: number;
  issued: number;
  gaps: number[];
  missingCount: number;
}

interface NumberGapsResponse {
  invoices: GapReport;
  vouchers: GapReport;
}

const MAX_CHIPS = 80;

export function NumberGapsPage() {
  const { t } = useTranslation();
  const apiError = useApiErrorMessage();

  useEffect(() => {
    document.title = `${t("gaps.title")} | ${t("app.name")}`;
  }, [t]);

  const query = useQuery({
    queryKey: ["reports", "number-gaps"],
    queryFn: () => api.get<NumberGapsResponse>("/reports/number-gaps"),
  });

  if (query.isLoading) return <PageLoader label={t("common.loading")} />;
  if (query.isError) {
    return <ErrorState message={apiError(query.error)} onRetry={() => void query.refetch()} />;
  }
  if (!query.data) return null;

  const reports = [
    {
      key: "invoices" as const,
      title: t("gaps.invoices"),
      icon: FileText,
      report: query.data.invoices,
      accent: "bg-brand-orange-soft text-brand-orange",
    },
    {
      key: "vouchers" as const,
      title: t("gaps.vouchers"),
      icon: ReceiptText,
      report: query.data.vouchers,
      accent: "bg-brand-orange-soft text-brand-orange",
    },
  ];

  return (
    <div>
      <PageHeader title={t("gaps.title")} subtitle={t("gaps.subtitle")} />

      <div className="grid gap-5 lg:grid-cols-2">
        {reports.map(({ key, title, icon: Icon, report, accent }) => (
          <section key={key} className="card p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t("gaps.start")} value={report.end >= report.start ? report.start : "—"} />
              <Stat label={t("gaps.end")} value={report.end >= report.start ? report.end : "—"} />
              <Stat label={t("gaps.issued")} value={report.issued} />
              <Stat
                label={t("gaps.missing")}
                value={report.missingCount}
                danger={report.missingCount > 0}
              />
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-extrabold text-slate-400">{t("gaps.missingList")}</p>
              {report.gaps.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-xs font-bold text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                  {t("gaps.none")}
                </div>
              ) : (
                <>
                  <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                    {report.gaps.slice(0, MAX_CHIPS).map((value) => (
                      <span
                        key={value}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-[11px] font-extrabold text-red-700"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {value}
                      </span>
                    ))}
                  </div>
                  {report.gaps.length > MAX_CHIPS ? (
                    <p className="mt-2 text-[11px] font-semibold text-slate-400">
                      +{report.gaps.length - MAX_CHIPS}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: number | string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <p className="text-[11px] font-extrabold text-slate-400">{label}</p>
      <p
        className={`mt-0.5 text-lg font-extrabold ${danger ? "text-red-600" : "text-slate-800"}`}
        dir="ltr"
      >
        {value}
      </p>
    </div>
  );
}
