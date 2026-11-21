import { useQuery } from "@tanstack/react-query";
import { DEFAULT_SETTINGS, type AppSettings } from "@antika/shared";
import { api } from "./api";

export function useSettingsQuery() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ settings: AppSettings }>("/settings"),
    staleTime: 5 * 60_000,
  });
}

export function useSettings(): AppSettings {
  const query = useSettingsQuery();
  return query.data?.settings ?? DEFAULT_SETTINGS;
}
