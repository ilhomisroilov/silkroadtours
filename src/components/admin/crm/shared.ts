// CRM helpers shared by server pages and client components (no server-only imports).
import { LEAD_STAGES, SERVICE_TYPES, type LeadSource, type LeadStage, type Locale, type ServiceType } from "@/db/types";
import { formatMoney } from "@/lib/pricing";

export const BOARD_STAGES = LEAD_STAGES.filter((s) => s !== "lost") as Exclude<LeadStage, "lost">[];
export const OPEN_STAGE_SET = new Set<LeadStage>(["new", "contacted", "qualified", "offer_sent", "negotiation"]);

/** Badge colours per stage: a calm ramp from mist (new) to navy (completed); lost is red. */
export const STAGE_TONE: Record<LeadStage, string> = {
  new: "bg-sky text-lapis border-lapis/20",
  contacted: "bg-lapis-mist text-lapis-deep border-lapis/20",
  qualified: "bg-saffron-soft text-saffron-ink border-saffron/40",
  offer_sent: "bg-saffron/25 text-saffron-ink border-saffron/50",
  negotiation: "bg-cobalt/12 text-cobalt border-cobalt/30",
  confirmed: "bg-success/12 text-success border-success/30",
  completed: "bg-lapis text-white border-lapis",
  lost: "bg-danger/10 text-danger border-danger/30",
};

/** Accent strip on top of each board column. */
export const STAGE_ACCENT: Record<LeadStage, string> = {
  new: "#9fb6d6",
  contacted: "#6f93c4",
  qualified: "#d9a441",
  offer_sent: "#c08a24",
  negotiation: "#245ba8",
  confirmed: "#1e7b4f",
  completed: "#173d66",
  lost: "#b42318",
};

export const SOURCE_TONE: Record<LeadSource, string> = {
  booking: "bg-lapis/10 text-lapis",
  request: "bg-saffron-soft text-saffron-ink",
  trip: "bg-success/10 text-success",
  partner: "bg-cobalt/10 text-cobalt",
  contact: "bg-sand text-ink",
  admin: "bg-ink/8 text-ink",
};

export function initials(name: string | null | undefined): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase();
}

export type FollowUpState = "overdue" | "today" | "upcoming" | null;

/** Follow-ups only matter while the deal is open. */
export function followUpState(followUpAt: string | null, stage: LeadStage, today: string): FollowUpState {
  if (!followUpAt || !OPEN_STAGE_SET.has(stage)) return null;
  if (followUpAt < today) return "overdue";
  if (followUpAt === today) return "today";
  return "upcoming";
}

/** Whole US dollars, e.g. "$2,380". */
export function usd(v: number, locale: string): string {
  return formatMoney(Math.round(v) * 100, "USD", (locale === "uz" || locale === "ru" ? locale : "en") as Locale);
}

/** "5 Jan – 12 Jan 2027" from ISO dates and translated short month names. */
export function dateRange(from: string | null, to: string | null, ms: (m: number) => string): string | null {
  const label = (iso: string, year: boolean) => {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    return year ? `${d} ${ms(m)} ${y}` : `${d} ${ms(m)}`;
  };
  if (!from && !to) return null;
  if (from && to && from !== to) return `${label(from, from.slice(0, 4) !== to.slice(0, 4))} – ${label(to, true)}`;
  return label((from ?? to)!, true);
}

export function dateLabel(iso: string, ms: (m: number) => string): string {
  return dateRange(iso, null, ms) ?? iso;
}

/** The serialisable shape the board and table render. */
export interface CrmLeadCard {
  id: number;
  stage: LeadStage;
  source: LeadSource;
  sourceRef: string | null;
  fullName: string;
  email: string;
  title: string;
  destination: string | null;
  travelFrom: string | null;
  travelTo: string | null;
  travellers: number | null;
  valueUsd: number | null;
  budgetUsd: number | null;
  assignedName: string | null;
  followUpAt: string | null;
}

/** Destinations may be stored as slugs ("samarkand, bukhara"); show them as names. */
export function prettyDestination(v: string | null): string | null {
  if (!v) return null;
  return v
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/^[a-z0-9-]+$/.test(p) ? p.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : p))
    .join(", ");
}

/** Requests without a subject are titled by their type ("custom_tour"); such titles get the translated type name. */
export function serviceTypeKey(title: string): ServiceType | null {
  const k = title.trim().toLowerCase().replace(/\s+/g, "_");
  return (SERVICE_TYPES as readonly string[]).includes(k) ? (k as ServiceType) : null;
}
