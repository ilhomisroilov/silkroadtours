"use client";

import { ExternalLink, ImageIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { LocalizedText } from "@/db/types";
import { SERVICE_TYPES } from "@/db/types";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { useAdminApi } from "./booking-actions";
import { LocalizedFields } from "./localized";

export type ContentKindName = "guide" | "experience" | "service";

export interface EditorContent {
  id?: number;
  kind: ContentKindName;
  slug: string;
  category: string | null;
  title: LocalizedText;
  excerpt: LocalizedText;
  body: LocalizedText;
  image: string | null;
  destinationSlug: string | null;
  icon: string | null;
  requestType: string | null;
  durationHours: number | null;
  priceFromUsd: number | null;
  readingMinutes: number | null;
  isPublished: boolean;
  sortOrder: number;
}

const field = "mt-1 block min-h-11 w-full rounded-sm border border-field bg-white px-3 font-normal";
const PUBLIC_PATH = { guide: "travel-guide", experience: "experiences", service: "services" } as const;
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function ContentEditor({
  initial,
  destinations,
  categories,
  icons,
}: {
  initial: EditorContent;
  destinations: { slug: string; name: string }[];
  categories: string[];
  icons: string[];
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("admin.content");
  const router = useRouter();
  const call = useAdminApi();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<{ url: string; folder: string }[] | null>(null);
  const [folder, setFolder] = useState("");
  const set = <K extends keyof EditorContent>(k: K, val: EditorContent[K]) => setV((x) => ({ ...x, [k]: val }));

  const save = async () => {
    setBusy(true);
    const { id, ...body } = v;
    const res = id
      ? await call(`/api/admin/content/${id}`, { method: "PUT", json: body }, t("common.saved"))
      : await call<{ id: number }>("/api/admin/content", { method: "POST", json: body }, tc("created"));
    setBusy(false);
    if (!id && res && typeof res === "object") router.push(`/admin/content/${res.id}`);
  };
  const remove = async () => {
    if (!v.id || !confirm(t("common.confirmDelete"))) return;
    const ok = await call(`/api/admin/content/${v.id}`, { method: "DELETE" }, tc("deleted"));
    if (ok) router.push(`/admin/content?kind=${v.kind}`);
  };
  const openPicker = async () => {
    if (picker) return setPicker(null);
    const r = await apiFetch<{ url: string; folder: string }[]>("/api/admin/media", { method: "GET" });
    if (r.ok && r.data) setPicker(r.data);
  };
  const folders = picker ? [...new Set(picker.map((m) => m.folder))] : [];

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <section className="grid gap-4 rounded-sm border border-line bg-white p-5 shadow-sm md:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold">{tc("slug")} *
          <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={v.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} className={field} />
        </label>
        <label className="text-sm font-semibold">{tc("category")}
          <input list="content-categories" value={v.category ?? ""} onChange={(e) => set("category", e.target.value || null)} className={field} />
          <datalist id="content-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="text-sm font-semibold">{tc("sortOrder")}
          <input type="number" min={0} value={v.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} className={field} />
        </label>
        <label className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold">
          <input type="checkbox" className="size-5" checked={v.isPublished} onChange={(e) => set("isPublished", e.target.checked)} />
          {t("common.published")}
        </label>

        {v.kind !== "service" && (
          <label className="text-sm font-semibold">{tc("destination")}
            <select value={v.destinationSlug ?? ""} onChange={(e) => set("destinationSlug", e.target.value || null)} className={field}>
              <option value="">—</option>
              {destinations.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
            </select>
          </label>
        )}
        {v.kind === "guide" && (
          <label className="text-sm font-semibold">{tc("reading")}
            <input type="number" min={1} max={120} value={v.readingMinutes ?? ""} onChange={(e) => set("readingMinutes", num(e.target.value))} className={field} />
          </label>
        )}
        {v.kind === "experience" && (
          <>
            <label className="text-sm font-semibold">{tc("duration")}
              <input type="number" min={0.5} step={0.5} value={v.durationHours ?? ""} onChange={(e) => set("durationHours", num(e.target.value))} className={field} />
            </label>
            <label className="text-sm font-semibold">{tc("price")}
              <input type="number" min={0} value={v.priceFromUsd ?? ""} onChange={(e) => set("priceFromUsd", num(e.target.value))} className={field} />
            </label>
          </>
        )}
        {v.kind === "service" && (
          <>
            <label className="text-sm font-semibold">{tc("icon")}
              <input list="content-icons" value={v.icon ?? ""} onChange={(e) => set("icon", e.target.value || null)} className={field} />
              <datalist id="content-icons">{icons.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="text-sm font-semibold">{tc("requestType")}
              <select value={v.requestType ?? ""} onChange={(e) => set("requestType", e.target.value || null)} className={field}>
                <option value="">—</option>
                {SERVICE_TYPES.map((s) => <option key={s} value={s}>{t(`requests.types.${s}`)}</option>)}
              </select>
            </label>
          </>
        )}
      </section>

      <section className="space-y-3 rounded-sm border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="h-24 w-36 shrink-0 overflow-hidden rounded-sm bg-sand-soft">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a site-relative path */}
            {v.image ? <img src={v.image} alt="" className="h-full w-full object-cover" /> : <ImageIcon aria-hidden="true" className="m-auto mt-8 size-8 text-ink-muted" />}
          </div>
          <label className="min-w-64 flex-1 text-sm font-semibold">{tc("image")}
            <input value={v.image ?? ""} onChange={(e) => set("image", e.target.value.trim() || null)} className={field} placeholder="/images/…" />
            <span className="mt-1 block text-xs font-normal text-ink-muted">{tc("imageHelp")}</span>
          </label>
          <Button type="button" variant="outline" size="sm" onClick={openPicker}>{t("media.title")}</Button>
        </div>
        {picker && (
          <div className="rounded-sm border border-line p-3">
            <select value={folder} onChange={(e) => setFolder(e.target.value)} className="mb-3 min-h-11 rounded-sm border border-field bg-white px-3" aria-label={t("media.filter")}>
              <option value="">{t("common.all")}</option>
              {folders.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <ul className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5 lg:grid-cols-8">
              {picker.filter((m) => !folder || m.folder === folder).slice(0, 160).map((m) => (
                <li key={m.url}>
                  <button type="button" title={m.url} onClick={() => { set("image", m.url); setPicker(null); }} className="block aspect-[4/3] w-full overflow-hidden rounded-sm ring-cobalt hover:ring-2 focus-visible:ring-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail picker */}
                    <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-5 rounded-sm border border-line bg-white p-5 shadow-sm">
        <LocalizedFields label={tc("titleField")} value={v.title} onChange={(x) => set("title", x)} required />
        <LocalizedFields label={tc("excerpt")} value={v.excerpt} onChange={(x) => set("excerpt", x)} multiline rows={3} required />
        <LocalizedFields label={tc("body")} value={v.body} onChange={(x) => set("body", x)} multiline rows={14} required />
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-ivory/95 px-4 py-3 backdrop-blur">
        <Button type="submit" disabled={busy}>{busy ? t("common.saving") : t("common.save")}</Button>
        {v.id && v.isPublished && (
          <a href={`/en/${PUBLIC_PATH[v.kind]}/${initial.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-cobalt underline">
            {tc("view")} <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        )}
        {v.id && (
          <Button type="button" variant="ghost" className="ml-auto text-danger" onClick={remove}>
            <Trash2 aria-hidden="true" className="size-4" /> {t("common.delete")}
          </Button>
        )}
      </div>
    </form>
  );
}
