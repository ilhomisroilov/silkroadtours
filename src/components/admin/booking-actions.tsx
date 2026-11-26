"use client";

import { BellRing } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { BookingStatus } from "@/db/types";
import { STATUS_TRANSITIONS } from "@/lib/booking-status";
import { apiFetch, translateCode } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";

/** Calls an admin API route, shows a toast, and refreshes the server-rendered page on success. */
export function useAdminApi() {
  const te = useTranslations("errors");
  const router = useRouter();
  return async function call<T = true>(url: string, init: RequestInit & { json?: unknown }, success?: string): Promise<T | null> {
    const r = await apiFetch<T>(url, init);
    if (!r.ok) {
      toast({ tone: "error", title: translateCode(r.error.code, te as never), description: r.error.message });
      return null;
    }
    if (success) toast({ tone: "success", title: success });
    router.refresh();
    return (r.data ?? true) as T;
  };
}

export function BookingStatusControl({ id, status }: { id: number; status: BookingStatus }) {
  const t = useTranslations("admin");
  const call = useAdminApi();
  const options = STATUS_TRANSITIONS[status];
  const [to, setTo] = useState<BookingStatus | "">(options[0] ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (options.length === 0) return <p className="text-ink-muted">{t("bookings.noTransitions")}</p>;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!to) return;
        setBusy(true);
        const ok = await call(`/api/admin/bookings/${id}`, { method: "PATCH", json: { status: to, note: note || undefined } }, t("common.saved"));
        setBusy(false);
        if (ok) setNote("");
      }}
    >
      <label className="block text-sm font-semibold" htmlFor="status-to">{t("bookings.changeStatus")}</label>
      <select id="status-to" value={to} onChange={(e) => setTo(e.target.value as BookingStatus)} className="min-h-11 w-full rounded-sm border border-field bg-white px-3" data-testid="status-select">
        {options.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
      </select>
      <label className="block text-sm font-semibold" htmlFor="status-note">{t("bookings.statusNote")}</label>
      <Textarea id="status-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />
      <Button type="submit" disabled={busy} data-testid="status-apply">{t("bookings.apply")}</Button>
    </form>
  );
}

export function NoteForm({ url }: { url: string }) {
  const t = useTranslations("admin");
  const call = useAdminApi();
  const [body, setBody] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        if (await call(url, { method: "POST", json: { body } }, t("common.saved"))) setBody("");
      }}
    >
      <label htmlFor="note-body" className="sr-only">{t("bookings.addNote")}</label>
      <Textarea id="note-body" value={body} placeholder={t("bookings.notePlaceholder")} onChange={(e) => setBody(e.target.value)} className="min-h-20" />
      <Button type="submit" variant="secondary" size="sm">{t("bookings.addNote")}</Button>
    </form>
  );
}

export function ResendButton({ url }: { url: string }) {
  const t = useTranslations("admin");
  const call = useAdminApi();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await call(url, { method: "POST" }, t("bookings.resent"));
        setBusy(false);
      }}
    >
      <BellRing aria-hidden="true" /> {t("bookings.resend")}
    </Button>
  );
}
