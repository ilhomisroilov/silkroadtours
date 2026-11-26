// Client-side helpers for calling the JSON API and mapping its errors to translated messages.

export interface ApiErrorBody {
  code: string;
  message?: string;
  fields?: Record<string, string[]>;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiErrorBody };

export async function apiFetch<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<ApiResult<T>> {
  const { json, headers, ...rest } = init;
  try {
    const res = await fetch(url, {
      ...rest,
      headers: { accept: "application/json", ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    if (res.status === 204) return { ok: true, data: undefined as T };
    const body = (await res.json().catch(() => null)) as { data?: T; error?: ApiErrorBody } | null;
    if (res.ok && body && "data" in body) return { ok: true, data: body.data as T };
    return { ok: false, status: res.status, error: body?.error ?? { code: "internal_error" } };
  } catch {
    return { ok: false, status: 0, error: { code: "network_error" } };
  }
}

/**
 * Turns API/Zod error codes into translated text. Zod's own default messages (not our codes)
 * fall back to a generic "invalid value" message in the visitor's language.
 */
export function translateCode(code: string | undefined, t: { has: (k: string) => boolean; (k: string): string }): string {
  if (code && t.has(code)) return t(code);
  return t.has("invalid_field") ? t("invalid_field") : code ?? "";
}
