"use client";

// shadcn/ui Popover, Select, Tabs and Accordion (Radix), restyled with the Silk Road tokens.
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Check, ChevronDown } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "@/lib/cn";

// ── Popover ────────────────────────────────────────────────────────────────
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverContent = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 8, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn("z-50 rounded-sm border border-line bg-ivory p-3 shadow-lift outline-none", className)}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = "PopoverContent";

// ── Select ─────────────────────────────────────────────────────────────────
export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex min-h-11 items-center justify-between gap-2 rounded-full border border-field bg-white px-4 text-sm font-semibold text-ink data-[placeholder]:text-ink-muted",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown aria-hidden="true" className="size-4 opacity-70" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={6}
      className={cn("z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-sm border border-line bg-ivory p-1 shadow-lift", className)}
      {...props}
    >
      <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex min-h-11 cursor-pointer select-none items-center rounded-sm py-2 pl-9 pr-3 text-sm outline-none data-[highlighted]:bg-sand-soft data-[state=checked]:font-semibold",
      className,
    )}
    {...props}
  >
    <span className="absolute left-3 flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check aria-hidden="true" className="size-4 text-turquoise-ink" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";

// ── Tabs ───────────────────────────────────────────────────────────────────
export const Tabs = TabsPrimitive.Root;
export const TabsList = forwardRef<ElementRef<typeof TabsPrimitive.List>, ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn("flex gap-1 overflow-x-auto border-b border-line", className)}
      {...props}
    />
  ),
);
TabsList.displayName = "TabsList";
export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "-mb-px min-h-11 whitespace-nowrap border-b-2 border-transparent px-4 text-sm font-semibold text-ink-muted hover:text-ink data-[state=active]:border-terracotta data-[state=active]:text-white",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";
export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} className={cn("pt-6", className)} {...props} />);
TabsContent.displayName = "TabsContent";

// ── Accordion ──────────────────────────────────────────────────────────────
// Content is force-mounted (hidden when closed) so the full text is in the HTML for search engines.
export const Accordion = AccordionPrimitive.Root;
export const AccordionItem = forwardRef<
  ElementRef<typeof AccordionPrimitive.Item>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b border-line", className)} {...props} />
));
AccordionItem.displayName = "AccordionItem";
export const AccordionTrigger = forwardRef<
  ElementRef<typeof AccordionPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & { headingLevel?: "h3" | "h4" }
>(({ className, children, headingLevel = "h3", ...props }, ref) => (
  <AccordionPrimitive.Header asChild>
    {headingLevel === "h3" ? (
      <h3 className="font-sans text-base">
        <AccordionPrimitive.Trigger
          ref={ref}
          className={cn(
            "group flex min-h-12 w-full items-center justify-between gap-4 py-4 text-left font-semibold text-ink hover:text-lapis",
            className,
          )}
          {...props}
        >
          {children}
          <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-lapis transition-transform duration-300 group-data-[state=open]:rotate-180" />
        </AccordionPrimitive.Trigger>
      </h3>
    ) : (
      <h4 className="font-sans text-base">
        <AccordionPrimitive.Trigger
          ref={ref}
          className={cn("group flex min-h-12 w-full items-center justify-between gap-4 py-3 text-left font-semibold", className)}
          {...props}
        >
          {children}
          <ChevronDown aria-hidden="true" className="size-5 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </AccordionPrimitive.Trigger>
      </h4>
    )}
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = "AccordionTrigger";
export const AccordionContent = forwardRef<
  ElementRef<typeof AccordionPrimitive.Content>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content ref={ref} forceMount className={cn("pb-5 text-ink data-[state=closed]:hidden", className)} {...props}>
    {children}
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = "AccordionContent";
