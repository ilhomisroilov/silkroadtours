import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/shell";
import { adminLocale, requireAdminPage } from "@/lib/server/admin";

/** Every page in the panel is protected on the server: no valid session → /admin/login. */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const [admin, locale] = await Promise.all([requireAdminPage(), adminLocale()]);
  return (
    <AdminShell user={{ name: admin.name, role: admin.role }} locale={locale}>
      {children}
    </AdminShell>
  );
}
