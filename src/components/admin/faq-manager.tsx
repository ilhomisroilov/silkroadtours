"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FAQ_CATEGORIES, type FaqCategory, type LocalizedText } from "@/db/types";
import { Button } from "@/components/ui/button";
import { useAdminApi } from "./booking-actions";
import { emptyLocalized, LocalizedFields } from "./localized";

interface Item {
  id?: number;
  category: FaqCategory;
  question: LocalizedText;
  answer: LocalizedText;
  sortOrder: number;
  isPublished: boolean;
}

function FaqItemEditor({ item, onDone }: { item: Item; onDone?: () => void }) {
  const t = useTranslations("admin");
  const tg = useTranslations("guide.categories");
  const call = useAdminApi();
  const [v, setV] = useState(item);
  const body = { category: v.category, question: v.question, answer: v.answer, sortOrder: v.sortOrder, isPublished: v.isPublished };
  return (
    <div className="space-y-3 rounded-sm border border-line bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">{t("faq.category")}
          <select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as FaqCategory })} className="mt-1 block min-h-11 rounded-sm border border-field bg-white px-3 font-normal">
            {FAQ_CATEGORIES.map((c) => <option key={c} value={c}>{tg(c)}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">{t("tours.sortOrder")}
          <input type="number" value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value) })} className="mt-1 block min-h-11 w-24 rounded-sm border border-field px-3 font-normal" />
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 font-semibold"><input type="checkbox" className="size-5" checked={v.isPublished} onChange={(e) => setV({ ...v, isPublished: e.target.checked })} />{t("common.published")}</label>
      </div>
      <LocalizedFields label={t("faq.question")} value={v.question} onChange={(q) => setV({ ...v, question: q })} required />
      <LocalizedFields label={t("faq.answer")} value={v.answer} multiline rows={4} onChange={(a) => setV({ ...v, answer: a })} required />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={async () => {
            const ok = v.id
              ? await call(`/api/admin/faq/${v.id}`, { method: "PUT", json: body }, t("common.saved"))
              : await call("/api/admin/faq", { method: "POST", json: body }, t("common.saved"));
            if (ok) onDone?.();
          }}
        >
          {t("common.save")}
        </Button>
        {v.id && (
          <Button size="sm" variant="ghost" className="text-danger" onClick={async () => { if (confirm(t("common.confirmDelete"))) await call(`/api/admin/faq/${v.id}`, { method: "DELETE" }, t("common.saved")); }}>
            {t("common.delete")}
          </Button>
        )}
      </div>
    </div>
  );
}

export function FaqManager({ items }: { items: Item[] }) {
  const t = useTranslations("admin");
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4">
      {adding ? (
        <FaqItemEditor item={{ category: "general", question: emptyLocalized(), answer: emptyLocalized(), sortOrder: 100, isPublished: true }} onDone={() => setAdding(false)} />
      ) : (
        <Button onClick={() => setAdding(true)}>+ {t("faq.new")}</Button>
      )}
      {items.map((i) => (
        <details key={i.id} className="rounded-sm border border-line bg-white">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 font-semibold">
            <span>{i.question.en}</span>
            <span className="text-xs text-ink-muted">{i.category}{i.isPublished ? "" : ` · ${t("common.draft")}`}</span>
          </summary>
          <div className="p-2"><FaqItemEditor item={i} /></div>
        </details>
      ))}
    </div>
  );
}
