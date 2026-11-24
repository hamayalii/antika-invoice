import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Hash,
  Image as ImageIcon,
  RotateCcw,
  Save,
  Settings2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { settingsSchema, type AppSettings } from "@antika/shared";
import { api } from "../lib/api";
import { useApiErrorMessage, useValidationMessage } from "../lib/i18nHooks";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import { ErrorState, PageHeader, PageLoader } from "../components/Ui";
import { SecurityPreview } from "../features/settings/SecurityPreview";
import { DirtyBadge, LiveLogo, LiveNumber } from "../features/settings/formBits";
import {
  setHighlightedPart,
  tapHighlightedPart,
  type DocPart,
} from "../features/settings/highlight";
import { toFormValues, type SettingsFormValues } from "../features/settings/types";

const SECURITY_TOGGLES: Array<{
  key:
    | "security.watermarkEnabled"
    | "security.guillocheEnabled"
    | "security.microtextEnabled"
    | "security.qrEnabled";
  part: DocPart;
  labelKey: string;
}> = [
  { key: "security.watermarkEnabled", part: "watermark", labelKey: "settings.watermarkEnabled" },
  { key: "security.guillocheEnabled", part: "guilloche", labelKey: "settings.guilloche" },
  { key: "security.microtextEnabled", part: "microtext", labelKey: "settings.microtext" },
  { key: "security.qrEnabled", part: "qr", labelKey: "settings.qr" },
];

