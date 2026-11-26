"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Attraction, LocalizedText, MediaItem } from "@/db/types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { useAdminApi } from "./booking-actions";
import { emptyLocalized, LocalizedFields } from "./localized";

export interface EditorDestination {
  id?: number;
  slug: string;
  name: LocalizedText;
  tagline: LocalizedText;
  overview: LocalizedText;
  attractions: Attraction[];
  bestTime: LocalizedText;
  bestMonths: number[];
  lat: number;
  lng: number;
  heroImage: string;
  gallery: MediaItem[];
  seoTitle: LocalizedText | null;
  seoDescription: LocalizedText | null;
  sortOrder: number;
  isPublished: boolean;
}

const field = "mt-1 block min-h-11 w-full rounded-sm border border-field bg-white px-3 font-normal";
const opt = (l: LocalizedText | null) => (l && (l.en || l.uz || l.ru) ? { en: l.en || l.uz || l.ru, uz: l.uz, ru: l.ru } : null);

export function DestinationEditor({ initial }: { initial: EditorDestination }) {
  const t = useTranslations("admin");
  const td = useTranslations("admin.destinations");
  const tt = useTranslations("admin.tours");
  const tm = useTranslations("monthsShort");
  const router = useRouter();
  const call = useAdminApi();
  const [d, setD] = useState(initial);
  const set = <K extends keyof EditorDestination>(k: K, v: EditorDestination[K]) => setD((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const { id, ...body } = d;
    const payload = {
      ...body,
      seoTitle: opt(d.seoTitle),
      seoDescription: opt(d.seoDescription),
      attractions: d.attractions.map((a) => ({ ...a, lat: a.lat ?? undefined, lng: a.lng ?? undefined, image: a.image || undefined })),
    };
    if (id) await call(`/api/admin/destinations/${id}`, { method: "PUT", json: payload }, t("common.saved"));
    else {
      const r = await call<{ id: number }>("/api/admin/destinations", { method: "POST", json: payload }, t("common.saved"));
      if (r && typeof r === "object") router.push(`/admin/destinations/${r.id}`);
    }
  };
  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-sm border border-line bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="block text-sm font-semibold">{tt("slug")}<input value={d.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} className={field} /></label>
          <label className="block text-sm font-semibold">{tt("lat")}<input type="number" step={0.0001} value={d.lat} onChange={(e) => set("lat", Number(e.target.value))} className={field} /></label>
          <label className="block text-sm font-semibold">{tt("lng")}<input type="number" step={0.0001} value={d.lng} onChange={(e) => set("lng", Number(e.target.value))} className={field} /></label>
          <label className="block text-sm font-semibold">{tt("sortOrder")}<input type="number" value={d.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} className={field} /></label>
        </div>
        <LocalizedFields label={td("name")} value={d.name} onChange={(v) => set("name", v)} required />
        <LocalizedFields label={td("tagline")} value={d.tagline} onChange={(v) => set("tagline", v)} required />
        <LocalizedFields label={td("overview")} value={d.overview} onChange={(v) => set("overview", v)} multiline rows={6} required />
        <LocalizedFields label={td("bestTime")} value={d.bestTime} onChange={(v) => set("bestTime", v)} multiline rows={2} required />
        <fieldset>
          <legend className="text-sm font-semibold">{td("bestMonths")}</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <label key={m} className="inline-flex min-h-11 min-w-14 items-center justify-center rounded-sm border border-field bg-white px-2 text-sm has-[:checked]:border-lapis has-[:checked]:bg-lapis has-[:checked]:text-white">
                <input type="checkbox" className="sr-only" checked={d.bestMonths.includes(m)} onChange={(e) => set("bestMonths", e.target.checked ? [...d.bestMonths, m].sort((a, b) => a - b) : d.bestMonths.filter((x) => x !== m))} />
                {tm(String(m) as never)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-semibold">{tt("heroImage")}<input value={d.heroImage} onChange={(e) => set("heroImage", e.target.value)} className={field} /></label>
        <label className="block text-sm font-semibold">{tt("gallery")}
          <textarea rows={4} value={d.gallery.map((g) => g.url).join("\n")} onChange={(e) => {
            const byUrl = new Map(d.gallery.map((g) => [g.url, g]));
            set("gallery", e.target.value.split("\n").map((u) => u.trim()).filter(Boolean).map((url) => byUrl.get(url) ?? { url, type: "image" as const, alt: { ...d.name } }));
          }} className={cn(field, "py-2 font-mono text-sm")} />
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 font-semibold"><input type="checkbox" className="size-5" checked={d.isPublished} onChange={(e) => set("isPublished", e.target.checked)} />{tt("isPublished")}</label>
      </section>
      <section className="space-y-4 rounded-sm border border-line bg-white p-5">
        <h2 className="font-sans text-lg font-bold text-lapis-deep">{td("attractions")}</h2>
        {d.attractions.map((a, i) => (
          <div key={i} className="space-y-3 rounded-sm border border-line p-3">
            <LocalizedFields label={td("attractionName")} value={a.name} onChange={(v) => set("attractions", d.attractions.map((x, j) => (j === i ? { ...x, name: v } : x)))} required />
            <LocalizedFields label={td("attractionDescription")} value={a.description} multiline rows={2} onChange={(v) => set("attractions", d.attractions.map((x, j) => (j === i ? { ...x, description: v } : x)))} />
            <div className="grid items-end gap-3 sm:grid-cols-3">
              <label className="block text-sm font-semibold">{tt("lat")}<input type="number" step={0.0001} value={a.lat ?? ""} onChange={(e) => set("attractions", d.attractions.map((x, j) => (j === i ? { ...x, lat: e.target.value === "" ? undefined : Number(e.target.value) } : x)))} className={field} /></label>
              <label className="block text-sm font-semibold">{tt("lng")}<input type="number" step={0.0001} value={a.lng ?? ""} onChange={(e) => set("attractions", d.attractions.map((x, j) => (j === i ? { ...x, lng: e.target.value === "" ? undefined : Number(e.target.value) } : x)))} className={field} /></label>
              <Button variant="ghost" size="sm" onClick={() => set("attractions", d.attractions.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" />{t("common.remove")}</Button>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => set("attractions", [...d.attractions, { name: emptyLocalized(), description: emptyLocalized() }])}><Plus aria-hidden="true" />{td("addAttraction")}</Button>
      </section>
      <section className="space-y-4 rounded-sm border border-line bg-white p-5">
        <LocalizedFields label={tt("seoTitle")} value={d.seoTitle} onChange={(v) => set("seoTitle", v)} />
        <LocalizedFields label={tt("seoDescription")} value={d.seoDescription} multiline rows={2} onChange={(v) => set("seoDescription", v)} />
      </section>
      <div className="sticky bottom-0 flex justify-end border-t border-line bg-sand-soft/90 py-3 backdrop-blur">
        <Button onClick={save}>{t("common.save")}</Button>
      </div>
    </div>
  );
}

export function DeleteButton({ url, label, confirmText, redirectTo }: { url: string; label: string; confirmText: string; redirectTo?: string }) {
  const call = useAdminApi();
  const router = useRouter();
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-sm px-2.5 text-sm font-semibold text-danger hover:bg-danger/10"
      onClick={async () => {
        if (!confirm(confirmText)) return;
        if ((await call(url, { method: "DELETE" })) && redirectTo) router.push(redirectTo);
      }}
    >
      <Trash2 aria-hidden="true" className="size-4" /> {label}
    </button>
  );
}
