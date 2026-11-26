import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/ui";
import { LeadForm } from "@/components/admin/crm/lead-actions";
import { getDb } from "@/db/client";
import { listActiveAdmins, listLeadDestinations } from "@/db/queries/crm";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("crm.create.title") };
}

export default async function NewLeadPage() {
  const admin = await requireAdminPage();
  const { t, locale } = await adminT();
  const db = getDb();
  const [admins, destinations] = await Promise.all([listActiveAdmins(db), listLeadDestinations(db)]);
  return (
    <>
      <p className="mb-2"><Link href="/admin/crm" className="text-sm text-cobalt underline">← {t("crm.detail.back")}</Link></p>
      <PageHeader title={t("crm.create.title")}>
        <p className="mt-1 max-w-2xl text-ink-muted">{t("crm.create.intro")}</p>
      </PageHeader>
      <Panel className="max-w-3xl">
        <LeadForm
          mode="create"
          admins={admins.map((a) => ({ id: a.id, name: a.name }))}
          destinations={destinations}
          defaultAssignee={admin.id}
          initial={{ fullName: "", email: "", phone: "", locale, title: "", destination: "", interests: "", budgetUsd: "", travelFrom: "", travelTo: "", travellers: "", valueUsd: "" }}
        />
      </Panel>
    </>
  );
}
