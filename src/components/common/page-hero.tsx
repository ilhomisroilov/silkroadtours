import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { siteUrl } from "@/lib/server/site";
import type { Locale } from "@/db/types";

/** Light header band used by inner pages: breadcrumbs, eyebrow, title and lead. */
export function PageHero({
  locale,
  crumbs,
  crumbLabel,
  eyebrow,
  title,
  lead,
  children,
}: {
  locale: Locale;
  crumbs: { name: string; href: string }[];
  crumbLabel: string;
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="bg-ai-soft relative overflow-hidden">
      <div className="container-page pb-12 pt-6 sm:pb-14">
        <Breadcrumbs label={crumbLabel} base={`${siteUrl()}/${locale}`} items={crumbs} />
        <div className="animate-fade-up mt-6 max-w-3xl">
          {eyebrow && (
            <p className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.1em] text-cobalt">
              {eyebrow}
              <span aria-hidden="true" className="h-px w-10 bg-cobalt/40" />
            </p>
          )}
          <h1 className="mt-3 text-[clamp(2rem,1.4rem+2.6vw,3.25rem)] leading-[1.08] text-lapis">{title}</h1>
          {lead && <div className="mt-4 max-w-2xl text-lg text-ink/75">{lead}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}
