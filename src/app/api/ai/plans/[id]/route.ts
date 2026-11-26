import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { savedTripPlans } from "@/db/schema";
import { planForDisplay, type TripPlan } from "@/lib/ai/planner";
import { notFound, ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  if (!/^p_[a-z0-9]{16}$/.test(id)) throw notFound();
  const [row] = await getDb().select().from(savedTripPlans).where(eq(savedTripPlans.id, id)).limit(1);
  if (!row) throw notFound();
  return ok({ id: row.id, plan: planForDisplay(row.plan as Partial<TripPlan>, row.locale), request: row.request, locale: row.locale });
});
