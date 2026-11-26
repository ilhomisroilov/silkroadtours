"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { AdminRole, ContactSettings, ExchangeRates } from "@/db/types";
import { Button } from "@/components/ui/button";
import { useAdminApi } from "./booking-actions";
import { LocalizedFields } from "./localized";

const field = "mt-1 block min-h-11 w-full rounded-sm border border-field bg-white px-3 font-normal";

export function ContactForm({ initial, canEdit }: { initial: ContactSettings; canEdit: boolean }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const call = useAdminApi();
  const [c, setC] = useState(initial);
  const input = (k: "agencyName" | "phone" | "email" | "whatsapp" | "telegram" | "licenseNumber", label: string) => (
    <label className="block text-sm font-semibold">{label}<input value={c[k]} disabled={!canEdit} onChange={(e) => setC({ ...c, [k]: e.target.value })} className={field} data-testid={`contact-${k}`} /></label>
  );
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); await call("/api/admin/settings/contact", { method: "PUT", json: c }, tc("saved")); }}>
      <p className="text-sm text-ink-muted">{t("contactHint")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {input("agencyName", t("agencyName"))}
        {input("phone", t("phone"))}
        {input("email", t("email"))}
        {input("whatsapp", t("whatsapp"))}
        {input("telegram", t("telegram"))}
        {input("licenseNumber", t("licence"))}
      </div>
      <LocalizedFields label={t("address")} value={c.address} onChange={(a) => setC({ ...c, address: a })} />
      {canEdit && <Button type="submit" data-testid="contact-save">{tc("save")}</Button>}
    </form>
  );
}

export function RatesForm({ initial, canEdit }: { initial: ExchangeRates; canEdit: boolean }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const call = useAdminApi();
  const [uzs, setUzs] = useState(initial.rates.UZS);
  const [eur, setEur] = useState(initial.rates.EUR);
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{t("ratesHint")} {t("ratesUpdated", { date: initial.updatedAt.slice(0, 16).replace("T", " "), source: initial.source })}</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={async (e) => { e.preventDefault(); await call("/api/admin/settings/exchange_rates", { method: "PUT", json: { rates: { USD: 1, UZS: uzs, EUR: eur } } }, tc("saved")); }}>
        <label className="block text-sm font-semibold">{t("rateUzs")}<input type="number" step="0.01" min={1} value={uzs} disabled={!canEdit} onChange={(e) => setUzs(Number(e.target.value))} className={field} /></label>
        <label className="block text-sm font-semibold">{t("rateEur")}<input type="number" step="0.0001" min={0.01} value={eur} disabled={!canEdit} onChange={(e) => setEur(Number(e.target.value))} className={field} /></label>
        {canEdit && <Button type="submit">{tc("save")}</Button>}
        <Button
          variant="outline"
          onClick={async () => {
            const r = await call<ExchangeRates>("/api/admin/settings/rates/refresh", { method: "POST" }, tc("saved"));
            if (r && typeof r === "object") { setUzs(r.rates.UZS); setEur(r.rates.EUR); }
          }}
        >
          {t("refreshCbu")}
        </Button>
      </form>
    </div>
  );
}

export function TelegramTest() {
  const t = useTranslations("admin.settings");
  const call = useAdminApi();
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">{t("telegramHint")}</p>
      <Button variant="secondary" onClick={() => call("/api/admin/settings/telegram/test", { method: "POST" }, t("testSent"))}>{t("sendTest")}</Button>
    </div>
  );
}

interface UserRow { id: number; email: string; name: string; role: AdminRole; isActive: boolean; lastLoginAt: string | null }

export function UsersManager({ users, meId }: { users: UserRow[]; meId: number }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const call = useAdminApi();
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-ink-muted"><tr><th className="py-2">{t("name")}</th><th>{t("email")}</th><th>{t("role")}</th><th>{t("active")}</th><th>{t("lastLogin")}</th><th><span className="sr-only">{tc("actions")}</span></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line align-middle">
                <td className="py-2 font-semibold">{u.name}{u.id === meId ? ` (${t("you")})` : ""}</td>
                <td>{u.email}</td>
                <td>
                  <select aria-label={t("role")} defaultValue={u.role} className="min-h-11 rounded-sm border border-field px-2" onChange={(e) => call(`/api/admin/users/${u.id}`, { method: "PATCH", json: { role: e.target.value } }, tc("saved"))}>
                    <option value="owner">{t("roles.owner")}</option>
                    <option value="editor">{t("roles.editor")}</option>
                  </select>
                </td>
                <td>{u.isActive ? tc("yes") : tc("no")}</td>
                <td className="text-xs text-ink-muted">{u.lastLoginAt?.slice(0, 16).replace("T", " ") ?? "—"}</td>
                <td className="flex flex-wrap gap-1 py-2">
                  <button type="button" className="min-h-11 rounded-sm px-2 font-semibold hover:bg-sand-soft" onClick={() => call(`/api/admin/users/${u.id}`, { method: "PATCH", json: { isActive: !u.isActive } }, tc("saved"))}>{u.isActive ? t("deactivate") : t("activate")}</button>
                  <button
                    type="button"
                    className="min-h-11 rounded-sm px-2 font-semibold hover:bg-sand-soft"
                    onClick={() => {
                      const pw = prompt(t("newPassword"));
                      if (pw) void call(`/api/admin/users/${u.id}`, { method: "PATCH", json: { password: pw } }, tc("saved"));
                    }}
                  >
                    {t("resetPassword")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="grid items-end gap-3 rounded-sm bg-sand-soft p-4 sm:grid-cols-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const ok = await call("/api/admin/users", { method: "POST", json: { name: f.get("name"), email: f.get("email"), password: f.get("password"), role: f.get("role") } }, tc("saved"));
          if (ok) e.currentTarget?.reset();
        }}
      >
        <label className="block text-sm font-semibold">{t("name")}<input name="name" required minLength={2} className={field} /></label>
        <label className="block text-sm font-semibold">{t("email")}<input name="email" type="email" required className={field} /></label>
        <label className="block text-sm font-semibold">{t("password")}<input name="password" type="password" required minLength={12} autoComplete="new-password" className={field} /></label>
        <label className="block text-sm font-semibold">{t("role")}<select name="role" className={field}><option value="editor">{t("roles.editor")}</option><option value="owner">{t("roles.owner")}</option></select></label>
        <Button type="submit">{t("newUser")}</Button>
      </form>
    </div>
  );
}

export function OwnPasswordForm() {
  const t = useTranslations("admin.settings");
  const call = useAdminApi();
  return (
    <form
      className="grid items-end gap-3 sm:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        if (await call("/api/admin/auth/password", { method: "POST", json: { currentPassword: f.get("current"), newPassword: f.get("next") } }, t("changePassword"))) form.reset();
      }}
    >
      <label className="block text-sm font-semibold">{t("currentPassword")}<input name="current" type="password" required autoComplete="current-password" className={field} /></label>
      <label className="block text-sm font-semibold">{t("newPassword")}<input name="next" type="password" required minLength={12} autoComplete="new-password" className={field} /></label>
      <Button type="submit" variant="secondary">{t("changePassword")}</Button>
    </form>
  );
}
