import { ArrowUpRight, CalendarClock, Mail, MessageCircle, NotebookPen, Phone, PhoneCall, Repeat2, UserRound, BellRing, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ActivityComposer, AssignFollowUp, LeadDetailsEditor, StageStepper, type LeadFormValues } from "@/components/admin/crm/lead-actions";
import { FollowUpChip, ManagerAvatar, SourceBadge, StageBadge } from "@/components/admin/crm/lead-card";
import { dateLabel, dateRange, prettyDestination, serviceTypeKey, usd } from "@/components/admin/crm/shared";
import { getDb } from "@/db/client";
import { getLead, hasCustomerProfile, listActiveAdmins, listLeadActivities, listLeadDestinations, resolveLeadSource, type LeadActivityRow } from "@/db/queries/crm";
import { LEAD_STAGES, type LeadActivityKind, type LeadStage } from "@/db/types";
import { messengerLinks } from "@/lib/links";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { todayInTashkent } from "@/validators/common";
import { LEAD_FIELD_KEYS } from "@/validators/lead";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { t } = await adminT();
  const id = Number((await params).id);
  const lead = Number.isInteger(id) && id > 0 ? await getLead(getDb(), id) : null;
  return { title: lead ? `${lead.fullName} · ${t("crm.title")}` : t("crm.title") };
}

const KIND_ICON: Record<LeadActivityKind, typeof Mail> = {
  created: Sparkles,
  note: NotebookPen,
  stage: Repeat2,
  assign: UserRound,
  follow_up: BellRing,
  call: PhoneCall,
  email: Mail,
};

