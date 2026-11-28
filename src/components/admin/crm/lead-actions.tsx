"use client";

import { Check, Mail, NotebookPen, PhoneCall, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { LEAD_STAGES, LOCALES, type LeadStage } from "@/db/types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input, PlainSelect, Textarea } from "@/components/ui/form";
import { BOARD_STAGES, STAGE_ACCENT } from "./shared";
import { useCrmApi } from "./use-crm-api";

/** Clickable pipeline: the current stage is highlighted, every other stage is one click away. */
export function StageStepper({ id, stage, name }: { id: number; stage: LeadStage; name: string }) {
  const t = useTranslations("admin.crm");
  const call = useCrmApi();
  const [busy, setBusy] = useState<LeadStage | null>(null);
  const current = BOARD_STAGES.indexOf(stage as (typeof BOARD_STAGES)[number]);
  const go = async (to: LeadStage) => {
    if (to === stage || busy) return;
    setBusy(to);
    await call(`/api/admin/leads/${id}`, { method: "PATCH", json: { stage: to } }, t("board.moved", { name, stage: t(`stages.${to}`) }));
    setBusy(null);
  };
  return (
    <div>
      <ol className="flex flex-wrap gap-2" aria-label={t("detail.changeStage")}>
        {BOARD_STAGES.map((s, i) => {
          const done = stage !== "lost" && i < current;
          const active = s === stage;
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => go(s)}
                aria-pressed={active}
                aria-current={active ? "step" : undefined}
                disabled={busy !== null}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full border py-1 pl-1.5 pr-3.5 text-left text-sm font-semibold transition-colors disabled:opacity-70",
                  active ? "border-lapis-deep bg-lapis-deep text-ivory" : done ? "border-lapis/30 bg-lapis-mist text-lapis-deep hover:bg-lapis-mist/70" : "border-line bg-white text-ink hover:bg-sand-soft",
                )}
                data-testid={`stage-${s}`}
              >
                <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold", active ? "bg-saffron text-ink" : done ? "bg-lapis text-white" : "border border-field text-ink-muted")} aria-hidden="true">
                  {done ? <Check className="size-3" /> : i + 1}
                </span>
                <span className="leading-tight">{t(`stages.${s}`)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => go(stage === "lost" ? "new" : "lost")}
          disabled={busy !== null}
          aria-pressed={stage === "lost"}
          className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold", stage === "lost" ? "border-danger bg-danger text-white" : "border-danger/40 text-danger hover:bg-danger/5")}
          data-testid="stage-lost"
        >
          <span className="size-2.5 rounded-full" style={{ background: stage === "lost" ? "#fff" : STAGE_ACCENT.lost }} aria-hidden="true" />
          {stage === "lost" ? t("board.moveTo", { stage: t("stages.new") }) : t("board.moveTo", { stage: t("stages.lost") })}
        </button>
      </div>
    </div>
  );
}

export function AssignFollowUp({ id, assignedTo, followUpAt, admins }: { id: number; assignedTo: number | null; followUpAt: string | null; admins: { id: number; name: string }[] }) {
  const t = useTranslations("admin.crm");
  const tc = useTranslations("admin.common");
  const call = useCrmApi();
  const [manager, setManager] = useState(assignedTo ? String(assignedTo) : "");
  const [date, setDate] = useState(followUpAt ?? "");
  const [busy, setBusy] = useState(false);
  const patch = async (json: Record<string, unknown>) => {
    setBusy(true);
    const ok = await call(`/api/admin/leads/${id}`, { method: "PATCH", json }, tc("saved"));
    setBusy(false);
    return ok;
  };
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="lead-manager" className="mb-1.5 block text-sm font-semibold">{t("detail.manager")}</label>
        <PlainSelect
          id="lead-manager"
          value={manager}
          disabled={busy}
          onChange={async (e) => {
            const prev = manager;
            setManager(e.target.value);
            if (!(await patch({ assignedTo: e.target.value ? Number(e.target.value) : null }))) setManager(prev);
          }}
          data-testid="lead-manager"
        >
          <option value="">{t("detail.unassigned")}</option>
          {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </PlainSelect>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await patch({ followUpAt: date || null });
        }}
      >
        <label htmlFor="lead-followup" className="mb-1.5 block text-sm font-semibold">{t("detail.followUp")}</label>
        <Input id="lead-followup" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="lead-followup" />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="submit" size="sm" variant="secondary" disabled={busy || date === (followUpAt ?? "")} data-testid="lead-followup-save">{tc("save")}</Button>
          {followUpAt && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setDate("");
                await patch({ followUpAt: null });
              }}
            >
              <X aria-hidden="true" /> {t("detail.clearFollowUp")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

const KINDS = [
  { kind: "note", icon: NotebookPen, label: "quick.addNote" },
  { kind: "call", icon: PhoneCall, label: "quick.logCall" },
  { kind: "email", icon: Mail, label: "quick.logEmail" },
] as const;

export function ActivityComposer({ id, initialKind = "note" }: { id: number; initialKind?: "note" | "call" | "email" }) {
  const t = useTranslations("admin.crm");
  const call = useCrmApi();
  const uid = useId();
  const [kind, setKind] = useState<"note" | "call" | "email">(initialKind);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      id="log-activity"
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        const ok = await call(`/api/admin/leads/${id}/activities`, { method: "POST", json: { kind, text } }, t("quick.logged"));
        setBusy(false);
        if (ok) setText("");
      }}
    >
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">{t("quick.kind")}</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(({ kind: k, icon: Icon, label }) => (
            <label key={k} className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cobalt", kind === k ? "border-lapis-deep bg-lapis-deep text-ivory" : "border-line bg-white hover:bg-sand-soft")}>
              <input type="radio" name={`${uid}-kind`} value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" data-testid={`activity-kind-${k}`} />
              <Icon aria-hidden="true" className="size-4" /> {t(label)}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`${uid}-text`} className="sr-only">{t("quick.log")}</label>
      <Textarea id={`${uid}-text`} value={text} onChange={(e) => setText(e.target.value)} placeholder={t(`quick.placeholder_${kind}`)} maxLength={4000} required className="min-h-24" data-testid="activity-text" />
      <Button type="submit" variant="secondary" disabled={busy || !text.trim()} data-testid="activity-submit">{t("quick.submit")}</Button>
    </form>
  );
}

