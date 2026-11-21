import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ku from "./ku.json";
import ar from "./ar.json";

export const SUPPORTED_LANGUAGES = ["ku", "ar"] as const;
export type UiLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const LANGUAGE_STORAGE_KEY = "antika.lang";

function initialLanguage(): UiLanguage {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "ar" ? "ar" : "ku";
}

function applyDocumentLanguage(lng: string): void {
  const language = lng === "ar" ? "ar" : "ku";
  document.documentElement.lang = language;
  document.documentElement.dir = "rtl";
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

void i18n.use(initReactI18next).init({
  resources: {
    ku: { translation: ku },
    ar: { translation: ar },
  },
  lng: initialLanguage(),
  fallbackLng: "ku",
  supportedLngs: ["ku", "ar"],
  interpolation: { escapeValue: false },
  returnNull: false,
});

applyDocumentLanguage(i18n.language);
i18n.on("languageChanged", applyDocumentLanguage);

export default i18n;
