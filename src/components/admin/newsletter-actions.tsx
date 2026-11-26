"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAdminApi } from "./booking-actions";

export function RemoveSubscriber({ id }: { id: number }) {
  const t = useTranslations("admin");
  const call = useAdminApi();
  return (
    <button
      type="button"
      aria-label={t("common.delete")}
      onClick={async () => { if (confirm(t("newsletter.removeConfirm"))) await call(`/api/admin/newsletter/${id}`, { method: "DELETE" }, t("common.saved")); }}
      className="inline-flex size-9 items-center justify-center rounded-full text-danger hover:bg-danger/10"
    >
      <Trash2 aria-hidden="true" className="size-4" />
    </button>
  );
}
