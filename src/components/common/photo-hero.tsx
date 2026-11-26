import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { SmartImage } from "@/components/common/smart-image";
import type { Locale } from "@/db/types";
import { siteUrl } from "@/lib/server/site";

/** Full-bleed photo header for hub pages: breadcrumbs, eyebrow, title, lead and actions over a darkened image. */
export function PhotoHero({
  locale,
  image,
  crumbs,
  crumbLabel,
  eyebrow,
  title,
  lead,
  children,
}: {
  locale: Locale;
  image: string;
  crumbs: { name: string; href: string }[];
  crumbLabel: string;
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-lapis-deep text-white">
      <div className="absolute inset-0 -z-10">
        <SmartImage src={image} alt="" label={title} priority sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-r from-lapis-deep/90 via-lapis-deep/60 to-lapis-deep/10" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-lapis-deep/70 to-transparent" />
      </div>
      <div className="container-page flex min-h-[24rem] flex-col py-8 lg:min-h-[30rem] lg:py-12">
        <Breadcrumbs tone="dark" label={crumbLabel} base={`${siteUrl()}/${locale}`} items={crumbs} />
        <div className="mt-auto max-w-2xl pt-12">
          {eyebrow && <p className="text-sm font-bold uppercase tracking-[0.12em] text-saffron">{eyebrow}</p>}
          <h1 className="mt-2 text-[clamp(2.4rem,1.6rem+3vw,4rem)] leading-[1.05] text-white">{title}</h1>
          {lead && <div className="mt-4 text-lg text-white/85">{lead}</div>}
          {children}
        </div>
      </div>
    </section>
  );
}
