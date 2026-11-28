"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

type Item = { value: string; label: string; disabled?: boolean; group?: string };

/** Reads <option> / <optgroup> children into a flat list (fragments and arrays included). */
function readItems(children: ReactNode, group?: string, out: Item[] = []): Item[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: unknown; children?: ReactNode; disabled?: boolean; label?: string }>;
    if (el.type === "option") {
      const text = Children.toArray(el.props.children).join("");
      out.push({ value: el.props.value === undefined ? text : String(el.props.value), label: text, disabled: el.props.disabled, group });
    } else if (el.type === "optgroup") {
      readItems(el.props.children, el.props.label, out);
    } else if (el.props?.children) {
      readItems(el.props.children, group, out);
    }
  });
  return out;
}

/** Sets a native select's value the way a user would, so React onChange and react-hook-form both see it. */
function chooseNative(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Drop-in replacement for <select>: the same props and <option> children, a real (hidden) <select> underneath for
 * forms, react-hook-form and no-JS submits, and a glass list that always opens under the field (scrolling inside
 * when long) instead of the operating system's list, which can open over the page header.
 */
export const GlassSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function GlassSelect(
  { className, children, value, defaultValue, onChange, id, title, disabled, style, ...rest },
  ref,
) {
  const select = useRef<HTMLSelectElement>(null);
  useImperativeHandle(ref, () => select.current as HTMLSelectElement);
  const items = readItems(children);
  const controlled = value !== undefined;
  const [own, setOwn] = useState<string>(() => String(defaultValue ?? items[0]?.value ?? ""));
  // A controlled value can lag behind the click (the parent updates the URL first): show the choice at once.
  const [optimistic, setOptimistic] = useState<string | null>(null);
  useEffect(() => setOptimistic(null), [value]);
  // Uncontrolled selects whose defaultValue changes (soft navigation) follow it.
  useEffect(() => {
    if (controlled || defaultValue === undefined) return;
    setOwn(String(defaultValue));
    if (select.current) select.current.value = String(defaultValue);
  }, [controlled, defaultValue]);
  const current = controlled ? (optimistic ?? String(value)) : own;
  const chosen = items.find((i) => i.value === current) ?? items[0];
  const [open, setOpen] = useState(false);
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // Keep the label in step when something else (a form reset, react-hook-form) changes the native select.
  useEffect(() => {
    const el = select.current;
    if (!el || controlled) return;
    const sync = () => setOwn(el.value);
    el.addEventListener("change", sync);
    el.form?.addEventListener("reset", () => setTimeout(sync));
    return () => el.removeEventListener("change", sync);
  }, [controlled]);

  const aria = Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith("aria-")));
  const selectProps = Object.fromEntries(Object.entries(rest).filter(([k]) => !k.startsWith("aria-")));

  const pick = (v: string) => {
    if (select.current) chooseNative(select.current, v);
    if (!controlled) setOwn(v);
    else setOptimistic(v);
    setOpen(false);
    trigger.current?.focus();
  };

  const focusItem = useCallback((index: number) => {
    const opts = list.current?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])');
    if (!opts?.length) return;
    opts[Math.max(0, Math.min(opts.length - 1, index))]?.focus();
  }, []);

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const opts = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])') ?? [])];
    const at = opts.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") focusItem(at + 1);
    else if (e.key === "ArrowUp") focusItem(at - 1);
    else if (e.key === "Home") focusItem(0);
    else if (e.key === "End") focusItem(opts.length - 1);
    else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const k = e.key.toLowerCase();
      const next = opts.findIndex((o, i) => i > at && (o.textContent ?? "").trim().toLowerCase().startsWith(k));
      const first = opts.findIndex((o) => (o.textContent ?? "").trim().toLowerCase().startsWith(k));
      focusItem(next >= 0 ? next : first);
    } else return;
    e.preventDefault();
  };

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  };

  // Make room under the field before opening, so the list never has to cover what is above it.
  const openList = (next: boolean) => {
    if (next && trigger.current) {
      const r = trigger.current.getBoundingClientRect();
      const want = Math.min(320, 44 * items.length + 16) + 16;
      const below = window.innerHeight - r.bottom;
      if (below < want) window.scrollBy({ top: Math.min(want - below, r.top - 80), behavior: "instant" as ScrollBehavior });
    }
    setOpen(next);
  };

  const bare = /\bbg-transparent\b/.test(className ?? "");
  let lastGroup: string | undefined;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={openList}>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          ref={trigger}
          type="button"
          id={id}
          title={title}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onKeyDown={onTriggerKey}
          style={style}
          {...aria}
          className={cn(
            "nt-select relative flex w-full items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60",
            bare ? "" : "min-h-11 rounded-sm border border-field bg-white px-3.5 py-2.5 text-base text-ink",
            className,
            "pr-9",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{chosen?.label ?? ""}</span>
          <ChevronDown aria-hidden="true" className={cn("pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-cobalt transition-transform", open && "rotate-180")} />
        </button>
      </PopoverPrimitive.Trigger>
      <select
        ref={select}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        disabled={disabled}
        {...(controlled ? { value } : { defaultValue })}
        onChange={onChange}
        {...selectProps}
      >
        {children}
      </select>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          avoidCollisions={false}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const opts = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
            (opts.find((o) => o.getAttribute("aria-selected") === "true") ?? opts[0])?.focus({ preventScroll: false });
          }}
          className="nt-select-list z-[60] min-w-[var(--radix-popover-trigger-width)] max-w-[min(92vw,28rem)] outline-none"
        >
          <div
            ref={list}
            id={listId}
            role="listbox"
            aria-label={typeof aria["aria-label"] === "string" ? (aria["aria-label"] as string) : undefined}
            onKeyDown={onListKey}
            className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height,21rem)-0.75rem))] overflow-y-auto overscroll-contain p-1.5"
          >
            {items.map((it) => {
              const head = it.group && it.group !== lastGroup ? it.group : null;
              lastGroup = it.group;
              const on = it.value === current;
              return (
                <div key={`${it.group ?? ""}:${it.value}`}>
                  {head && <p className="px-3 pb-1 pt-2 text-xs font-extrabold uppercase tracking-[0.08em] text-ink-muted">{head}</p>}
                  <div
                    role="option"
                    tabIndex={-1}
                    aria-selected={on}
                    aria-disabled={it.disabled || undefined}
                    onClick={() => !it.disabled && pick(it.value)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !it.disabled) {
                        e.preventDefault();
                        pick(it.value);
                      }
                    }}
                    className={cn(
                      "flex min-h-10 cursor-pointer items-center gap-2 rounded-[0.65rem] px-3 py-2 text-[0.95rem] font-semibold outline-none",
                      on ? "bg-lapis text-white" : "text-ink hover:bg-sand focus-visible:bg-sand",
                      it.disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="min-w-0 flex-1">{it.label}</span>
                    {on && <Check aria-hidden="true" className="size-4 shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
});
