"use client";

import { CreditCard, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/cn";

/** Payment providers we will take. Online payment is not switched on yet, so picking one explains that. */
const METHODS = [
  { key: "payme", name: "Payme", color: "#33cccc" },
  { key: "click", name: "Click", color: "#0073ff" },
  { key: "uzum", name: "Uzum Bank", color: "#7000ff" },
  { key: "uzcard", name: "Uzcard / Humo", color: "#1f7a4d" },
  { key: "card", name: "Visa / Mastercard", color: "#5b7cfa" },
] as const;

export function PaymentMethods() {
  const t = useTranslations("payments");
  const [picked, setPicked] = useState<string | null>(null);
  const method = METHODS.find((m) => m.key === picked);
  return (
    <section aria-labelledby="pay-title" className="rounded-sm border border-line p-5" data-testid="payment-methods">
      <h3 id="pay-title" className="flex items-center gap-2 text-lg font-semibold">
        <CreditCard aria-hidden="true" className="size-5" /> {t("title")}
      </h3>
      <p className="mt-1 text-sm text-ink-muted">{t("lead")}</p>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {METHODS.map((m) => (
          <li key={m.key} className="min-w-0">
            <button
              type="button"
              aria-pressed={picked === m.key}
              aria-describedby={picked === m.key ? "pay-status" : undefined}
              onClick={() => setPicked(m.key)}
              className={cn(
                "flex min-h-12 w-full items-center gap-2 rounded-sm border px-3 py-2 text-left text-sm font-semibold transition",
                picked === m.key ? "border-saffron bg-saffron/10" : "border-line hover:border-ink-muted",
              )}
              data-testid={`pay-${m.key}`}
            >
              <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: m.color }} />
              <span className="min-w-0 leading-tight">{m.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <div id="pay-status" role="status" aria-live="polite">
        {method && (
          <div className="mt-4 flex gap-3 rounded-sm bg-saffron/10 p-4 text-sm" data-testid="payment-unavailable">
            <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">{t("unavailable", { name: method.name })}</p>
              <p className="mt-1 text-ink-muted">{t("unavailableHint")}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
