"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { REVIEW_SOURCES } from "@/db/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { useAdminApi } from "./booking-actions";

export function ReviewActions({ id, isPublished, isVerified }: { id: number; isPublished: boolean; isVerified: boolean }) {
  const t = useTranslations("admin");
  const call = useAdminApi();
  const btn = "inline-flex min-h-11 items-center rounded-sm px-3 text-sm font-semibold hover:bg-sand-soft";
  return (
    <div className="flex flex-wrap gap-1">
      <button type="button" className={btn} onClick={() => call(`/api/admin/reviews/${id}`, { method: "PATCH", json: { isPublished: !isPublished } }, t("common.saved"))}>
        {isPublished ? t("reviews.unpublish") : t("reviews.publish")}
      </button>
      <button type="button" className={btn} onClick={() => call(`/api/admin/reviews/${id}`, { method: "PATCH", json: { isVerified: !isVerified } }, t("common.saved"))}>
        {isVerified ? t("reviews.unverify") : t("reviews.verify")}
      </button>
      <button type="button" className={`${btn} text-danger`} onClick={async () => { if (confirm(t("common.confirmDelete"))) await call(`/api/admin/reviews/${id}`, { method: "DELETE" }, t("common.saved")); }}>
        {t("common.delete")}
      </button>
    </div>
  );
}

export function ImportReviewForm({ tours, destinations }: { tours: { id: number; name: string }[]; destinations: { id: number; name: string }[] }) {
  const t = useTranslations("admin.reviews");
  const tc = useTranslations("admin.common");
  const call = useAdminApi();
  const [open, setOpen] = useState(false);
  const field = "mt-1 block min-h-11 w-full rounded-sm border border-field bg-white px-3 font-normal";
  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}>+ {t("import")}</Button>;
  return (
    <form
      className="space-y-4 rounded-sm border border-line bg-white p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const s = (k: string) => String(f.get(k) ?? "").trim();
        const ok = await call("/api/admin/reviews", {
          method: "POST",
          json: {
            tourId: s("tourId") ? Number(s("tourId")) : null,
            destinationId: s("destinationId") ? Number(s("destinationId")) : null,
            authorName: s("authorName"),
            authorCountry: s("authorCountry") || null,
            rating: Number(s("rating")),
            title: s("title") || null,
            body: s("body"),
            language: s("language") || "en",
            source: s("source"),
            sourceUrl: s("sourceUrl") || null,
            travelDate: s("travelDate") || null,
            isPublished: f.get("isPublished") === "on",
          },
        }, tc("saved"));
        if (ok) setOpen(false);
      }}
    >
      <p className="text-sm text-saffron-ink">{t("importHint")}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-semibold">{t("author")} *<input name="authorName" required minLength={2} className={field} /></label>
        <label className="block text-sm font-semibold">{t("country")}<input name="authorCountry" className={field} /></label>
        <label className="block text-sm font-semibold">{t("rating")} *<select name="rating" defaultValue="5" className={field}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className="block text-sm font-semibold">{t("source")} *<select name="source" defaultValue="google" className={field}>{REVIEW_SOURCES.filter((s) => s !== "sample").map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label className="block text-sm font-semibold sm:col-span-2">{t("sourceUrl")} *<input name="sourceUrl" type="url" required placeholder="https://" className={field} /></label>
        <label className="block text-sm font-semibold">{t("tour")}<select name="tourId" className={field}><option value="">—</option>{tours.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="block text-sm font-semibold">{t("destination")}<select name="destinationId" className={field}><option value="">—</option>{destinations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="block text-sm font-semibold">{t("travelDate")}<input name="travelDate" type="date" className={field} /></label>
        <label className="block text-sm font-semibold">{t("language")}<input name="language" defaultValue="en" maxLength={5} className={field} /></label>
        <label className="block text-sm font-semibold sm:col-span-2">{t("reviewTitle")}<input name="title" className={field} /></label>
      </div>
      <label className="block text-sm font-semibold">{t("body")} *<Textarea name="body" required minLength={10} className="mt-1" /></label>
      <label className="inline-flex min-h-11 items-center gap-2 font-semibold"><input type="checkbox" name="isPublished" className="size-5" />{t("publish")}</label>
      <div className="flex gap-2"><Button type="submit">{tc("save")}</Button><Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button></div>
    </form>
  );
}
