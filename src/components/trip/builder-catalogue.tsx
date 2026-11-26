"use client";

import { RotateCw, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { SmartImage } from "@/components/common/smart-image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { CATALOG_TABS, type CatalogEntry, type CatalogTab } from "@/lib/trip-helpers";
import type { TripItem } from "@/lib/trip-store";
import { AddToTripButton } from "./add-to-trip-button";
import { KindIcon } from "./kind-icon";

export function usePriceLabel(money: (usd: number) => string) {
  const t = useTranslations("tripBuilder.price");
  return (item: Pick<TripItem, "priceUsd" | "priceUnit" | "kind">): string | null => {
    if (item.priceUsd == null || !(item.priceUsd > 0)) return item.kind === "attraction" ? t("onSite") : null;
    const price = money(item.priceUsd);
    switch (item.priceUnit) {
      case "night":
        return t("night", { price });
      case "meal":
        return t("meal", { price });
      case "group":
        return t("group", { price });
      case "trip":
        return t("trip", { price });
      default:
        return t("person", { price });
    }
  };
}

export function BuilderCatalogue({
  entries,
  loading,
  error,
  retry,
  tripDestinations,
  destinationName,
  money,
}: {
  entries: CatalogEntry[];
  loading: boolean;
  error: boolean;
  retry: () => void;
  tripDestinations: string[];
  destinationName: (slug: string) => string;
  money: (usd: number) => string;
}) {
  const t = useTranslations("tripBuilder.catalogue");
  const priceLabel = usePriceLabel(money);
  const [tab, setTab] = useState<CatalogTab>("hotels");
  const [q, setQ] = useState("");
  const [everywhere, setEverywhere] = useState(false);
  const scoped = tripDestinations.length > 0 && !everywhere;

  const visible = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase();
    return entries.filter(
      (e) =>
        (!scoped || (e.destinationSlug && tripDestinations.includes(e.destinationSlug))) &&
        (!needle || `${e.title} ${e.meta ?? ""} ${e.summary ?? ""}`.toLocaleLowerCase().includes(needle)),
    );
  }, [entries, q, scoped, tripDestinations]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(CATALOG_TABS.map((k) => [k, 0])) as Record<CatalogTab, number>;
    for (const e of visible) c[e.tab]++;
    return c;
  }, [visible]);

  return (
    <section aria-labelledby="tb-catalogue" className="card min-w-0 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-cobalt">{t("eyebrow")}</p>
          <h2 id="tb-catalogue" className="mt-1.5 text-2xl text-lapis">
            {t("title")}
          </h2>
        </div>
        {tripDestinations.length > 0 && (
          <div role="group" aria-label={t("scope")} className="inline-flex rounded-full bg-sky p-1 text-sm font-semibold">
            {[false, true].map((all) => (
              <button
                key={String(all)}
                type="button"
                aria-pressed={everywhere === all}
                onClick={() => setEverywhere(all)}
                className={`min-h-9 rounded-full px-3.5 transition ${everywhere === all ? "bg-lapis text-white" : "text-lapis hover:bg-white"}`}
              >
                {all ? t("everywhere") : t("mine")}
              </button>
            ))}
          </div>
        )}
      </div>
      {tripDestinations.length === 0 && <p className="mt-2 text-sm text-ink-muted">{t("pickHint")}</p>}

      <label className="relative mt-4 block">
        <span className="sr-only">{t("search")}</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="min-h-11 w-full rounded-full border border-field bg-white pl-10 pr-4 text-base focus-visible:border-cobalt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/30"
        />
      </label>

      <Tabs value={tab} onValueChange={(v) => setTab(v as CatalogTab)} className="mt-4">
        <TabsList aria-label={t("tabsLabel")} className="-mx-4 px-4 sm:-mx-6 sm:px-6 [scrollbar-width:thin]">
          {CATALOG_TABS.map((k) => (
            <TabsTrigger key={k} value={k} className="px-3">
              {t(`tabs.${k}`)}
              <span className="ml-1.5 rounded-full bg-sky px-1.5 py-0.5 text-[0.7rem] font-bold text-lapis">{counts[k]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {CATALOG_TABS.map((k) => {
          const list = visible.filter((e) => e.tab === k);
          return (
            <TabsContent key={k} value={k} className="pt-4 focus-visible:outline-none">
              {loading ? (
                <ul className="grid gap-3 xl:grid-cols-2" aria-busy="true">
                  {[0, 1, 2, 3].map((i) => (
                    <li key={i} className="skeleton h-32" />
                  ))}
                </ul>
              ) : error ? (
                <div role="alert" className="rounded-2xl bg-sky/70 p-5 text-ink">
                  <p>{t("error")}</p>
                  <button type="button" onClick={retry} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-lapis px-5 font-bold text-white hover:bg-cobalt">
                    <RotateCw aria-hidden="true" className="size-4" /> {t("retry")}
                  </button>
                </div>
              ) : list.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line bg-sand-soft p-6 text-center">
                  <p className="font-semibold text-lapis">{t("empty")}</p>
                  {scoped && (
                    <button type="button" onClick={() => setEverywhere(true)} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-bold text-lapis ring-1 ring-line hover:bg-sky">
                      {t("showEverywhere")}
                    </button>
                  )}
                </div>
              ) : (
                <ul className="grid gap-3 xl:grid-cols-2">
                  {list.map((e) => {
                    const price = priceLabel(e);
                    const { tab: _tab, summary: _s, href, ...item } = e;
                    return (
                      <li key={e.id} className="flex min-w-0 overflow-hidden rounded-2xl border border-line bg-white">
                        <div className="relative w-24 shrink-0 sm:w-28">
                          <SmartImage src={e.image} alt="" label={e.title} compact sizes="112px" className="absolute inset-0" />
                          <KindIcon kind={e.kind} className="absolute left-2 top-2 size-7 ring-2 ring-white" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
                            {t(`kind.${e.kind}`)}
                            {e.destinationSlug && <> · {destinationName(e.destinationSlug)}</>}
                          </p>
                          <h3 className="text-base font-extrabold leading-snug text-lapis">
                            {href ? (
                              <Link href={href} className="hover:underline">
                                {e.title}
                              </Link>
                            ) : (
                              e.title
                            )}
                          </h3>
                          {e.meta && <p className="line-clamp-1 text-sm text-ink-muted">{e.meta}</p>}
                          {e.summary && <p className="line-clamp-2 text-sm text-ink/80">{e.summary}</p>}
                          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pt-2">
                            {price ? <p className="text-sm font-bold text-saffron-ink">{price}</p> : <span />}
                            <AddToTripButton {...item} size="sm" />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
}