/** Tiny «?» that opens a one-line explanation (never toggles the checkbox). */
function HelpDot({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        title={text}
        aria-label={text}
        data-testid="settings-help-dot"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[9px] font-extrabold leading-none text-slate-500 transition-colors hover:border-brand-orange hover:text-brand-orange"
      >
        ?
      </button>
      {open ? (
        <span
          role="tooltip"
          data-testid="settings-help-tip"
          className="absolute start-0 top-5 z-20 w-60 rounded-lg border border-slate-200 bg-white p-2 text-[11px] font-semibold leading-5 text-slate-600 shadow-md"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const apiError = useApiErrorMessage();
  const validation = useValidationMessage();
  const isAdmin = user?.role === "admin";
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const query = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ settings: AppSettings }>("/settings"),
  });

  const form = useForm<SettingsFormValues>();
  const { register, handleSubmit, reset, setValue, control } = form;

  useEffect(() => {
    document.title = `${t("settings.title")} | ${t("app.name")}`;
  }, [t]);

  useEffect(() => {
    if (query.data?.settings) reset(toFormValues(query.data.settings));
  }, [query.data, reset]);

  // Only these two fields re-render the page (the save buttons depend on them).
  const advance = Number(useWatch({ control, name: "defaults.advancePercent" }) ?? 0);
  const final = Number(useWatch({ control, name: "defaults.finalPercent" }) ?? 0);
  const sumOk = advance + final === 100;

  const digitsOptions = useMemo(
    () =>
      (["eastern", "latin"] as const).map((value) => ({
        value,
        label: t(`settings.${value}`),
      })),
    [t],
  );

  if (query.isLoading) return <PageLoader label={t("common.loading")} />;
  if (query.isError) {
    return (
      <ErrorState message={apiError(query.error)} onRetry={() => void query.refetch()} />
    );
  }

  const settings = query.data?.settings;
  if (!settings) return <PageLoader label={t("common.loading")} />;

  const resetToSaved = () => reset(toFormValues(settings));

  const onSubmit = async (values: SettingsFormValues) => {
    setFormError("");
    const normalized: SettingsFormValues = {
      ...values,
      company: {
        ...values.company,
        phones: values.company.phones.filter((p) => p.trim() !== ""),
        addressKu: values.company.addressKu.filter((line) => line.trim() !== ""),
        addressAr: values.company.addressAr.filter((line) => line.trim() !== ""),
      },
      defaults: {
        ...values.defaults,
        invoiceStart: Number(values.defaults.invoiceStart),
        voucherStart: Number(values.defaults.voucherStart),
        advancePercent: Number(values.defaults.advancePercent),
        finalPercent: Number(values.defaults.finalPercent),
      },
    };

    const parsed = settingsSchema.safeParse(normalized);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setFormError(first ? validation(first.message) : t("errors.VALIDATION_ERROR"));
      return;
    }

    setSaving(true);
    try {
      await api.put("/settings", parsed.data);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success(t("settings.saved"));
    } catch (error) {
      setFormError(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  const fieldsetDisabled = !isAdmin || saving;

  return (
    <div>
      <PageHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        actions={
          <button
            type="submit"
            form="settings-form"
            className="btn-primary"
            disabled={fieldsetDisabled || !sumOk}
          >
            <Save className="h-4 w-4" />
            {saving ? t("common.saving") : t("settings.saveSettings")}
          </button>
        }
      />

      {!isAdmin ? (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <ShieldAlert className="h-4 w-4" />
          {t("settings.adminOnly")}
        </div>
      ) : null}

      {formError ? (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {formError}
        </div>
      ) : null}

      <form id="settings-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={fieldsetDisabled} className="min-w-0 space-y-6">
          <section className="card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">{t("settings.company")}</h2>
                <p className="text-xs font-semibold text-slate-400">{t("app.factory")}</p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <p className="label">{t("settings.phones")}</p>
                <div className="space-y-2">
                  {[0, 1, 2].map((index) => (
                    <input
                      key={index}
                      className="input"
                      dir="ltr"
                      placeholder="07701243724"
                      {...register(`company.phones.${index}` as const)}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="label">{t("settings.taglineKu")}</label>
                  <input className="input" {...register("company.taglineKu")} />
                </div>
                <div>
                  <label className="label">{t("settings.taglineAr")}</label>
                  <input className="input" {...register("company.taglineAr")} />
                </div>
              </div>

              <div>
                <p className="label">{t("settings.addressKu")}</p>
                <div className="space-y-2">
                  {[0, 1, 2].map((index) => (
                    <input
                      key={index}
                      className="input"
                      placeholder={t("settings.addressLine")}
                      {...register(`company.addressKu.${index}` as const)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="label">{t("settings.addressAr")}</p>
                <div className="space-y-2">
                  {[0, 1, 2].map((index) => (
                    <input
                      key={index}
                      className="input"
                      placeholder={t("settings.addressLine")}
                      {...register(`company.addressAr.${index}` as const)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange">
                <Hash className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">{t("settings.numbering")}</h2>
                <p className="text-xs font-semibold text-slate-400">{t("settings.startHint")}</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="label">{t("settings.invoiceStart")}</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  dir="ltr"
                  {...register("defaults.invoiceStart", { valueAsNumber: true })}
                />
              </div>
              <div>
                <label className="label">{t("settings.voucherStart")}</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  dir="ltr"
                  {...register("defaults.voucherStart", { valueAsNumber: true })}
                />
              </div>
              <div>
                <label className="label">{t("settings.invoiceDigits")}</label>
                <select className="input" {...register("defaults.invoiceDigits")}>
                  {digitsOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t("settings.voucherDigits")}</label>
                <select className="input" {...register("defaults.voucherDigits")}>
                  {digitsOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <div>
                <label className="label">{t("settings.advancePercent")}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="input"
                  dir="ltr"
                  {...register("defaults.advancePercent", {
                    valueAsNumber: true,
                    onChange: (event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value)) {
                        setValue("defaults.finalPercent", 100 - value, { shouldDirty: true });
                      }
                    },
                  })}
                />
              </div>
              <div>
                <label className="label">{t("settings.finalPercent")}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="input"
                  dir="ltr"
                  {...register("defaults.finalPercent", {
                    valueAsNumber: true,
                    onChange: (event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value)) {
                        setValue("defaults.advancePercent", 100 - value, { shouldDirty: true });
                      }
                    },
                  })}
                />
              </div>
              <div>
                <label className="label">{t("settings.voucherPage")}</label>
                <select className="input" {...register("defaults.voucherPage")}>
                  <option value="A5_landscape">{t("settings.A5_landscape")}</option>
                  <option value="A4_landscape">{t("settings.A4_landscape")}</option>
                </select>
              </div>
            </div>

            {!sumOk ? (
              <p className="mt-3 text-xs font-bold text-red-600">{t("settings.percentSum")}</p>
            ) : null}

            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <div>
                <label className="label">{t("settings.safeMargin")}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={1}
                    className="input"
                    dir="ltr"
                    {...register("defaults.safeMarginMm", { valueAsNumber: true })}
                  />
                  <span className="text-xs font-extrabold text-slate-400">mm</span>
                </div>
              </div>
              <p className="text-[11px] font-semibold leading-5 text-slate-400 sm:col-span-2 sm:self-end">
                {t("settings.safeMarginHint")}
              </p>
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">{t("settings.security")}</h2>
                <p className="text-xs font-semibold text-slate-400">{t("settings.securityHint")}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {SECURITY_TOGGLES.map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3"
                  data-testid={`settings-toggle-${item.part}`}
                  onPointerEnter={() => setHighlightedPart(item.part)}
                  onPointerLeave={() => setHighlightedPart(null)}
                  onPointerDown={() => tapHighlightedPart(item.part)}
                  onFocusCapture={() => setHighlightedPart(item.part)}
                  onBlurCapture={() => setHighlightedPart(null)}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-700">{t(item.labelKey)}</span>
                    <HelpDot text={t(`settings.preview.help.${item.part}`)} />
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-orange"
                    {...register(item.key)}
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div
                onPointerEnter={() => setHighlightedPart("watermark")}
                onPointerLeave={() => setHighlightedPart(null)}
                onPointerDown={() => tapHighlightedPart("watermark")}
                onFocusCapture={() => setHighlightedPart("watermark")}
                onBlurCapture={() => setHighlightedPart(null)}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="label !mb-0">{t("settings.watermarkOpacity")}</label>
                  <LiveNumber control={control} name="security.watermarkOpacity" />
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.3}
                  step={0.01}
                  className="w-full accent-brand-orange"
                  data-testid="settings-watermark-opacity"
                  {...register("security.watermarkOpacity", { valueAsNumber: true })}
                />
              </div>
              <div
                onPointerEnter={() => setHighlightedPart("watermark")}
                onPointerLeave={() => setHighlightedPart(null)}
                onPointerDown={() => tapHighlightedPart("watermark")}
                onFocusCapture={() => setHighlightedPart("watermark")}
                onBlurCapture={() => setHighlightedPart(null)}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="label !mb-0">{t("settings.watermarkScale")}</label>
                  <LiveNumber control={control} name="security.watermarkScale" digits={1} suffix="×" />
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  className="w-full accent-brand-orange"
                  data-testid="settings-watermark-scale"
                  {...register("security.watermarkScale", { valueAsNumber: true })}
                />
              </div>
            </div>

            <p className="mt-4 text-[11px] leading-5 text-slate-400">{t("settings.securityNote")}</p>
          </section>
        </fieldset>

        <div className="mt-6" data-testid="settings-preview-wrap">
          <SecurityPreview control={control} saved={settings} />
        </div>

        <fieldset disabled={fieldsetDisabled} className="mt-6 min-w-0 space-y-6">

          <section className="card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <ImageIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">{t("settings.assets")}</h2>
                <p className="text-xs font-semibold text-slate-400">{t("settings.assetsHint")}</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label">Logo</label>
                <div className="flex items-center gap-3">
                  <LiveLogo
                    control={control}
                    name="assets.logo"
                    fallback="/assets/logo.svg"
                    className="w-24 rounded border border-slate-200 bg-white p-1"
                  />
                  <input className="input" dir="ltr" {...register("assets.logo")} />
                </div>
              </div>
              <div>
                <label className="label">{t("common.kurdish")}</label>
                <input className="input" dir="ltr" {...register("assets.brandKu")} />
              </div>
              <div>
                <label className="label">{t("common.arabic")}</label>
                <input className="input" dir="ltr" {...register("assets.brandAr")} />
              </div>
              <div>
                <label className="label">Watermark</label>
                <input className="input" dir="ltr" {...register("assets.watermark")} />
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
              <Settings2 className="h-4 w-4" />
              {t("settings.saved")}
              <DirtyBadge control={control} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={resetToSaved}
                className="btn-ghost !px-3 !py-2 text-xs"
                data-testid="settings-reset"
              >
                <RotateCcw className="h-4 w-4" />
                {t("settings.preview.resetToSaved")}
              </button>
              <button type="submit" className="btn-primary" disabled={fieldsetDisabled || !sumOk}>
                <Save className="h-4 w-4" />
                {saving ? t("common.saving") : t("settings.saveSettings")}
              </button>
            </div>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