const FIELD_LABEL: Record<(typeof LEAD_FIELD_KEYS)[number], string> = {
  fullName: "name",
  email: "email",
  phone: "phone",
  locale: "locale",
  title: "title",
  destination: "destination",
  interests: "interests",
  budgetUsd: "budget",
  travelFrom: "travelFrom",
  travelTo: "travelTo",
  travellers: "travellers",
  valueUsd: "value",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const tm = await getTranslations({ locale, namespace: "monthsShort" });
  const ms = (m: number) => tm(String(m) as never);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const db = getDb();
  const lead = await getLead(db, id);
  if (!lead) notFound();
  const [activities, admins, destinations, source, hasProfile] = await Promise.all([
    listLeadActivities(db, id),
    listActiveAdmins(db),
    listLeadDestinations(db),
    resolveLeadSource(db, lead),
    hasCustomerProfile(db, lead.email),
  ]);
  const today = todayInTashkent();
  const tc = (k: string, v?: Record<string, string | number>) => t(`crm.${k}` as never, v as never);
  const typeKey = serviceTypeKey(lead.title);
  const title = typeKey ? t(`requests.types.${typeKey}`) : lead.title;
  const links = lead.phone ? messengerLinks({ whatsapp: lead.phone, telegram: "", phone: lead.phone }, `${lead.fullName.split(" ")[0]}, ${title}`) : null;
  const dates = dateRange(lead.travelFrom, lead.travelTo, ms);
  const stamp = (d: Date) => `${dateLabel(new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10), ms)}, ${new Date(d.getTime() + 5 * 3600_000).toISOString().slice(11, 16)}`;
  const isStage = (s: string): s is LeadStage => (LEAD_STAGES as readonly string[]).includes(s);

  const describe = (a: LeadActivityRow): { title: string; body?: ReactNode } => {
    const kindLabel = t(`crm.activity.kinds.${a.kind}`);
    switch (a.kind) {
      case "created": {
        const ref = a.text.match(/[A-Z]{2}-\d{4}-\d+/)?.[0];
        return { title: kindLabel, body: lead.source === "admin" ? t("crm.activity.createdManual") : ref ? t("crm.activity.createdFrom", { source: t(`crm.sources.${lead.source}`), ref }) : t(`crm.sources.${lead.source}`) };
      }
      case "stage": {
        const [from, to] = a.text.split("→").map((s) => s.trim());
        if (from && to && isStage(from) && isStage(to)) {
          return {
            title: kindLabel,
            body: (
              <span className="flex flex-wrap items-center gap-1.5">
                <StageBadge stage={from} label={t(`crm.stages.${from}`)} />
                <span aria-hidden="true">→</span>
                <StageBadge stage={to} label={t(`crm.stages.${to}`)} />
              </span>
            ),
          };
        }
        return { title: kindLabel, body: a.text };
      }
      case "assign":
        return { title: kindLabel, body: a.text ? t("crm.activity.assignedTo", { name: a.text }) : t("crm.activity.unassigned") };
      case "follow_up":
        return { title: kindLabel, body: /^\d{4}-\d{2}-\d{2}$/.test(a.text) ? t("crm.activity.followUpSet", { date: dateLabel(a.text, ms) }) : t("crm.activity.followUpCleared") };
      case "note": {
        const m = a.text.match(/^updated:([A-Za-z,]+)$/);
        if (m) {
          const keys = m[1]!.split(",").filter((k): k is (typeof LEAD_FIELD_KEYS)[number] => (LEAD_FIELD_KEYS as readonly string[]).includes(k));
          return { title: t("crm.detail.editDetails"), body: t("crm.activity.detailsUpdated", { fields: keys.map((k) => t(`crm.detail.${FIELD_LABEL[k]}`).replace(/\s*\(USD\)$/, "")).join(", ") }) };
        }
        return { title: kindLabel, body: <span className="whitespace-pre-line">{a.text}</span> };
      }
      default:
        return { title: kindLabel, body: <span className="whitespace-pre-line">{a.text}</span> };
    }
  };

  const formInitial: LeadFormValues = {
    fullName: lead.fullName,
    email: lead.email,
    phone: lead.phone ?? "",
    locale: lead.locale,
    title: lead.title,
    destination: lead.destination ?? "",
    interests: lead.interests ?? "",
    budgetUsd: lead.budgetUsd != null ? String(lead.budgetUsd) : "",
    travelFrom: lead.travelFrom ?? "",
    travelTo: lead.travelTo ?? "",
    travellers: lead.travellers != null ? String(lead.travellers) : "",
    valueUsd: lead.valueUsd != null ? String(lead.valueUsd) : "",
  };
  const notSet = <span className="font-normal text-ink-muted">{t("crm.detail.notSet")}</span>;
  const row = (label: string, value: ReactNode) => (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-b border-line py-2 last:border-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right font-semibold">{value ?? notSet}</dd>
    </div>
  );
  const pill = "inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-lapis-deep hover:bg-sand-soft";

  return (
    <>
      <p className="mb-2"><Link href="/admin/crm" className="text-sm text-cobalt underline">← {t("crm.detail.back")}</Link></p>
      <PageHeader title={lead.fullName}>
        <p className="mt-1 max-w-2xl text-ink-muted">{title}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StageBadge stage={lead.stage} label={t(`crm.stages.${lead.stage}`)} />
          <SourceBadge source={lead.source} label={t(`crm.sources.${lead.source}`)} />
          {lead.sourceRef && <span className="text-sm font-semibold text-ink-muted">{lead.sourceRef}</span>}
          <FollowUpChip followUpAt={lead.followUpAt} stage={lead.stage} today={today} t={tc} ms={ms} />
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Panel title={t("crm.detail.pipeline")}>
            <StageStepper id={lead.id} stage={lead.stage} name={lead.fullName} />
          </Panel>

          <Panel title={t("crm.quick.title")}>
            <div className="mb-4 flex flex-wrap gap-2">
              <a href={`mailto:${lead.email}?subject=${encodeURIComponent(title)}`} className={pill} data-testid="quick-email"><Mail aria-hidden="true" className="size-4" /> {t("crm.quick.email")}</a>
              {links?.phone && <a href={links.phone} className={pill} data-testid="quick-call"><Phone aria-hidden="true" className="size-4" /> {t("crm.quick.call")}</a>}
              {links?.whatsapp && <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={pill} data-testid="quick-whatsapp"><MessageCircle aria-hidden="true" className="size-4 text-success" /> {t("crm.quick.whatsapp")}</a>}
            </div>
            <ActivityComposer id={lead.id} />
          </Panel>

          <Panel title={t("crm.activity.title")}>
            {activities.length === 0 ? (
              <p className="text-ink-muted">{t("crm.activity.empty")}</p>
            ) : (
              <ol className="relative space-y-5 before:absolute before:inset-y-1 before:left-[1.05rem] before:w-px before:bg-line" data-testid="lead-timeline">
                {activities.map((a) => {
                  const Icon = KIND_ICON[a.kind] ?? NotebookPen;
                  const d = describe(a);
                  return (
                    <li key={a.id} className="relative flex gap-3" data-kind={a.kind}>
                      <span className="relative z-10 inline-flex size-[2.15rem] shrink-0 items-center justify-center rounded-full border border-line bg-white text-cobalt" aria-hidden="true">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <span className="font-bold text-ink">{d.title}</span>
                          <time dateTime={a.createdAt.toISOString()} className="text-xs text-ink-muted">{stamp(a.createdAt)}</time>
                        </p>
                        {d.body && <div className="mt-1 text-sm text-ink">{d.body}</div>}
                        <p className="mt-1 text-xs text-ink-muted">{a.adminName ?? t("crm.activity.system")}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title={t("crm.detail.customer")}>
            <dl>
              {row(t("crm.detail.email"), <a href={`mailto:${lead.email}`} className="text-lapis underline">{lead.email}</a>)}
              {row(t("crm.detail.phone"), lead.phone ? <a href={links?.phone ?? `tel:${lead.phone}`} className="text-lapis underline">{lead.phone}</a> : null)}
              {row(t("crm.detail.locale"), t.has(`crm.locales.${lead.locale}`) ? t(`crm.locales.${lead.locale}`) : lead.locale)}
            </dl>
            {hasProfile && (
              <Link href={`/admin/customers/${encodeURIComponent(lead.email)}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-cobalt underline">
                {t("crm.detail.otherLeads")} <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </Panel>

          <Panel title={t("crm.detail.ownership")}>
            <div className="mb-4 flex items-center gap-3">
              <ManagerAvatar name={lead.assignedName} label={lead.assignedName ? t("crm.card.assignedTo", { name: lead.assignedName }) : t("crm.card.unassigned")} />
              <span className="font-semibold">{lead.assignedName ?? t("crm.detail.unassigned")}</span>
            </div>
            <AssignFollowUp id={lead.id} assignedTo={lead.assignedTo} followUpAt={lead.followUpAt} admins={admins.map((a) => ({ id: a.id, name: a.name }))} />
          </Panel>

          <Panel title={t("crm.detail.deal")}>
            <LeadDetailsEditor leadId={lead.id} initial={formInitial} destinations={destinations}>
              <dl>
                {row(t("crm.detail.destination"), prettyDestination(lead.destination))}
                {row(t("crm.detail.travelDates"), dates)}
                {row(t("crm.detail.travellers"), lead.travellers)}
                {row(t("crm.detail.budget"), lead.budgetUsd != null ? usd(lead.budgetUsd, locale) : null)}
                {row(t("crm.detail.value"), lead.valueUsd != null ? usd(lead.valueUsd, locale) : null)}
              </dl>
              {lead.interests && (
                <div className="mt-3">
                  <p className="text-sm text-ink-muted">{t("crm.detail.interests")}</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{lead.interests}</p>
                </div>
              )}
            </LeadDetailsEditor>
          </Panel>

          <Panel title={t("crm.detail.source")}>
            <dl>
              {row(t("crm.detail.source"), <SourceBadge source={lead.source} label={t(`crm.sources.${lead.source}`)} />)}
              {lead.sourceRef && row(t("crm.detail.reference"), lead.sourceRef)}
              {row(t("crm.detail.created"), stamp(lead.createdAt))}
              {row(t("crm.detail.updated"), stamp(lead.updatedAt))}
            </dl>
            <div className="mt-3 flex flex-col items-start gap-2">
              {lead.source === "admin" && <p className="text-sm text-ink-muted">{t("crm.detail.manualSource")}</p>}
              {source.href && (
                <Link href={source.href} className="inline-flex items-center gap-1 text-sm font-semibold text-cobalt underline" data-testid="lead-source-link">
                  {t("crm.detail.openSource", { source: t(`crm.sources.${lead.source}`).toLowerCase() })} <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              )}
              {source.tripId && (
                <Link href={`/admin/trips/${encodeURIComponent(source.tripId)}`} className="inline-flex items-center gap-1 text-sm font-semibold text-cobalt underline">
                  <CalendarClock aria-hidden="true" className="size-4" /> {t("crm.detail.openTrip")}
                </Link>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
