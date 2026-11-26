"use client";

import { ArrowLeft, ArrowRight, ImageIcon, ImagePlus, Library, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

interface LibraryItem {
  url: string;
  folder: string;
}

const MAX = 6 * 1024 * 1024;
const field = "mt-1 block min-h-11 w-full rounded-sm border border-field bg-white px-3 font-normal";

/** Library grid + upload button shared by the main image and the gallery. */
function useMediaSource() {
  const t = useTranslations("admin.places.form");
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (items) return items;
    const r = await apiFetch<LibraryItem[]>("/api/admin/media", { method: "GET" });
    if (r.ok && r.data) {
      setItems(r.data);
      return r.data;
    }
    toast({ tone: "error", title: t("libraryError") });
    return null;
  };
  const upload = async (file: File | undefined): Promise<string | null> => {
    if (!file) return null;
    if (file.size > MAX) {
      toast({ tone: "error", title: t("tooLarge") });
      return null;
    }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/media", { method: "POST", body: fd, credentials: "same-origin" });
      const body = (await res.json().catch(() => null)) as { data?: { url: string } } | null;
      if (res.ok && body?.data?.url) {
        toast({ tone: "success", title: t("uploaded") });
        setItems(null);
        return body.data.url;
      }
      toast({ tone: "error", title: res.status === 422 ? t("unsupported") : t("uploadFailed") });
      return null;
    } catch {
      toast({ tone: "error", title: t("uploadFailed") });
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { items, load, upload, busy };
}

function LibraryGrid({ items, onPick, onClose }: { items: LibraryItem[]; onPick: (url: string) => void; onClose: () => void }) {
  const t = useTranslations("admin.places.form");
  const [folder, setFolder] = useState("uploads");
  const folders = [...new Set(items.map((m) => m.folder))];
  const current = folders.includes(folder) ? folder : "";
  const shown = items.filter((m) => !current || m.folder === current).slice(0, 160);
  return (
    <div className="mt-3 rounded-sm border border-line bg-sand-soft/40 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-sm font-semibold">
          <span className="sr-only">{t("libraryFolder")}</span>
          <select value={current} onChange={(e) => setFolder(e.target.value)} className="min-h-11 rounded-sm border border-field bg-white px-3 font-normal" aria-label={t("libraryFolder")}>
            <option value="">{t("allFolders")}</option>
            {folders.map((f) => (
              <option key={f} value={f}>{f === "uploads" ? t("uploadsFolder") : f}</option>
            ))}
          </select>
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} className="ml-auto">
          <X aria-hidden="true" /> {t("closeLibrary")}
        </Button>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("libraryEmpty")}</p>
      ) : (
        <ul className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5 lg:grid-cols-8">
          {shown.map((m) => (
            <li key={m.url}>
              <button type="button" title={m.url} onClick={() => onPick(m.url)} className="block aspect-[4/3] w-full overflow-hidden rounded-sm bg-white ring-cobalt hover:ring-2 focus-visible:outline-none focus-visible:ring-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail picker */}
                <img src={m.url} alt={m.url.split("/").pop() ?? ""} loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourceButtons({ onLibrary, onFile, busy }: { onLibrary: () => void; onFile: (f: File | undefined) => void; busy: boolean }) {
  const t = useTranslations("admin.places.form");
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onLibrary}>
        <Library aria-hidden="true" /> {t("chooseFromLibrary")}
      </Button>
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        <Upload aria-hidden="true" /> {busy ? t("uploading") : t("upload")}
      </Button>
    </div>
  );
}

/** Main image: preview, path field, library and upload. */
export function ImageField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const t = useTranslations("admin.places.form");
  const src = useMediaSource();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-28 w-40 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-sand-soft">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a site-relative path */}
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImageIcon aria-hidden="true" className="size-8 text-ink-muted" />}
        </div>
        <div className="min-w-56 flex-1 space-y-2">
          <label htmlFor={id} className="block text-sm font-semibold">{t("image")}</label>
          <input id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value.trim() || null)} className={field} placeholder="/images/…" aria-describedby={`${id}-help`} />
          <p id={`${id}-help`} className="text-xs text-ink-muted">{t("imageHelp")}</p>
          <div className="flex flex-wrap gap-2">
            <SourceButtons
              busy={src.busy}
              onLibrary={async () => {
                if (open) return setOpen(false);
                if (await src.load()) setOpen(true);
              }}
              onFile={async (f) => {
                const url = await src.upload(f);
                if (url) onChange(url);
              }}
            />
            {value && (
              <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={() => onChange(null)}>
                <X aria-hidden="true" /> {t("removeImage")}
              </Button>
            )}
          </div>
        </div>
      </div>
      {open && src.items && (
        <LibraryGrid
          items={src.items}
          onClose={() => setOpen(false)}
          onPick={(url) => {
            onChange(url);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Gallery: ordered thumbnails with move/remove, plus library, upload and a pasted path. */
export function GalleryField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const t = useTranslations("admin.places.form");
  const src = useMediaSource();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const id = useId();
  const add = (url: string) => {
    const u = url.trim();
    if (u && !value.includes(u)) onChange([...value, u]);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <div>
      <p className="text-sm font-semibold">{t("gallery")}</p>
      <p className="text-xs text-ink-muted">{t("galleryHelp")}</p>
      {value.length > 0 ? (
        <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {value.map((url, i) => (
            <li key={url} className="overflow-hidden rounded-sm border border-line bg-white">
              <div className="aspect-[4/3] bg-sand-soft">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
                <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </div>
              <div className="flex items-center justify-between gap-1 px-1 py-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="inline-flex size-11 items-center justify-center rounded-sm hover:bg-sand-soft disabled:opacity-30" aria-label={t("moveLeft")}>
                  <ArrowLeft aria-hidden="true" className="size-4" />
                </button>
                <span className="text-xs tabular-nums text-ink-muted">{i + 1}</span>
                <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} className="inline-flex size-11 items-center justify-center rounded-sm hover:bg-sand-soft disabled:opacity-30" aria-label={t("moveRight")}>
                  <ArrowRight aria-hidden="true" className="size-4" />
                </button>
                <button type="button" onClick={() => onChange(value.filter((x) => x !== url))} className="inline-flex size-11 items-center justify-center rounded-sm text-danger hover:bg-danger/10" aria-label={t("removeFromGallery")}>
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 rounded-sm border border-dashed border-line px-3 py-4 text-sm text-ink-muted">{t("galleryEmpty")}</p>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <SourceButtons
          busy={src.busy}
          onLibrary={async () => {
            if (open) return setOpen(false);
            if (await src.load()) setOpen(true);
          }}
          onFile={async (f) => {
            const url = await src.upload(f);
            if (url) add(url);
          }}
        />
        <div className="flex min-w-60 flex-1 items-end gap-2">
          <label htmlFor={id} className="sr-only">{t("galleryPath")}</label>
          <input
            id={id}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
                setDraft("");
              }
            }}
            placeholder={t("galleryPath")}
            className="min-h-11 w-full rounded-sm border border-field bg-white px-3"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!draft.trim()}
            onClick={() => {
              add(draft);
              setDraft("");
            }}
          >
            <ImagePlus aria-hidden="true" /> {t("addToGallery")}
          </Button>
        </div>
      </div>
      {open && src.items && <LibraryGrid items={src.items} onClose={() => setOpen(false)} onPick={(url) => add(url)} />}
    </div>
  );
}
