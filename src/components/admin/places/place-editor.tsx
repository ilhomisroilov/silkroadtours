"use client";

import { Crosshair, MapPinOff, Plus, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import type { HotelDetails, LocalizedText, PlaceKind, PlaceSource, RestaurantDetails, TransportDetails } from "@/db/types";
import { apiFetch, translateCode } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { emptyLocalized, LocalizedFields } from "../localized";
import { defaultDetails } from "./defaults";
import { GalleryField, ImageField } from "./media-field";
import { DeletePlaceButton } from "./place-actions";

const PointPicker = dynamic(() => import("../point-picker"), { ssr: false });

export interface EditorPlace {
  id?: number;
  kind: PlaceKind;
  slug: string;
  destinationSlug: string | null;
  name: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText;
  image: string | null;
  gallery: string[];
  lat: number | null;
  lng: number | null;
  priceFromUsd: number | null;
  priceLevel: number | null;
  tags: string[];
  partnerId: number | null;
  isPublished: boolean;
  sortOrder: number;
  source?: PlaceSource;
  details: HotelDetails | RestaurantDetails | TransportDetails;
}

export interface EditorOptions {
  destinations: { slug: string; name: string; lat: number; lng: number }[];
  partners: { id: number; label: string }[];
}

const KINDS: PlaceKind[] = ["hotel", "restaurant", "transport"];
const TRANSPORT_MODES = ["train", "flight", "bus", "shared_taxi", "taxi", "transfer", "metro", "car"] as const;
const AMENITIES = ["wifi", "breakfast", "air_conditioning", "parking", "airport_transfer", "restaurant", "courtyard", "terrace", "pool", "spa", "gym", "family_rooms", "laundry", "accessible"];
const CUISINES = ["uzbek", "central_asian", "international", "european", "turkish", "russian", "korean", "georgian", "cafe", "street_food"];
const DIETARY = ["halal", "vegetarian", "vegan", "gluten_free", "kids_menu"];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

const field = "mt-1 block min-h-11 w-full rounded-sm border border-field bg-white px-3 font-normal";
const toNum = (v: string) => (v.trim() === "" ? null : Number(v));

function Section({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-4 rounded-sm border border-line bg-white p-4 shadow-sm sm:p-5", className)}>
      <div>
        <h2 className="font-sans text-lg font-bold text-lapis-deep">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-ink-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Num({ label, value, onChange, min = 0, max, step = 1, hint }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; hint?: string }) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input type="number" inputMode="decimal" min={min} max={max} step={step} value={value ?? ""} onChange={(e) => onChange(toNum(e.target.value))} className={field} />
      {hint && <span className="mt-1 block text-xs font-normal text-ink-muted">{hint}</span>}
    </label>
  );
}

