const TOKEN_STORAGE_KEY = "antika_auth_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore environments where localStorage is blocked
  }
}

function resolveApiBase(): string {
  const envUrl =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    (import.meta.env.VITE_API_BASE as string | undefined);

  if (!envUrl) return "/api";

  const trimmed = envUrl.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("/")) return trimmed;

  if (trimmed.endsWith("/api")) {
    return trimmed;
  }
  return `${trimmed}/api`;
}

export const API_BASE = resolveApiBase();

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public details?: unknown,
  ) {
    super(message || code);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown; query?: Record<string, unknown> };

function buildQuery(query?: Record<string, unknown>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, headers, ...rest } = options;
  const token = getStoredToken();
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
    credentials: "include",
    ...rest,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...authHeaders,
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { code?: string; message?: string; details?: unknown } }
        | null;
      throw new ApiError(
        response.status,
        payload?.error?.code ?? "HTTP_ERROR",
        payload?.error?.message,
        payload?.error?.details,
      );
    }
    throw new ApiError(response.status, "HTTP_ERROR", response.statusText);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>) => request<T>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export function apiErrorMessage(error: unknown, translate: (key: string, fallback?: string) => string): string {
  if (error instanceof ApiError) {
    const translated = translate(`errors.${error.code}`, "");
    if (translated) return translated;
    if (error.code === "VALIDATION_ERROR" && Array.isArray(error.details) && error.details.length > 0) {
      const first = error.details[0] as { message?: string; path?: (string | number)[] };
      const msg = first?.message ?? "";
      const mapped = translate(`validation.${msg}`, "");
      if (mapped) return mapped;
      return msg || error.message;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return translate("errors.UNKNOWN", "Something went wrong");
}
