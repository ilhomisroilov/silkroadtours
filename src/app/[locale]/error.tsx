"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GirihRosette } from "@/components/ornament";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="container-page flex flex-col items-center py-24 text-center">
      <GirihRosette size={72} tone="pomegranate" />
      <h1 className="mt-6 text-4xl text-lapis-deep">{t("title")}</h1>
      <p className="mt-4 max-w-lg text-lg text-ink-muted">{t("text")}</p>
      <Button className="mt-8" variant="secondary" onClick={reset}>
        {t("retry")}
      </Button>
    </section>
  );
}
