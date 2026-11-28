"use client";

import { BarChart3, BookOpenCheck, Building2, CalendarCheck2, Cog, FileText, Handshake, HelpCircle, Images, KanbanSquare, LogOut, Mail, Map, MessageSquareQuote, NotebookPen, PanelLeft, Route, Bot, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { ADMIN_LOCALE_COOKIE, type AdminLocale } from "@/i18n/admin";
import { apiFetch } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { GirihRosette } from "@/components/ornament";
import { BRAND } from "@/lib/brand";

const NAV = [
  { href: "/admin", key: "overview", icon: BarChart3 },
  { href: "/admin/crm", key: "crm", icon: KanbanSquare },
  { href: "/admin/customers", key: "customers", icon: Users },
  { href: "/admin/bookings", key: "bookings", icon: CalendarCheck2 },
  { href: "/admin/requests", key: "requests", icon: BookOpenCheck },
  { href: "/admin/trips", key: "trips", icon: NotebookPen },
  { href: "/admin/places", key: "places", icon: Building2 },
  { href: "/admin/tours", key: "tours", icon: Route },
  { href: "/admin/destinations", key: "destinations", icon: Map },
  { href: "/admin/media", key: "media", icon: Images },
  { href: "/admin/partners", key: "partners", icon: Handshake },
  { href: "/admin/content", key: "content", icon: FileText },
  { href: "/admin/ai", key: "ai", icon: Bot },
  { href: "/admin/faq", key: "faq", icon: HelpCircle },
  { href: "/admin/reviews", key: "reviews", icon: MessageSquareQuote },
  { href: "/admin/newsletter", key: "newsletter", icon: Mail },
  { href: "/admin/settings", key: "settings", icon: Cog },
] as const;

export function AdminShell({ user, locale, children }: { user: { name: string; role: string }; locale: AdminLocale; children: ReactNode }) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const setLocale = (l: AdminLocale) => {
    document.cookie = `${ADMIN_LOCALE_COOKIE}=${l}; Path=/admin; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    router.refresh();
  };
  const logout = async () => {
    await apiFetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };
  const nav = (
    <nav aria-label={t("nav.menu")}>
      <ul className="space-y-1">
        {NAV.map(({ href, key, icon: Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-11 items-center gap-3 rounded-sm px-3 font-semibold", active ? "bg-saffron text-ink" : "text-sand hover:bg-white/10 hover:text-white")}
              >
                <Icon aria-hidden="true" className="size-5" />
                {t(`nav.${key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[16rem_1fr]">
      <aside className={cn("on-dark bg-girih-dark fixed inset-y-0 left-0 z-50 flex w-64 flex-col gap-6 overflow-y-auto overscroll-contain p-4 transition-transform lg:static lg:overflow-visible lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <Link href="/admin" className="flex items-center gap-2 px-2 pt-2">
          <GirihRosette size={32} tone="saffron" strokeWidth={2.2} />
          <span className="font-display text-xl font-bold text-ivory">{BRAND.name}</span>
        </Link>
        {nav}
        <div className="mt-auto space-y-3 border-t border-white/15 pt-4 text-sm text-sand">
          <p>{t("nav.signedInAs", { name: user.name })}</p>
          <div className="flex gap-1" role="group" aria-label={t("language")}>
            {(["uz", "en"] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLocale(l)} aria-pressed={locale === l} className={cn("min-h-11 flex-1 rounded-sm font-semibold uppercase", locale === l ? "bg-white/20 text-white" : "hover:bg-white/10")}>
                {l}
              </button>
            ))}
          </div>
          <a href="/en" className="flex min-h-11 items-center rounded-sm px-2 hover:bg-white/10">{t("nav.viewSite")} ↗</a>
          <button type="button" onClick={logout} className="flex min-h-11 w-full items-center gap-2 rounded-sm px-2 font-semibold text-white hover:bg-white/10" data-testid="admin-logout">
            <LogOut aria-hidden="true" className="size-4" /> {t("nav.logout")}
          </button>
        </div>
      </aside>
      {open && <button type="button" aria-label={t("common.cancel")} className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-ivory px-4 py-2 lg:hidden">
          <button type="button" onClick={() => setOpen(true)} className="inline-flex size-11 items-center justify-center rounded-sm hover:bg-sand-soft" aria-label={t("nav.menu")}>
            <PanelLeft aria-hidden="true" className="size-5" />
          </button>
          <span className="font-display text-lg font-bold text-lapis-deep">{t("brand")}</span>
        </div>
        <main id="main" className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
