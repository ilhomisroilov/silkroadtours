import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { TestConsole } from "@/components/admin/ai-center/test-console";
import { ConversationTable, KnowledgePanel, KpiTiles, ModelConfigPanel, OutcomePanel, ProviderPanel, ToolsPanel, UsagePanels } from "@/components/admin/ai-center/sections";
import { AiSettingsForm } from "@/components/admin/ai-settings-form";
import { FilterBar, FilterField, filterInput, Pager } from "@/components/admin/list-tools";
import { PageHeader, Panel } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { aiStats, failedRequests, knowledgeStats, providerStatus, recentConversations, usageStats } from "@/lib/ai/admin";
import { getAiSettings } from "@/lib/ai/agent";
import { TOOL_SPECS } from "@/lib/ai/tools";
import { formatDateLabel } from "@/lib/format";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { cn } from "@/lib/cn";
import { uzText } from "@/lib/uz-alphabet";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("aicenter.title") };
}

const TABS = ["overview", "console", "usage", "logs", "settings"] as const;
type Tab = (typeof TABS)[number];

const logQuery = z.object({
  status: z.enum(["ok", "error", "fallback", "unanswered"]).optional().catch(undefined),
  source: z.enum(["assistant", "planner", "test"]).optional().catch(undefined),
  lang: z.enum(["en", "uz", "ru"]).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});

export default async function AdminAiCenter({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdminPage();
  const { t, locale } = await adminT();
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";
  const db = getDb();
  const fmt = (n: number) => n.toLocaleString(locale === "uz" ? "uz-UZ" : "en-US");
  const prov = providerStatus();
  const settings = await getAiSettings(db);

  let body: ReactNode = null;
  if (tab === "overview") {
    const [stats, kb] = await Promise.all([aiStats(db), knowledgeStats(db)]);
    body = (
      <>
        <KpiTiles stats={stats} t={t} fmt={fmt} />
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <ProviderPanel prov={prov} settings={settings} t={t} className="xl:col-span-2" />
          <KnowledgePanel kb={kb} t={t} fmt={fmt} />
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <ToolsPanel tools={TOOL_SPECS.map((s) => ({ name: s.name, description: s.description }))} usage={stats.tools} t={t} />
          <OutcomePanel stats={stats} t={t} />
        </div>
      </>
    );
  } else if (tab === "console") {
    body = <TestConsole chain={prov.chain} enabled={settings.enabled} defaultLocale={locale === "uz" ? "uz" : "en"} />;
  } else if (tab === "usage") {
    const tm = await getTranslations({ locale, namespace: "monthsShort" });
    const ms = (d: string) => formatDateLabel(d, (m) => tm(String(m) as never), false);
    const [usage, failures] = await Promise.all([usageStats(db), failedRequests(db)]);
    body = <UsagePanels usage={usage} failures={failures} t={t} fmt={fmt} ms={ms} />;
  } else if (tab === "logs") {
    const parsed = logQuery.parse(sp);
    const rows = await recentConversations(db, { status: parsed.status, source: parsed.source, locale: parsed.lang, q: parsed.q, page: parsed.page, pageSize: 30 });
    const pages = Math.max(1, Math.ceil(rows.total / rows.pageSize));
    const filtered = Boolean(parsed.status || parsed.source || parsed.lang || parsed.q);
    body = (
      <>
        <FilterBar submitLabel={t("common.filter")}>
          <input type="hidden" name="tab" value="logs" />
          <FilterField label={t("aicenter.logs.search")}>
            <input name="q" type="search" defaultValue={parsed.q ?? ""} className={`${filterInput} w-64 max-w-full`} />
          </FilterField>
          <FilterField label={t("aicenter.logs.cols.status")}>
            <select name="status" defaultValue={parsed.status ?? ""} className={filterInput}>
              <option value="">{t("common.all")}</option>
              {(["ok", "unanswered", "fallback", "error"] as const).map((s) => <option key={s} value={s}>{t(`aicenter.status.${s}`)}</option>)}
            </select>
          </FilterField>
          <FilterField label={t("aicenter.logs.cols.source")}>
            <select name="source" defaultValue={parsed.source ?? ""} className={filterInput}>
              <option value="">{t("common.all")}</option>
              <option value="assistant">{t("aicenter.logs.sources.assistant")}</option>
              <option value="planner">{t("aicenter.logs.sources.planner")}</option>
              <option value="test">{t("aicenter.logs.test")}</option>
            </select>
          </FilterField>
          <FilterField label={t("aicenter.logs.cols.lang")}>
            <select name="lang" defaultValue={parsed.lang ?? ""} className={filterInput}>
              <option value="">{t("common.all")}</option>
              <option value="en">English</option>
              <option value="uz">{uzText("Oʻzbekcha")}</option>
              <option value="ru">Русский</option>
            </select>
          </FilterField>
          {filtered && <Link href="/admin/ai?tab=logs" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-cobalt underline">{t("aicenter.logs.reset")}</Link>}
        </FilterBar>
        <p className="mb-2 text-sm text-ink-muted">{t("aicenter.logs.count", { count: rows.total })}</p>
        <ConversationTable rows={rows} t={t} fmt={fmt} />
        {pages > 1 && (
          <Pager
            page={rows.page}
            pageSize={rows.pageSize}
            total={rows.total}
            base="/admin/ai"
            params={{ tab: "logs", status: parsed.status, source: parsed.source, lang: parsed.lang, q: parsed.q }}
            labels={{ prev: t("common.prev"), next: t("common.next"), page: t("common.page", { page: rows.page, pages }) }}
          />
        )}
        <p className="mt-4 text-xs text-ink-muted">{t("aicenter.logs.privacy", { days: settings.retentionDays })}</p>
      </>
    );
  } else {
    body = (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title={t("aicenter.settings.title")} className="min-w-0">
          <p className="mb-5 border-l-2 border-terracotta bg-sand-soft p-3 text-sm">{t("aicenter.settings.protected")}</p>
          <AiSettingsForm initial={settings} canEdit={admin.role === "owner"} />
        </Panel>
        <ModelConfigPanel prov={prov} t={t} />
      </div>
    );
  }

  return (
    <>
      <PageHeader title={t("aicenter.title")}>
        <p className="mt-1 max-w-2xl text-ink-muted">{t("aicenter.intro")}</p>
      </PageHeader>
      <nav aria-label={t("aicenter.title")} className="mb-6 flex flex-wrap gap-2" data-testid="ai-tabs">
        {TABS.map((k) => (
          <Link
            key={k}
            href={k === "overview" ? "/admin/ai" : `/admin/ai?tab=${k}`}
            aria-current={k === tab ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold", k === tab ? "bg-lapis text-white" : "border border-line bg-white text-ink hover:bg-sand-soft")}
          >
            {t(`aicenter.tabs.${k}`)}
          </Link>
        ))}
      </nav>
      {body}
    </>
  );
}
