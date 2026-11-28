"use client";

import {
  BarChartOutlined,
  BookOutlined,
  CalendarOutlined,
  CommentOutlined,
  ExportOutlined,
  FileTextOutlined,
  GlobalOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuOutlined,
  PictureOutlined,
  ProjectOutlined,
  QuestionCircleOutlined,
  RobotOutlined,
  SettingOutlined,
  ShopOutlined,
  SolutionOutlined,
  TeamOutlined,
  ApartmentOutlined,
  CompassOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Drawer, Flex, Grid, Layout, Menu, Segmented, Typography, type MenuProps } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { ADMIN_LOCALE_COOKIE, type AdminLocale } from "@/i18n/admin";
import { apiFetch } from "@/lib/client/api";
import { BRAND } from "@/lib/brand";
import { ADMIN_COLORS } from "./antd-provider";

type NavKey =
  | "overview" | "crm" | "customers" | "bookings" | "requests" | "trips" | "places" | "tours" | "destinations"
  | "media" | "partners" | "content" | "ai" | "faq" | "reviews" | "newsletter" | "settings";

const GROUPS: { group: "main" | "sales" | "catalog" | "content" | "system"; items: { href: string; key: NavKey; icon: ReactNode }[] }[] = [
  { group: "main", items: [{ href: "/admin", key: "overview", icon: <BarChartOutlined /> }] },
  {
    group: "sales",
    items: [
      { href: "/admin/bookings", key: "bookings", icon: <CalendarOutlined /> },
      { href: "/admin/requests", key: "requests", icon: <SolutionOutlined /> },
      { href: "/admin/crm", key: "crm", icon: <ProjectOutlined /> },
      { href: "/admin/customers", key: "customers", icon: <TeamOutlined /> },
      { href: "/admin/trips", key: "trips", icon: <BookOutlined /> },
    ],
  },
  {
    group: "catalog",
    items: [
      { href: "/admin/tours", key: "tours", icon: <CompassOutlined /> },
      { href: "/admin/destinations", key: "destinations", icon: <GlobalOutlined /> },
      { href: "/admin/places", key: "places", icon: <ShopOutlined /> },
      { href: "/admin/partners", key: "partners", icon: <ApartmentOutlined /> },
      { href: "/admin/media", key: "media", icon: <PictureOutlined /> },
    ],
  },
  {
    group: "content",
    items: [
      { href: "/admin/content", key: "content", icon: <FileTextOutlined /> },
      { href: "/admin/faq", key: "faq", icon: <QuestionCircleOutlined /> },
      { href: "/admin/reviews", key: "reviews", icon: <CommentOutlined /> },
      { href: "/admin/newsletter", key: "newsletter", icon: <MailOutlined /> },
    ],
  },
  {
    group: "system",
    items: [
      { href: "/admin/ai", key: "ai", icon: <RobotOutlined /> },
      { href: "/admin/settings", key: "settings", icon: <SettingOutlined /> },
    ],
  },
];

function activeKey(pathname: string): string {
  let best = "/admin";
  for (const g of GROUPS) for (const i of g.items) if (i.href !== "/admin" && pathname.startsWith(i.href) && i.href.length > best.length) best = i.href;
  return best;
}

export function AdminShell({ user, locale, children }: { user: { name: string; role: string }; locale: AdminLocale; children: ReactNode }) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const desktop = screens.lg ?? true;
  const [open, setOpen] = useState(false);

  const setLocale = (l: AdminLocale) => {
    document.cookie = `${ADMIN_LOCALE_COOKIE}=${l}; Path=/admin; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    router.refresh();
  };
  const logout = async () => {
    await apiFetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  const items: MenuProps["items"] = GROUPS.map((g) => ({
    type: "group" as const,
    key: g.group,
    label: <span style={{ color: "#8fa2b7", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>{t(`panel.groups.${g.group}`)}</span>,
    children: g.items.map((i) => ({
      key: i.href,
      icon: i.icon,
      label: <Link href={i.href} onClick={() => setOpen(false)}>{t(`nav.${i.key}`)}</Link>,
    })),
  }));

  const side = (
    <Flex vertical style={{ height: "100%", background: ADMIN_COLORS.night }}>
      <Link href="/admin" style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 20px 12px", color: "#fff" }}>
        <Avatar shape="square" size={36} style={{ background: ADMIN_COLORS.gold, color: ADMIN_COLORS.night, fontWeight: 700 }}>{BRAND.name.slice(0, 1)}</Avatar>
        <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{BRAND.name}</span>
      </Link>
      <nav aria-label={t("nav.menu")} style={{ flex: 1, overflowY: "auto" }}>
        <Menu theme="dark" mode="inline" selectedKeys={[activeKey(pathname)]} items={items} style={{ borderInlineEnd: 0 }} />
      </nav>
      <Flex vertical gap={8} style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
        <Typography.Text style={{ color: "#c9d4e0", fontSize: 13 }}>{t("nav.signedInAs", { name: user.name })}</Typography.Text>
        <Segmented<AdminLocale>
          block
          aria-label={t("panel.language")}
          value={locale}
          onChange={setLocale}
          options={[{ label: "Oʻzbekcha", value: "uz" }, { label: "English", value: "en" }]}
        />
        <Button block href="/" target="_blank" icon={<ExportOutlined />}>{t("nav.viewSite")}</Button>
        <Button block danger icon={<LogoutOutlined />} onClick={logout} data-testid="admin-logout">{t("nav.logout")}</Button>
      </Flex>
    </Flex>
  );

  return (
    <Layout style={{ minHeight: "100dvh" }}>
      {desktop ? (
        <Layout.Sider width={264} style={{ position: "sticky", top: 0, height: "100dvh", overflow: "hidden" }}>{side}</Layout.Sider>
      ) : (
        <Drawer placement="left" open={open} onClose={() => setOpen(false)} size={280} closable={false} styles={{ body: { padding: 0, background: ADMIN_COLORS.night } }}>
          {side}
        </Drawer>
      )}
      <Layout>
        {!desktop && (
          <Layout.Header style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 12, padding: "0 12px", borderBottom: "1px solid #dfe4ea", height: 56, lineHeight: "56px" }}>
            <Button type="text" size="large" icon={<MenuOutlined />} aria-label={t("nav.menu")} onClick={() => setOpen(true)} />
            <Typography.Text strong style={{ fontSize: 17 }}>{BRAND.name}</Typography.Text>
          </Layout.Header>
        )}
        <Layout.Content>
          <main id="main" style={{ maxWidth: 1320, margin: "0 auto", padding: desktop ? "28px 32px 48px" : "16px 12px 40px" }}>{children}</main>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
