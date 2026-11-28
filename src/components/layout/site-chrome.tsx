import { Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Currency, Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { messengerLinks } from "@/lib/links";
import { localize } from "@/lib/localize";
import { contactSettings } from "@/lib/server/site";

import { ArrowRight } from "lucide-react";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { db } from "@/lib/server/site";
import { WishlistLink } from "@/components/common/wishlist";
import { NewsletterForm } from "./newsletter-form";
import { Logo } from "./logo";
import { DesktopNav, HeaderFrame, type NavItem } from "./nav-menu";
import { LanguageSwitcher, MobileMenu } from "./switchers";

export { Logo };

async function navItems(locale: Locale): Promise<NavItem[]> {
  const t = await getTranslations({ locale });
  const dests = await listPublishedDestinations(db()).catch(() => []);
  const local = dests.filter((d) => !d.country).slice(0, 8);
  const abroad = dests.filter((d) => d.country);
  return [
    {
      href: "/destinations",
      label: t("nav.destinations"),
      children: [
        ...local.map((d) => ({ href: `/destinations/${d.slug}`, label: localize(d.name, locale), group: t("nt.menu.uzbekistan") })),
        ...abroad.map((d) => ({ href: `/destinations/${d.slug}`, label: localize(d.name, locale), hint: localize(d.country, locale), group: t("nt.menu.abroad") })),
      ],
      footer: { href: "/destinations", label: t("nt.menu.allDestinations") },
    },
    {
      href: "/virtual-tours",
      label: t("eco.nav.explore"),
      children: [
        { href: "/virtual-tours", label: t("eco.nav.virtualTours"), hint: t("eco.nav.virtualToursHint") },
        { href: "/navigator", label: t("eco.nav.travelMap"), hint: t("eco.nav.travelMapHint") },
        { href: "/experiences", label: t("eco.nav.experiences") },
        { href: "/travel-guide", label: t("eco.nav.travelGuide") },
      ],
    },
    {
      href: "/tours",
      label: t("nav.tours"),
      children: [
        { href: "/tours", label: t("nt.menu.allTours") },
        { href: "/inbound", label: t("nt.menu.inbound") },
        { href: "/domestic", label: t("nt.menu.domestic") },
        { href: "/compare", label: t("nt.menu.compare") },
        { href: "/services", label: t("nt.menu.services") },
      ],
    },
    {
      href: "/trip-builder",
      label: t("eco.nav.plan"),
      children: [
        { href: "/trip-builder", label: t("eco.nav.tripBuilder"), hint: t("eco.nav.tripBuilderHint") },
        { href: "/ai-guide", label: t("eco.nav.aiGuide"), hint: t("eco.nav.aiGuideHint") },
        { href: "/planner", label: t("eco.nav.aiPlanner") },
      ],
    },
    {
      href: "/hotels",
      label: t("eco.nav.stay"),
      children: [
        { href: "/hotels", label: t("eco.nav.hotels"), hint: t("eco.nav.hotelsHint") },
        { href: "/restaurants", label: t("eco.nav.restaurants"), hint: t("eco.nav.restaurantsHint") },
      ],
    },
    { href: "/transport", label: t("eco.nav.transport") },
    { href: "/partners", label: t("eco.nav.partners") },
  ];
}

export async function SiteHeader({ locale, currency }: { locale: Locale; currency: Currency }) {
  const t = await getTranslations({ locale });
  const items = await navItems(locale);
  return (
    <HeaderFrame>
      <div className="container-page flex h-[72px] items-center justify-between gap-3">
        <Link href="/" className="shrink-0 rounded-xl" aria-label={`${t("meta.siteName")}, ${t("nav.home")}`}>
          <Logo />
        </Link>
        <DesktopNav items={items} label={t("nav.mainNav")} />
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher currency={currency} />
          <WishlistLink label={t("nt.menu.wishlist")} className="max-sm:hidden xl:max-2xl:hidden" />
          <Link
            href="/trip-builder"
            className="hidden min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-lapis px-5 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgb(23_61_102/0.8)] transition-colors hover:bg-cobalt sm:inline-flex"
          >
            {t("eco.nav.planTrip")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <MobileMenu
            items={[
              { href: "/", label: t("nav.home") },
              ...items.map((i) => ({ href: i.href, label: i.label, children: i.children })),
              { href: "/about", label: t("eco.nav.about") },
              { href: "/contact", label: t("eco.nav.contact") },
              { href: "/wishlist", label: t("nt.menu.wishlist") },
            ]}
            currency={currency}
          />
        </div>
      </div>
    </HeaderFrame>
  );
}

export async function SiteFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale });
  const contact = await contactSettings();
  const links = messengerLinks(contact);
  const address = localize(contact.address, locale);
  const year = new Date().getFullYear();
  const linkCls = "inline-flex min-h-10 items-center text-[0.95rem] text-white/75 transition-colors hover:text-white";
  const col = (title: string, items: { href: string; label: string }[]) => (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-saffron">{title}</h2>
      <ul className="mt-3">
        {items.map((i) => (
          <li key={i.href}>
            <Link className={linkCls} href={i.href}>{i.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
  const social = [
    links.telegram && { href: links.telegram, label: "Telegram", icon: Send },
    links.whatsapp && { href: links.whatsapp, label: "WhatsApp", icon: MessageCircle },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Send }[];
  return (
    <footer className="on-dark mt-24 bg-girih-dark text-white">
      <div className="container-page grid gap-10 py-14 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <Logo tone="dark" />
          <p className="mt-4 max-w-sm text-white/75">{t("nt.footer.tagline")}</p>
          {contact.licenseNumber && <p className="mt-3 text-sm text-white/70">{t("footer.licence", { number: contact.licenseNumber })}</p>}
          {social.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-white/80">{t("nt.footer.follow")}</p>
              <ul className="mt-2 flex gap-2">
                {social.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} target="_blank" rel="noopener" aria-label={s.label} className="inline-flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                      <s.icon aria-hidden="true" className="size-5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <nav aria-label={t("nav.footerNav")} className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-6">
          {col(t("nt.footer.tours"), [
            { href: "/tours", label: t("nt.menu.allTours") },
            { href: "/inbound", label: t("hubs.inboundTitle") },
            { href: "/domestic", label: t("hubs.domesticTitle") },
            { href: "/experiences", label: t("nt.menu.experiences") },
            { href: "/virtual-tours", label: t("eco.nav.virtualTours") },
            { href: "/destinations", label: t("nav.destinations") },
          ])}
          {col(t("eco.nav.plan"), [
            { href: "/trip-builder", label: t("eco.nav.tripBuilder") },
            { href: "/ai-guide", label: t("eco.nav.aiGuide") },
            { href: "/hotels", label: t("eco.nav.hotels") },
            { href: "/restaurants", label: t("eco.nav.restaurants") },
            { href: "/transport", label: t("eco.nav.flightsTrains") },
            { href: "/navigator", label: t("eco.nav.travelMap") },
          ])}
          {col(t("nt.footer.company"), [
            { href: "/about", label: t("nav.about") },
            { href: "/partners", label: t("eco.nav.partners") },
            { href: "/travel-guide", label: t("nt.menu.guide") },
            { href: "/services", label: t("nt.menu.services") },
            { href: "/contact", label: t("nav.contact") },
          ])}
          {col(t("nt.footer.support"), [
            { href: "/faq", label: t("nt.footer.faq") },
            { href: "/reviews/new", label: t("footer.reviewTrip") },
            { href: "/wishlist", label: t("nt.menu.wishlist") },
            { href: "/terms", label: t("nt.footer.terms") },
            { href: "/privacy", label: t("nt.footer.privacy") },
          ])}
        </nav>
        <div className="lg:col-span-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-saffron">{t("nt.footer.newsletterTitle")}</h2>
          <p className="mt-3 text-sm text-white/75">{t("nt.footer.newsletterText")}</p>
          <NewsletterForm
            locale={locale}
            labels={{ email: t("nt.footer.email"), subscribe: t("nt.footer.subscribe"), done: t("nt.footer.subscribed"), error: t("nt.footer.subscribeError") }}
          />
          <ul className="mt-6 space-y-1">
            {links.phone && (
              <li><a className={`${linkCls} gap-2`} href={links.phone}><Phone aria-hidden="true" className="size-4" />{contact.phone}</a></li>
            )}
            {contact.email && (
              <li><a className={`${linkCls} gap-2`} href={`mailto:${contact.email}`}><Mail aria-hidden="true" className="size-4" />{contact.email}</a></li>
            )}
            {address && (
              <li className="flex items-start gap-2 py-2 text-[0.95rem] text-white/75"><MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" /><span>{address}</span></li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 pt-5 pb-40 text-sm text-white/65 sm:flex-row sm:items-center sm:justify-between lg:pb-5 lg:pr-24">
          <p>{t("footer.rights", { year, name: contact.agencyName || t("meta.siteName") })}</p>
          <p className="flex flex-wrap items-center gap-x-4">
            <Link href="/privacy" className="inline-flex min-h-10 items-center hover:text-white">{t("nt.footer.privacy")}</Link>
            <Link href="/terms" className="inline-flex min-h-10 items-center hover:text-white">{t("nt.footer.terms")}</Link>
            <a href="/admin/login" className="inline-flex min-h-10 items-center hover:text-white">{t("nav.admin")}</a>
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Floating WhatsApp/Telegram buttons. Hidden entirely until the agency sets a number or username. */
export async function FloatingContact({ locale }: { locale: Locale }) {
  const contact = await contactSettings();
  const links = messengerLinks(contact);
  if (!links.whatsapp && !links.telegram) return null;
  const t = await getTranslations({ locale, namespace: "contact" });
  return (
    <aside aria-label={t("floating")} className="fixed bottom-[5.5rem] right-4 z-30 flex flex-col gap-2 max-lg:bottom-[9.5rem]">
      {links.whatsapp && (
        <a href={links.whatsapp} target="_blank" rel="noopener" className="inline-flex size-14 items-center justify-center rounded-full bg-success text-white shadow-lift hover:scale-105 focus-visible:scale-105">
          <MessageCircle aria-hidden="true" className="size-6" />
          <span className="sr-only">{t("whatsapp")}</span>
        </a>
      )}
      {links.telegram && (
        <a href={links.telegram} target="_blank" rel="noopener" className="inline-flex size-14 items-center justify-center rounded-full bg-cobalt text-white shadow-lift hover:scale-105 focus-visible:scale-105">
          <Send aria-hidden="true" className="size-6" />
          <span className="sr-only">{t("telegram")}</span>
        </a>
      )}
    </aside>
  );
}
