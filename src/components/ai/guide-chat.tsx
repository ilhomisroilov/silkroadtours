"use client";

import { ArrowUp, BedDouble, Check, Compass, Landmark, MapPin, Plus, RotateCcw, ThumbsDown, ThumbsUp, TrainFront, UtensilsCrossed } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import type { Locale } from "@/db/types";
import { addTripItem, emptyTrip, loadTrip, onTripChange, removeTripItem, type TripItem, type TripItemKind, type TripState } from "@/lib/trip-store";
import { RichText } from "./rich-text";
import { RobotIllustration } from "./robot";

type CardKind = "tour" | "destination" | "hotel" | "restaurant" | "transport" | "attraction";
type Card = { kind: CardKind; slug: string; title: string; url: string; image: string; meta: string; trip?: TripItem & { kind: string } };
type Draft = { slug: string; title: string; url: string; adults: number; children: number; preferredDate?: string } | null;
type Msg = { role: "user" | "assistant"; content: string; cards?: Card[]; draft?: Draft; status?: "ok" | "fallback"; id?: number | null; rated?: 1 | -1 };

const STORE = "nt-ai-guide-chat";
const TRIP_KINDS: TripItemKind[] = ["hotel", "restaurant", "transport", "flight", "train", "transfer", "attraction", "experience", "tour", "activity"];
const KIND_ICON: Record<CardKind, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  tour: Compass,
  destination: MapPin,
  hotel: BedDouble,
  restaurant: UtensilsCrossed,
  transport: TrainFront,
  attraction: Landmark,
};
const GROUPS = ["plan", "stay", "move", "culture", "phrases", "budget", "nearby"] as const;

/** Trip summary for the guide: catalogue items, dates and party size only. */
function tripForGuide(trip: TripState) {
  return {
    title: trip.title.slice(0, 120) || undefined,
    destinations: trip.destinations.filter((d) => /^[a-z0-9-]{1,60}$/.test(d)).slice(0, 12),
    startDate: trip.startDate,
    endDate: trip.endDate,
    adults: trip.adults,
    children: trip.children,
    items: trip.items.slice(0, 40).map((i) => ({ kind: i.kind, title: i.title.slice(0, 140), day: i.day, priceUsd: i.priceUsd, priceUnit: i.priceUnit })),
  };
}

function cardTripItem(c: Card): TripItem | null {
  if (c.trip) {
    const kind = TRIP_KINDS.includes(c.trip.kind as TripItemKind) ? (c.trip.kind as TripItemKind) : "attraction";
    return { ...c.trip, kind };
  }
  if (c.kind === "tour") return { id: `tour:${c.slug}`, kind: "tour", title: c.title, refSlug: c.slug, image: c.image || undefined, meta: c.meta, priceUnit: "person" };
  return null;
}

