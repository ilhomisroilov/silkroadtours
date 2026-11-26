import "server-only";
import type { Db } from "@/db/client";
import { listContentAdmin } from "@/db/queries/content";
import { listDestinationsAdmin } from "@/db/queries/destinations";
import type { ContentKind } from "@/db/schema";

/** Options for the content editor: destinations, and categories/icons already used for this kind. */
export async function contentEditorOptions(db: Db, kind: ContentKind) {
  const [dests, items] = await Promise.all([listDestinationsAdmin(db), listContentAdmin(db, kind)]);
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
  return {
    destinations: dests.map((d) => ({ slug: d.slug, name: d.name.en })),
    categories: uniq(items.map((i) => i.category)),
    icons: uniq(items.map((i) => i.icon)),
  };
}
