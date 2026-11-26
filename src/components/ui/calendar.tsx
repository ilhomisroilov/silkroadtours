"use client";

// shadcn/ui Calendar (react-day-picker v9), restyled with the Silk Road tokens.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { cn } from "@/lib/cn";

export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      className={cn("p-1", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row",
        month: "space-y-3",
        month_caption: "flex h-11 items-center justify-center font-display text-lg font-semibold text-lapis-deep",
        caption_label: "",
        nav: "absolute inset-x-1 top-1 flex justify-between",
        button_previous: "inline-flex size-11 items-center justify-center rounded-full text-lapis hover:bg-sand-soft disabled:opacity-30",
        button_next: "inline-flex size-11 items-center justify-center rounded-full text-lapis hover:bg-sand-soft disabled:opacity-30",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-11 text-center text-xs font-semibold uppercase text-ink-muted",
        week: "mt-1 flex w-full",
        day: "relative size-11 p-0 text-center",
        day_button:
          "inline-flex size-11 items-center justify-center rounded-full text-sm font-semibold text-ink hover:bg-sand-soft aria-selected:bg-lapis aria-selected:text-white disabled:pointer-events-none disabled:font-normal disabled:text-ink-muted/60",
        today: "[&>button]:ring-1 [&>button]:ring-saffron",
        outside: "opacity-40",
        disabled: "",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft aria-hidden="true" className="size-5" /> : <ChevronRight aria-hidden="true" className="size-5" />,
      }}
      {...props}
    />
  );
}
