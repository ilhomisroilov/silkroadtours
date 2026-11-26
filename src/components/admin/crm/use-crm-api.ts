"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch, translateCode } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";

/**
 * Calls a CRM admin route, shows a toast (CRM-specific error texts first, then the shared ones)
 * and refreshes the server-rendered page on success.
 */
export function useCrmApi() {
  const t = useTranslations("admin.crm");
  const te = useTranslations("errors");
  const router = useRouter();
  const message = (code: string | undefined) => (code && t.has(`errors.${code}`) ? t(`errors.${code}` as never) : translateCode(code, te as never));
  return async function call<T = true>(url: string, init: RequestInit & { json?: unknown }, success?: string, opts: { refresh?: boolean } = {}): Promise<T | null> {
    const r = await apiFetch<T>(url, init);
    if (!r.ok) {
      const fieldCode = r.error.fields ? Object.values(r.error.fields)[0]?.[0] : undefined;
      toast({ tone: "error", title: message(fieldCode && t.has(`errors.${fieldCode}`) ? fieldCode : r.error.code) });
      return null;
    }
    if (success) toast({ tone: "success", title: success });
    if (opts.refresh !== false) router.refresh();
    return (r.data ?? true) as T;
  };
}
