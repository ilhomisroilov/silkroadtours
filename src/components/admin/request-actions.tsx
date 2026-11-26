"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { BOOKING_STATUSES, type BookingStatus } from "@/db/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { useAdminApi } from "./booking-actions";

export function RequestEditor({ id, status, notes }: { id: number; status: BookingStatus; notes: string }) {
  const t = useTranslations("admin");
  const call = useAdminApi();
  const [s, setS] = useState(status);
  const [n, setN] = useState(notes);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        await call(`/api/admin/service-requests/${id}`, { method: "PATCH", json: { status: s, internalNotes: n } }, t("common.saved"));
      }}
    >
      <label htmlFor="sr-status" className="block text-sm font-semibold">{t("bookings.status")}</label>
      <select id="sr-status" value={s} onChange={(e) => setS(e.target.value as BookingStatus)} className="min-h-11 w-full rounded-sm border border-field bg-white px-3">
        {BOOKING_STATUSES.map((x) => <option key={x} value={x}>{t(`status.${x}`)}</option>)}
      </select>
      <label htmlFor="sr-notes" className="block text-sm font-semibold">{t("requests.internalNotes")}</label>
      <Textarea id="sr-notes" value={n} onChange={(e) => setN(e.target.value)} placeholder={t("bookings.notePlaceholder")} />
      <Button type="submit">{t("common.save")}</Button>
    </form>
  );
}
