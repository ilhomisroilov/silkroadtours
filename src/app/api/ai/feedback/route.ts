import { z } from "zod";
import { getDb } from "@/db/client";
import { aiFeedback } from "@/db/schema";
import { noContent, parseBody, route } from "@/lib/http";

export const dynamic = "force-dynamic";
const schema = z.object({ messageId: z.number().int().positive(), rating: z.union([z.literal(1), z.literal(-1)]) });

export const POST = route(async (req) => {
  const input = await parseBody(req, schema);
  try {
    await getDb().insert(aiFeedback).values(input);
  } catch {
    /* unknown message id: ignore */
  }
  return noContent();
});
