import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CalendarDays,
  Eye,
  FileText,
  Loader2,
  Lock,
  Plus,
  Printer,
  Save,
  Trash2,
  Unlock,
  UserRound,
  Ban,
} from "lucide-react";
import clsx from "clsx";
import {
  computeInvoiceTotals,
  computeLineTotal,
  invoiceInputSchema,
  todayInBaghdad,
  type AppSettings,
  type CustomerDto,
  type DigitsMode,
  type InvoiceDto,
  type InvoiceInput,
  type ItemInput,
  type Language,
} from "@antika/shared";
import { api } from "../lib/api";
import { useApiErrorMessage, useValidationMessage } from "../lib/i18nHooks";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/useSettings";
import { useDebounced } from "../lib/useDebounced";
import { PageLoader } from "../components/Ui";
import { ConfirmDialog } from "../components/Modal";
import { InvoiceDocument } from "../features/invoices/InvoiceDocument";
import { ScaledSheet } from "../components/ScaledSheet";

const emptyItem: ItemInput = {
  name: "",
  code: "",
  qty: 1,
  price: 0,
  discount: 0,
  notes: "",
};

function defaults(settings: AppSettings, nextNumber?: number): InvoiceInput {
  return {
    number: nextNumber,
    date: todayInBaghdad(),
    customerId: null,
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    lang: "ku",
    digitsMode: settings.defaults.invoiceDigits,
    itemInfo: "",
    materialsText: "",
    specialOffer: "",
    advancePercent: settings.defaults.advancePercent,
    finalPercent: settings.defaults.finalPercent,
    items: [{ ...emptyItem }],
    saveCustomer: true,
    watermarkEnabled: null,
  };
}

function toFormValues(invoice: InvoiceDto): InvoiceInput {
  return {
    number: invoice.number,
    date: invoice.date,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    customerPhone: invoice.customerPhone,
    customerAddress: invoice.customerAddress,
    lang: invoice.lang,
    digitsMode: invoice.digitsMode,
    itemInfo: invoice.itemInfo,
    materialsText: invoice.materialsText,
    specialOffer: invoice.specialOffer,
    advancePercent: invoice.advancePercent,
    finalPercent: invoice.finalPercent,
    items: invoice.items.map((item) => ({
      name: item.name,
      code: item.code,
      qty: item.qty,
      price: item.price,
      discount: item.discount,
      notes: item.notes,
    })),
    saveCustomer: true,
    watermarkEnabled: invoice.watermarkEnabled,
  };
}

