import type { Metadata } from "next";
import { ContactForm, OwnPasswordForm, RatesForm, TelegramTest, UsersManager } from "@/components/admin/settings-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { listAdmins } from "@/db/queries/admin-users";
import { getContact, getRates } from "@/db/queries/settings";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("settings.title") };
}

export default async function AdminSettings() {
  const me = await requireAdminPage();
  const { t } = await adminT();
  const db = getDb();
  const isOwner = me.role === "owner";
  const [contact, rates, users] = await Promise.all([getContact(db), getRates(db), isOwner ? listAdmins(db) : Promise.resolve([])]);
  return (
    <>
      <PageHeader title={t("settings.title")}>{!isOwner && <p className="text-saffron-ink">{t("settings.ownerOnly")}</p>}</PageHeader>
      <div className="grid gap-6">
        <Panel title={t("settings.contact")}><ContactForm initial={contact} canEdit={isOwner} /></Panel>
        <Panel title={t("settings.rates")}><RatesForm initial={rates} canEdit={isOwner} /></Panel>
        <Panel title={t("settings.telegram")}><TelegramTest /></Panel>
        {isOwner && (
          <Panel title={t("settings.users")}>
            <UsersManager meId={me.id} users={users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, isActive: u.isActive, lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null }))} />
          </Panel>
        )}
        <Panel title={t("settings.ownPassword")}><OwnPasswordForm /></Panel>
      </div>
    </>
  );
}