export interface LeadFormValues {
  fullName: string;
  email: string;
  phone: string;
  locale: string;
  title: string;
  destination: string;
  interests: string;
  budgetUsd: string;
  travelFrom: string;
  travelTo: string;
  travellers: string;
  valueUsd: string;
}

const num = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));

/** Create (with stage, manager, follow-up and a first note) or edit the descriptive fields of a lead. */
export function LeadForm({ mode, leadId, initial, admins, destinations, defaultAssignee, onDone }: { mode: "create" | "edit"; leadId?: number; initial: LeadFormValues; admins?: { id: number; name: string }[]; destinations?: string[]; defaultAssignee?: number; onDone?: () => void }) {
  const t = useTranslations("admin.crm");
  const tc = useTranslations("admin.common");
  const call = useCrmApi();
  const router = useRouter();
  const uid = useId();
  const [v, setV] = useState(initial);
  const [extra, setExtra] = useState({ stage: "new" as LeadStage, assignedTo: defaultAssignee ? String(defaultAssignee) : "", followUpAt: "", note: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof LeadFormValues) => (e: { target: { value: string } }) => setV((cur) => ({ ...cur, [k]: e.target.value }));
  const f = (k: string) => `${uid}-${k}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      fullName: v.fullName,
      email: v.email,
      phone: v.phone,
      locale: v.locale,
      title: v.title,
      destination: v.destination,
      interests: v.interests,
      budgetUsd: num(v.budgetUsd),
      travelFrom: v.travelFrom,
      travelTo: v.travelTo,
      travellers: num(v.travellers),
      valueUsd: num(v.valueUsd),
    };
    setBusy(true);
    if (mode === "create") {
      const created = await call<{ id: number }>(
        "/api/admin/leads",
        { method: "POST", json: { ...body, stage: extra.stage, assignedTo: extra.assignedTo ? Number(extra.assignedTo) : null, followUpAt: extra.followUpAt, note: extra.note || undefined } },
        t("create.created"),
        { refresh: false },
      );
      setBusy(false);
      if (created) router.push(`/admin/crm/${created.id}`);
      return;
    }
    const ok = await call(`/api/admin/leads/${leadId}`, { method: "PATCH", json: body }, tc("saved"));
    setBusy(false);
    if (ok) onDone?.();
  };

  const field = (k: keyof LeadFormValues, label: string, props: Record<string, unknown> = {}, span = false) => (
    <div className={span ? "sm:col-span-2" : undefined}>
      <label htmlFor={f(k)} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <Input id={f(k)} value={v[k]} onChange={set(k)} {...props} />
    </div>
  );

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" data-testid={`lead-form-${mode}`}>
      {field("fullName", t("detail.name"), { required: true, minLength: 2, maxLength: 120, autoComplete: "off" })}
      {field("email", t("detail.email"), { type: "email", required: true, maxLength: 200, autoComplete: "off" })}
      {field("phone", t("detail.phone"), { type: "tel", maxLength: 40, inputMode: "tel", placeholder: "+998 90 123 45 67" })}
      <div>
        <label htmlFor={f("locale")} className="mb-1.5 block text-sm font-semibold">{t("detail.locale")}</label>
        <PlainSelect id={f("locale")} value={v.locale} onChange={set("locale")}>
          {LOCALES.map((l) => <option key={l} value={l}>{t(`locales.${l}`)}</option>)}
        </PlainSelect>
      </div>
      {field("title", t("detail.title"), { required: true, minLength: 2, maxLength: 200 }, true)}
      {field("destination", t("detail.destination"), { maxLength: 120, list: destinations?.length ? f("dest-list") : undefined })}
      {destinations?.length ? (
        <datalist id={f("dest-list")}>{destinations.map((d) => <option key={d} value={d} />)}</datalist>
      ) : null}
      {field("travellers", t("detail.travellers"), { type: "number", min: 1, max: 500, inputMode: "numeric" })}
      {field("travelFrom", t("detail.travelFrom"), { type: "date" })}
      {field("travelTo", t("detail.travelTo"), { type: "date", min: v.travelFrom || undefined })}
      {field("budgetUsd", t("detail.budget"), { type: "number", min: 0, max: 10000000, inputMode: "numeric" })}
      <div>
        <label htmlFor={f("valueUsd")} className="mb-1.5 block text-sm font-semibold">{t("detail.value")}</label>
        <Input id={f("valueUsd")} type="number" min={0} max={10000000} inputMode="numeric" value={v.valueUsd} onChange={set("valueUsd")} aria-describedby={f("valueHint")} />
        <p id={f("valueHint")} className="mt-1 text-xs text-ink-muted">{t("detail.valueHint")}</p>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={f("interests")} className="mb-1.5 block text-sm font-semibold">{t("detail.interests")}</label>
        <Textarea id={f("interests")} value={v.interests} onChange={set("interests")} maxLength={1000} className="min-h-20" />
      </div>
      {mode === "create" && (
        <>
          <div>
            <label htmlFor={f("stage")} className="mb-1.5 block text-sm font-semibold">{t("detail.stage")}</label>
            <PlainSelect id={f("stage")} value={extra.stage} onChange={(e) => setExtra((x) => ({ ...x, stage: e.target.value as LeadStage }))}>
              {LEAD_STAGES.map((s) => <option key={s} value={s}>{t(`stages.${s}`)}</option>)}
            </PlainSelect>
          </div>
          <div>
            <label htmlFor={f("assigned")} className="mb-1.5 block text-sm font-semibold">{t("detail.manager")}</label>
            <PlainSelect id={f("assigned")} value={extra.assignedTo} onChange={(e) => setExtra((x) => ({ ...x, assignedTo: e.target.value }))}>
              <option value="">{t("detail.unassigned")}</option>
              {admins?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </PlainSelect>
          </div>
          <div>
            <label htmlFor={f("follow")} className="mb-1.5 block text-sm font-semibold">{t("detail.followUp")}</label>
            <Input id={f("follow")} type="date" value={extra.followUpAt} onChange={(e) => setExtra((x) => ({ ...x, followUpAt: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={f("note")} className="mb-1.5 block text-sm font-semibold">{t("create.note")}</label>
            <Textarea id={f("note")} value={extra.note} onChange={(e) => setExtra((x) => ({ ...x, note: e.target.value }))} maxLength={4000} className="min-h-20" placeholder={t("quick.placeholder_note")} />
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy} data-testid="lead-form-submit">{mode === "create" ? t("create.submit") : t("detail.saveDetails")}</Button>
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            <X aria-hidden="true" /> {tc("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}

/** Read view of the deal fields with an "Edit details" toggle that swaps in <LeadForm>. */
export function LeadDetailsEditor({ leadId, initial, destinations, children }: { leadId: number; initial: LeadFormValues; destinations: string[]; children: ReactNode }) {
  const t = useTranslations("admin.crm");
  const [editing, setEditing] = useState(false);
  if (editing) return <LeadForm mode="edit" leadId={leadId} initial={initial} destinations={destinations} onDone={() => setEditing(false)} />;
  return (
    <div>
      {children}
      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setEditing(true)} data-testid="lead-edit">{t("detail.editDetails")}</Button>
    </div>
  );
}
