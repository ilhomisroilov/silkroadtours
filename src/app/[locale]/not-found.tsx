import { Compass } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { GirihPattern, SuzaniMedallion } from "@/components/ornament";
import type { Locale } from "@/db/types";

export default async function NotFound() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations({ locale, namespace: "notFound" });
  return (
    <section className="relative overflow-hidden bg-sand-soft">
      <GirihPattern className="absolute inset-0" tone="lapis" opacity={0.12} />
      <div className="container-page relative flex flex-col items-center py-24 text-center">
        <SuzaniMedallion size={140} />
        <p className="mt-6 flex items-center gap-2 font-semibold uppercase tracking-widest text-saffron-ink">
          <Compass aria-hidden="true" className="size-4" /> 404
        </p>
        <h1 className="mt-2 text-4xl text-lapis-deep">{t("title")}</h1>
        <p className="mt-4 max-w-lg text-lg text-ink-muted">{t("text")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>{t("home")}</Link>
          <Link href="/tours" className={buttonVariants({ variant: "outline" })}>{t("tours")}</Link>
        </div>
      </div>
    </section>
  );
}
