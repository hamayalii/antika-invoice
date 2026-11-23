import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Ban,
  CalendarDays,
  Eye,
  Link2,
  Loader2,
  Lock,
  Printer,
  ReceiptText,
  RefreshCw,
  Save,
  Unlock,
  UserRound,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import {
  amountInWords,
  todayInBaghdad,
  voucherInputSchema,
  type AppSettings,
  type InvoiceDto,
  type InvoiceListItem,
  type Paginated,
  type VoucherDto,
  type VoucherInput,
} from "@antika/shared";
import { api } from "../lib/api";
import { useApiErrorMessage, useValidationMessage } from "../lib/i18nHooks";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/useSettings";
import { openPrintWindow } from "../lib/printWindow";
import { toWholeNumber } from "../lib/formNumbers";
import { useToast } from "../components/Toast";
import { PageLoader } from "../components/Ui";
import { ConfirmDialog } from "../components/Modal";
import { ScaledSheet } from "../components/ScaledSheet";
import { VoucherDocument } from "../features/vouchers/VoucherDocument";

function defaults(settings: AppSettings, preparedBy: string, nextNumber?: number): VoucherInput {
  const lang = "ar" as const;
  return {
    number: nextNumber,
    date: todayInBaghdad(),
    invoiceId: null,
    receivedFrom: "",
    amount: 0,
    amountWords: amountInWords(0, lang),
    wordsManuallyEdited: false,
    paymentFor: "",
    paymentMethod: "cash",
    preparedBy,
    receivedByName: "",
    approvedBy: "",
    lang,
    digitsMode: settings.defaults.voucherDigits,
    watermarkEnabled: null,
  };
}

function toFormValues(voucher: VoucherDto): VoucherInput {
  return {
    number: voucher.number,
    date: voucher.date,
    invoiceId: voucher.invoiceId,
    receivedFrom: voucher.receivedFrom,
    amount: voucher.amount,
    amountWords: voucher.amountWords,
    wordsManuallyEdited: true,
    paymentFor: voucher.paymentFor,
    paymentMethod: voucher.paymentMethod,
    preparedBy: voucher.preparedBy,
    receivedByName: voucher.receivedByName,
    approvedBy: voucher.approvedBy,
    lang: voucher.lang,
    digitsMode: voucher.digitsMode,
    watermarkEnabled: voucher.watermarkEnabled,
  };
}

