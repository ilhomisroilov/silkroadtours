import { BellRing, CalendarDays, MapPin, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { LeadSource, LeadStage } from "@/db/types";
import { cn } from "@/lib/cn";
import { dateLabel, dateRange, followUpState, initials, prettyDestination, SOURCE_TONE, STAGE_TONE, usd, type CrmLeadCard } from "./shared";

type T = (key: string, values?: Record<string, string | number>) => string;

export function StageBadge({ stage, label, className }: { stage: LeadStage; label: string; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold", STAGE_TONE[stage], className)}>{label}</span>;
}

export function SourceBadge({ source, label }: { source: LeadSource; label: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide", SOURCE_TONE[source])}>{label}</span>;
}

export function ManagerAvatar({ name, label }: { name: string | null; label: string }) {
  return (
    <span
      title={label}
      className={cn("relative inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", name ? "bg-lapis-deep text-ivory" : "border border-dashed border-field text-ink-muted")}
    >
      <span aria-hidden="true">{name ? initials(name) : "–"}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function FollowUpChip({ followUpAt, stage, today, t, ms, compact }: { followUpAt: string | null; stage: LeadStage; today: string; t: T; ms: (m: number) => string; compact?: boolean }) {
  const state = followUpState(followUpAt, stage, today);
  if (!state || !followUpAt) return null;
  const date = dateLabel(followUpAt, ms);
  const full = state === "overdue" ? t("card.overdue", { date }) : state === "today" ? t("card.dueToday") : t("card.followUp", { date });
  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold",
        state === "overdue" && "bg-danger text-white",
        state === "today" && "bg-saffron text-ink",
        state === "upcoming" && "bg-sand text-ink",
      )}
      data-followup={state}
      title={compact ? full : undefined}
    >
      <BellRing aria-hidden="true" className="size-3.5" />
      {compact ? (
        <>
          <span aria-hidden="true">{date}</span>
          <span className="sr-only">{full}</span>
        </>
      ) : (
        full
      )}
    </span>
  );
}

export function LeadValue({ lead, locale, t }: { lead: Pick<CrmLeadCard, "valueUsd" | "budgetUsd">; locale: string; t: T }) {
  if (lead.valueUsd != null) return <span className="font-display text-lg font-bold tabular-nums text-ink">{usd(lead.valueUsd, locale)}</span>;
  if (lead.budgetUsd != null) return <span className="text-sm font-semibold text-ink-muted">{t("card.budget", { value: usd(lead.budgetUsd, locale) })}</span>;
  return <span className="text-sm text-ink-muted">—</span>;
}

/** The body of a lead card, shared by the board (client) and other lists. */
export function LeadCardBody({ lead, today, locale, t, ms, footer }: { lead: CrmLeadCard; today: string; locale: string; t: T; ms: (m: number) => string; footer?: ReactNode }) {
  const dates = dateRange(lead.travelFrom, lead.travelTo, ms);
  const dest = prettyDestination(lead.destination);
  const managerLabel = lead.assignedName ? t("card.assignedTo", { name: lead.assignedName }) : t("card.unassigned");
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <SourceBadge source={lead.source} label={t(`sources.${lead.source}`)} />
        <ManagerAvatar name={lead.assignedName} label={managerLabel} />
      </div>
      <h3 className="mt-1 font-sans text-base font-bold leading-snug">
        <Link href={`/admin/crm/${lead.id}`} draggable={false} className="text-lapis-deep hover:text-cobalt hover:underline">
          {lead.fullName}
        </Link>
      </h3>
      <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{lead.title}</p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink">
        {dest && (
          <li className="flex min-w-0 max-w-full items-center gap-1"><MapPin aria-hidden="true" className="size-3.5 shrink-0 text-cobalt" /><span className="truncate">{dest}</span></li>
        )}
        {dates && (
          <li className="flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5 shrink-0 text-cobalt" />{dates}</li>
        )}
        {lead.travellers ? (
          <li className="flex items-center gap-1"><Users aria-hidden="true" className="size-3.5 shrink-0 text-cobalt" />{t("card.travellers", { count: lead.travellers })}</li>
        ) : null}
      </ul>
      {followUpState(lead.followUpAt, lead.stage, today) && (
        <div className="mt-2">
          <FollowUpChip followUpAt={lead.followUpAt} stage={lead.stage} today={today} t={t} ms={ms} />
        </div>
      )}
      {footer ?? (
        <div className="mt-2">
          <LeadValue lead={lead} locale={locale} t={t} />
        </div>
      )}
    </>
  );
}
