"use client";

import { ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type DragEvent } from "react";
import type { LeadStage } from "@/db/types";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/toast";
import { LeadCardBody, LeadValue } from "./lead-card";
import { BOARD_STAGES, STAGE_ACCENT, usd, type CrmLeadCard } from "./shared";
import { useCrmApi } from "./use-crm-api";

const DRAG_TYPE = "application/x-crm-lead";

/**
 * Pipeline board: one column per stage, cards move by drag and drop or with the arrow buttons on
 * each card (keyboard and touch). Moves are optimistic and roll back if the server refuses.
 */
export function KanbanBoard({ leads, today, locale }: { leads: CrmLeadCard[]; today: string; locale: string }) {
  const t = useTranslations("admin.crm");
  const tm = useTranslations("monthsShort");
  const ms = (m: number) => tm(String(m) as never);
  const call = useCrmApi();
  const [items, setItems] = useState(leads);
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<LeadStage | null>(null);
  const [lostOpen, setLostOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const focusAfterMove = useRef<number | null>(null);
  const dragRef = useRef<number | null>(null);

  useEffect(() => setItems(leads), [leads]);
  useEffect(() => {
    if (focusAfterMove.current == null) return;
    const el = document.querySelector<HTMLElement>(`[data-lead-card="${focusAfterMove.current}"]`);
    el?.focus();
    focusAfterMove.current = null;
  });

  const tt = (k: string, v?: Record<string, string | number>) => t(k as never, v as never);

  async function move(id: number, stage: LeadStage, keepFocus = false) {
    const lead = items.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;
    const before = items;
    setItems((cur) => cur.map((l) => (l.id === id ? { ...l, stage } : l)));
    if (keepFocus) focusAfterMove.current = id;
    if (stage === "lost") setLostOpen(true);
    const msg = t("board.moved", { name: lead.fullName, stage: t(`stages.${stage}`) });
    const ok = await call(`/api/admin/leads/${id}`, { method: "PATCH", json: { stage } });
    if (!ok) {
      setItems(before);
      setAnnounce(t("board.moveFailed"));
      return;
    }
    setAnnounce(msg);
    toast({ tone: "success", title: msg });
  }

  const dropProps = (stage: LeadStage) => ({
    onDragOver: (e: DragEvent) => {
      if (dragRef.current == null && !e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== stage) setOver(stage);
    },
    onDragLeave: (e: DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver((s) => (s === stage ? null : s));
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      const id = Number(e.dataTransfer.getData(DRAG_TYPE)) || dragRef.current;
      dragRef.current = null;
      setOver(null);
      setDragId(null);
      if (id) void move(id, stage);
    },
  });

  const card = (lead: CrmLeadCard) => {
    const idx = BOARD_STAGES.indexOf(lead.stage as (typeof BOARD_STAGES)[number]);
    const prev = idx > 0 ? BOARD_STAGES[idx - 1] : null;
    const next = idx >= 0 && idx < BOARD_STAGES.length - 1 ? BOARD_STAGES[idx + 1] : null;
    const arrow = "inline-flex size-9 items-center justify-center rounded-full border border-line text-lapis hover:bg-sand-soft disabled:invisible";
    return (
      <li key={lead.id}>
        <article
          data-lead-card={lead.id}
          tabIndex={-1}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_TYPE, String(lead.id));
            e.dataTransfer.setData("text/plain", lead.fullName);
            e.dataTransfer.effectAllowed = "move";
            dragRef.current = lead.id;
            setDragId(lead.id);
          }}
          onDragEnd={() => {
            dragRef.current = null;
            setDragId(null);
            setOver(null);
          }}
          className={cn(
            "relative cursor-grab rounded-sm border border-line bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
            dragId === lead.id && "opacity-50",
          )}
        >
          <LeadCardBody
            lead={lead}
            today={today}
            locale={locale}
            t={tt}
            ms={ms}
            footer={
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
                {lead.stage === "lost" ? (
                  <>
                    <LeadValue lead={lead} locale={locale} t={tt} />
                    <button type="button" onClick={() => move(lead.id, "new", true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-lapis hover:bg-sand-soft">
                      <RotateCcw aria-hidden="true" className="size-3.5" />
                      {t("board.moveTo", { stage: t("stages.new") })}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" disabled={!prev} onClick={() => prev && move(lead.id, prev, true)} className={arrow} aria-label={prev ? t("board.moveTo", { stage: t(`stages.${prev}`) }) : undefined} title={prev ? t("board.moveTo", { stage: t(`stages.${prev}`) }) : undefined}>
                      <ChevronLeft aria-hidden="true" className="size-4" />
                    </button>
                    <LeadValue lead={lead} locale={locale} t={tt} />
                    <button type="button" disabled={!next} onClick={() => next && move(lead.id, next, true)} className={arrow} aria-label={next ? t("board.moveTo", { stage: t(`stages.${next}`) }) : undefined} title={next ? t("board.moveTo", { stage: t(`stages.${next}`) }) : undefined}>
                      <ChevronRight aria-hidden="true" className="size-4" />
                    </button>
                  </>
                )}
              </div>
            }
          />
        </article>
      </li>
    );
  };

  const lost = items.filter((l) => l.stage === "lost");

  return (
    <div>
      <p className="mb-3 text-sm text-ink-muted">{t("board.hint")}</p>
      <p className="sr-only" aria-live="polite" role="status">{announce}</p>
      <div className="relative -mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0" role="region" aria-label={t("board.label")} tabIndex={0} data-testid="crm-board">
        <ol className="flex snap-x snap-mandatory gap-3 sm:snap-none">
          {BOARD_STAGES.map((stage) => {
            const col = items.filter((l) => l.stage === stage);
            const value = col.reduce((a, l) => a + (l.valueUsd ?? 0), 0);
            return (
              <li key={stage} className="w-[17.5rem] shrink-0 snap-start" data-stage={stage}>
                <section
                  aria-labelledby={`col-${stage}`}
                  {...dropProps(stage)}
                  className={cn("flex h-full min-h-48 flex-col rounded-sm border bg-sand-soft/70 transition-colors", over === stage ? "border-cobalt bg-lapis-mist/60" : "border-line")}
                >
                  <header className="rounded-t-sm border-t-4 bg-white px-3 py-2.5" style={{ borderTopColor: STAGE_ACCENT[stage] }}>
                    <div className="flex items-center justify-between gap-2">
                      <h2 id={`col-${stage}`} className="font-sans text-sm font-bold uppercase tracking-wide text-lapis-deep">{t(`stages.${stage}`)}</h2>
                      <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-bold tabular-nums text-ink" aria-label={t("board.count", { count: col.length })}>{col.length}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink-muted">{usd(value, locale)}</p>
                  </header>
                  <ul className="flex max-h-[68dvh] min-h-32 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2">
                    {col.map(card)}
                    {col.length === 0 && <li className="flex flex-1 items-center justify-center rounded-sm border border-dashed border-field/60 p-4 text-center text-xs text-ink-muted">{t("board.empty")}</li>}
                  </ul>
                </section>
              </li>
            );
          })}
        </ol>
      </div>

      <section
        {...dropProps("lost")}
        aria-labelledby="col-lost"
        className={cn("mt-4 rounded-sm border bg-white shadow-sm transition-colors", over === "lost" ? "border-danger bg-danger/5" : "border-line")}
        data-stage="lost"
      >
        <h2 id="col-lost" className="font-sans text-base">
          <button type="button" onClick={() => setLostOpen((o) => !o)} aria-expanded={lostOpen} aria-controls="crm-lost-list" className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left font-bold text-lapis-deep">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: STAGE_ACCENT.lost }} aria-hidden="true" />
              {t("board.lost")}
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs tabular-nums text-danger">{lost.length}</span>
            </span>
            <ChevronDown aria-hidden="true" className={cn("size-5 transition-transform", lostOpen && "rotate-180")} />
          </button>
        </h2>
        <div id="crm-lost-list" hidden={!lostOpen} className="border-t border-line p-3">
          {lost.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("board.lostEmpty")}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{lost.map(card)}</ul>
          )}
        </div>
      </section>
    </div>
  );
}
