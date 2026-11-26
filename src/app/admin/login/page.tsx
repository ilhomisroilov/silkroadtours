import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { GirihPattern, GirihRosette } from "@/components/ornament";
import { getAdminFromCookies } from "@/lib/auth/guard";
import { adminT } from "@/lib/server/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("login.title") };
}

export default async function AdminLoginPage() {
  if (await getAdminFromCookies()) redirect("/admin");
  const { t } = await adminT();
  return (
    <main id="main" className="relative flex min-h-dvh items-center justify-center bg-lapis-deep p-4">
      <GirihPattern className="absolute inset-0" tone="saffron" opacity={0.3} />
      <div className="relative w-full max-w-md rounded-[var(--radius-card)] bg-ivory p-8 shadow-lift">
        <div className="mb-6 flex items-center gap-3">
          <GirihRosette size={40} tone="lapis" strokeWidth={2.2} />
          <h1 className="text-3xl text-lapis-deep">{t("login.title")}</h1>
        </div>
        <LoginForm />
        <p className="mt-6 text-sm text-ink-muted">{t("login.noAccount")}</p>
      </div>
    </main>
  );
}
