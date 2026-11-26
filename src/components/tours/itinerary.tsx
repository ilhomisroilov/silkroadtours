"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/primitives";

/** Day-by-day timeline. All days are in the HTML; the first is open. */
export function ItineraryAccordion({ days }: { days: { value: string; heading: ReactNode; body: ReactNode }[] }) {
  const t = useTranslations("tour");
  const [open, setOpen] = useState<string[]>(days[0] ? [days[0].value] : []);
  const allOpen = open.length === days.length;
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={() => setOpen(allOpen ? [] : days.map((d) => d.value))} className="inline-flex min-h-11 items-center text-sm font-semibold text-cobalt underline">
          {allOpen ? t("collapseAll") : t("expandAll")}
        </button>
      </div>
      <Accordion type="multiple" value={open} onValueChange={setOpen} className="relative">
        <span aria-hidden="true" className="absolute bottom-6 left-[1.35rem] top-6 w-px bg-gradient-to-b from-saffron via-terracotta/50 to-saffron" />
        {days.map((d) => (
          <AccordionItem key={d.value} value={d.value} className="relative border-0 pl-14">
            <AccordionTrigger>{d.heading}</AccordionTrigger>
            <AccordionContent>{d.body}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