export function GuideChat({ locale, enabled, initialQuestion }: { locale: Locale; enabled: boolean; initialQuestion?: string }) {
  const t = useTranslations("aiGuide");
  const pathname = usePathname();
  const params = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [trip, setTrip] = useState<TripState>(emptyTrip);
  const [useTrip, setUseTrip] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    setTrip(loadTrip());
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const saved = JSON.parse(raw) as { conversationId?: string; messages?: Msg[] };
        setConsent(true);
        setConversationId(saved.conversationId);
        setMessages(saved.messages ?? []);
      }
    } catch {
      /* storage unavailable */
    }
    return onTripChange(setTrip);
  }, []);

  useEffect(() => {
    try {
      if (consent) localStorage.setItem(STORE, JSON.stringify({ conversationId, messages: messages.slice(-30) }));
      else localStorage.removeItem(STORE);
    } catch {
      /* ignore */
    }
  }, [consent, conversationId, messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      setError(null);
      setBusy(true);
      setInput("");
      setMessages((m) => [...m, { role: "user", content: message }]);
      try {
        const current = loadTrip();
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            conversationId,
            message,
            locale,
            page: pathname,
            consent,
            ...(useTrip && (current.items.length || current.destinations.length) ? { trip: tripForGuide(current) } : {}),
          }),
        });
        if (res.status === 429) throw new Error(t("chat.limited"));
        if (!res.ok) throw new Error(t("chat.error"));
        const { data } = (await res.json()) as { data: { conversationId: string; text: string; cards: Card[]; bookingDraft: Draft | null; status: "ok" | "fallback"; messageId: number | null } };
        setConversationId(data.conversationId);
        setMessages((m) => [...m, { role: "assistant", content: data.text, cards: data.cards, draft: data.bookingDraft, status: data.status, id: data.messageId }]);
      } catch (e) {
        setError((e as Error).message || t("chat.error"));
        setMessages((m) => m.slice(0, -1));
        setInput(message);
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy, consent, conversationId, locale, pathname, t, useTrip],
  );

  // A question passed in the link (e.g. from a virtual tour or destination page) is asked once.
  useEffect(() => {
    const q = (initialQuestion ?? params.get("q") ?? "").trim().slice(0, 500);
    if (q && !asked.current && enabled) {
      asked.current = true;
      void send(q);
    }
  }, [enabled, initialQuestion, params, send]);

  const rate = (index: number, rating: 1 | -1) => {
    const msg = messages[index];
    if (!msg?.id || msg.rated) return;
    setMessages((m) => m.map((x, i) => (i === index ? { ...x, rated: rating } : x)));
    void fetch("/api/ai/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageId: msg.id, rating }) });
  };

  const inTrip = (id: string) => trip.items.some((i) => i.id === id);
  const groups = trip.items.length ? [...GROUPS, "modify" as const] : GROUPS;
  const prompts = (g: (typeof groups)[number]) => (t.raw(`prompts.${g}`) as string[]) ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <section aria-label={t("chat.title")} className="flex min-h-[34rem] flex-col overflow-hidden rounded-[1.5rem] border border-lapis/10 bg-white shadow-card lg:h-[min(48rem,calc(100dvh-8rem))]">
        <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-lapis-deep to-lapis px-4 py-3 text-white sm:px-5">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/95">
            <RobotIllustration className="w-8" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg leading-tight text-white">{t("chat.title")}</h2>
            <p className="truncate text-xs text-white/75">{t("chat.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setConversationId(undefined);
              setError(null);
            }}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/30 px-3 text-sm font-semibold hover:bg-white/10"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            <span className="max-sm:sr-only">{t("chat.newChat")}</span>
          </button>
        </header>

        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto bg-ivory/60 px-4 py-5 text-[0.95rem] leading-relaxed sm:px-6" aria-live="polite">
          <div className="max-w-[46rem] rounded-2xl rounded-tl-sm border border-lapis/10 bg-white px-4 py-3">{t("chat.welcome")}</div>
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 lg:hidden">
              {[...prompts("plan"), ...prompts("stay").slice(0, 1), ...prompts("move").slice(0, 1)].map((s) => (
                <button key={s} type="button" disabled={!enabled} onClick={() => send(s)} className="rounded-full border border-lapis/20 bg-white px-3.5 py-2 text-left text-sm font-semibold text-lapis hover:border-lapis">
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-lapis px-4 py-2.5 text-white">
                {m.content}
              </div>
            ) : (
              <div key={i} className="max-w-[46rem] space-y-3">
                <div className={`rounded-2xl rounded-tl-sm border bg-white px-4 py-3 ${m.status === "fallback" ? "border-saffron/50" : "border-lapis/10"}`}>
                  {m.status === "fallback" && <p className="eyebrow mb-1 text-saffron-ink">{t("chat.fallback")}</p>}
                  <RichText text={m.content} />
                </div>
                {!!m.cards?.length && (
                  <ul className="grid gap-2.5 sm:grid-cols-2">
                    {m.cards.slice(0, 4).map((c) => {
                      const item = cardTripItem(c);
                      const Icon = KIND_ICON[c.kind] ?? Compass;
                      const added = item ? inTrip(item.id) : false;
                      return (
                        <li key={c.kind + c.slug} className="flex gap-3 rounded-2xl border border-lapis/10 bg-white p-2.5">
                          {c.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.image} alt="" width={72} height={72} loading="lazy" className="size-[4.5rem] shrink-0 rounded-xl bg-sand object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
                          ) : (
                            <span className="inline-flex size-[4.5rem] shrink-0 items-center justify-center rounded-xl bg-sky text-cobalt">
                              <Icon aria-hidden={true} className="size-7" />
                            </span>
                          )}
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-saffron-ink">{t(`chat.kind.${c.kind}`)}</span>
                            <a href={c.url} className="line-clamp-2 font-display text-[1rem] leading-snug text-lapis-deep hover:underline">
                              {c.title}
                            </a>
                            {c.meta && <span className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{c.meta}</span>}
                            {item && (
                              <button
                                type="button"
                                onClick={() => (added ? removeTripItem(item.id) : addTripItem(item))}
                                aria-pressed={added}
                                aria-label={`${added ? t("chat.removeFromTrip") : t("chat.addToTrip")}: ${c.title}`}
                                className={`mt-auto inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full px-3 pt-0.5 text-xs font-bold ${added ? "bg-success/10 text-success" : "bg-saffron-soft text-lapis-deep hover:bg-saffron/30"}`}
                              >
                                {added ? <Check aria-hidden="true" className="size-3.5" /> : <Plus aria-hidden="true" className="size-3.5" />}
                                {added ? t("chat.inTrip") : t("chat.addToTrip")}
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {m.draft && (
                  <div className="rounded-2xl border border-saffron/60 bg-white p-4">
                    <p className="font-bold text-lapis-deep">{t("chat.bookTitle")}</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {t("chat.bookBody", { title: m.draft.title, adults: m.draft.adults, children: m.draft.children ? ` + ${m.draft.children}` : "" })}
                    </p>
                    <a href={m.draft.url} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-lapis-deep">
                      {t("chat.bookCta")}
                    </a>
                  </div>
                )}
                {m.id && m.status === "ok" && (
                  <div className="flex gap-1 text-ink-muted">
                    <button type="button" aria-label={t("chat.helpful")} aria-pressed={m.rated === 1} onClick={() => rate(i, 1)} className={`inline-flex size-9 items-center justify-center rounded-xl hover:bg-sand ${m.rated === 1 ? "text-success" : ""}`}>
                      <ThumbsUp aria-hidden="true" className="size-4" />
                    </button>
                    <button type="button" aria-label={t("chat.notHelpful")} aria-pressed={m.rated === -1} onClick={() => rate(i, -1)} className={`inline-flex size-9 items-center justify-center rounded-xl hover:bg-sand ${m.rated === -1 ? "text-danger" : ""}`}>
                      <ThumbsDown aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            ),
          )}
          {busy && (
            <div className="inline-flex gap-1.5 rounded-2xl rounded-tl-sm border border-lapis/10 bg-white px-4 py-3.5" role="status" aria-label={t("chat.typing")}>
              <span className="size-1.5 animate-pulse rounded-full bg-saffron" />
              <span className="size-1.5 animate-pulse rounded-full bg-saffron [animation-delay:150ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-saffron [animation-delay:300ms]" />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-white px-4 py-3 text-sm text-danger" role="alert">
              {error}
              <button type="button" onClick={() => send(input)} className="font-bold underline">
                {t("chat.retry")}
              </button>
            </div>
          )}
        </div>

        <form
          className="border-t border-line bg-white px-4 pb-3 pt-3 sm:px-5"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="flex items-end gap-2">
            <label className="flex-1">
              <span className="sr-only">{t("chat.placeholder")}</span>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={1500}
                disabled={!enabled}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder={t("chat.placeholder")}
                className="block max-h-36 min-h-12 w-full resize-none rounded-2xl border border-field bg-white px-4 py-3 text-[0.95rem]"
              />
            </label>
            <button type="submit" disabled={busy || !input.trim() || !enabled} aria-label={t("chat.send")} className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-lapis text-white hover:bg-lapis-deep disabled:opacity-50">
              <ArrowUp aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-ink-muted">
            <label className="inline-flex min-h-8 items-center gap-2">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="size-4 accent-lapis" />
              {t("chat.consent")}
            </label>
          </div>
          <p className="mt-1 text-[0.72rem] leading-snug text-ink-muted">{t("chat.disclaimer")}</p>
        </form>
      </section>

      <aside className="space-y-5">
        <section className="rounded-[1.5rem] border border-lapis/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-lg text-lapis-deep">{t("trip.title")}</h2>
          {trip.items.length || trip.destinations.length ? (
            <>
              <p className="mt-1 text-sm text-ink-muted">{t("trip.summary", { items: trip.items.length, destinations: trip.destinations.length })}</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {trip.items.slice(0, 5).map((i) => (
                  <li key={i.id} className="flex items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-saffron" aria-hidden="true" />
                    <span className="truncate">{i.title}</span>
                  </li>
                ))}
              </ul>
              <label className="mt-4 flex items-start gap-2.5 text-sm font-semibold text-lapis-deep">
                <input type="checkbox" checked={useTrip} onChange={(e) => setUseTrip(e.target.checked)} className="mt-0.5 size-4 accent-lapis" />
                <span>
                  {t("trip.use")}
                  <span className="mt-0.5 block text-xs font-normal text-ink-muted">{t("trip.useHint")}</span>
                </span>
              </label>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">{t("trip.empty")}</p>
          )}
          <a href={`/${locale}/trip-builder`} className="mt-4 inline-flex min-h-10 items-center rounded-full border border-lapis/25 px-4 text-sm font-bold text-lapis hover:border-lapis">
            {t("trip.open")}
          </a>
        </section>

        <section className="rounded-[1.5rem] border border-lapis/10 bg-white p-5 shadow-card max-lg:hidden">
          <h2 className="font-display text-lg text-lapis-deep">{t("prompts.title")}</h2>
          <div className="mt-3 space-y-4">
            {groups.map((g) => (
              <div key={g}>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-saffron-ink">{t(`prompts.groups.${g}`)}</p>
                <ul className="mt-1.5 space-y-1">
                  {prompts(g).map((s) => (
                    <li key={s}>
                      <button type="button" disabled={busy || !enabled} onClick={() => send(s)} className="w-full rounded-xl px-2.5 py-1.5 text-left text-sm text-ink hover:bg-sky disabled:opacity-60">
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
