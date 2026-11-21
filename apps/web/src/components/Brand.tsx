import { Link } from "react-router-dom";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

export function Logo({ className, src = "/assets/logo.svg" }: { className?: string; src?: string }) {
  return (
    <img
      src={src}
      alt="Antika Factory"
      className={clsx("block select-none object-contain", className ?? "h-11 w-11")}
      draggable={false}
    />
  );
}

export function Wordmark({
  className,
  latin = false,
  light = false,
}: {
  className?: string;
  latin?: boolean;
  light?: boolean;
}) {
  return (
    <div className={clsx("leading-none", className)}>
      <div className={clsx("text-[1.55em] font-extrabold", light ? "text-white" : "text-slate-800")}>
        <span className={light ? "text-white" : "text-brand-orange"}>A</span>
        {latin ? "NTIKEH" : "NTIKA"}
      </div>
      <div
        className={clsx(
          "mt-[0.28em] text-[0.58em] font-extrabold",
          light ? "text-white/85" : "text-brand-orange",
        )}
      >
        FACTORY
      </div>
    </div>
  );
}

export function BrandLockup({ compact = false, logoSrc }: { compact?: boolean; logoSrc?: string }) {
  const { t } = useTranslation();
  return (
    <Link to="/" className="flex items-center gap-3">
      <Logo className={compact ? "w-12" : "w-14"} src={logoSrc} />
      <div className="min-w-0">
        <div className="truncate text-base font-extrabold text-slate-900">{t("app.name")}</div>
        <div className="mt-0.5 truncate text-[11px] font-semibold text-brand-orange">
          {t("app.tagline")}
        </div>
      </div>
    </Link>
  );
}
