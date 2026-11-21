import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import { apiErrorMessage } from "./api";
import type { UiLanguage } from "../i18n";

export function useLanguage() {
  const { i18n } = useTranslation();
  const language: UiLanguage = i18n.language === "ar" ? "ar" : "ku";
  const setLanguage = useCallback(
    (next: UiLanguage) => {
      void i18n.changeLanguage(next);
    },
    [i18n],
  );
  return { language, setLanguage, isArabic: language === "ar" };
}

export function useApiErrorMessage() {
  const { t } = useTranslation();
  return useCallback(
    (error: unknown) => apiErrorMessage(error, (key, fallback) => t(key, { defaultValue: fallback ?? key })),
    [t],
  );
}

export function useValidationMessage() {
  const { t } = useTranslation();
  return useCallback(
    (message: string | undefined) => {
      if (!message) return "";
      return t(`validation.${message}`, { defaultValue: message });
    },
    [t],
  );
}
