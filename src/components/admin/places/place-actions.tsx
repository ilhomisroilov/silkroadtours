"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { apiFetch, translateCode } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

/** Delete with a real confirmation dialog (keyboard friendly, focus trapped). */
export function DeletePlaceButton({ id, name, redirectTo, compact = false }: { id: number; name: string; redirectTo?: string; compact?: boolean }) {
  const t = useTranslations("admin.places");
  const te = useTranslations("errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    const r = await apiFetch(`/api/admin/places/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) {
      toast({ tone: "error", title: translateCode(r.error.code, te as never) });
      return;
    }
    setOpen(false);
    toast({ tone: "success", title: t("deleted") });
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="ghost" size="sm" className="text-danger hover:bg-danger/10" onClick={() => setOpen(true)} data-testid={`place-delete-${id}`} aria-label={compact ? `${t("delete")}: ${name}` : undefined}>
        <Trash2 aria-hidden="true" /> {compact ? <span className="sr-only sm:not-sr-only">{t("delete")}</span> : t("delete")}
      </Button>
      <DialogContent closeLabel={t("cancel")}>
        <DialogTitle className="pr-10 text-xl">{t("deleteTitle", { name })}</DialogTitle>
        <DialogDescription className="mt-2">{t("deleteBody")}</DialogDescription>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button type="button" variant="danger" disabled={busy} onClick={remove} data-testid="place-delete-confirm">
            <Trash2 aria-hidden="true" /> {t("deleteConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One-click publish / unpublish from the list. */
export function PublishToggle({ id, isPublished }: { id: number; isPublished: boolean }) {
  const t = useTranslations("admin.places");
  const te = useTranslations("errors");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPublished}
      disabled={busy}
      data-testid={`place-publish-${id}`}
      onClick={async () => {
        setBusy(true);
        const r = await apiFetch(`/api/admin/places/${id}`, { method: "PATCH", json: { isPublished: !isPublished } });
        setBusy(false);
        if (!r.ok) return toast({ tone: "error", title: translateCode(r.error.code, te as never) });
        toast({ tone: "success", title: isPublished ? t("unpublishedToast") : t("publishedToast") });
        router.refresh();
      }}
      className={`inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-bold transition-colors disabled:opacity-60 ${isPublished ? "bg-success/10 text-success hover:bg-success/20" : "bg-saffron-soft text-saffron-ink hover:bg-saffron-soft/70"}`}
    >
      {isPublished ? <Eye aria-hidden="true" className="size-4" /> : <EyeOff aria-hidden="true" className="size-4" />}
      {isPublished ? t("statusPublished") : t("statusHidden")}
      <span className="sr-only">. {isPublished ? t("unpublish") : t("publish")}</span>
    </button>
  );
}

/** Inline sort-order field: saves on blur or Enter. */
export function SortOrderInput({ id, value, label }: { id: number; value: number; label: string }) {
  const t = useTranslations("admin.places");
  const te = useTranslations("errors");
  const router = useRouter();
  const [v, setV] = useState(String(value));
  const save = async () => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 10000) return setV(String(value));
    if (n === value) return;
    const r = await apiFetch(`/api/admin/places/${id}`, { method: "PATCH", json: { sortOrder: n } });
    if (!r.ok) {
      setV(String(value));
      return toast({ tone: "error", title: translateCode(r.error.code, te as never) });
    }
    toast({ tone: "success", title: t("orderSaved") });
    router.refresh();
  };
  return (
    <input
      type="number"
      min={0}
      max={10000}
      inputMode="numeric"
      value={v}
      aria-label={label}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="min-h-11 w-20 rounded-sm border border-field bg-white px-2 text-right tabular-nums"
    />
  );
}
