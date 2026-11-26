"use client";

import { Check, Globe, Menu } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition, type ReactNode } from "react";
import { CURRENCIES, LOCALES, type Currency, type Locale } from "@/db/types";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { currencyCookie } from "@/lib/currency";
import { cn } from "@/lib/cn";
import { Dialog, DialogTitle, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/primitives";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", UZS: "so'm", EUR: "€" };

function useQueryObject(): Record<string, string> {
  const params = useSearchParams();
  const out: Record<string, string> = {};
  params?.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function LocaleLinks({ onNavigate, query }: { onNavigate?: () => void; query: Record<string, string> }) {
  const t = useTranslations("languages");
  const pathname = usePathname();
  const current = useLocale();
  return (
    <ul className="flex flex-col gap-1">
      {LOCALES.map((l) => (
        <li key={l}>
          <Link
            href={{ pathname, query }}
            locale={l}
            hrefLang={l}
            lang={l}
            aria-current={l === current ? "true" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center justify-between gap-6 rounded-sm px-3 text-sm font-semibold hover:bg-sand-soft",
              l === current ? "text-lapis-deep" : "text-ink",
            )}
          >
            {t(l)}
            {l === current && <Check aria-hidden="true" className="size-4 text-turquoise-ink" />}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function LocaleLinksWithQuery(props: { onNavigate?: () => void }) {
  const query = useQueryObject();
  return <LocaleLinks {...props} query={query} />;
}

/** Keeps the visitor on the same page (and filters) when changing language. */
export function LanguageSwitcher({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold uppercase",
          tone === "dark" ? "text-ivory hover:bg-white/10" : "text-lapis-deep hover:bg-sand-soft",
          className,
        )}
        aria-label={`${t("chooseLanguage")}: ${locale.toUpperCase()}`}
      >
        <Globe aria-hidden="true" className="size-4" />
        {locale}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-2">
        <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("language")}</p>
        <Suspense fallback={<LocaleLinks query={{}} />}>
          <LocaleLinksWithQuery onNavigate={() => setOpen(false)} />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}

/** Stores the choice in the CURRENCY cookie and re-renders server prices. */
export function CurrencySwitcher({ value, className, onChanged }: { value: Currency; className?: string; onChanged?: () => void }) {
  const t = useTranslations("nav");
  const tc = useTranslations("currency");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState<Currency>(value);
  return (
    <Select
      value={current}
      onValueChange={(v) => {
        const c = v as Currency;
        setCurrent(c);
        document.cookie = currencyCookie(c, location.protocol === "https:");
        startTransition(() => router.refresh());
        onChanged?.();
      }}
    >
      <SelectTrigger
        aria-label={`${t("chooseCurrency")}: ${current}`}
        data-testid="currency-switcher"
        className={cn("min-w-[6.5rem]", pending && "opacity-70", className)}
      >
        <SelectValue>
          <span>{current}</span> <span className="text-ink-muted">{CURRENCY_SYMBOL[current] !== current ? CURRENCY_SYMBOL[current] : ""}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {CURRENCIES.map((c) => (
          <SelectItem key={c} value={c} data-testid={`currency-option-${c}`}>
            {c} · {tc(c)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MainNavLinks({
  items,
  className,
  itemClassName,
  onNavigate,
}: {
  items: { href: string; label: string }[];
  className?: string;
  itemClassName?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <ul className={className}>
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(itemClassName, active && "text-terracotta-deep after:scale-x-100")}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AudienceToggle({ className, tone = "dark", onNavigate }: { className?: string; tone?: "dark" | "light"; onNavigate?: () => void }) {
  const t = useTranslations("audience");
  const pathname = usePathname();
  const items = [
    { href: "/inbound", label: t("inboundShort"), long: t("inbound") },
    { href: "/domestic", label: t("domesticShort"), long: t("domestic") },
  ];
  return (
    <nav aria-label={t("label")} className={className}>
      <ul className={cn("inline-flex rounded-full p-1", tone === "dark" ? "bg-white/10" : "bg-sand-soft")}>
        {items.map((i) => {
          const active = pathname.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                title={i.long}
                onClick={onNavigate}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors",
                  tone === "dark"
                    ? active
                      ? "bg-saffron text-ink"
                      : "text-ivory hover:bg-white/10"
                    : active
                      ? "bg-lapis text-white"
                      : "text-lapis-deep hover:bg-sand",
                )}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileMenu({
  items,
  currency,
  footer,
}: {
  items: { href: string; label: string }[];
  currency: Currency;
  footer?: ReactNode;
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex size-11 items-center justify-center rounded-full text-lapis-deep hover:bg-sand-soft xl:hidden" aria-label={t("openMenu")}>
        <Menu aria-hidden="true" className="size-6" />
      </DialogTrigger>
      <SheetContent closeLabel={t("closeMenu")} side="right" aria-describedby={undefined}>
        <div className="bg-girih-dark px-5 pb-6 pt-5 text-ivory">
          <DialogTitle className="text-ivory">{t("menu")}</DialogTitle>
          <AudienceToggle className="mt-4" onNavigate={close} />
        </div>
        <nav aria-label={t("mainNav")} className="px-3 py-4">
          <MainNavLinks
            items={items}
            onNavigate={close}
            className="flex flex-col"
            itemClassName="flex min-h-12 items-center rounded-sm px-3 text-lg font-semibold text-ink hover:bg-sand-soft"
          />
        </nav>
        <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
          <span className="text-sm font-semibold text-ink-muted">{t("currency")}</span>
          <CurrencySwitcher value={currency} onChanged={close} />
        </div>
        <div className="border-t border-line px-3 py-3">
          <p className="px-3 text-sm font-semibold text-ink-muted">{t("language")}</p>
          <Suspense fallback={<LocaleLinks query={{}} />}>
            <LocaleLinksWithQuery onNavigate={close} />
          </Suspense>
        </div>
        {footer}
      </SheetContent>
    </Dialog>
  );
}
