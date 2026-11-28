"use client";

import { ArrowRight, CalendarDays, LogOut, Save, Send, UserRound, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, fieldAria, Input } from "@/components/ui/form";
import { Spinner } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import type { Currency, Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/pricing";

export interface Me {
  id: string;
  email: string | null;
  email_verified: boolean;
  full_name: string | null;
  phone: string | null;
}

interface BookingRow {
  reference: string;
  status: string;
  tourTitle: string | null;
  tourSlug: string | null;
  preferredDate: string | null;
  adults: number;
  children: number;
  quoteCurrency: Currency | null;
  quoteTotalMinor: number | null;
  createdAt: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; status: number; code: string };

/** Calls the accounts service (same site, /v1/…). Its errors look like {detail: {code}} or a list for bad fields. */
async function v1<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Result<T>> {
  const { json, ...rest } = init;
  try {
    const res = await fetch(path, {
      ...rest,
      credentials: "same-origin",
      headers: { accept: "application/json", ...(json !== undefined ? { "content-type": "application/json" } : {}) },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
    const body = (await res.json().catch(() => null)) as unknown;
    if (res.ok) return { ok: true, data: body as T };
    const detail = (body as { detail?: unknown } | null)?.detail;
    let code = "generic";
    if (detail && typeof detail === "object" && !Array.isArray(detail) && "code" in detail) code = String((detail as { code: unknown }).code);
    else if (Array.isArray(detail)) code = detail.some((d) => Array.isArray(d?.loc) && d.loc.includes("password")) ? "weak_password" : "invalid_input";
    else if ((body as { error?: string } | null)?.error) code = String((body as { error: string }).error);
    return { ok: false, status: res.status, code };
  } catch {
    return { ok: false, status: 0, code: "service_unavailable" };
  }
}

const ERROR_KEYS: Record<string, string> = {
  invalid_credentials: "invalid_credentials",
  account_disabled: "invalid_credentials",
  email_in_use: "email_taken",
  email_in_use_sign_in_first: "email_taken",
  weak_password: "weak_password",
  invalid_input: "invalid_input",
  too_many_requests: "too_many_requests",
};

function useErrorText() {
  const t = useTranslations("account");
  return (r: { status: number; code: string }) =>
    r.status === 0 || r.status === 503 || r.code === "service_unavailable" ? t("unavailable") : t(`errors.${ERROR_KEYS[r.code] ?? "generic"}` as never);
}

export function AccountClient() {
  const t = useTranslations("account");
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [down, setDown] = useState(false);

  const load = useCallback(async () => {
    const r = await v1<Me>("/v1/me");
    if (r.ok) setMe(r.data);
    else {
      setDown(r.status === 0 || r.status >= 500);
      setMe(null);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (me === undefined) return <div className="flex justify-center py-16"><Spinner label={t("title")} /></div>;
  if (down) return <p role="status" className="rounded-[1.5rem] bg-white p-8 text-center text-ink/80 shadow-card">{t("unavailable")}</p>;
  if (!me) return <SignInPanel onDone={load} />;
  return <SignedIn me={me} onChange={setMe} onSignOut={() => setMe(null)} />;
}

/* ── signed out ─────────────────────────────────────────────────────────── */

function SignInPanel({ onDone }: { onDone: () => Promise<void> }) {
  const t = useTranslations("account");
  const locale = useLocale() as Locale;
  const errorText = useErrorText();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [telegramBot, setTelegramBot] = useState<string | null>(null);

  useEffect(() => {
    void v1<{ telegram?: { enabled: boolean; bot_username: string | null } }>("/v1/auth/providers").then((r) => {
      if (r.ok && r.data.telegram?.enabled && r.data.telegram.bot_username) setTelegramBot(r.data.telegram.bot_username);
    });
  }, []);

  const submit = (kind: "in" | "up") => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const json =
      kind === "in"
        ? { email: String(f.get("email") ?? "").trim(), password: String(f.get("password") ?? "") }
        : { email: String(f.get("email") ?? "").trim(), password: String(f.get("password") ?? ""), full_name: String(f.get("full_name") ?? "").trim(), locale };
    setBusy(true);
    setError(null);
    const r = await v1(kind === "in" ? "/v1/auth/login" : "/v1/auth/register", { method: "POST", json });
    setBusy(false);
    if (r.ok) await onDone();
    else setError(errorText(r));
  };

  const errorBox = error && (
    <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger" data-testid="account-error">{error}</p>
  );

  return (
    <div className="mx-auto max-w-md rounded-[1.5rem] bg-white p-6 shadow-card sm:p-8" data-testid="account-signin">
      <Tabs value={tab} onValueChange={(v) => { setTab(v as "in" | "up"); setError(null); }}>
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="in" data-testid="account-tab-in">{t("signIn")}</TabsTrigger>
          <TabsTrigger value="up" data-testid="account-tab-up">{t("signUp")}</TabsTrigger>
        </TabsList>
        <TabsContent value="in">
          <form className="grid gap-4" onSubmit={submit("in")} noValidate={false}>
            <Field id="in-email" label={t("email")}><Input {...fieldAria("in-email")} name="email" type="email" autoComplete="email" required /></Field>
            <Field id="in-password" label={t("password")}><Input {...fieldAria("in-password")} name="password" type="password" autoComplete="current-password" required /></Field>
            {errorBox}
            <Button type="submit" disabled={busy} data-testid="account-submit-in">{t("submitSignIn")}</Button>
          </form>
        </TabsContent>
        <TabsContent value="up">
          <form className="grid gap-4" onSubmit={submit("up")}>
            <Field id="up-name" label={t("fullName")}><Input {...fieldAria("up-name")} name="full_name" autoComplete="name" minLength={2} maxLength={200} required /></Field>
            <Field id="up-email" label={t("email")}><Input {...fieldAria("up-email")} name="email" type="email" autoComplete="email" required /></Field>
            <Field id="up-password" label={t("password")} hint={t("passwordHint")}>
              <Input {...fieldAria("up-password", undefined, true)} name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required />
            </Field>
            {errorBox}
            <Button type="submit" disabled={busy} data-testid="account-submit-up">{t("submitSignUp")}</Button>
          </form>
        </TabsContent>
      </Tabs>
      {telegramBot && (
        <>
          <p className="my-5 flex items-center gap-3 text-sm text-ink-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">{t("or")}</p>
          <TelegramButton bot={telegramBot} label={t("telegram")} onDone={onDone} onError={(r) => setError(errorText(r))} />
        </>
      )}
    </div>
  );
}

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

/** Telegram's own sign-in button, loaded only when the site has a Telegram bot set up. */
function TelegramButton({ bot, label, onDone, onError }: { bot: string; label: string; onDone: () => Promise<void>; onError: (r: { status: number; code: string }) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.onTelegramAuth = async (user) => {
      const r = await v1("/v1/auth/telegram", { method: "POST", json: user });
      if (r.ok) await onDone();
      else onError(r);
    };
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.dataset.telegramLogin = bot;
    s.dataset.size = "large";
    s.dataset.radius = "12";
    s.dataset.requestAccess = "write";
    s.dataset.onauth = "onTelegramAuth(user)";
    const el = box.current;
    el?.appendChild(s);
    return () => {
      if (el) el.innerHTML = "";
      delete window.onTelegramAuth;
    };
  }, [bot, onDone, onError]);
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink"><Send aria-hidden="true" className="size-4 text-cobalt" />{label}</span>
      <div ref={box} />
    </div>
  );
}

/* ── signed in ──────────────────────────────────────────────────────────── */

function SignedIn({ me, onChange, onSignOut }: { me: Me; onChange: (m: Me) => void; onSignOut: () => void }) {
  const t = useTranslations("account");
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const phone = String(f.get("phone") ?? "").trim();
    setBusy(true);
    setMsg(null);
    const r = await v1<Me>("/v1/me", { method: "PATCH", json: { full_name: String(f.get("full_name") ?? "").trim(), phone: phone || null } });
    setBusy(false);
    if (r.ok) {
      onChange(r.data);
      setMsg({ ok: true, text: t("saved") });
    } else setMsg({ ok: false, text: errorText(r) });
  };

  const signOut = async () => {
    await v1("/v1/auth/logout", { method: "POST" });
    window.dispatchEvent(new Event("account-changed"));
    onSignOut();
  };

  useEffect(() => {
    window.dispatchEvent(new Event("account-changed"));
  }, []);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]" data-testid="account-signed-in">
      <section aria-labelledby="profile-title" className="rounded-[1.5rem] bg-white p-6 shadow-card">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-lapis text-lg font-bold text-white">
            {(me.full_name || me.email || "?").trim().slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 id="profile-title" className="text-lg font-bold">{t("profile")}</h2>
            <p className="truncate text-sm text-ink-muted">{me.email}</p>
          </div>
        </div>
        <form className="mt-5 grid gap-4" onSubmit={save}>
          <Field id="me-name" label={t("fullName")}><Input {...fieldAria("me-name")} name="full_name" defaultValue={me.full_name ?? ""} autoComplete="name" minLength={2} maxLength={200} required /></Field>
          <Field id="me-phone" label={t("phone")}><Input {...fieldAria("me-phone")} name="phone" type="tel" defaultValue={me.phone ?? ""} autoComplete="tel" placeholder="+998 …" maxLength={32} /></Field>
          <div role="status" aria-live="polite">
            {msg && <p className={msg.ok ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-danger"}>{msg.text}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy} data-testid="account-save"><Save aria-hidden="true" />{t("save")}</Button>
            <Button type="button" variant="ghost" onClick={signOut} data-testid="account-signout"><LogOut aria-hidden="true" />{t("signOut")}</Button>
          </div>
        </form>
      </section>
      <Bookings verified={me.email_verified} />
    </div>
  );
}

function Bookings({ verified }: { verified: boolean }) {
  const t = useTranslations("account");
  const locale = useLocale() as Locale;
  const [rows, setRows] = useState<BookingRow[] | null>(null);
  useEffect(() => {
    void fetch("/api/account/bookings", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? (r.json() as Promise<{ data?: BookingRow[] }>) : null))
      .then((b: { data?: BookingRow[] } | null) => setRows(b?.data ?? []))
      .catch(() => setRows([]));
  }, []);
  const date = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join(".") : "—");
  return (
    <section aria-labelledby="bookings-title" className="rounded-[1.5rem] bg-white p-6 shadow-card" data-testid="account-bookings">
      <h2 id="bookings-title" className="text-lg font-bold">{t("bookings")}</h2>
      {!verified && <p className="mt-2 text-sm text-ink-muted">{t("verifyNote")}</p>}
      {rows === null ? (
        <div className="flex justify-center py-10"><Spinner label={t("bookings")} /></div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-ink/80">{t("noBookings")}</p>
          <Link href="/tours" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-cobalt">
            {t("findTour")} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3">
          {rows.map((b) => (
            <li key={b.reference} className="rounded-2xl border border-line p-4" data-testid="account-booking">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {b.tourSlug ? (
                    <Link href={`/tours/${b.tourSlug}`} className="font-semibold text-lapis hover:underline">{b.tourTitle}</Link>
                  ) : (
                    <p className="font-semibold">{b.tourTitle ?? "—"}</p>
                  )}
                  <p className="mt-0.5 text-xs text-ink-muted">{t("bookingRef")}: <span className="font-mono">{b.reference}</span></p>
                </div>
                <span className="rounded-full bg-sky px-3 py-1 text-xs font-bold text-lapis">
                  {t.has(`status.${b.status}` as never) ? t(`status.${b.status}` as never) : b.status}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <div className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-4 text-ink-muted" /><dt className="sr-only">{t("travelDate")}</dt><dd>{date(b.preferredDate)}</dd></div>
                <div className="flex items-center gap-2"><Users aria-hidden="true" className="size-4 text-ink-muted" /><dt className="sr-only">{t("travellersLabel")}</dt><dd>{t("travellers", { adults: b.adults, children: b.children })}</dd></div>
                {b.quoteTotalMinor != null && b.quoteCurrency && (
                  <div className="flex items-center gap-2"><dt className="text-ink-muted">{t("total")}:</dt><dd className="font-semibold">{formatMoney(b.quoteTotalMinor, b.quoteCurrency, locale)}</dd></div>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── header button ──────────────────────────────────────────────────────── */

/** Round button in the site header: the traveller's initial when signed in, a person icon otherwise. */
export function AccountLink({ signInLabel, accountLabel, className }: { signInLabel: string; accountLabel: string; className?: string }) {
  const [initial, setInitial] = useState<string | null>(null);
  useEffect(() => {
    const check = () =>
      void v1<Me>("/v1/me").then((r) => setInitial(r.ok ? (r.data.full_name || r.data.email || "?").trim().slice(0, 1).toUpperCase() : null));
    check();
    window.addEventListener("account-changed", check);
    return () => window.removeEventListener("account-changed", check);
  }, []);
  const label = initial ? accountLabel : signInLabel;
  return (
    <Link
      href="/account"
      aria-label={label}
      title={label}
      className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/80 text-lapis ring-1 ring-lapis/10 transition hover:bg-white", initial && "bg-lapis text-white hover:bg-cobalt", className)}
      data-testid="account-link"
    >
      {initial ? <span aria-hidden="true" className="text-base font-bold">{initial}</span> : <UserRound aria-hidden="true" className="size-5" />}
    </Link>
  );
}
