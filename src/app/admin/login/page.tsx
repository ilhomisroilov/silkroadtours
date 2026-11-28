import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { LoginCard } from "@/components/admin/login-card";
import { getAdminFromCookies } from "@/lib/auth/guard";
import { adminT } from "@/lib/server/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("login.title") };
}

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  if (await getAdminFromCookies()) redirect("/admin");
  const { t } = await adminT();
  return (
    <LoginCard title={t("login.title")} note={t("login.noAccount")}>
      <LoginForm idle={(await searchParams).reason === "idle"} />
    </LoginCard>
  );
}
