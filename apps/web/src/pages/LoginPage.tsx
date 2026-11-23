import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@antika/shared";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowLeft, LogIn, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { api, setStoredToken } from "../lib/api";
import type { AuthResponse } from "../lib/types";
import { useAuth } from "../lib/auth";
import { useApiErrorMessage, useValidationMessage } from "../lib/i18nHooks";
import { useToast } from "../components/Toast";
import { Logo, Wordmark } from "../components/Brand";

export function LoginPage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const apiError = useApiErrorMessage();
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    document.title = `${t("auth.loginTitle")} | ${t("app.name")}`;
  }, [t]);

  if (user) {
    return <Navigate to={user.mustChangePassword ? "/change-password" : "/"} replace />;
  }

  const onSubmit = async (values: LoginInput) => {
    setServerError("");
    try {
      const result = await api.post<AuthResponse>("/auth/login", values);
      if (result.token) {
        setStoredToken(result.token);
      }
      setUser(result.user);
      toast.success(t("auth.welcomeBack"));
      if (result.user.mustChangePassword) {
        navigate("/change-password", { replace: true });
      } else {
        const from = (location.state as { from?: string } | null)?.from;
        navigate(from && from !== "/login" ? from : "/", { replace: true });
      }
    } catch (error) {
      setServerError(apiError(error));
    }
  };

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-brand-orange-dark lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 15%, #ffffff 0, transparent 28%), radial-gradient(circle at 82% 70%, #FF7A33 0, transparent 32%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(45deg, #fff 25%, transparent 25%, transparent 75%, #fff 75%), linear-gradient(45deg, #fff 25%, transparent 25%, transparent 75%, #fff 75%)",
            backgroundSize: "44px 44px",
            backgroundPosition: "0 0, 22px 22px",
          }}
        />
        <div className="relative p-10 xl:p-14">
          <div className="flex items-center gap-4">
            <Logo className="w-28 rounded" />
            <div className="text-white">
              <Wordmark className="text-[30px]" light />
            </div>
          </div>
        </div>

        <div className="relative px-10 pb-12 xl:px-14">
          <p className="text-xs font-extrabold text-brand-orange-soft">
            Antika Factory — Sulaymaniyah
          </p>
          <h1 className="mt-4 max-w-xl text-balance text-4xl font-extrabold leading-tight text-white xl:text-5xl">
            {t("app.name")}
          </h1>
          <p className="mt-4 max-w-lg text-base leading-8 text-brand-orange-soft">
            {t("auth.footerNote")}
          </p>
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold leading-6 text-brand-orange-soft">{t("app.tagline")}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo className="w-20" />
            <div>
              <Wordmark className="text-[22px]" />
            </div>
          </div>

          <p className="text-sm font-extrabold text-brand-orange">{t("app.factory")}</p>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900">{t("auth.loginTitle")}</h2>
          <p className="mt-2 text-sm text-slate-500">{t("auth.loginSubtitle")}</p>

          {serverError ? (
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
            <div>
              <label className="label" htmlFor="username">
                {t("auth.username")}
              </label>
              <input
                id="username"
                autoComplete="username"
                autoFocus
                className="input"
                placeholder={t("auth.username")}
                {...register("username")}
              />
              {errors.username ? (
                <p className="mt-1.5 text-xs font-semibold text-red-600">
                  {validation(errors.username.message)}
                </p>
              ) : null}
            </div>

            <div>
              <label className="label" htmlFor="password">
                {t("auth.password")}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="input"
                placeholder="••••••••"
                {...register("password")}
              />
              {errors.password ? (
                <p className="mt-1.5 text-xs font-semibold text-red-600">
                  {validation(errors.password.message)}
                </p>
              ) : null}
            </div>

            <button type="submit" className="btn-primary w-full py-3" disabled={isSubmitting}>
              {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
              {isSubmitting ? null : <LogIn className="h-4 w-4" />}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-3 text-xs font-semibold text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span>ANTIKA DOCS</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <p className="mt-4 text-center text-[11px] leading-5 text-slate-400">{t("auth.footerNote")}</p>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mx-auto mt-5 flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            {t("common.back")}
          </button>
        </div>
      </div>
    </div>
  );
}
