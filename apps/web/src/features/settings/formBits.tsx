import { useFormState, useWatch, type Control, type FieldPath } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Logo } from "../../components/Brand";
import type { SettingsFormValues } from "./types";

/**
 * Small bridge components: they subscribe to a single form field with
 * `useWatch`, so typing in the settings form never re-renders the whole page.
 */

export function DirtyBadge({ control }: { control: Control<SettingsFormValues> }) {
  const { t } = useTranslation();
  const { isDirty } = useFormState({ control });
  if (!isDirty) return null;
  return (
    <span
      className="badge bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      data-testid="settings-dirty"
      role="status"
    >
      {t("settings.preview.dirty")}
    </span>
  );
}

export function LiveNumber({
  control,
  name,
  digits = 2,
  suffix = "",
}: {
  control: Control<SettingsFormValues>;
  name: FieldPath<SettingsFormValues>;
  digits?: number;
  suffix?: string;
}) {
  const value = useWatch({ control, name });
  const number = Number(value);
  return (
    <span className="text-xs font-extrabold text-slate-500" data-testid={`live-${name}`}>
      {Number.isFinite(number) ? number.toFixed(digits) : "—"}
      {suffix}
    </span>
  );
}

export function LiveLogo({
  control,
  name,
  fallback,
  className,
}: {
  control: Control<SettingsFormValues>;
  name: FieldPath<SettingsFormValues>;
  fallback: string;
  className?: string;
}) {
  const value = useWatch({ control, name });
  return <Logo className={className} src={String(value || fallback)} />;
}
