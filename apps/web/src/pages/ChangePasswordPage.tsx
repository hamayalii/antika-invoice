import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordInput } from "@antika/shared";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, KeyRound, LogOut } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApiErrorMessage, useValidationMessage } from "../lib/i18nHooks";
import { useToast } from "../components/Toast";
import { BrandLockup, Logo, Wordmark } from "../components/Brand";
import type { AuthResponse } from "../lib/types";

export function ChangePasswordPage() {
  const { t } = useTranslation();
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const apiError = useApiErrorMessage();
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    document.title = `${t("auth.changePasswordTitle")} | ${t("app.name")}`;
  }, [t]);

  if (user && !user.mustChangePassword) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: ChangePasswordInput) => {
    setServerError("");
    try {
      const result = await api.post<AuthResponse>("/auth/change-password", values);
      setUser(result.user);
      reset();
      toast.success(t("auth.passwordChanged"));
      navigate("/", { replace: true });
    } catch (error) {
      setServerError(apiError(error));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <BrandLockup compact />
          <button type="button" className="btn-ghost" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            {t("nav.logout")}
          </button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[480px]">
          <div className="card overflow-hidden">
            <div className="relative overflow-hidden bg-brand-orange-dark px-6 py-7 text-white">
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 80% 20%, #FF7A33 0, transparent 35%), radial-gradient(circle at 10% 90%, #fff 0, transparent 30%)",
                }}
              />
              <div className="relative flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                  <KeyRound className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-xl font-extrabold">{t("auth.changePasswordTitle")}</h1>
                  <p className="mt-0.5 text-xs font-semibold text-brand-orange-soft">
                    {t("auth.forceChange")}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-7">
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-semibold leading-6 text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{t("auth.changePasswordSubtitle")}</span>
              </div>

              {serverError ? (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                  {serverError}
                </div>
              ) : null}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div>
                  <label className="label" htmlFor="currentPassword">
                    {t("auth.currentPassword")}
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    className="input"
                    {...register("currentPassword")}
                  />
                  {errors.currentPassword ? (
                    <p className="mt-1.5 text-xs font-semibold text-red-600">
                      {validation(errors.currentPassword.message)}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="label" htmlFor="newPassword">
                    {t("auth.newPassword")}
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    className="input"
                    {...register("newPassword")}
                  />
                  {errors.newPassword ? (
                    <p className="mt-1.5 text-xs font-semibold text-red-600">
                      {validation(errors.newPassword.message)}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="label" htmlFor="confirmPassword">
                    {t("auth.confirmPassword")}
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    className="input"
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword ? (
                    <p className="mt-1.5 text-xs font-semibold text-red-600">
                      {validation(errors.confirmPassword.message)}
                    </p>
                  ) : null}
                </div>

                <button type="submit" className="btn-primary w-full py-3" disabled={isSubmitting}>
                  {isSubmitting ? t("common.saving") : t("auth.changePassword")}
                </button>
              </form>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3 opacity-60">
            <Logo className="w-10" />
            <Wordmark className="text-[16px]" />
          </div>
        </div>
      </main>
    </div>
  );
}
