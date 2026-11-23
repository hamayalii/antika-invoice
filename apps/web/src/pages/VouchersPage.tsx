import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Copy,
  FilePlus2,
  FileText,
  Printer,
  ReceiptText,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { formatMoney, type Paginated, type VoucherDto } from "@antika/shared";
import { api } from "../lib/api";
import { useApiErrorMessage } from "../lib/i18nHooks";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import { useDebounced } from "../lib/useDebounced";
import { openPrintWindow } from "../lib/printWindow";
import { PageHeader, PageLoader, ErrorState, EmptyState } from "../components/Ui";
import { ConfirmDialog } from "../components/Modal";

const PAGE_SIZE = 20;

function pageNumber(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function VouchersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const apiError = useApiErrorMessage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();

  const [search, setSearch] = useState(params.get("q") ?? "");
  const debouncedSearch = useDebounced(search, 300);
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const page = pageNumber(params.get("page"));

  useEffect(() => {
    document.title = `${t("vouchers.title")} | ${t("app.name")}`;
  }, [t]);

  useEffect(() => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      const trimmed = debouncedSearch.trim();
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      if (next.get("q") === current.get("q")) return current;
      next.delete("page");
      return next;
    });
  }, [debouncedSearch, setParams]);

  const listQuery = useQuery({
    queryKey: ["vouchers", { q: params.get("q") ?? "", from, to, page }],
    queryFn: () =>
      api.get<Paginated<VoucherDto>>("/vouchers", {
        q: params.get("q") ?? "",
        from,
        to,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const [deleteTarget, setDeleteTarget] = useState<VoucherDto | null>(null);

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => api.post<{ voucher: { id: number } }>(`/vouchers/${id}/duplicate`),
    onSuccess: async (result) => {
      toast.success(t("vouchers.duplicated"));
      await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      navigate(`/vouchers/${result.voucher.id}/edit`);
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete<{ ok: boolean }>(`/vouchers/${id}`),
    onSuccess: async () => {
      toast.success(t("vouchers.deleted"));
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const setFilter = (key: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      return next;
    });
    if (key === "q") setSearch(value);
  };

  const goToPage = (nextPage: number) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (nextPage > 1) next.set("page", String(nextPage));
      else next.delete("page");
      return next;
    });
  };

  const rows = listQuery.data?.items ?? [];
  const hasFilters = Boolean(params.get("q") || from || to);

  const summary = useMemo(() => {
    if (!listQuery.data) return null;
    const pageTotal = rows.reduce((sum, row) => sum + row.amount, 0);
    return (
      <div className="flex flex-wrap items-center gap-4 px-5 py-3 text-xs font-semibold text-slate-500">
        <span>{t("common.showing", { count: rows.length })}</span>
        <span className="text-slate-300">|</span>
        <span>
          {t("vouchers.amount")}:{" "}
          <span className="font-extrabold text-slate-700">{formatMoney(pageTotal)}</span>
        </span>
        <span className="text-slate-300">|</span>
        <span>
          {t("common.total")}:{" "}
          <span className="font-extrabold text-slate-700">{formatMoney(listQuery.data.total)}</span>
        </span>
      </div>
    );
  }, [listQuery.data, rows, t]);

  const methodLabel = (method: VoucherDto["paymentMethod"]) => {
    if (method === "bank_transfer") return t("vouchers.bankTransfer");
    if (method === "cheque") return t("vouchers.cheque");
    return t("vouchers.cash");
  };

  return (
    <div>
      <PageHeader
        title={t("vouchers.title")}
        subtitle={t("vouchers.subtitle")}
        actions={
          <Link to="/vouchers/new" className="btn-primary">
            <FilePlus2 className="h-4 w-4" />
            {t("vouchers.newVoucher")}
          </Link>
        }
      />

      <div className="card mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_170px_170px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input ps-10"
              placeholder={t("vouchers.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <button
                type="button"
                aria-label={t("common.reset")}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={() => setSearch("")}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              className="input ps-10"
              dir="ltr"
              aria-label={t("common.from")}
              value={from}
              max={to || undefined}
              onChange={(event) => setFilter("from", event.target.value)}
            />
          </div>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              className="input ps-10"
              dir="ltr"
              aria-label={t("common.to")}
              value={to}
              min={from || undefined}
              onChange={(event) => setFilter("to", event.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-ghost"
            disabled={!hasFilters}
            onClick={() => {
              setSearch("");
              setParams({});
            }}
          >
            <X className="h-4 w-4" />
            {t("common.reset")}
          </button>
        </div>
      </div>

      <div className="table-wrap">
        {listQuery.isLoading ? (
          <PageLoader label={t("common.loading")} />
        ) : listQuery.isError ? (
          <ErrorState
            message={apiError(listQuery.error)}
            onRetry={() => void listQuery.refetch()}
            retryLabel={t("common.confirm")}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title={hasFilters ? t("common.noResults") : t("vouchers.noVouchers")}
            action={
              hasFilters ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setSearch("");
                    setParams({});
                  }}
                >
                  {t("common.reset")}
                </button>
              ) : (
                <Link to="/vouchers/new" className="btn-primary">
                  <FilePlus2 className="h-4 w-4" />
                  {t("vouchers.newVoucher")}
                </Link>
              )
            }
          />
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("vouchers.number")}</th>
                  <th>{t("invoices.date")}</th>
                  <th>{t("vouchers.receivedFrom")}</th>
                  <th>{t("vouchers.paymentMethod")}</th>
                  <th>{t("vouchers.amount")}</th>
                  <th className="text-end">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/vouchers/${row.id}/edit`}
                          className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-orange hover:underline"
                        >
                          <ReceiptText className="h-4 w-4" />
                          #{row.number}
                        </Link>
                        <span
                          className={
                            row.status === "CANCELLED"
                              ? "badge bg-red-50 text-red-700"
                              : row.status === "ISSUED"
                                ? "badge bg-emerald-50 text-emerald-700"
                                : "badge bg-slate-100 text-slate-500"
                          }
                        >
                          {t(`documents.status.${row.status}`)}
                        </span>
                      </div>
                      {user?.role === "admin" && row.verifyCount > 0 ? (
                        <p className="mt-1 text-[11px] font-semibold text-slate-400">
                          {t("documents.verifiedTimes", { count: row.verifyCount })}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-600" dir="ltr">
                      {row.date}
                    </td>
                    <td>
                      <div className="max-w-[260px] truncate font-bold text-slate-800">{row.receivedFrom}</div>
                    </td>
                    <td>
                      <span className="badge bg-slate-100 text-slate-500">{methodLabel(row.paymentMethod)}</span>
                    </td>
                    <td className="whitespace-nowrap text-sm font-extrabold text-slate-800" dir="ltr">
                      {formatMoney(row.amount)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand-orange"
                          title={t("invoices.print")}
                          data-testid={`print-voucher-${row.id}`}
                          onClick={() =>
                            openPrintWindow(`/print/voucher/${row.id}?lang=${row.lang}`)
                          }
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <a
                          href={`/api/vouchers/${row.id}/pdf`}
                          target="_blank"
                          rel="noopener"
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand-orange"
                          title={t("invoices.pdf")}
                        >
                          <FileText className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand-orange"
                          title={t("vouchers.duplicated")}
                          disabled={duplicateMutation.isPending}
                          onClick={() => duplicateMutation.mutate(row.id)}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        {user?.role === "admin" ? (
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                            title={t("vouchers.deleted")}
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-100">{summary}</div>
          </>
        )}
      </div>

      {listQuery.data && listQuery.data.totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-500">
            {t("common.page")} <span>{listQuery.data.page}</span> {t("common.of")}{" "}
            <span>{listQuery.data.totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost !px-3 !py-2 text-xs"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              <ArrowRight className="h-4 w-4" />
              {t("common.previous")}
            </button>
            <button
              type="button"
              className="btn-ghost !px-3 !py-2 text-xs"
              disabled={page >= listQuery.data.totalPages}
              onClick={() => goToPage(page + 1)}
            >
              {t("common.next")}
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("vouchers.deleteTitle")}
        message={t("vouchers.deleteConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        danger
        busy={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
