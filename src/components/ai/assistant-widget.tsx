"use client";

import { ArrowUp, RotateCcw, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/db/types";
import { RichText } from "./rich-text";
import { RobotIllustration } from "./robot";
import { AI_STRINGS } from "./strings";

type Card = { kind: "tour" | "destination"; slug: string; title: string; url: string; image: string; meta: string };
type Draft = { slug: string; title: string; url: string; adults: number; children: number; preferredDate?: string } | null;
type Msg = { role: "user" | "assistant"; content: string; cards?: Card[]; draft?: Draft; status?: "ok" | "fallback"; id?: number | null; rated?: 1 | -1 };

const STORE = "srt-ai-chat";

export function AssistantWidget({ locale, welcome, enabled }: { locale: Locale; welcome: string; enabled: boolean }) {
  const t = AI_STRINGS[locale];
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const sendRef = useRef<(text: string) => void>(() => {});

  // Restore only if the visitor opted in to remembering the chat on this device.
  useEffect(() => {
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
    const openFromEvent = (e: Event) => {
      setOpen(true);
      const d = (e as CustomEvent<{ question?: string; send?: boolean } | undefined>).detail;
      if (!d?.question) return;
      if (d.send) setTimeout(() => sendRef.current(d.question!), 0);
      else setInput(d.question);
    };
    window.addEventListener("srt:open-assistant", openFromEvent);
    return () => window.removeEventListener("srt:open-assistant", openFromEvent);
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

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      setError(null);
      setBusy(true);
      setInput("");
      setMessages((m) => [...m, { role: "user", content: message }]);
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversationId, message, locale, page: pathname, consent }),
        });
        if (res.status === 429) throw new Error(t.limited);
        if (!res.ok) throw new Error(t.error);
        const { data } = (await res.json()) as { data: { conversationId: string; text: string; cards: Card[]; bookingDraft: Draft | null; status: "ok" | "fallback"; messageId: number | null } };
        setConversationId(data.conversationId);
        setMessages((m) => [...m, { role: "assistant", content: data.text, cards: data.cards, draft: data.bookingDraft, status: data.status, id: data.messageId }]);
      } catch (e) {
        setError((e as Error).message || t.error);
        setMessages((m) => m.slice(0, -1));
        setInput(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, consent, conversationId, locale, pathname, t],
  );

  useEffect(() => {
    sendRef.current = (text: string) => void send(text);
  }, [send]);

  const rate = async (index: number, rating: 1 | -1) => {
    const msg = messages[index];
    if (!msg?.id || msg.rated) return;
    setMessages((m) => m.map((x, i) => (i === index ? { ...x, rated: rating } : x)));
    void fetch("/api/ai/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageId: msg.id, rating }) });
  };

  // The launcher steps aside while a form field is focused (it never covers the field, its picker icon or
  // the on-screen keyboard) and shrinks to a round icon once the visitor scrolls, so it covers less content.
  const [typing, setTyping] = useState(false);
  const [compact, setCompact] = useState(false);
  const isHome = /^\/[a-z]{2}\/?$/.test(pathname ?? "");
  useEffect(() => {
    const onScroll = () => setCompact(!isHome || window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);
  useEffect(() => {
    const isField = (el: EventTarget | null) => el instanceof HTMLElement && el.matches("input, textarea, select, [contenteditable=true]");
    const on = (e: FocusEvent) => { if (isField(e.target)) setTyping(true); };
    const off = () => setTimeout(() => setTyping(isField(document.activeElement)), 0);
    document.addEventListener("focusin", on);
    document.addEventListener("focusout", off);
    return () => { document.removeEventListener("focusin", on); document.removeEventListener("focusout", off); };
  }, []);

  if (!enabled || pathname?.startsWith("/admin") || pathname?.endsWith("/ai-guide")) return null;

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          className={`fixed bottom-4 right-4 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-gradient-to-r from-lapis to-cobalt pl-2 pr-2 text-[0.95rem] font-bold text-white shadow-lift transition-all hover:brightness-110 focus-visible:outline-saffron max-lg:bottom-20 ${compact ? "" : "sm:pr-5"} ${typing ? "hidden" : ""}`}
          aria-haspopup="dialog"
          aria-label={t.open}
          title={t.open}
          onMouseEnter={() => setCompact(false)}
          onMouseLeave={() => setCompact(!isHome || window.scrollY > 120)}
        >
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-white/95"><RobotIllustration className="w-8" /></span>
          <span className={compact ? "sr-only" : "max-sm:sr-only"}>{t.open}</span>
        </button>
      )}
      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-label={t.title}
          className="fixed inset-x-0 bottom-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-ivory shadow-lift sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[min(760px,calc(100dvh-2rem))] sm:w-[420px] sm:rounded-[1.5rem] sm:border sm:border-lapis/10"
        >
          <header className="on-dark flex items-center gap-3 bg-gradient-to-r from-lapis to-cobalt px-4 py-3 text-white">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/95"><RobotIllustration className="w-8" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold leading-tight">{t.title}</p>
              <p className="truncate text-xs text-white/80">{t.subtitle}</p>
            </div>
            <button type="button" onClick={() => { setMessages([]); setConversationId(undefined); setError(null); }} className="inline-flex size-10 items-center justify-center rounded-xl border border-ivory/30 hover:bg-white/10" aria-label={t.clear} title={t.clear}>
              <RotateCcw aria-hidden="true" className="size-4" />
            </button>
            <button type="button" onClick={() => { setOpen(false); launcherRef.current?.focus(); }} className="inline-flex size-10 items-center justify-center rounded-xl border border-ivory/30 hover:bg-white/10" aria-label={t.close}>
              <X aria-hidden="true" className="size-5" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[0.95rem] leading-relaxed" aria-live="polite">
            <div className="max-w-[88%] rounded-sm border border-lapis-deep/10 bg-white px-3.5 py-2.5">{welcome}</div>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {[t.s1, t.s2, t.s3, t.s4].map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-lapis-deep/25 bg-white px-3.5 py-2 text-sm font-semibold hover:border-lapis-deep">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-auto max-w-[88%] whitespace-pre-wrap rounded-sm bg-cobalt px-3.5 py-2.5 text-white">{m.content}</div>
              ) : (
                <div key={i} className="max-w-[94%] space-y-2">
                  <div className={`rounded-sm border bg-white px-3.5 py-2 ${m.status === "fallback" ? "border-terracotta/40" : "border-lapis-deep/10"}`}>
                    {m.status === "fallback" && <p className="eyebrow mb-1 text-terracotta-deep">{t.fallback}</p>}
                    <RichText text={m.content} />
                  </div>
                  {!!m.cards?.length && (
                    <ul className="grid gap-2">
                      {m.cards.slice(0, 3).map((c) => (
                        <li key={c.kind + c.slug}>
                          <a href={c.url} className="flex items-center gap-3 rounded-sm border border-lapis-deep/12 bg-sand-soft p-2 hover:border-lapis-deep">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={c.image} alt="" width={56} height={56} loading="lazy" className="size-14 shrink-0 bg-sand object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
                            <span className="min-w-0">
                              <span className="block truncate font-display text-[1rem] text-lapis-deep">{c.title}</span>
                              <span className="block text-xs text-ink-muted">{c.meta}</span>
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.draft && (
                    <div className="rounded-sm border border-turquoise bg-white p-3.5">
                      <p className="font-bold">{t.bookTitle}</p>
                      <p className="mt-1 text-sm text-ink-muted">
                        {t.bookBody
                          .replace("{title}", m.draft.title)
                          .replace("{adults}", String(m.draft.adults))
                          .replace("{children}", m.draft.children ? ` + ${m.draft.children}` : "")}
                      </p>
                      <a href={m.draft.url} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-terracotta px-4 text-sm font-bold text-white hover:bg-terracotta-deep">
                        {t.bookCta}
                      </a>
                    </div>
                  )}
                  {m.id && m.status === "ok" && (
                    <div className="flex gap-1 text-ink-muted">
                      <button type="button" aria-label={t.helpful} aria-pressed={m.rated === 1} onClick={() => rate(i, 1)} className={`inline-flex size-8 items-center justify-center rounded-xl hover:bg-sand ${m.rated === 1 ? "text-turquoise-ink" : ""}`}>
                        <ThumbsUp aria-hidden="true" className="size-4" />
                      </button>
                      <button type="button" aria-label={t.notHelpful} aria-pressed={m.rated === -1} onClick={() => rate(i, -1)} className={`inline-flex size-8 items-center justify-center rounded-xl hover:bg-sand ${m.rated === -1 ? "text-terracotta-deep" : ""}`}>
                        <ThumbsDown aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
              ),
            )}
            {busy && (
              <div className="inline-flex gap-1.5 rounded-sm border border-lapis-deep/10 bg-white px-3.5 py-3" role="status" aria-label={t.typing}>
                <span className="size-1.5 animate-pulse rounded-full bg-turquoise" />
                <span className="size-1.5 animate-pulse rounded-full bg-turquoise [animation-delay:150ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-turquoise [animation-delay:300ms]" />
              </div>
            )}
            {error && (
              <div className="flex items-center justify-between gap-3 rounded-sm border border-danger/30 bg-white px-3.5 py-2.5 text-sm text-danger" role="alert">
                {error}
                <button type="button" onClick={() => send(input)} className="font-bold underline">{t.retry}</button>
              </div>
            )}
          </div>

          <form
            className="border-t border-lapis-deep/12 px-4 pb-3 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <div className="flex items-end gap-2">
              <label className="flex-1">
                <span className="sr-only">{t.placeholder}</span>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  maxLength={1500}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  placeholder={t.placeholder}
                  className="block max-h-32 min-h-12 w-full resize-none rounded-xl border border-field bg-white px-3.5 py-3 text-[0.95rem]"
                />
              </label>
              <button type="submit" disabled={busy || !input.trim()} aria-label={t.send} className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-lapis-deep text-ivory disabled:opacity-50">
                <ArrowUp aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-muted">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="size-4 accent-lapis-deep" />
                {t.consent}
              </label>
              <a href={`/${locale}/planner`} className="font-semibold text-lapis underline">{t.planner}</a>
            </div>
            <p className="mt-1.5 text-[0.7rem] leading-snug text-ink-muted">{t.disclaimer}</p>
          </form>
        </section>
      )}
    </>
  );
}

/** Any button can open the assistant with a pre-filled question. */
export function openAssistant(question?: string, send = false) {
  window.dispatchEvent(new CustomEvent("srt:open-assistant", { detail: question ? { question, send } : undefined }));
}
