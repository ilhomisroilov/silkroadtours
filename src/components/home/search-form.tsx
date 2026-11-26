import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/db/types";
import { getPathname } from "@/i18n/navigation";
import { NativeSelect } from "@/components/ui/form";

/**
 * Smart search: destination, audience, month, guests → /tours?… (all state in the URL).
 * A plain GET form, so it works before JavaScript loads and costs no client JS.
 */
export async function SearchForm({ locale, destinations }: { locale: Locale; destinations: { slug: string; name: string }[] }) {
  const t = await getTranslations({ locale });
  const label = "mb-1 block text-xs font-bold uppercase tracking-wider text-lapis-deep";
  return (
    <form
      action={getPathname({ locale, href: "/tours" })}
      method="get"
      role="search"
      aria-label={t("home.searchTitle")}
      className="grid gap-3 rounded-[1.5rem] bg-ivory p-4 text-ink shadow-lift sm:grid-cols-2 lg:grid-cols-[1.5fr_1.2fr_1fr_0.6fr_auto] lg:items-end"
    >
      <div>
        <label htmlFor="search-destination" className={label}>{t("home.searchDestination")}</label>
        <NativeSelect id="search-destination" name="destination" defaultValue="">
          <option value="">{t("home.searchAnyDestination")}</option>
          {destinations.map((d) => (
            <option key={d.slug} value={d.slug}>{d.name}</option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <label htmlFor="search-audience" className={label}>{t("home.searchAudience")}</label>
        <NativeSelect id="search-audience" name="audience" defaultValue="">
          <option value="">{t("tours.anyAudience")}</option>
          <option value="inbound">{t("audience.inbound")}</option>
          <option value="domestic">{t("audience.domestic")}</option>
        </NativeSelect>
      </div>
      <div>
        <label htmlFor="search-month" className={label}>{t("home.searchMonth")}</label>
        <NativeSelect id="search-month" name="month" defaultValue="">
          <option value="">{t("home.searchAnyMonth")}</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{t(`months.${i + 1}` as never)}</option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <label htmlFor="search-guests" className={label}>{t("home.searchGuests")}</label>
        <input
          id="search-guests"
          name="guests"
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          placeholder="2"
          className="block min-h-11 w-full rounded-sm border border-field bg-white px-3.5 py-2.5"
        />
      </div>
      <button
        type="submit"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-terracotta px-6 font-semibold text-white hover:bg-terracotta-deep sm:col-span-2 lg:col-span-1"
      >
        <Search aria-hidden="true" className="size-5" />
        {t("home.searchSubmit")}
      </button>
    </form>
  );
}
