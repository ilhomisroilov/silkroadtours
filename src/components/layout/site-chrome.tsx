import { Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Currency, Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { messengerLinks } from "@/lib/links";
import { localize } from "@/lib/localize";
import { contactSettings } from "@/lib/server/site";

/** Eight-point khatam star (two overlapping squares): the Caravan Atlas brand mark. */
export function KhatamStar({ size = 28, color = "#a8492a" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth="1.2">
        <rect x="5.5" y="5.5" width="13" height="13" />
        <rect x="5.5" y="5.5" width="13" height="13" transform="rotate(45 12 12)" />
        <circle cx="12" cy="12" r="2.2" />
      </g>
    </svg>
  );
}
import { AudienceToggle, CurrencySwitcher, LanguageSwitcher, MainNavLinks, MobileMenu } from "./switchers";

export function Logo({ name, tone = "light" }: { name: string; tone?: "light" | "dark" }) {
  return (
    <span className="inline-flex items-center gap-3">
      <KhatamStar size={30} color={tone === "dark" ? "#e2be82" : "#a8492a"} />
      <span className={`font-display text-[1.4rem] font-medium leading-none ${tone === "dark" ? "text-ivory" : "text-lapis-deep"}`}>{name}</span>
    </span>
  );
}

export async function SiteHeader({ locale, currency }: { locale: Locale; currency: Currency }) {
  const t = await getTranslations({ locale, namespace: "nav" });
  const tm = await getTranslations({ locale, namespace: "meta" });
  const contact = await contactSettings();
  const items = [
    { href: "/tours", label: t("tours") },
    { href: "/destinations", label: t("destinations") },
    { href: "/planner", label: t("planner") },
    { href: "/services", label: t("services") },
    { href: "/travel-guide", label: t("travelGuide") },
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
  ];
  return (
    <header className="relative z-40">
      <div className="bg-girih-dark on-dark">
        <div className="container-page flex min-h-14 items-center justify-between gap-4 py-1">
          <AudienceToggle />
          <div className="flex items-center gap-1">
            {contact.phone && (
              <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hidden min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-ivory hover:bg-white/10 sm:inline-flex">
                <Phone aria-hidden="true" className="size-4 text-saffron" />
                {contact.phone}
              </a>
            )}
            <LanguageSwitcher tone="dark" />
          </div>
        </div>
      </div>
      <div className="border-b border-lapis-deep/10 bg-ivory/95 backdrop-blur">
        <div className="container-page flex min-h-20 items-center justify-between gap-4">
          <Link href="/" className="shrink-0 rounded-sm" aria-label={`${tm("siteName")} — ${t("home")}`}>
            <Logo name={tm("siteName")} />
          </Link>
          <nav aria-label={t("mainNav")} className="hidden xl:block">
            <MainNavLinks
              items={items}
              className="flex items-center gap-1"
              itemClassName="relative inline-flex min-h-11 items-center whitespace-nowrap px-2.5 text-[0.92rem] font-semibold text-ink hover:text-lapis after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-terracotta after:transition-transform hover:after:scale-x-100"
            />
          </nav>
          <div className="flex items-center gap-2">
            <CurrencySwitcher value={currency} className="hidden sm:inline-flex" />
            <Link
              href="/tours"
              className="hidden min-h-11 items-center rounded-[2px] bg-lapis-deep px-5 text-sm font-bold text-ivory hover:bg-lapis xl:inline-flex"
            >
              {t("bookTour")}
            </Link>
            <MobileMenu items={[{ href: "/", label: t("home") }, ...items]} currency={currency} />
          </div>
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "footer" });
  const tn = await getTranslations({ locale, namespace: "nav" });
  const ts = await getTranslations({ locale, namespace: "services" });
  const tc = await getTranslations({ locale, namespace: "contact" });
  const tm = await getTranslations({ locale, namespace: "meta" });
  const th = await getTranslations({ locale, namespace: "hubs" });
  const contact = await contactSettings();
  const links = messengerLinks(contact);
  const address = localize(contact.address, locale);
  const year = new Date().getFullYear();
  const linkCls = "inline-flex min-h-11 items-center text-sand hover:text-white hover:underline";
  return (
    <footer className="on-dark mt-32 bg-lapis-night text-sand">
      <div className="relative overflow-hidden">
        
        <div className="container-page relative grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo name={tm("siteName")} tone="dark" />
            <p className="mt-4 max-w-sm text-sand">{t("tagline")}</p>
            {contact.licenseNumber && <p className="mt-3 text-sm text-sand">{t("licence", { number: contact.licenseNumber })}</p>}
          </div>
          <nav aria-label={tn("footerNav")} className="grid grid-cols-2 gap-8 lg:col-span-5">
            <div>
              <h2 className="eyebrow text-saffron">{t("explore")}</h2>
              <ul className="mt-3">
                <li><Link className={linkCls} href="/tours">{tn("tours")}</Link></li>
                <li><Link className={linkCls} href="/destinations">{tn("destinations")}</Link></li>
                <li><Link className={linkCls} href="/inbound">{th("inboundTitle")}</Link></li>
                <li><Link className={linkCls} href="/domestic">{th("domesticTitle")}</Link></li>
                <li><Link className={linkCls} href="/travel-guide">{tn("travelGuide")}</Link></li>
              </ul>
            </div>
            <div>
              <h2 className="eyebrow text-saffron">{t("servicesTitle")}</h2>
              <ul className="mt-3">
                <li><Link className={linkCls} href="/services/airport-transfer">{ts("airport-transfer.title")}</Link></li>
                <li><Link className={linkCls} href="/services/tailor-made">{ts("tailor-made.title")}</Link></li>
                <li><Link className={linkCls} href="/services/accommodation">{ts("accommodation.title")}</Link></li>
                <li><Link className={linkCls} href="/services/guides">{ts("guides.title")}</Link></li>
                <li><Link className={linkCls} href="/about">{tn("about")}</Link></li>
                <li><Link className={linkCls} href="/reviews/new">{t("reviewTrip")}</Link></li>
              </ul>
            </div>
          </nav>
          <div className="lg:col-span-3">
            <h2 className="eyebrow text-saffron">{t("contactTitle")}</h2>
            <ul className="mt-3 space-y-1">
              {links.phone && (
                <li><a className={`${linkCls} gap-2`} href={links.phone}><Phone aria-hidden="true" className="size-4" />{contact.phone}</a></li>
              )}
              {contact.email && (
                <li><a className={`${linkCls} gap-2`} href={`mailto:${contact.email}`}><Mail aria-hidden="true" className="size-4" />{contact.email}</a></li>
              )}
              {links.whatsapp && (
                <li><a className={`${linkCls} gap-2`} href={links.whatsapp} rel="noopener" target="_blank"><MessageCircle aria-hidden="true" className="size-4" />{tc("whatsapp")}</a></li>
              )}
              {links.telegram && (
                <li><a className={`${linkCls} gap-2`} href={links.telegram} rel="noopener" target="_blank"><Send aria-hidden="true" className="size-4" />{tc("telegram")}</a></li>
              )}
              {address && (
                <li className="flex items-start gap-2 py-2.5"><MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" /><span>{address}</span></li>
              )}
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-sm text-sand sm:flex-row sm:items-center sm:justify-between">
          <p>{t("rights", { year, name: contact.agencyName || tm("siteName") })}</p>
          <p className="flex items-center gap-3">
            <span>{t("madeIn")}</span>
            <a href="/admin/login" className="inline-flex min-h-11 items-center text-sand hover:text-white hover:underline">{tn("admin")}</a>
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
    <aside aria-label={t("floating")} className="fixed bottom-4 right-4 z-30 flex flex-col gap-2 max-lg:bottom-24">
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
