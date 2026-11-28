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
  DownOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
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
import { Avatar, Button, Drawer, Flex, Grid, Layout, Menu, Popover, Segmented, Typography, type MenuProps } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { ADMIN_LOCALE_COOKIE, type AdminLocale } from "@/i18n/admin";
import { apiFetch } from "@/lib/client/api";
import { BRAND } from "@/lib/brand";
import type { AdminTheme } from "@/lib/admin-theme";
import { ADMIN_COLORS, useAdminTheme } from "./antd-provider";

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
      <Link href="/admin" aria-label={BRAND.name} style={{ display: "flex", justifyContent: "center", padding: "18px 20px 10px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND.logo.header.src} alt={BRAND.name} width={BRAND.logo.header.width} height={BRAND.logo.header.height} style={{ width: 132, height: "auto" }} />
      </Link>
      <nav aria-label={t("nav.menu")} style={{ flex: 1, overflowY: "auto" }}>
        <Menu theme="dark" mode="inline" selectedKeys={[activeKey(pathname)]} items={items} style={{ borderInlineEnd: 0 }} />
      </nav>
    </Flex>
  );

  return (
    <Layout style={desktop ? { height: "100dvh", overflow: "hidden" } : { minHeight: "100dvh" }}>
      {desktop ? (
        <Layout.Sider width={264} style={{ height: "100dvh", overflow: "hidden" }}>{side}</Layout.Sider>
      ) : (
        <Drawer placement="left" open={open} onClose={() => setOpen(false)} size={280} closable={false} styles={{ body: { padding: 0, background: ADMIN_COLORS.night } }}>
          {side}
        </Drawer>
      )}
      {/* On desktop the menu and the work area scroll separately: only the work area moves with the page. */}
      <Layout style={desktop ? { height: "100dvh", overflowY: "auto" } : undefined} data-scroll-area>
        {!desktop && (
          <Layout.Header style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 12, padding: "0 12px", borderBottom: "1px solid var(--adm-border)", height: 56, lineHeight: "56px" }}>
            <Button type="text" size="large" icon={<MenuOutlined />} aria-label={t("nav.menu")} onClick={() => setOpen(true)} />
            <Link href="/admin" aria-label={BRAND.name} style={{ display: "flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BRAND.logo.header.src} alt={BRAND.name} width={BRAND.logo.header.width} height={BRAND.logo.header.height} style={{ height: 40, width: "auto" }} />
            </Link>
            <span style={{ flex: 1 }} />
            <UserMenu user={user} locale={locale} compact />
          </Layout.Header>
        )}
        <Layout.Content id="main" tabIndex={-1}>
          <div style={{ maxWidth: 1320, margin: "0 auto", padding: desktop ? "16px 32px 48px" : "16px 12px 40px" }}>
            {desktop && <Flex justify="flex-end" style={{ marginBottom: 8 }}><UserMenu user={user} locale={locale} /></Flex>}
            {children}
          </div>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

/**
 * Top-right profile button: one click opens the panel with the signed-in user, Day/Night, panel language,
 * "view site" and sign-out; a second click (or a click outside) closes it.
 */
function UserMenu({ user, locale, compact = false }: { user: { name: string; role: string }; locale: AdminLocale; compact?: boolean }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const { mode, setMode } = useAdminTheme();
  const [open, setOpen] = useState(false);
  const setLocale = (l: AdminLocale) => {
    document.cookie = `${ADMIN_LOCALE_COOKIE}=${l}; Path=/admin; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    router.refresh();
  };
  const logout = async () => {
    setOpen(false);
    await apiFetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };
  const initial = user.name.trim().slice(0, 1).toUpperCase() || "?";
  const role = user.role === "owner" || user.role === "editor" ? t(`settings.roles.${user.role}`) : user.role;
  const panel = (
    <Flex vertical gap={14} style={{ width: 260 }} data-testid="admin-user-panel">
      <Flex align="center" gap={10}>
        <Avatar size={40} style={{ background: ADMIN_COLORS.primary, flex: "none" }}>{initial}</Avatar>
        <Flex vertical style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis>{user.name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>{role}</Typography.Text>
        </Flex>
      </Flex>
      <Flex vertical gap={6}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>{t("panel.theme")}</Typography.Text>
        <Segmented<AdminTheme>
          block
          aria-label={t("panel.theme")}
          value={mode}
          onChange={setMode}
          data-testid="admin-theme"
          options={[
            { value: "light", label: <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><SunOutlined aria-hidden />{t("panel.day")}</span> },
            { value: "dark", label: <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MoonOutlined aria-hidden />{t("panel.night")}</span> },
          ]}
        />
      </Flex>
      <Flex vertical gap={6}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>{t("panel.language")}</Typography.Text>
        <Segmented<AdminLocale>
          block
          aria-label={t("panel.language")}
          value={locale}
          onChange={setLocale}
          options={[{ label: "Oʻzbekcha", value: "uz" }, { label: "English", value: "en" }]}
        />
      </Flex>
      <Flex vertical gap={8} style={{ borderTop: "1px solid var(--adm-border)", paddingTop: 12 }}>
        <Button block href="/" target="_blank" icon={<ExportOutlined />}>{t("nav.viewSite")}</Button>
        <Button block danger icon={<LogoutOutlined />} onClick={logout} data-testid="admin-logout">{t("nav.logout")}</Button>
      </Flex>
    </Flex>
  );
  return (
    <Popover content={panel} trigger="click" placement="bottomRight" open={open} onOpenChange={setOpen} arrow={false}>
      <Button
        type={compact ? "text" : "default"}
        size="large"
        aria-label={t("panel.profile")}
        aria-expanded={open}
        data-testid="admin-user-menu"
        style={compact ? { paddingInline: 4 } : { paddingInline: 8, borderRadius: 999 }}
      >
        <Flex align="center" gap={8}>
          <Avatar size={30} style={{ background: ADMIN_COLORS.primary }}>{initial}</Avatar>
          {!compact && <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</span>}
          {mode === "dark" ? <MoonOutlined aria-hidden /> : <SunOutlined aria-hidden />}
          <DownOutlined aria-hidden style={{ fontSize: 11 }} />
        </Flex>
      </Button>
    </Popover>
  );
}
