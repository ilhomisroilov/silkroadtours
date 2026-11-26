import "server-only";
import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { leadActivities, leads } from "../schema";
import type { LeadSource } from "../types";

export type Lead = typeof leads.$inferSelect;
export type LeadActivity = typeof leadActivities.$inferSelect;

export interface NewLead {
  source: LeadSource;
  sourceRef?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  locale?: string;
  title: string;
  destination?: string | null;
  interests?: string | null;
  budgetUsd?: number | null;
  travelFrom?: string | null;
  travelTo?: string | null;
  travellers?: number | null;
  valueUsd?: number | null;
}

/**
 * Every inquiry becomes a CRM lead in stage "new". Best effort: a failure here must never lose the
 * booking or request itself, so errors are logged and swallowed. Idempotent per (source, sourceRef).
 */
export async function createLead(db: Db, input: NewLead): Promise<number | null> {
  try {
    if (input.sourceRef) {
      const [existing] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.source, input.source), eq(leads.sourceRef, input.sourceRef)))
        .limit(1);
      if (existing) return existing.id;
    }
    const [row] = await db
      .insert(leads)
      .values({ ...input, title: input.title.slice(0, 200), stage: "new" })
      .returning({ id: leads.id });
    if (!row) return null;
    await db.insert(leadActivities).values({ leadId: row.id, kind: "created", text: input.sourceRef ? `New ${input.source}: ${input.sourceRef}` : `New ${input.source}` });
    return row.id;
  } catch (err) {
    console.error("[crm] could not create lead", err);
    return null;
  }
}
