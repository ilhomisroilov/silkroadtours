import { BadgeCheck, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ImportReviewForm, ReviewActions } from "@/components/admin/review-tools";
import { PageHeader } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { listDestinationsAdmin } from "@/db/queries/destinations";
import { listReviewsAdmin } from "@/db/queries/reviews";
import { listToursAdmin } from "@/db/queries/tours";
import { cn } from "@/lib/cn";
import { localize } from "@/lib/localize";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("reviews.title") };
}

export default async function AdminReviews({ searchParams }: { searchParams: Promise<{ published?: string }> }) {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const published = (await searchParams).published === "true" ? "true" : "false";
  const db = getDb();
  const [list, tours, destinations] = await Promise.all([listReviewsAdmin(db, { published, page: 1, pageSize: 100 }), listToursAdmin(db, {}), listDestinationsAdmin(db)]);
  const tab = (p: string, label: string) => (
    <Link href={`/admin/reviews?published=${p}`} aria-current={published === p ? "page" : undefined} className={cn("inline-flex min-h-11 items-center rounded-full px-4 font-semibold", published === p ? "bg-lapis text-white" : "bg-white text-lapis")}>{label}</Link>
  );
  return (
    <>
      <PageHeader title={t("reviews.title")} actions={<>{tab("false", t("reviews.queue"))}{tab("true", t("reviews.publishedTab"))}</>} />
      <div className="mb-6"><ImportReviewForm tours={tours.map((x) => ({ id: x.id, name: localize(x.title, locale) }))} destinations={destinations.map((d) => ({ id: d.id, name: localize(d.name, locale) }))} /></div>
      {list.items.length === 0 ? (
        <p className="rounded-sm bg-white p-6 text-ink-muted">{t("common.empty")}</p>
      ) : (
        <ul className="space-y-4">
          {list.items.map((r) => (
            <li key={r.id} className="rounded-sm border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} · {r.authorName}{r.authorCountry ? `, ${r.authorCountry}` : ""}</p>
                  <p className="text-sm text-ink-muted">
                    {r.tour?.title ? localize(r.tour.title, locale) : r.destination?.name ? localize(r.destination.name, locale) : "—"} · {r.source}
                    {r.bookingId && ` · ${t("reviews.fromBooking")}`}
                    {r.isVerified && <span className="ml-1 inline-flex items-center gap-1 text-success"><BadgeCheck aria-hidden="true" className="size-4" />{t("reviews.verified")}</span>}
                    {r.sourceUrl && <a href={r.sourceUrl} target="_blank" rel="noopener nofollow" className="ml-2 inline-flex items-center gap-1 text-cobalt underline">{t("reviews.sourceUrl")}<ExternalLink aria-hidden="true" className="size-3" /></a>}
                  </p>
                </div>
                <ReviewActions id={r.id} isPublished={r.isPublished} isVerified={r.isVerified} />
              </div>
              {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
              <p className="mt-1 whitespace-pre-wrap" lang={r.language}>{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