/** Toggle chips for known keys plus free keys typed by the editor. */
function KeyChips({ label, options, value, onChange, labelFor }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; labelFor: (k: string) => string }) {
  const t = useTranslations("admin.places.form");
  const id = useId();
  const [draft, setDraft] = useState("");
  const extra = value.filter((v) => !options.includes(v));
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  const addDraft = () => {
    const k = draft.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    if (k && !value.includes(k)) onChange([...value, k]);
    setDraft("");
  };
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((k) => (
          <label key={k} className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-field bg-white px-3 text-sm has-[:checked]:border-lapis has-[:checked]:bg-lapis has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cobalt">
            <input type="checkbox" className="sr-only" checked={value.includes(k)} onChange={() => toggle(k)} />
            {labelFor(k)}
          </label>
        ))}
        {extra.map((k) => (
          <span key={k} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-lapis pl-3 text-sm text-white">
            {k}
            <button type="button" onClick={() => toggle(k)} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/15" aria-label={`${t("remove")}: ${k}`}>
              <X aria-hidden="true" className="size-4" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex max-w-md items-center gap-2">
        <label htmlFor={id} className="sr-only">{t("addOther")}</label>
        <input
          id={id}
          value={draft}
          placeholder={t("addOther")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          className="min-h-11 w-full rounded-sm border border-field bg-white px-3 text-sm"
        />
        <Button type="button" variant="ghost" size="sm" onClick={addDraft} disabled={!draft.trim()}>
          <Plus aria-hidden="true" /> {t("add")}
        </Button>
      </div>
    </fieldset>
  );
}

/** Rows with a localized name and a price (room types, menu, fare classes). */
function PricedRows<R extends { name: LocalizedText }>({
  rows,
  onChange,
  nameLabel,
  addLabel,
  empty,
  fields,
  blank,
}: {
  rows: R[];
  onChange: (r: R[]) => void;
  nameLabel: string;
  addLabel: string;
  empty: string;
  fields: (row: R, set: (patch: Partial<R>) => void) => ReactNode;
  blank: () => R;
}) {
  const t = useTranslations("admin.places.form");
  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="rounded-sm border border-dashed border-line px-3 py-4 text-sm text-ink-muted">{empty}</p>}
      {rows.map((r, i) => {
        const set = (patch: Partial<R>) => onChange(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
        return (
          <div key={i} className="space-y-3 rounded-sm border border-line bg-sand-soft/30 p-3">
            <LocalizedFields label={`${nameLabel} ${i + 1}`} value={r.name} onChange={(v) => set({ name: v } as Partial<R>)} required />
            <div className="grid items-end gap-3 sm:grid-cols-3">
              {fields(r, set)}
              <Button type="button" variant="ghost" size="sm" className="justify-self-start text-danger hover:bg-danger/10" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden="true" /> {t("remove")}
              </Button>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, blank()])}>
        <Plus aria-hidden="true" /> {addLabel}
      </Button>
    </div>
  );
}

export function PlaceEditor({ initial, options }: { initial: EditorPlace; options: EditorOptions }) {
  const t = useTranslations("admin.places");
  const tf = useTranslations("admin.places.form");
  const te = useTranslations("errors");
  const router = useRouter();
  const [p, setP] = useState<EditorPlace>(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof EditorPlace>(k: K, v: EditorPlace[K]) => setP((x) => ({ ...x, [k]: v }));
  const setDetails = (patch: Partial<HotelDetails & RestaurantDetails & TransportDetails>) => setP((x) => ({ ...x, details: { ...x.details, ...patch } as EditorPlace["details"] }));
  const isNew = !p.id;
  const hotel = p.kind === "hotel" ? (p.details as HotelDetails) : null;
  const restaurant = p.kind === "restaurant" ? (p.details as RestaurantDetails) : null;
  const transport = p.kind === "transport" ? (p.details as TransportDetails) : null;
  const dest = options.destinations.find((d) => d.slug === p.destinationSlug);

  const fieldLabel = (path: string): string => {
    const head = path.split(".")[0] ?? path;
    const known: Record<string, string> = { slug: tf("slug"), name: tf("name"), summary: tf("summary"), description: tf("description"), image: tf("image"), gallery: tf("gallery"), priceFromUsd: tf("priceFrom"), priceLevel: tf("priceLevel"), tags: tf("tags"), lat: tf("lat"), lng: tf("lng"), sortOrder: tf("sortOrder"), details: tf(`details.${p.kind}`) };
    return known[head] ?? head;
  };

  const payload = () => {
    const { id: _id, source: _source, ...body } = p;
    void _id;
    void _source;
    const named = <R extends { name: LocalizedText }>(rows: R[] | undefined) => (rows ?? []).filter((r) => r.name.en.trim() || r.name.uz.trim() || r.name.ru.trim());
    let details: EditorPlace["details"] = p.details;
    if (hotel) details = { ...hotel, stars: hotel.stars || undefined, roomTypes: named(hotel.roomTypes) };
    if (restaurant) details = { ...restaurant, menu: named(restaurant.menu) };
    if (transport) details = { ...transport, classes: named(transport.classes) };
    return { ...body, details };
  };

  const save = async () => {
    setBusy(true);
    setErrors([]);
    const body = payload();
    const r = p.id ? await apiFetch(`/api/admin/places/${p.id}`, { method: "PUT", json: body }) : await apiFetch<{ id: number }>("/api/admin/places", { method: "POST", json: body });
    setBusy(false);
    if (!r.ok) {
      const fields = r.error.fields ? [...new Set(Object.keys(r.error.fields).map(fieldLabel))] : [];
      setErrors(fields);
      const own = ["slug_taken", "partner_not_found", "kind_change_not_allowed"].includes(r.error.code) ? tf(`errors.${r.error.code}` as never) : null;
      toast({ tone: "error", title: own ?? (fields.length ? tf("errors.check") : translateCode(r.error.code, te as never)), description: fields.join(", ") || undefined });
      return;
    }
    if (!p.id) {
      toast({ tone: "success", title: t("created") });
      router.push(`/admin/places/${(r.data as { id: number }).id}`);
      return;
    }
    toast({ tone: "success", title: t("saved") });
    router.refresh();
  };

  const priceHint = tf(`priceHint.${p.kind}`);

  return (
    <form
      className="space-y-5 pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
    >
      {errors.length > 0 && (
        <div role="alert" className="rounded-sm border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {tf("errors.check")}: {errors.join(", ")}
        </div>
      )}

      <Section title={tf("basics")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm font-semibold">
            {tf("kind")}
            <select
              value={p.kind}
              disabled={!isNew}
              onChange={(e) => {
                const kind = e.target.value as PlaceKind;
                setP((x) => ({ ...x, kind, details: defaultDetails(kind) }));
              }}
              className={cn(field, !isNew && "bg-sand-soft/60")}
            >
              {KINDS.map((k) => <option key={k} value={k}>{t(`kindOne.${k}`)}</option>)}
            </select>
            {!isNew && <span className="mt-1 block text-xs font-normal text-ink-muted">{tf("kindLocked")}</span>}
          </label>
          <label className="block text-sm font-semibold">
            {tf("destination")}
            <select value={p.destinationSlug ?? ""} onChange={(e) => set("destinationSlug", e.target.value || null)} className={field}>
              <option value="">{tf("noDestination")}</option>
              {options.destinations.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            {tf("partner")}
            <select value={p.partnerId ?? ""} onChange={(e) => set("partnerId", e.target.value ? Number(e.target.value) : null)} className={field}>
              <option value="">{tf("noPartner")}</option>
              {options.partners.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <Num label={tf("sortOrder")} value={p.sortOrder} onChange={(v) => set("sortOrder", v ?? 0)} max={10000} hint={tf("sortOrderHelp")} />
        </div>
        <LocalizedFields
          label={tf("name")}
          value={p.name}
          required
          onChange={(v) => {
            setP((x) => ({ ...x, name: v, slug: slugTouched ? x.slug : slugify(v.en) }));
          }}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold">
            {tf("slug")} <span aria-hidden="true" className="text-pomegranate">*</span>
            <input
              required
              value={p.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
              }}
              className={cn(field, "font-mono text-sm")}
              aria-describedby="place-slug-help"
            />
            <span id="place-slug-help" className="mt-1 block text-xs font-normal text-ink-muted">{tf("slugHelp")}</span>
          </label>
          <label className="block text-sm font-semibold">
            {tf("tags")}
            <input value={p.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((s) => s.trim().toLowerCase().replace(/\s+/g, "-")).filter((s, i, a) => s || i === a.length - 1))} onBlur={() => set("tags", p.tags.filter(Boolean))} className={field} aria-describedby="place-tags-help" />
            <span id="place-tags-help" className="mt-1 block text-xs font-normal text-ink-muted">{tf("tagsHelp")}</span>
          </label>
        </div>
        <label className="inline-flex min-h-11 items-center gap-2 font-semibold">
          <input type="checkbox" className="size-5" checked={p.isPublished} onChange={(e) => set("isPublished", e.target.checked)} data-testid="place-published" />
          {tf("published")}
        </label>
      </Section>

      <Section title={tf("texts")}>
        <LocalizedFields label={tf("summary")} value={p.summary} onChange={(v) => set("summary", v)} multiline rows={2} required />
        <LocalizedFields label={tf("description")} value={p.description} onChange={(v) => set("description", v)} multiline rows={6} required />
      </Section>

      {hotel && (
        <Section title={tf("details.hotel")}>
          <LocalizedFields label={tf("hotel.area")} value={hotel.area} onChange={(v) => setDetails({ area: v })} />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-semibold">
              {tf("hotel.stars")}
              <select value={hotel.stars ?? ""} onChange={(e) => setDetails({ stars: e.target.value ? Number(e.target.value) : undefined })} className={field}>
                <option value="">{tf("notRated")}</option>
                {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{tf("hotel.starsValue", { count: s })}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">{tf("hotel.checkIn")}<input type="time" value={hotel.checkIn ?? ""} onChange={(e) => setDetails({ checkIn: e.target.value })} className={field} /></label>
            <label className="block text-sm font-semibold">{tf("hotel.checkOut")}<input type="time" value={hotel.checkOut ?? ""} onChange={(e) => setDetails({ checkOut: e.target.value })} className={field} /></label>
          </div>
          <KeyChips label={tf("hotel.amenities")} options={AMENITIES} value={hotel.amenities} onChange={(v) => setDetails({ amenities: v })} labelFor={(k) => (AMENITIES.includes(k) ? tf(`amenity.${k}` as never) : k)} />
          <div>
            <h3 className="mb-2 text-sm font-semibold">{tf("hotel.roomTypes")}</h3>
            <PricedRows
              rows={hotel.roomTypes}
              onChange={(rows) => setDetails({ roomTypes: rows })}
              nameLabel={tf("hotel.roomName")}
              addLabel={tf("hotel.addRoom")}
              empty={tf("hotel.noRooms")}
              blank={() => ({ name: emptyLocalized(), sleeps: 2, priceFromUsd: p.priceFromUsd ?? 0 })}
              fields={(r, s) => (
                <>
                  <Num label={tf("hotel.sleeps")} value={r.sleeps} min={1} max={20} onChange={(v) => s({ sleeps: v ?? 1 })} />
                  <Num label={tf("hotel.roomPrice")} value={r.priceFromUsd} onChange={(v) => s({ priceFromUsd: v ?? 0 })} />
                </>
              )}
            />
          </div>
        </Section>
      )}

      {restaurant && (
        <Section title={tf("details.restaurant")}>
          <div className="grid gap-4">
            <LocalizedFields label={tf("restaurant.area")} value={restaurant.area} onChange={(v) => setDetails({ area: v })} />
            <LocalizedFields label={tf("restaurant.hours")} value={restaurant.hours} onChange={(v) => setDetails({ hours: v })} />
          </div>
          <KeyChips label={tf("restaurant.cuisine")} options={CUISINES} value={restaurant.cuisine} onChange={(v) => setDetails({ cuisine: v })} labelFor={(k) => (CUISINES.includes(k) ? tf(`cuisine.${k}` as never) : k)} />
          <KeyChips label={tf("restaurant.dietary")} options={DIETARY} value={restaurant.dietary} onChange={(v) => setDetails({ dietary: v })} labelFor={(k) => (DIETARY.includes(k) ? tf(`dietary.${k}` as never) : k)} />
          <div>
            <h3 className="mb-2 text-sm font-semibold">{tf("restaurant.menu")}</h3>
            <PricedRows
              rows={restaurant.menu}
              onChange={(rows) => setDetails({ menu: rows })}
              nameLabel={tf("restaurant.dish")}
              addLabel={tf("restaurant.addDish")}
              empty={tf("restaurant.noDishes")}
              blank={() => ({ name: emptyLocalized(), priceUsd: 0 })}
              fields={(r, s) => <Num label={tf("restaurant.dishPrice")} value={r.priceUsd} step={0.5} onChange={(v) => s({ priceUsd: v ?? 0 })} />}
            />
          </div>
        </Section>
      )}

      {transport && (
        <Section title={tf("details.transport")}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="block text-sm font-semibold">
              {tf("transport.mode")}
              <select value={transport.mode} onChange={(e) => setDetails({ mode: e.target.value as TransportDetails["mode"] })} className={field}>
                {TRANSPORT_MODES.map((m) => <option key={m} value={m}>{tf(`mode.${m}`)}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">{tf("transport.from")} <span aria-hidden="true" className="text-pomegranate">*</span><input value={transport.from} onChange={(e) => setDetails({ from: e.target.value })} className={field} /></label>
            <label className="block text-sm font-semibold">{tf("transport.to")} <span aria-hidden="true" className="text-pomegranate">*</span><input value={transport.to} onChange={(e) => setDetails({ to: e.target.value })} className={field} /></label>
            <Num label={tf("transport.duration")} value={transport.durationMin} min={1} max={10000} onChange={(v) => setDetails({ durationMin: v ?? 0 })} hint={transport.durationMin > 0 ? tf("transport.durationHint", { h: Math.floor(transport.durationMin / 60), m: transport.durationMin % 60 }) : undefined} />
          </div>
          <label className="block max-w-xl text-sm font-semibold">{tf("transport.operator")}<input value={transport.operator ?? ""} onChange={(e) => setDetails({ operator: e.target.value })} className={field} /></label>
          <LocalizedFields label={tf("transport.scheduleNote")} value={transport.scheduleNote} onChange={(v) => setDetails({ scheduleNote: v })} multiline rows={2} />
          <div>
            <h3 className="mb-2 text-sm font-semibold">{tf("transport.classes")}</h3>
            <PricedRows
              rows={transport.classes ?? []}
              onChange={(rows) => setDetails({ classes: rows })}
              nameLabel={tf("transport.className")}
              addLabel={tf("transport.addClass")}
              empty={tf("transport.noClasses")}
              blank={() => ({ name: emptyLocalized(), priceFromUsd: p.priceFromUsd ?? 0 })}
              fields={(r, s) => <Num label={tf("transport.classPrice")} value={r.priceFromUsd} onChange={(v) => s({ priceFromUsd: v ?? 0 })} />}
            />
          </div>
        </Section>
      )}

      <Section title={tf("pricing")} hint={tf("pricingHint")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Num label={tf("priceFrom")} value={p.priceFromUsd} onChange={(v) => set("priceFromUsd", v)} max={100000} hint={priceHint} />
          <label className="block text-sm font-semibold">
            {tf("priceLevel")}
            <select value={p.priceLevel ?? ""} onChange={(e) => set("priceLevel", e.target.value ? Number(e.target.value) : null)} className={field}>
              <option value="">{tf("notSet")}</option>
              {[1, 2, 3, 4].map((l) => <option key={l} value={l}>{"$".repeat(l)} · {tf(`level.${l}` as never)}</option>)}
            </select>
          </label>
        </div>
      </Section>

      <Section title={tf("photos")}>
        <ImageField value={p.image} onChange={(v) => set("image", v)} />
        <GalleryField value={p.gallery} onChange={(v) => set("gallery", v)} />
      </Section>

      <Section title={tf("location")} hint={tf("locationHelp")}>
        <div className="h-72 overflow-hidden rounded-sm border border-line bg-sand-soft sm:h-80">
          <PointPicker points={p.lat != null && p.lng != null ? [{ lat: p.lat, lng: p.lng, label: p.name.en }] : []} onPick={(lat, lng) => setP((x) => ({ ...x, lat, lng }))} />
        </div>
        <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Num label={tf("lat")} value={p.lat} min={-90} max={90} step={0.0001} onChange={(v) => set("lat", v)} />
          <Num label={tf("lng")} value={p.lng} min={-180} max={180} step={0.0001} onChange={(v) => set("lng", v)} />
          {dest && (
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setP((x) => ({ ...x, lat: dest.lat, lng: dest.lng }))}>
              <Crosshair aria-hidden="true" /> {tf("useDestination")}
            </Button>
          )}
          {p.lat != null && (
            <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setP((x) => ({ ...x, lat: null, lng: null }))}>
              <MapPinOff aria-hidden="true" /> {tf("clearPoint")}
            </Button>
          )}
        </div>
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-ivory/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button type="submit" disabled={busy} data-testid="place-save">{busy ? tf("saving") : isNew ? tf("create") : tf("save")}</Button>
        <span className="text-sm text-ink-muted">{p.isPublished ? tf("willBePublic") : tf("willBeHidden")}</span>
        {p.id && <div className="ml-auto"><DeletePlaceButton id={p.id} name={p.name.en || p.slug} redirectTo={`/admin/places?kind=${p.kind}`} /></div>}
      </div>
    </form>
  );
}
