"use client";

import { Copy, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { useAdminApi } from "./booking-actions";

export interface LibraryItem {
  url: string;
  name: string;
  folder: string;
  uploaded: boolean;
}

const MAX = 6 * 1024 * 1024;

export function MediaLibrary({ items }: { items: LibraryItem[] }) {
  const t = useTranslations("admin.media");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const call = useAdminApi();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState("");
  const folders = [...new Set(items.map((i) => i.folder))];
  const shown = items.filter((i) => !folder || i.folder === folder);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      if (file.size > MAX) {
        toast({ tone: "error", title: t("tooLarge") });
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body: fd, credentials: "same-origin" });
      if (res.ok) toast({ tone: "success", title: t("uploaded") });
      else toast({ tone: "error", title: res.status === 422 ? t("unsupported") : tc("error") });
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  };
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ tone: "success", title: t("copied"), description: url });
    } catch {
      toast({ tone: "info", title: url });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-line bg-white p-4 shadow-sm">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" id="media-upload" onChange={(e) => upload(e.target.files)} />
        <Button type="button" disabled={busy} onClick={() => input.current?.click()}>
          <Upload aria-hidden="true" className="size-4" /> {busy ? t("uploading") : t("upload")}
        </Button>
        <p className="text-sm text-ink-muted">{t("help")}</p>
        <label className="ml-auto text-sm font-semibold">
          <span className="sr-only">{t("filter")}</span>
          <select value={folder} onChange={(e) => setFolder(e.target.value)} className="min-h-11 rounded-sm border border-field bg-white px-3 font-normal">
            <option value="">{tc("all")} ({items.length})</option>
            {folders.map((f) => <option key={f} value={f}>{f === "uploads" ? t("uploads") : f}</option>)}
          </select>
        </label>
      </div>
      <p className="text-sm text-ink-muted">{t("count", { count: shown.length })}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6" data-testid="media-grid">
        {shown.map((m) => (
          <li key={m.url} className="overflow-hidden rounded-sm border border-line bg-white shadow-sm">
            <div className="aspect-[4/3] bg-sand-soft">
              {/* eslint-disable-next-line @next/next/no-img-element -- library thumbnail */}
              <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </div>
            <div className="space-y-1 p-2">
              <p className="truncate text-xs font-semibold" title={m.url}>{m.url.replace(/^\/images\//, "")}</p>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => copy(m.url)} className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-xs font-semibold text-cobalt hover:bg-sky">
                  <Copy aria-hidden="true" className="size-3.5" /> {t("copy")}
                </button>
                {m.uploaded && (
                  <button
                    type="button"
                    onClick={async () => { if (confirm(t("deleteConfirm"))) await call(`/api/admin/media/${m.name}`, { method: "DELETE" }, tc("saved")); }}
                    className="ml-auto inline-flex size-9 items-center justify-center rounded-full text-danger hover:bg-danger/10"
                    aria-label={tc("delete")}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
