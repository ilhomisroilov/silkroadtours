import type { Metadata } from "next";
import { OwnPasswordForm, OwnProfileForm } from "@/components/admin/settings-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { findAdminById } from "@/db/queries/admin-users";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("panel.myProfile") };
}

/** "Mening profilim": the signed-in admin's own name, sign-in details and password. */
export default async function AdminProfile() {
  const me = await requireAdminPage();
  const { t } = await adminT();
  const row = await findAdminById(getDb(), me.id);
  const role = me.role === "owner" || me.role === "editor" ? t(`settings.roles.${me.role}`) : me.role;
  return (
    <>
      <PageHeader title={t("panel.myProfile")}>{t("panel.myProfileLead")}</PageHeader>
      <div className="grid gap-6">
        <Panel title={t("panel.myProfile")}>
          <OwnProfileForm initial={{ name: me.name, email: me.email, role, lastLoginAt: row?.lastLoginAt ? row.lastLoginAt.toISOString() : null }} />
        </Panel>
        <Panel title={t("settings.ownPassword")}><OwnPasswordForm /></Panel>
      </div>
    </>
  );
}
