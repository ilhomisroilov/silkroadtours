"use client";

import { Check, ChevronDown, Globe, Menu } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition, type ReactNode } from "react";
import { CURRENCIES, LOCALES, type Currency, type Locale } from "@/db/types";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { currencyCookie } from "@/lib/currency";
import { cn } from "@/lib/cn";
import { Dialog, DialogTitle, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/primitives";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", UZS: "soʻm", EUR: "€" };

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

/** Keeps the visitor on the same page (and filters) when changing language; also holds the currency choice. */
export function LanguageSwitcher({ className, tone = "light", currency }: { className?: string; tone?: "light" | "dark"; currency?: Currency }) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [cur, setCur] = useState<Currency | undefined>(currency);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold uppercase",
          tone === "dark" ? "text-ivory hover:bg-white/10" : "text-ink hover:bg-white/70",
          className,
        )}
        aria-label={`${t("chooseLanguage")}: ${locale.toUpperCase()}`}
      >
        <Globe aria-hidden="true" className="size-[1.15rem]" />
        {locale}
        {cur && <span className="hidden text-ink-muted 2xl:inline">· {cur}</span>}
        <ChevronDown aria-hidden="true" className="size-4 opacity-70" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("language")}</p>
        <Suspense fallback={<LocaleLinks query={{}} />}>
          <LocaleLinksWithQuery onNavigate={() => setOpen(false)} />
        </Suspense>
        {cur && (
          <div className="mt-1 border-t border-line px-1 pt-2">
            <p className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("currency")}</p>
            <div className="grid grid-cols-3 gap-1" role="group" aria-label={t("chooseCurrency")}>
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={c === cur}
                  data-testid={`currency-option-${c}`}
                  onClick={() => {
                    setCur(c);
                    document.cookie = currencyCookie(c, location.protocol === "https:");
                    router.refresh();
                    setOpen(false);
                  }}
                  className={cn("min-h-10 rounded-lg text-sm font-semibold", c === cur ? "bg-lapis text-white" : "text-ink hover:bg-sand-soft")}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
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
              className={cn(itemClassName, active && "text-cobalt after:scale-x-100")}
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
  items: { href: string; label: string; children?: { href: string; label: string }[] }[];
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
        <nav aria-label={t("mainNav")} className="overflow-y-auto px-3 py-4">
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.href}>
                <MainNavLinks
                  items={[item]}
                  onNavigate={close}
                  className="flex flex-col"
                  itemClassName="flex min-h-12 items-center rounded-xl px-3 text-lg font-semibold text-ink hover:bg-sand-soft"
                />
                {item.children && item.children.length > 0 && (
                  <MainNavLinks
                    items={item.children}
                    onNavigate={close}
                    className="mb-2 ml-3 flex flex-col border-l border-line pl-2"
                    itemClassName="flex min-h-11 items-center rounded-xl px-3 text-[0.95rem] font-medium text-ink-muted hover:bg-sand-soft hover:text-ink"
                  />
                )}
              </li>
            ))}
          </ul>
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
