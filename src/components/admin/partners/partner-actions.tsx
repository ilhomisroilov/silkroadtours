"use client";

import { Check, Copy, Link2, Pencil, RotateCcw, Unlink, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAdminApi } from "@/components/admin/booking-actions";
import { ServicesEditor, type ServicesEditorLabels } from "@/components/partners/services-editor";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/form";
import type { PartnerStatus, PartnerType } from "@/db/types";
import { PARTNER_TYPE_LIST, SERVICE_UNITS, type PartnerService } from "@/lib/partners";
import { cn } from "@/lib/cn";

const STATUS_CLS: Record<PartnerStatus, string> = {
  pending: "bg-saffron-soft text-saffron-ink",
  approved: "bg-success/10 text-success",
  rejected: "bg-danger/10 text-danger",
};
export function PartnerStatusBadge({ status, label }: { status: PartnerStatus; label: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_CLS[status])} data-testid="partner-status-badge">{label}</span>;
}

function useAdminServicesLabels(): ServicesEditorLabels {
  const t = useTranslations("admin.partners");
  return {
    serviceName: t("serviceName"),
    placeholder: t("servicePlaceholder"),
    price: t("price"),
    unit: t("unit"),
    noUnit: t("noUnit"),
    add: t("addService"),
    remove: (n) => t("removeService", { n }),
    serviceN: (n) => t("serviceN", { n }),
    units: Object.fromEntries(SERVICE_UNITS.map((u) => [u, t(`unitNames.${u}`)])) as ServicesEditorLabels["units"],
  };
}

/** Approve / reject / return to review, with a note the partner sees on the dashboard. */
export function PartnerReviewPanel({ id, status, note, canEdit }: { id: number; status: PartnerStatus; note: string; canEdit: boolean }) {
  const t = useTranslations("admin.partners");
  const call = useAdminApi();
  const [text, setText] = useState(note);
  const [busy, setBusy] = useState(false);
  const send = async (next: PartnerStatus) => {
    setBusy(true);
    await call(`/api/admin/partners/${id}/review`, { method: "POST", json: { status: next, adminNote: text } }, t(`${next}Toast`));
    setBusy(false);
  };
  return (
    <div className="space-y-3">
      <label htmlFor="partner-note" className="block text-sm font-semibold">{t("adminNote")}</label>
      <Textarea id="partner-note" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("notePlaceholder")} disabled={!canEdit} className="min-h-24" data-testid="partner-note" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!canEdit || busy} onClick={() => send("approved")} className="bg-success hover:bg-success/90" data-testid="partner-approve">
          <Check aria-hidden="true" /> {t("approve")}
        </Button>
        <Button type="button" size="sm" variant="danger" disabled={!canEdit || busy} onClick={() => send("rejected")} data-testid="partner-reject">
          <X aria-hidden="true" /> {t("reject")}
        </Button>
        {status !== "pending" && (
          <Button type="button" size="sm" variant="outline" disabled={!canEdit || busy} onClick={() => send("pending")}>
            <RotateCcw aria-hidden="true" /> {t("backToPending")}
          </Button>
        )}
      </div>
    </div>
  );
}

export interface EditablePartner {
  id: number;
  type: PartnerType;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string | null;
  destinationSlug: string | null;
  city: string | null;
  description: string;
  services: PartnerService[];
  locale: "en" | "uz" | "ru";
}