export function InvoiceEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const invoiceId = id ? Number(id) : null;
  const isEdit = Boolean(invoiceId);
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
  const [customerOpen, setCustomerOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const initialized = useRef(false);

  const invoiceQuery = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => api.get<{ invoice: InvoiceDto }>(`/invoices/${invoiceId}`),
    enabled: isEdit,
  });

  const nextNumberQuery = useQuery({
    queryKey: ["invoice", "next-number"],
    queryFn: () => api.get<{ number: number }>("/invoices/next-number"),
    enabled: !isEdit,
    staleTime: 0,
  });

  const form = useForm<InvoiceInput>({
    resolver: zodResolver(invoiceInputSchema),
    defaultValues: defaults(settings, undefined),
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const values = watch();

  useEffect(() => {
    document.title = `${isEdit ? t("invoices.editInvoice") : t("invoices.newInvoice")} | ${t("app.name")}`;
  }, [t, isEdit]);

  useEffect(() => {
    if (initialized.current) return;
    if (isEdit && invoiceQuery.data?.invoice) {
      const invoice = invoiceQuery.data.invoice;
      reset(toFormValues(invoice));
      initialized.current = true;
    } else if (!isEdit && nextNumberQuery.data) {
      reset(defaults(settings, nextNumberQuery.data.number));
      initialized.current = true;
    }
  }, [isEdit, invoiceQuery.data, nextNumberQuery.data, reset, settings]);

  const customerName = watch("customerName");
  const debouncedCustomer = useDebounced(customerName ?? "", 250);
  const customersQuery = useQuery({
    queryKey: ["customers", debouncedCustomer],
    queryFn: () =>
      api.get<{ customers: CustomerDto[] }>("/customers", { q: debouncedCustomer }),
    enabled: customerOpen && debouncedCustomer.trim().length >= 1,
    staleTime: 30_000,
  });

  const totals = useMemo(
    () =>
      computeInvoiceTotals(
        values.items ?? [],
        Number(values.advancePercent) || 0,
        Number(values.finalPercent) || 0,
      ),
    [values.items, values.advancePercent, values.finalPercent],
  );

  const previewInvoice: InvoiceDto = useMemo(() => {
    return {
      id: invoiceId ?? 0,
      number: Number(values.number) || nextNumberQuery.data?.number || 0,
      date: values.date || todayInBaghdad(),
      customerId: values.customerId ?? null,
      customerName: values.customerName ?? "",
      customerPhone: values.customerPhone ?? "",
      customerAddress: values.customerAddress ?? "",
      lang: values.lang ?? "ku",
      digitsMode: values.digitsMode ?? "eastern",
      itemInfo: values.itemInfo ?? "",
      materialsText: values.materialsText ?? "",
      specialOffer: values.specialOffer ?? "",
      advancePercent: totals.advancePercent,
      finalPercent: totals.finalPercent,
      subtotal: totals.subtotal,
      total: totals.total,
      advanceAmount: totals.advanceAmount,
      finalAmount: totals.finalAmount,
      createdBy: user?.id ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      verifyCode: invoiceQuery.data?.invoice.verifyCode ?? "XXXX-XXXX-XXXX",
      status: invoiceQuery.data?.invoice.status ?? "DRAFT",
      issuedAt: invoiceQuery.data?.invoice.issuedAt ?? null,
      cancelledAt: invoiceQuery.data?.invoice.cancelledAt ?? null,
      cancelReason: invoiceQuery.data?.invoice.cancelReason ?? "",
      verifyCount: invoiceQuery.data?.invoice.verifyCount ?? 0,
      lastVerifiedAt: invoiceQuery.data?.invoice.lastVerifiedAt ?? null,
      watermarkEnabled: values.watermarkEnabled ?? null,
      items: totals.items.map((item, index) => ({
        id: index + 1,
        position: index,
        name: item.name,
        code: item.code,
        qty: item.qty,
        price: item.price,
        discount: item.discount,
        notes: item.notes,
        lineTotal: item.lineTotal,
      })),
    };
  }, [values, totals, invoiceId, nextNumberQuery.data?.number, user?.id, invoiceQuery.data?.invoice]);

  const saveMutation = useMutation({
    mutationFn: async ({ input, print }: { input: InvoiceInput; print: boolean }) => {
      const result = isEdit
        ? await api.put<{ invoice: InvoiceDto }>(`/invoices/${invoiceId}`, input)
        : await api.post<{ invoice: InvoiceDto }>("/invoices", input);
      return { ...result, print };
    },
    onSuccess: async (result) => {
      toast.success(isEdit ? t("invoices.saved") : t("invoices.created"));
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (result.print) {
        window.open(`/print/invoice/${result.invoice.id}?lang=${result.invoice.lang}`, "_blank", "noopener");
      }
      navigate(`/invoices/${result.invoice.id}/edit`, { replace: !isEdit });
    },
    onError: (error) => setServerError(apiError(error)),
  });

  const documentStatus = previewInvoice.status;
  const isLocked = isEdit && documentStatus !== "DRAFT";

  const invalidateDocument = async () => {
    await queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    await queryClient.invalidateQueries({ queryKey: ["invoices"] });
    await queryClient.invalidateQueries({ queryKey: ["invoice", "next-number"] });
  };

  const unlockMutation = useMutation({
    mutationFn: () => api.post<{ invoice: InvoiceDto }>(`/invoices/${invoiceId}/unlock`),
    onSuccess: async () => {
      toast.success(t("documents.unlocked"));
      setUnlockOpen(false);
      await invalidateDocument();
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      api.post<{ invoice: InvoiceDto }>(`/invoices/${invoiceId}/cancel`, { reason: cancelReason }),
    onSuccess: async () => {
      toast.success(t("documents.cancelledDone"));
      setCancelOpen(false);
      setCancelReason("");
      await invalidateDocument();
    },
    onError: (error) => toast.error(apiError(error)),
  });

  if (isEdit && invoiceQuery.isLoading) return <PageLoader label={t("common.loading")} />;
  if (isEdit && invoiceQuery.isError) {
    return (
      <div className="card p-8 text-center text-sm font-semibold text-red-600">
        {apiError(invoiceQuery.error)}
      </div>
    );
  }

  const onSubmit = (input: InvoiceInput, print = false) => {
    if (isLocked) return;
    setServerError("");
    saveMutation.mutate({ input, print });
  };

  const submitWithPrint = handleSubmit((input) => onSubmit(input, true));
  const submit = handleSubmit((input) => onSubmit(input, false));

  const pickCustomer = (customer: CustomerDto) => {
    setValue("customerId", customer.id, { shouldDirty: true });
    setValue("customerName", customer.name, { shouldDirty: true });
    setValue("customerPhone", customer.phone, { shouldDirty: true });
    setValue("customerAddress", customer.address, { shouldDirty: true });
    setCustomerOpen(false);
  };

  const busy = isSubmitting || saveMutation.isPending;

  const formPanel = (
    <form id="invoice-form" onSubmit={submit} noValidate className="space-y-5">
      {serverError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {serverError}
        </div>
      ) : null}
      {Object.keys(errors).length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {validation((errors as Record<string, { message?: string }>).items?.message) ||
            validation((errors as Record<string, { message?: string }>).customerName?.message) ||
            t("errors.VALIDATION_ERROR")}
        </div>
      ) : null}

      <fieldset disabled={isLocked} className="space-y-5">
      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange">
            <FileText className="h-4.5 w-4.5" />
          </span>
          <h2 className="text-sm font-extrabold text-slate-900">{t("documents.invoice.number", { lng: "ku" })}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="invoice-number">
              {t("invoices.number")}
            </label>
            <input
              id="invoice-number"
              type="number"
              min={1}
              readOnly={!isAdmin}
              className={clsx("input", !isAdmin && "bg-slate-100")}
              dir="ltr"
              {...register("number", { valueAsNumber: true })}
            />
            <p className="mt-1 text-[11px] leading-4 text-slate-400">{t("invoices.numberHint")}</p>
          </div>
          <div>
            <label className="label" htmlFor="invoice-date">
              {t("invoices.date")}
            </label>
            <div className="relative">
              <input
                id="invoice-date"
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
              <option value="ku">{t("common.kurdish")}</option>
              <option value="ar">{t("common.arabic")}</option>
            </select>
          </div>
          <div>
            <label className="label">{t("invoices.digits")}</label>
            <select className="input" {...register("digitsMode")}>
              <option value="eastern">{t("settings.eastern")}</option>
              <option value="latin">{t("settings.latin")}</option>
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
            <UserRound className="h-4.5 w-4.5" />
          </span>
          <h2 className="text-sm font-extrabold text-slate-900">{t("invoices.customer")}</h2>
        </div>
        <div className="space-y-4">
          <div className="relative">
            <label className="label" htmlFor="customer-name">
              {t("invoices.customerName")}
            </label>
            <input
              id="customer-name"
              className="input"
              autoComplete="off"
              {...register("customerName", {
                onChange: () => {
                  setValue("customerId", null);
                  setCustomerOpen(true);
                },
                onBlur: () => {
                  window.setTimeout(() => setCustomerOpen(false), 120);
                },
              })}
              onFocus={() => setCustomerOpen(true)}
            />
            <p className="mt-1 text-[11px] leading-4 text-slate-400">
              {t("invoices.customerSearchHint")}
            </p>
            {customerOpen && debouncedCustomer.trim().length >= 1 ? (
              <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
                {customersQuery.isLoading ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("common.loading")}
                  </div>
                ) : null}
                {(customersQuery.data?.customers ?? []).map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      pickCustomer(customer);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-start transition hover:bg-slate-50"
                  >
                    <span className="truncate text-sm font-bold text-slate-700">{customer.name}</span>
                    <span className="shrink-0 text-[11px] text-slate-400" dir="ltr">
                      {customer.phone}
                    </span>
                  </button>
                ))}
                {!customersQuery.isLoading && (customersQuery.data?.customers ?? []).length === 0 ? (
                  <p className="px-3.5 py-2 text-xs text-slate-400">{t("common.noResults")}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{t("invoices.customerPhone")}</label>
              <input className="input" dir="ltr" {...register("customerPhone")} />
            </div>
            <div>
              <label className="label">{t("invoices.customerAddress")}</label>
              <input className="input" {...register("customerAddress")} />
            </div>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold text-slate-900">{t("invoices.items")}</h2>
          <button
            type="button"
            className="btn-ghost !py-2 text-xs"
            onClick={() => append({ ...emptyItem })}
          >
            <Plus className="h-4 w-4" />
            {t("invoices.addItem")}
          </button>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => {
            const item = values.items?.[index];
            const lineTotal = item ? computeLineTotal(item) : 0;
            return (
              <div key={field.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="badge bg-white text-slate-500">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    className="btn-link text-red-600 hover:bg-red-50"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("invoices.removeItem")}
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                  <div>
                    <label className="label !text-xs">{t("invoices.itemName")}</label>
                    <input className="input" {...register(`items.${index}.name`)} />
                  </div>
                  <div>
                    <label className="label !text-xs">{t("invoices.itemCode")}</label>
                    <input className="input" dir="ltr" {...register(`items.${index}.code`)} />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="label !text-xs">{t("invoices.qty")}</label>
                    <input
                      type="number"
                      min={0}
                      className="input"
                      dir="ltr"
                      {...register(`items.${index}.qty`, { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <label className="label !text-xs">{t("invoices.price")}</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="input"
                      dir="ltr"
                      {...register(`items.${index}.price`, { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <label className="label !text-xs">{t("invoices.discount")}</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="input"
                      dir="ltr"
                      {...register(`items.${index}.discount`, { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <label className="label !text-xs">{t("invoices.lineTotal")}</label>
                    <div className="flex h-[42px] items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-brand-orange" dir="ltr">
                      {new Intl.NumberFormat("en-US").format(lineTotal)}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label !text-xs">{t("invoices.notes")}</label>
                  <input className="input" {...register(`items.${index}.notes`)} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-extrabold text-slate-900">{t("invoices.itemInfo")}</h2>
        <div className="space-y-4">
          <div>
            <label className="label">{t("invoices.itemInfo")}</label>
            <textarea className="textarea" rows={4} {...register("itemInfo")} />
          </div>
          <div>
            <label className="label">{t("invoices.materials")}</label>
            <textarea className="textarea" rows={4} {...register("materialsText")} />
          </div>
          <div>
            <label className="label">{t("invoices.specialOffer")}</label>
            <textarea className="textarea" rows={3} {...register("specialOffer")} />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-extrabold text-slate-900">{t("invoices.percentages")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t("invoices.advancePercent")}</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input"
              dir="ltr"
              {...register("advancePercent", {
                valueAsNumber: true,
                onChange: (event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    setValue("finalPercent", 100 - value, { shouldDirty: true });
                  }
                },
              })}
            />
          </div>
          <div>
            <label className="label">{t("invoices.finalPercent")}</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input"
              dir="ltr"
              {...register("finalPercent", {
                valueAsNumber: true,
                onChange: (event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    setValue("advancePercent", 100 - value, { shouldDirty: true });
                  }
                },
              })}
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
          <div>
            <p className="text-[11px] font-semibold text-slate-400">{t("invoices.totalAmount")}</p>
            <p className="mt-1 text-sm font-extrabold text-slate-800" dir="ltr">
              {new Intl.NumberFormat("en-US").format(totals.total)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">{totals.advancePercent}%</p>
            <p className="mt-1 text-sm font-extrabold text-brand-orange" dir="ltr">
              {new Intl.NumberFormat("en-US").format(totals.advanceAmount)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">{totals.finalPercent}%</p>
            <p className="mt-1 text-sm font-extrabold text-brand-orange" dir="ltr">
              {new Intl.NumberFormat("en-US").format(totals.finalAmount)}
            </p>
          </div>
        </div>
      </section>
      </fieldset>
    </form>
  );

  const previewPanel = (
    <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <span className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500">
          <Eye className="h-4 w-4" />
          {t("invoices.livePreview")}
        </span>
        <span className="badge bg-white text-slate-500">A4 · 210 × 297 mm</span>
      </div>
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <ScaledSheet widthMm={210} heightMm={297}>
          <InvoiceDocument
            invoice={previewInvoice}
            settings={settings}
            lang={previewInvoice.lang}
            digitsMode={previewInvoice.digitsMode}
          />
        </ScaledSheet>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to="/invoices" className="btn-ghost !px-2.5 !py-2">
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {isEdit ? t("invoices.editInvoice") : t("invoices.newInvoice")}
            </h1>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">
              {previewInvoice.number ? `#${previewInvoice.number}` : ""} · {previewInvoice.date}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLocked ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                window.open(`/print/invoice/${invoiceId}?lang=${previewInvoice.lang}`, "_blank", "noopener")
              }
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">{t("invoices.print")}</span>
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={submitWithPrint} disabled={busy}>
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">{t("invoices.saveAndPrint")}</span>
            </button>
          )}
          <button type="submit" form="invoice-form" className="btn-primary" disabled={busy || isLocked}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {busy ? t("common.saving") : t("invoices.save")}
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
                {documentStatus === "CANCELLED" && previewInvoice.cancelReason ? (
                  <p className="mt-1 text-xs font-semibold text-red-700">
                    {t("documents.cancelReason")}: {previewInvoice.cancelReason}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] font-semibold text-slate-500" dir="ltr">
                  {t("documents.verifyCode")}: {previewInvoice.verifyCode}
                  {previewInvoice.issuedAt
                    ? ` · ${t("documents.issuedAt")}: ${previewInvoice.issuedAt.slice(0, 10)}`
                    : ""}
                  {previewInvoice.cancelledAt
                    ? ` · ${t("documents.cancelledAt")}: ${previewInvoice.cancelledAt.slice(0, 10)}`
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
            {tab === "form" ? t("invoices.form") : t("invoices.preview")}
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
