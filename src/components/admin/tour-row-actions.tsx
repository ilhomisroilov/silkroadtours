"use client";

import { Copy, Eye, EyeOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/client/api";
import { useAdminApi } from "./booking-actions";
import { toUpsertBody, type EditorTour } from "./tour-editor";

type AdminTourResponse = Omit<EditorTour, "destinationIds"> & { id: number; destinationLinks: { destinationId: number }[] };

export function TourRowActions({ id, isPublished, bookingCount }: { id: number; isPublished: boolean; bookingCount: number }) {
  const t = useTranslations("admin");
  const call = useAdminApi();
  const router = useRouter();
  const btn = "inline-flex min-h-11 items-center gap-1.5 rounded-sm px-2.5 text-sm font-semibold hover:bg-sand-soft";
  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        className={btn}
        data-testid={`tour-toggle-${id}`}
        onClick={async () => {
          const r = await apiFetch<AdminTourResponse>(`/api/admin/tours/${id}`);
          if (!r.ok) return;
          const tour: EditorTour = { ...r.data, destinationIds: r.data.destinationLinks.map((l) => l.destinationId) };
          await call(`/api/admin/tours/${id}`, { method: "PUT", json: { ...toUpsertBody(tour), isPublished: !isPublished } }, t("common.saved"));
        }}
      >
        {isPublished ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        {isPublished ? t("tours.unpublish") : t("tours.publish")}
      </button>
      <button
        type="button"
        className={btn}
        onClick={async () => {
          const r = await call<{ id: number }>(`/api/admin/tours/${id}/duplicate`, { method: "POST" }, t("tours.duplicated"));
          if (r && typeof r === "object") router.push(`/admin/tours/${r.id}`);
        }}
      >
        <Copy aria-hidden="true" className="size-4" /> {t("tours.duplicate")}
      </button>
      <button
        type="button"
        className={`${btn} text-danger`}
        title={bookingCount > 0 ? t("tours.deleteBlocked") : undefined}
        onClick={async () => {
          if (!confirm(bookingCount > 0 ? t("tours.deleteBlocked") : t("common.confirmDelete"))) return;
          await call(`/api/admin/tours/${id}`, { method: "DELETE" }, t("common.saved"));
        }}
      >
        <Trash2 aria-hidden="true" className="size-4" /> {t("common.delete")}
      </button>
    </div>
  );
}
