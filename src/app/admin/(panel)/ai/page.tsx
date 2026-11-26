import type { Metadata } from "next";
import Link from "next/link";
import { AiSettingsForm } from "@/components/admin/ai-settings-form";
import { HBars, PageHeader, Panel, StatTile } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { aiStats, knowledgeStats, providerStatus, recentConversations } from "@/lib/ai/admin";
import { AI_ADMIN } from "@/lib/ai/admin-strings";
import { getAiSettings } from "@/lib/ai/agent";
import { adminLocale, requireAdminPage } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: AI_ADMIN[await adminLocale()].title };
}

const STATUS_CLS: Record<string, string> = { ok: "text-turquoise-ink", fallback: "text-terracotta-deep", error: "text-danger", unanswered: "text-saffron-ink" };

export default async function AdminAi() {
  const admin = await requireAdminPage();
  const locale = await adminLocale();
  const t = AI_ADMIN[locale];
  const db = getDb();
  const [stats, kb, settings, convs] = await Promise.all([aiStats(db), knowledgeStats(db), getAiSettings(db), recentConversations(db, 50)]);
  const prov = providerStatus();
  const fmt = (n: number) => n.toLocaleString(locale === "uz" ? "uz-UZ" : "en-US");
  return (
    <>
      <PageHeader title={t.title}>
        <p className="mt-1 text-ink-muted">{t.last30}</p>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t.conversations} value={fmt(stats.conversations)} />
        <StatTile label={t.replies} value={fmt(stats.replies)} hint={`${t.fallback}: ${stats.fallback} · ${t.errors}: ${stats.errors}`} />
        <StatTile label={t.tokens} value={`${fmt(stats.tokensIn)} / ${fmt(stats.tokensOut)}`} hint={`${t.latency}: ${(stats.avgLatencyMs / 1000).toFixed(1)} s`} />
        <StatTile label={t.feedback} value={`${stats.feedback.up} / ${stats.feedback.down}`} hint={`${t.bookings}: ${stats.bookingInquiries}`} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title={t.provider}>
          {prov.chain.length === 0 ? (
            <p className="text-danger">{t.noProvider}</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-ink-muted">{t.chain}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {prov.chain.map((p) => (
                  <li key={p.id + p.model}><b>{p.id}</b> · {p.model}</li>
                ))}
              </ol>
            </>
          )}
          <p className="mt-4 text-sm font-semibold text-ink-muted">{t.keys}</p>
          <ul className="mt-1 space-y-1 text-sm">
            <li>GEMINI_API_KEY: <code>{prov.keys.gemini ?? t.notSet}</code></li>
            <li>GROQ_API_KEY: <code>{prov.keys.groq ?? t.notSet}</code></li>
          </ul>
        </Panel>
        <Panel title={t.knowledge}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-line pb-2"><dt>{t.tours}</dt><dd className="font-bold">{kb.toursPublished} / {kb.tours}</dd></div>
            <div className="flex justify-between border-b border-line pb-2"><dt>{t.destinations}</dt><dd className="font-bold">{kb.destinations}</dd></div>
            <div className="flex justify-between"><dt>{t.faq}</dt><dd className="font-bold">{kb.faq}</dd></div>
          </dl>
        </Panel>
        <Panel title={t.tools}>
          {stats.tools.length ? <HBars rows={stats.tools} color="#2f8f8b" /> : <p className="text-ink-muted">{t.noData}</p>}
          {stats.byProvider.length > 0 && (
            <>
              <p className="mb-2 mt-4 text-sm font-semibold text-ink-muted">{t.byProvider}</p>
              <HBars rows={stats.byProvider} color="#26458f" />
            </>
          )}
        </Panel>
      </div>

      <Panel title={t.recent} className="mt-6">
        {convs.length === 0 ? (
          <p className="text-ink-muted">{t.none}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="py-2 pr-3">{t.id}</th><th className="py-2 pr-3">{t.time}</th><th className="py-2 pr-3">{t.lang}</th><th className="py-2 pr-3">{t.source}</th><th className="py-2 pr-3">{t.question}</th><th className="py-2 pr-3">Model</th><th className="py-2 pr-3">Token</th><th className="py-2 pr-3">{t.status}</th><th />
                </tr>
              </thead>
              <tbody>
                {convs.map((c) => (
                  <tr key={c.id} className="border-t border-line align-top">
                    <td className="py-2 pr-3 font-mono text-xs">{c.id.slice(0, 8)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{c.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td className="py-2 pr-3 uppercase">{c.locale}</td>
                    <td className="py-2 pr-3">{c.source}</td>
                    <td className="max-w-[22rem] py-2 pr-3"><span className="line-clamp-2">{c.firstQuestion}</span></td>
                    <td className="py-2 pr-3">{c.lastProvider}</td>
                    <td className="py-2 pr-3">{fmt(Number(c.tokens))}</td>
                    <td className={`py-2 pr-3 font-bold ${STATUS_CLS[c.lastStatus] ?? ""}`}>{c.lastStatus ?? "—"}{c.bookingReference ? ` · ${c.bookingReference}` : ""}</td>
                    <td className="py-2"><Link href={`/admin/ai/${c.id}`} className="font-semibold text-lapis underline">{t.open}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-muted">{t.privacy}</p>
      </Panel>

      <Panel title={t.settings} className="mt-6">
        <p className="mb-4 border-l-2 border-terracotta bg-sand-soft p-3 text-sm">{t.protected}</p>
        <AiSettingsForm initial={settings} locale={locale} canEdit={admin.role === "owner"} />
      </Panel>
    </>
  );
}