export function VoucherEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const voucherId = id ? Number(id) : null;
  const isEdit = Boolean(voucherId);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const apiError = useApiErrorMessage();
  const validation = useValidationMessage();
  const { user } = useAuth();
  const settings = useSettings();
  const isAdmin = user?.role === "admin";

  const [serverError, setServerError] = useState("");
  const [mobileTab, setMobileTab] = useState<"form" | "preview">("form");
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const initialized = useRef(false);

  const voucherQuery = useQuery({
    queryKey: ["voucher", voucherId],
    queryFn: () => api.get<{ voucher: VoucherDto }>(`/vouchers/${voucherId}`),
    enabled: isEdit,
  });

  const nextNumberQuery = useQuery({
    queryKey: ["voucher", "next-number"],
    queryFn: () => api.get<{ number: number }>("/vouchers/next-number"),
    enabled: !isEdit,
    staleTime: 0,
  });

  const invoiceOptionsQuery = useQuery({
    queryKey: ["invoices", "voucher-link"],
    queryFn: () => api.get<Paginated<InvoiceListItem>>("/invoices", { pageSize: 50 }),
    staleTime: 60_000,
  });

  const form = useForm<VoucherInput>({
    resolver: zodResolver(voucherInputSchema),
    defaultValues: defaults(settings, user?.fullName ?? "", undefined),
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  // `watch()` hands back the mutable form-values object (stable identity), so
  // memoised preview values never refresh. useWatch clones on each keystroke.
  const values = useWatch({ control }) as VoucherInput;
  const amount = toWholeNumber(values.amount);
  const lang = values.lang ?? "ar";
  const manualWords = Boolean(values.wordsManuallyEdited);

  useEffect(() => {
    document.title = `${isEdit ? t("vouchers.editVoucher") : t("vouchers.newVoucher")} | ${t("app.name")}`;
  }, [t, isEdit]);

  useEffect(() => {
    if (initialized.current) return;
    if (isEdit && voucherQuery.data?.voucher) {
      reset(toFormValues(voucherQuery.data.voucher));
      initialized.current = true;
      return;
    }
    if (!isEdit && nextNumberQuery.data) {
      reset(defaults(settings, user?.fullName ?? "", nextNumberQuery.data.number));
      initialized.current = true;
    }
  }, [isEdit, voucherQuery.data, nextNumberQuery.data, reset, settings, user?.fullName]);

  // Keep the words in sync with the amount unless the user typed their own text.
  useEffect(() => {
    if (!initialized.current || manualWords) return;
    setValue("amountWords", amountInWords(amount, lang), { shouldValidate: false });
  }, [amount, lang, manualWords, setValue]);

  // Prefill from ?invoiceId=... (for example from the invoice list).
  useEffect(() => {
    if (isEdit || !initialized.current) return;
    const preset = Number(searchParams.get("invoiceId"));
    if (!Number.isInteger(preset) || preset <= 0) return;
    if (values.invoiceId === preset) return;
    let cancelled = false;
    void api
      .get<{ invoice: InvoiceDto }>(`/invoices/${preset}`)
      .then(({ invoice }) => {
        if (cancelled) return;
        setValue("invoiceId", invoice.id);
        setValue("receivedFrom", invoice.customerName);
        setValue("amount", invoice.total);
        setValue("amountWords", amountInWords(invoice.total, values.lang ?? "ar"));
        setValue("wordsManuallyEdited", false);
        if (!values.paymentFor) {
          setValue("paymentFor", invoice.itemInfo || t("vouchers.linkInvoice"));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    isEdit,
    searchParams,
    setValue,
    t,
    values.invoiceId,
    values.lang,
    values.paymentFor,
    nextNumberQuery.data?.number,
  ]);

  const previewVoucher: VoucherDto = {
    id: voucherId ?? 0,
    number: toWholeNumber(values.number) || nextNumberQuery.data?.number || 0,
    date: values.date || todayInBaghdad(),
    invoiceId: values.invoiceId ?? null,
    receivedFrom: values.receivedFrom ?? "",
    amount,
    amountWords: manualWords ? values.amountWords ?? "" : amountInWords(amount, lang),
    paymentFor: values.paymentFor ?? "",
    paymentMethod: values.paymentMethod ?? "cash",
    preparedBy: values.preparedBy ?? "",
    receivedByName: values.receivedByName ?? "",
    approvedBy: values.approvedBy ?? "",
    lang,
    digitsMode: values.digitsMode ?? "latin",
    createdBy: user?.id ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    verifyCode: voucherQuery.data?.voucher.verifyCode ?? "XXXX-XXXX-XXXX",
    status: voucherQuery.data?.voucher.status ?? "DRAFT",
    issuedAt: voucherQuery.data?.voucher.issuedAt ?? null,
    cancelledAt: voucherQuery.data?.voucher.cancelledAt ?? null,
    cancelReason: voucherQuery.data?.voucher.cancelReason ?? "",
    verifyCount: voucherQuery.data?.voucher.verifyCount ?? 0,
    lastVerifiedAt: voucherQuery.data?.voucher.lastVerifiedAt ?? null,
    watermarkEnabled: values.watermarkEnabled ?? null,
  };

  const saveMutation = useMutation({
    mutationFn: async ({ input, print }: { input: VoucherInput; print: boolean }) => {
      const result = isEdit
        ? await api.put<{ voucher: VoucherDto }>(`/vouchers/${voucherId}`, input)
        : await api.post<{ voucher: VoucherDto }>("/vouchers", input);
      return { ...result, print };
    },
    onSuccess: async (result) => {
      toast.success(isEdit ? t("vouchers.saved") : t("vouchers.created"));
      await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      if (result.print) {
        openPrintWindow(`/print/voucher/${result.voucher.id}?lang=${result.voucher.lang}`);
      }
      navigate(`/vouchers/${result.voucher.id}/edit`, { replace: !isEdit });
    },
    onError: (error) => setServerError(apiError(error)),
  });

  const documentStatus = previewVoucher.status;
  const isLocked = isEdit && documentStatus !== "DRAFT";

  const invalidateDocument = async () => {
    await queryClient.invalidateQueries({ queryKey: ["voucher", voucherId] });
    await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
    await queryClient.invalidateQueries({ queryKey: ["voucher", "next-number"] });
  };

  const unlockMutation = useMutation({
    mutationFn: () => api.post<{ voucher: VoucherDto }>(`/vouchers/${voucherId}/unlock`),
    onSuccess: async () => {
      toast.success(t("documents.unlocked"));
      setUnlockOpen(false);
      await invalidateDocument();
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      api.post<{ voucher: VoucherDto }>(`/vouchers/${voucherId}/cancel`, { reason: cancelReason }),
    onSuccess: async () => {
      toast.success(t("documents.cancelledDone"));
      setCancelOpen(false);
      setCancelReason("");
      await invalidateDocument();
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const onSubmit = (input: VoucherInput, print = false) => {
    if (isLocked) return;
    setServerError("");
    saveMutation.mutate({
      input: {
        ...input,
        amountWords: input.wordsManuallyEdited ? input.amountWords : amountInWords(input.amount, input.lang),
      },
      print,
    });
  };

  const submit = handleSubmit((input) => onSubmit(input, false));
  const submitWithPrint = handleSubmit((input) => onSubmit(input, true));

  const pickInvoice = (raw: string) => {
    const invoiceId = Number(raw);
    if (!invoiceId) {
      setValue("invoiceId", null);
      return;
    }
    const option = invoiceOptionsQuery.data?.items.find((item) => item.id === invoiceId);
    setValue("invoiceId", invoiceId);
    if (!option) return;
    setValue("receivedFrom", option.customerName);
    setValue("amount", option.total);
    setValue("amountWords", amountInWords(option.total, values.lang ?? "ar"));
    setValue("wordsManuallyEdited", false);
    if (!values.paymentFor) setValue("paymentFor", t("vouchers.linkInvoice"));
  };

  const regenerateWords = () => {
    setValue("wordsManuallyEdited", false);
    setValue("amountWords", amountInWords(amount, lang), { shouldDirty: true, shouldValidate: true });
  };

  if (isEdit && voucherQuery.isLoading) return <PageLoader label={t("common.loading")} />;
  if (isEdit && voucherQuery.isError) {
    return (
      <div className="card p-8 text-center text-sm font-semibold text-red-600">
        {apiError(voucherQuery.error)}
      </div>
    );
  }

  const busy = isSubmitting || saveMutation.isPending;

  const formPanel = (
    <form id="voucher-form" onSubmit={submit} noValidate className="space-y-5">
      {serverError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {serverError}
        </div>
      ) : null}
      {Object.keys(errors).length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {validation((errors as Record<string, { message?: string }>).amount?.message) ||
            validation((errors as Record<string, { message?: string }>).receivedFrom?.message) ||
            t("errors.VALIDATION_ERROR")}
        </div>
      ) : null}

      <fieldset disabled={isLocked} className="space-y-5">
      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange">
            <ReceiptText className="h-4.5 w-4.5" />
          </span>
          <h2 className="text-sm font-extrabold text-slate-900">{t("documents.voucher.title", { lng: "ar" })}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="voucher-number">
              {t("vouchers.number")}
            </label>
            <input
              id="voucher-number"
              type="number"
              min={1}
              readOnly={!isAdmin}
              className={clsx("input", !isAdmin && "bg-slate-100")}
              dir="ltr"
              {...register("number", { setValueAs: (value: unknown) => toWholeNumber(value) || undefined })}
            />
          </div>
          <div>
            <label className="label" htmlFor="voucher-date">
              {t("invoices.date")}
            </label>
            <div className="relative">
              <input
                id="voucher-date"
                type="date"
                className="input pe-10"
                dir="ltr"
                {...register("date")}
              />
              <CalendarDays className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            {errors.date ? (
              <p className="mt-1 text-xs font-semibold text-red-600">{validation(errors.date.message)}</p>
            ) : null}
          </div>
          <div>
            <label className="label">{t("invoices.language")}</label>
            <select className="input" {...register("lang")}>
              <option value="ar">{t("common.arabic")}</option>
              <option value="ku">{t("common.kurdish")}</option>
            </select>
          </div>
          <div>
            <label className="label">{t("invoices.digits")}</label>
            <select className="input" {...register("digitsMode")}>
              <option value="latin">{t("settings.latin")}</option>
              <option value="eastern">{t("settings.eastern")}</option>
            </select>
          </div>
          {isAdmin ? (
            <div>
              <label className="label">{t("settings.watermark")}</label>
              <select
                className="input"
                value={
                  values.watermarkEnabled === null || values.watermarkEnabled === undefined
                    ? "default"
                    : values.watermarkEnabled
                      ? "on"
                      : "off"
                }
                onChange={(event) =>
                  setValue(
                    "watermarkEnabled",
                    event.target.value === "default" ? null : event.target.value === "on",
                    { shouldDirty: true },
                  )
                }
              >
                <option value="default">{t("documents.watermarkDefault")}</option>
                <option value="on">{t("documents.watermarkOn")}</option>
                <option value="off">{t("documents.watermarkOff")}</option>
              </select>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange">
            <Link2 className="h-4.5 w-4.5" />
          </span>
          <h2 className="text-sm font-extrabold text-slate-900">{t("vouchers.linkInvoice")}</h2>
        </div>
        <select
          className="input"
          value={values.invoiceId ?? ""}
          onChange={(event) => pickInvoice(event.target.value)}
        >
          <option value="">{t("vouchers.noInvoice")}</option>
          {(invoiceOptionsQuery.data?.items ?? []).map((invoice) => (
            <option key={invoice.id} value={invoice.id}>
              #{invoice.number} — {invoice.customerName || t("common.none")}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[11px] leading-4 text-slate-400">{t("vouchers.invoiceLinkHint")}</p>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange">
            <UserRound className="h-4.5 w-4.5" />
          </span>
          <h2 className="text-sm font-extrabold text-slate-900">{t("vouchers.receivedFrom")}</h2>
        </div>
        <div>
          <label className="label">{t("vouchers.receivedFrom")}</label>
          <input
            className="input"
            {...register("receivedFrom")}
            placeholder={t("vouchers.receivedFrom")}
            data-testid="voucher-received-from"
          />
          {errors.receivedFrom ? (
            <p className="mt-1 text-xs font-semibold text-red-600">{validation(errors.receivedFrom.message)}</p>
          ) : null}
        </div>
        <div className="mt-4">
          <label className="label">{t("vouchers.paymentFor")}</label>
          <textarea className="textarea min-h-[90px]" rows={3} {...register("paymentFor")} data-testid="voucher-payment-for" />
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange">
            <Wallet className="h-4.5 w-4.5" />
          </span>
          <h2 className="text-sm font-extrabold text-slate-900">{t("vouchers.amount")}</h2>
        </div>
        <div>
          <label className="label">{t("vouchers.amount")} · IQD</label>
          <input
            type="number"
            min={0}
            step={1}
            className="input text-lg font-extrabold"
            dir="ltr"
            data-testid="voucher-amount"
            {...register("amount", { setValueAs: toWholeNumber })}
          />
          {errors.amount ? (
            <p className="mt-1 text-xs font-semibold text-red-600">{validation(errors.amount.message)}</p>
          ) : null}
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label className="label !mb-0">{t("vouchers.amountWords")}</label>
            <button type="button" className="btn-link text-xs" onClick={regenerateWords}>
              <RefreshCw className="h-3.5 w-3.5" />
              {t("common.reset")}
            </button>
          </div>
          <textarea
            className="textarea min-h-[96px]"
            rows={3}
            {...register("amountWords", {
              onChange: () => setValue("wordsManuallyEdited", true),
            })}
          />
          <p className="mt-1.5 text-[11px] leading-4 text-slate-400">{t("vouchers.wordsHint")}</p>
        </div>
        <div className="mt-4">
          <label className="label">{t("vouchers.paymentMethod")}</label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: "cash", label: t("vouchers.cash") },
                { value: "bank_transfer", label: t("vouchers.bankTransfer") },
                { value: "cheque", label: t("vouchers.cheque") },
              ] as const
            ).map((method) => (
              <label
                key={method.value}
                className={clsx(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-extrabold transition",
                  values.paymentMethod === method.value
                    ? "border-brand-orange bg-brand-orange-soft text-brand-orange"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                )}
              >
                <input
                  type="radio"
                  value={method.value}
                  className="h-3.5 w-3.5 accent-brand-orange"
                  {...register("paymentMethod")}
                />
                {method.label}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-extrabold text-slate-900">{t("vouchers.signature")}</h2>
        <div className="space-y-4">
          <div>
            <label className="label">{t("vouchers.preparedBy")}</label>
            <input className="input" {...register("preparedBy")} />
          </div>
          <div>
            <label className="label">{t("vouchers.receivedBy")}</label>
            <input className="input" {...register("receivedByName")} />
          </div>
          <div>
            <label className="label">{t("vouchers.approvedBy")}</label>
            <input className="input" {...register("approvedBy")} />
          </div>
        </div>
      </section>
      </fieldset>
    </form>
  );

  const previewPanel = (
    <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3 shadow-card" data-testid="voucher-preview">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <span className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500">
          <Eye className="h-4 w-4" />
          {t("vouchers.livePreview")}
        </span>
        <span className="badge bg-white text-slate-500">A5 · 210 × 148 mm</span>
      </div>
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <ScaledSheet widthMm={210} heightMm={148}>
          <VoucherDocument
            voucher={previewVoucher}
            settings={settings}
            lang={previewVoucher.lang}
            digitsMode={previewVoucher.digitsMode}
          />
        </ScaledSheet>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to="/vouchers" className="btn-ghost !px-2.5 !py-2">
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {isEdit ? t("vouchers.editVoucher") : t("vouchers.newVoucher")}
            </h1>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">
              {previewVoucher.number ? `#${previewVoucher.number}` : ""} · {previewVoucher.date}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLocked ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                openPrintWindow(`/print/voucher/${voucherId}?lang=${previewVoucher.lang}`)
              }
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">{t("invoices.print")}</span>
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={submitWithPrint} disabled={busy}>
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">{t("vouchers.saveAndPrint")}</span>
            </button>
          )}
          <button type="submit" form="voucher-form" className="btn-primary" disabled={busy || isLocked}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {busy ? t("common.saving") : t("vouchers.save")}
          </button>
        </div>
      </div>

      {isLocked ? (
        <div
          className={clsx(
            "mb-4 rounded-2xl border px-4 py-3.5",
            documentStatus === "CANCELLED"
              ? "border-red-200 bg-red-50"
              : "border-amber-200 bg-amber-50",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={clsx(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white",
                  documentStatus === "CANCELLED" ? "bg-red-600" : "bg-amber-500",
                )}
              >
                <Lock className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">
                  {t(`documents.status.${documentStatus}`)} · {t("documents.readOnly")}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">{t("documents.lockedHint")}</p>
                {documentStatus === "CANCELLED" && previewVoucher.cancelReason ? (
                  <p className="mt-1 text-xs font-semibold text-red-700">
                    {t("documents.cancelReason")}: {previewVoucher.cancelReason}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] font-semibold text-slate-500" dir="ltr">
                  {t("documents.verifyCode")}: {previewVoucher.verifyCode}
                  {previewVoucher.issuedAt
                    ? ` · ${t("documents.issuedAt")}: ${previewVoucher.issuedAt.slice(0, 10)}`
                    : ""}
                  {previewVoucher.cancelledAt
                    ? ` · ${t("documents.cancelledAt")}: ${previewVoucher.cancelledAt.slice(0, 10)}`
                    : ""}
                </p>
              </div>
            </div>
            {isAdmin ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-ghost !py-2 text-xs"
                  onClick={() => setUnlockOpen(true)}
                >
                  <Unlock className="h-4 w-4" />
                  {t("documents.unlock")}
                </button>
                {documentStatus !== "CANCELLED" ? (
                  <button
                    type="button"
                    className="btn-link text-red-600 hover:bg-red-100"
                    onClick={() => setCancelOpen((open) => !open)}
                  >
                    <Ban className="h-4 w-4" />
                    {t("documents.cancelDocument")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {isAdmin && cancelOpen && documentStatus !== "CANCELLED" ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-white p-3">
              <p className="mb-2 text-xs font-bold text-red-700">{t("documents.cancelConfirm")}</p>
              <label className="label !text-xs">{t("documents.cancelReason")}</label>
              <input
                className="input"
                value={cancelReason}
                maxLength={500}
                onChange={(event) => setCancelReason(event.target.value)}
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="btn-ghost !py-1.5 text-xs"
                  onClick={() => setCancelOpen(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-extrabold text-white transition hover:bg-red-700 disabled:opacity-60"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                >
                  {t("documents.cancelDocument")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 flex rounded-xl border border-slate-200 bg-white p-1 lg:hidden">
        {(["form", "preview"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={clsx(
              "flex-1 rounded-lg px-3 py-2 text-xs font-extrabold transition",
              mobileTab === tab ? "bg-brand-orange text-white" : "text-slate-500",
            )}
          >
            {tab === "form" ? t("vouchers.form") : t("vouchers.preview")}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
        <div className={clsx("min-w-0", mobileTab === "preview" && "hidden lg:block")}>{formPanel}</div>
        <div
          className={clsx(
            "min-w-0 lg:sticky lg:top-[92px]",
            mobileTab === "form" && "hidden lg:block",
          )}
        >
          {previewPanel}
        </div>
      </div>

      <ConfirmDialog
        open={unlockOpen}
        title={t("documents.unlock")}
        message={t("documents.lockedHint")}
        confirmLabel={t("documents.unlock")}
        cancelLabel={t("common.cancel")}
        busy={unlockMutation.isPending}
        onConfirm={() => unlockMutation.mutate()}
        onClose={() => setUnlockOpen(false)}
      />
    </div>
  );
}
