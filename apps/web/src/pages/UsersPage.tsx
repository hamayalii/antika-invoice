import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import {
  userCreateSchema,
  type Role,
  type UserCreateInput,
  type AdminResetPasswordInput,
} from "@antika/shared";
import { api } from "../lib/api";
import { useApiErrorMessage, useValidationMessage } from "../lib/i18nHooks";
import { useToast } from "../components/Toast";
import { ErrorState, PageHeader, PageLoader } from "../components/Ui";
import { Modal, ConfirmDialog } from "../components/Modal";
import { useAuth } from "../lib/auth";

interface UserItem {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
  active: boolean;
  createdAt: string;
}

export function UsersPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const apiError = useApiErrorMessage();
  const validation = useValidationMessage();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    document.title = `${t("users.title")} | ${t("app.name")}`;
  }, [t]);

  const query = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ users: UserItem[] }>("/users"),
  });

  const form = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { username: "", fullName: "", role: "staff", password: "" },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const createMutation = useMutation({
    mutationFn: (values: UserCreateInput) => api.post("/users", values),
    onSuccess: async () => {
      toast.success(t("users.userCreated"));
      setCreateOpen(false);
      form.reset();
      await invalidate();
    },
    onError: (error) => setCreateError(apiError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.patch(`/users/${id}`, data),
    onSuccess: async () => {
      toast.success(t("users.userUpdated"));
      await invalidate();
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api.post(`/users/${id}/reset-password`, { newPassword: password } satisfies AdminResetPasswordInput),
    onSuccess: async () => {
      toast.success(t("users.passwordReset"));
      setResetTarget(null);
      setNewPassword("");
      await invalidate();
    },
    onError: (error) => setResetError(apiError(error)),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      active ? api.patch(`/users/${id}`, { active: true }) : api.delete(`/users/${id}`),
    onSuccess: async (_data, variables) => {
      toast.success(variables.active ? t("users.activated") : t("users.deactivated"));
      setDeactivateTarget(null);
      await invalidate();
    },
    onError: (error) => {
      setDeactivateTarget(null);
      toast.error(apiError(error));
    },
  });

  if (query.isLoading) return <PageLoader label={t("common.loading")} />;
  if (query.isError) {
    return <ErrorState message={apiError(query.error)} onRetry={() => void query.refetch()} />;
  }

  const users = query.data?.users ?? [];

  return (
    <div>
      <PageHeader
        title={t("users.title")}
        subtitle={t("users.subtitle")}
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setCreateError("");
              form.reset();
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t("users.addUser")}
          </button>
        }
      />

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("users.fullName")}</th>
              <th>{t("auth.username")}</th>
              <th>{t("users.role")}</th>
              <th>{t("common.status")}</th>
              <th>{t("users.mustChangePassword")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-orange-soft text-sm font-extrabold text-brand-orange">
                      {(user.fullName || user.username).slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-bold text-slate-800">{user.fullName || "—"}</p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(user.createdAt).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="text-sm font-semibold text-slate-600" dir="ltr">
                  {user.username}
                </td>
                <td>
                  <span
                    className={
                      user.role === "admin"
                        ? "badge bg-brand-orange-soft text-brand-orange"
                        : "badge bg-slate-100 text-slate-600"
                    }
                  >
                    {user.role === "admin" ? (
                      <ShieldCheck className="me-1 h-3 w-3" />
                    ) : (
                      <Users className="me-1 h-3 w-3" />
                    )}
                    {t(`roles.${user.role}`)}
                  </span>
                </td>
                <td>
                  <span
                    className={
                      user.active ? "badge bg-emerald-50 text-emerald-700" : "badge bg-red-50 text-red-600"
                    }
                  >
                    {user.active ? t("common.active") : t("common.inactive")}
                  </span>
                </td>
                <td>
                  {user.mustChangePassword ? (
                    <span className="badge bg-amber-50 text-amber-700">{t("common.yes")}</span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">{t("common.no")}</span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => {
                        setResetError("");
                        setNewPassword("");
                        setResetTarget(user);
                      }}
                      title={t("users.resetPassword")}
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() =>
                        updateMutation.mutate({
                          id: user.id,
                          data: { role: user.role === "admin" ? "staff" : "admin" },
                        })
                      }
                      title={t("users.role")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {user.id !== currentUser?.id ? (
                      <button
                        type="button"
                        className={
                          user.active
                            ? "btn-link text-red-600 hover:bg-red-50"
                            : "btn-link text-emerald-600 hover:bg-emerald-50"
                        }
                        onClick={() => {
                          if (user.active) setDeactivateTarget(user);
                          else toggleMutation.mutate({ id: user.id, active: true });
                        }}
                        title={user.active ? t("users.deactivate") : t("users.activate")}
                      >
                        {user.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("users.addUser")}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="create-user-form"
              className="btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </>
        }
      >
        {createError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {createError}
          </div>
        ) : null}
        <form
          id="create-user-form"
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => {
            setCreateError("");
            createMutation.mutate(values);
          })}
          noValidate
        >
          <div>
            <label className="label">{t("auth.username")}</label>
            <input className="input" dir="ltr" autoComplete="off" {...form.register("username")} />
            {form.formState.errors.username ? (
              <p className="mt-1 text-xs font-semibold text-red-600">
                {validation(form.formState.errors.username.message)}
              </p>
            ) : null}
            <p className="mt-1 text-[11px] text-slate-400">{t("users.usernameHint")}</p>
          </div>
          <div>
            <label className="label">{t("users.fullName")}</label>
            <input className="input" {...form.register("fullName")} />
          </div>
          <div>
            <label className="label">{t("users.role")}</label>
            <select className="input" {...form.register("role")}>
              <option value="staff">{t("roles.staff")}</option>
              <option value="admin">{t("roles.admin")}</option>
            </select>
          </div>
          <div>
            <label className="label">{t("auth.password")}</label>
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="mt-1 text-xs font-semibold text-red-600">
                {validation(form.formState.errors.password.message)}
              </p>
            ) : null}
            <p className="mt-1 text-[11px] text-slate-400">{t("users.passwordHint")}</p>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={t("users.resetPasswordFor", { name: resetTarget?.fullName || resetTarget?.username })}
        size="sm"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setResetTarget(null)}>
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="reset-password-form"
              className="btn-primary"
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? t("common.saving") : t("users.resetPassword")}
            </button>
          </>
        }
      >
        {resetError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {resetError}
          </div>
        ) : null}
        <form
          id="reset-password-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!resetTarget) return;
            setResetError("");
            resetMutation.mutate({ id: resetTarget.id, password: newPassword });
          }}
        >
          <label className="label">{t("users.newPasswordTemporary")}</label>
          <input
            type="text"
            className="input"
            autoComplete="off"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <p className="mt-2 text-[11px] leading-5 text-slate-500">{t("users.passwordHint")}</p>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title={t("users.deactivate")}
        message={t("users.deactivateConfirm")}
        confirmLabel={t("users.deactivate")}
        cancelLabel={t("common.cancel")}
        danger
        busy={toggleMutation.isPending}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => {
          if (deactivateTarget) toggleMutation.mutate({ id: deactivateTarget.id, active: false });
        }}
      />
    </div>
  );
}