/** Edit business info and services (owner accounts). */
export function PartnerEditor({ partner, destinations }: { partner: EditablePartner; destinations: { slug: string; name: string }[] }) {
  const t = useTranslations("admin.partners");
  const tc = useTranslations("admin.common");
  const call = useAdminApi();
  const labels = useAdminServicesLabels();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(partner);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof EditablePartner>(k: K, val: EditablePartner[K]) => setV((x) => ({ ...x, [k]: val }));
  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="partner-admin-edit">
        <Pencil aria-hidden="true" /> {t("edit")}
      </Button>
    );
  }
  const field = "space-y-1 text-sm font-semibold";
  return (
    <form
      className="mt-4 space-y-4 rounded-sm border border-lapis/20 bg-sand-soft/40 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { id: _id, ...body } = v;
        const ok = await call(
          `/api/admin/partners/${partner.id}`,
          { method: "PATCH", json: { ...body, website: body.website ?? "", destinationSlug: body.destinationSlug ?? "", city: body.city ?? "", services: body.services.map((s) => ({ ...s, name: s.name.trim() })) } },
          tc("saved"),
        );
        setBusy(false);
        if (ok) setOpen(false);
      }}
      data-testid="partner-admin-form"
    >
      <h3 className="font-bold text-lapis-deep">{t("editTitle")}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={field}>
          <span className="block">{t("type")}</span>
          <NativeSelect value={v.type} onChange={(e) => set("type", e.target.value as PartnerType)}>
            {PARTNER_TYPE_LIST.map((ty) => <option key={ty} value={ty}>{t(`types.${ty}`)}</option>)}
          </NativeSelect>
        </label>
        <label className={field}>
          <span className="block">{t("businessName")}</span>
          <Input value={v.businessName} onChange={(e) => set("businessName", e.target.value)} />
        </label>
        <label className={field}>
          <span className="block">{t("contactName")}</span>
          <Input value={v.contactName} onChange={(e) => set("contactName", e.target.value)} />
        </label>
        <label className={field}>
          <span className="block">{t("email")}</span>
          <Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
        </label>
        <label className={field}>
          <span className="block">{t("phone")}</span>
          <Input type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
        </label>
        <label className={field}>
          <span className="block">{t("website")}</span>
          <Input value={v.website ?? ""} onChange={(e) => set("website", e.target.value || null)} />
        </label>
        <label className={field}>
          <span className="block">{t("destination")}</span>
          <NativeSelect value={v.destinationSlug ?? ""} onChange={(e) => set("destinationSlug", e.target.value || null)}>
            <option value="">{t("noDestination")}</option>
            {destinations.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
          </NativeSelect>
        </label>
        <label className={field}>
          <span className="block">{t("city")}</span>
          <Input value={v.city ?? ""} onChange={(e) => set("city", e.target.value || null)} />
        </label>
        <label className={field}>
          <span className="block">{t("locale")}</span>
          <NativeSelect value={v.locale} onChange={(e) => set("locale", e.target.value as EditablePartner["locale"])}>
            {(["en", "uz", "ru"] as const).map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </NativeSelect>
        </label>
      </div>
      <label className={field}>
        <span className="block">{t("description")}</span>
        <Textarea rows={5} value={v.description} onChange={(e) => set("description", e.target.value)} />
      </label>
      <div>
        <p className="mb-2 text-sm font-semibold">{t("services")}</p>
        <ServicesEditor value={v.services} onChange={(s) => set("services", s)} labels={labels} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} data-testid="partner-admin-save">{busy ? tc("saving") : tc("save")}</Button>
        <Button type="button" variant="ghost" onClick={() => { setV(partner); setOpen(false); }}>{tc("cancel")}</Button>
      </div>
    </form>
  );
}

export interface PlaceOption {
  id: number;
  label: string;
  linkedElsewhere: boolean;
}

/** Link a hotel/restaurant/transport listing to the partner, or unlink one. */
export function PlaceLinker({ partnerId, options, canEdit }: { partnerId: number; options: PlaceOption[]; canEdit: boolean }) {
  const t = useTranslations("admin.partners");
  const call = useAdminApi();
  const [placeId, setPlaceId] = useState("");
  const [busy, setBusy] = useState(false);
  if (!canEdit) return null;
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!placeId) return;
        setBusy(true);
        const ok = await call(`/api/admin/partners/${partnerId}/places`, { method: "POST", json: { placeId: Number(placeId), action: "link" } }, t("linkedToast"));
        setBusy(false);
        if (ok) setPlaceId("");
      }}
    >
      <label className="min-w-0 flex-1 text-sm font-semibold">
        <span className="mb-1 block">{t("choosePlace")}</span>
        <NativeSelect value={placeId} onChange={(e) => setPlaceId(e.target.value)} data-testid="partner-place-select">
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}{o.linkedElsewhere ? ` (${t("linkedToOther")})` : ""}</option>
          ))}
        </NativeSelect>
      </label>
      <Button type="submit" size="sm" disabled={!placeId || busy} data-testid="partner-place-link">
        <Link2 aria-hidden="true" /> {t("link")}
      </Button>
    </form>
  );
}

export function UnlinkPlaceButton({ partnerId, placeId }: { partnerId: number; placeId: number }) {
  const t = useTranslations("admin.partners");
  const call = useAdminApi();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await call(`/api/admin/partners/${partnerId}/places`, { method: "POST", json: { placeId, action: "unlink" } }, t("unlinkedToast"));
        setBusy(false);
      }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
    >
      <Unlink aria-hidden="true" className="size-4" /> {t("unlink")}
    </button>
  );
}

/** Shows a private link with a copy button (light background). */
export function CopyField({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [done, setDone] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const full = value.startsWith("/") ? `${origin}${value}` : value;
  return (
    <div className="flex items-stretch gap-2">
      <input readOnly value={full} aria-label={label} onFocus={(e) => e.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-sm border border-field bg-sand-soft/50 px-3 font-mono text-xs" />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(full);
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          } catch {
            /* the link stays selectable */
          }
        }}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-semibold hover:bg-sand-soft"
      >
        {done ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
        <span aria-live="polite">{done ? copiedLabel : label}</span>
      </button>
    </div>
  );
}
