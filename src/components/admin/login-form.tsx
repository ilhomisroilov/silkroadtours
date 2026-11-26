"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { apiFetch, translateCode } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

export function LoginForm() {
  const t = useTranslations("admin.login");
  const te = useTranslations("errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const r = await apiFetch("/api/admin/auth/login", { method: "POST", json: { email: fd.get("email"), password: fd.get("password") } });
        setBusy(false);
        if (r.ok) {
          router.replace("/admin");
          router.refresh();
        } else setError(translateCode(r.error.code, te as never));
      }}
    >
      {error && <p role="alert" className="rounded-sm bg-danger/5 p-3 font-semibold text-danger" data-testid="login-error">{error}</p>}
      <Field id="email" label={t("email")} required>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field id="password" label={t("password")} required>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="lg" disabled={busy} data-testid="login-submit">{t("submit")}</Button>
    </form>
  );
}
