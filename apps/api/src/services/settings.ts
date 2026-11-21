import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type CompanySettings,
  type AssetSettings,
  type DefaultSettings,
  type SettingsInput,
} from "@antika/shared";
import { prisma } from "../db";

type SettingsKey = "company" | "assets" | "defaults" | "security";
const KEYS: SettingsKey[] = ["company", "assets", "defaults", "security"];

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } });
  const stored = new Map(rows.map((row) => [row.key, row.value as Record<string, unknown>]));
  return {
    company: { ...DEFAULT_SETTINGS.company, ...(stored.get("company") ?? {}) } as CompanySettings,
    assets: { ...DEFAULT_SETTINGS.assets, ...(stored.get("assets") ?? {}) } as AssetSettings,
    defaults: {
      ...DEFAULT_SETTINGS.defaults,
      ...(stored.get("defaults") ?? {}),
    } as DefaultSettings,
    security: {
      ...DEFAULT_SETTINGS.security,
      ...(stored.get("security") ?? {}),
    } as AppSettings["security"],
  };
}

export async function updateSettings(input: SettingsInput): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = {
    company: { ...current.company, ...(input.company ?? {}) },
    assets: { ...current.assets, ...(input.assets ?? {}) },
    defaults: { ...current.defaults, ...(input.defaults ?? {}) },
    security: { ...current.security, ...(input.security ?? {}) },
  };

  // Percentages must always add up to 100.
  if (input.defaults?.advancePercent !== undefined && input.defaults.finalPercent === undefined) {
    next.defaults.finalPercent = 100 - input.defaults.advancePercent;
  }
  if (input.defaults?.finalPercent !== undefined && input.defaults.advancePercent === undefined) {
    next.defaults.advancePercent = 100 - input.defaults.finalPercent;
  }
  if (next.defaults.advancePercent + next.defaults.finalPercent !== 100) {
    next.defaults.finalPercent = 100 - next.defaults.advancePercent;
  }

  await prisma.$transaction(
    KEYS.filter((key) => input[key] !== undefined).map((key) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: next[key] as unknown as object },
        update: { value: next[key] as unknown as object },
      }),
    ),
  );
  return next;
}
