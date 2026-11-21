import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, FileWarning, Printer, Ruler, ScanLine, ShieldCheck } from "lucide-react";

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm font-semibold text-slate-700">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      <span className="leading-6">{children}</span>
    </li>
  );
}

export function HelpPage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t("help.title")} | ${t("app.name")}`;
  }, [t]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">{t("help.title")}</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">{t("help.subtitle")}</p>
      </div>

      <section className="card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange">
            <Printer className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">{t("help.settingsTitle")}</h2>
            <p className="text-xs font-semibold text-slate-400">{t("help.settingsHint")}</p>
          </div>
        </div>
        <ul className="space-y-2.5">
          <Rule>{t("help.paper")}</Rule>
          <Rule>{t("help.scale")}</Rule>
          <Rule>{t("help.margins")}</Rule>
          <Rule>{t("help.background")}</Rule>
          <Rule>{t("help.headers")}</Rule>
        </ul>
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-bold leading-5 text-amber-800">
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
          {t("help.noFit")}
        </p>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange">
            <Ruler className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">{t("help.calibrationTitle")}</h2>
            <p className="text-xs font-semibold text-slate-400">{t("help.calibrationHint")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/print/calibration?size=a4"
            target="_blank"
            rel="noopener"
            className="btn-ghost"
          >
            <Ruler className="h-4 w-4" />
            {t("help.calibrationA4")}
          </a>
          <a
            href="/print/calibration?size=a5"
            target="_blank"
            rel="noopener"
            className="btn-ghost"
          >
            <Ruler className="h-4 w-4" />
            {t("help.calibrationA5")}
          </a>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange">
              <ScanLine className="h-5 w-5" />
            </span>
            <h2 className="text-base font-extrabold text-slate-900">{t("help.twoUpTitle")}</h2>
          </div>
          <p className="text-sm font-semibold leading-6 text-slate-600">{t("help.twoUpHint")}</p>
          <Link to="/vouchers" className="btn-ghost mt-4 inline-flex">
            {t("help.openVoucher")}
          </Link>
        </div>

        <div className="card p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h2 className="text-base font-extrabold text-slate-900">{t("help.safeMarginTitle")}</h2>
          </div>
          <p className="text-sm font-semibold leading-6 text-slate-600">{t("help.safeMarginHint")}</p>
          <Link to="/settings" className="btn-ghost mt-4 inline-flex">
            {t("settings.title")}
          </Link>
        </div>
      </section>
    </div>
  );
}
