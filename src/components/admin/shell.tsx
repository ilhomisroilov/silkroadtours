"use client";

import { DownOutlined, ExportOutlined, LogoutOutlined, MenuOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { BarChart3, BookOpenCheck, Bot, Building2, CalendarCheck2, Cog, FileText, Handshake, HelpCircle, Images, KanbanSquare, Mail, Map as MapIcon, MessageSquareQuote, NotebookPen, Route, Users } from "lucide-react";
import { Avatar, Button, Drawer, Flex, Grid, Layout, Popover, Segmented, Typography } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { ADMIN_LOCALE_COOKIE, type AdminLocale } from "@/i18n/admin";
import { apiFetch } from "@/lib/client/api";
import { BRAND } from "@/lib/brand";
import type { AdminTheme } from "@/lib/admin-theme";
import { ADMIN_COLORS, useAdminTheme } from "./antd-provider";

/** Menu order and icons as the team knows them from the earlier panel. */
const NAV = [
  { href: "/admin", key: "overview", icon: BarChart3 },
  { href: "/admin/crm", key: "crm", icon: KanbanSquare },
  { href: "/admin/customers", key: "customers", icon: Users },
  { href: "/admin/bookings", key: "bookings", icon: CalendarCheck2 },
  { href: "/admin/requests", key: "requests", icon: BookOpenCheck },
  { href: "/admin/trips", key: "trips", icon: NotebookPen },
  { href: "/admin/places", key: "places", icon: Building2 },
  { href: "/admin/tours", key: "tours", icon: Route },
  { href: "/admin/destinations", key: "destinations", icon: MapIcon },
  { href: "/admin/media", key: "media", icon: Images },
  { href: "/admin/partners", key: "partners", icon: Handshake },
  { href: "/admin/content", key: "content", icon: FileText },
  { href: "/admin/ai", key: "ai", icon: Bot },
  { href: "/admin/faq", key: "faq", icon: HelpCircle },
  { href: "/admin/reviews", key: "reviews", icon: MessageSquareQuote },
  { href: "/admin/newsletter", key: "newsletter", icon: Mail },
  { href: "/admin/settings", key: "settings", icon: Cog },
] as const;

export function AdminShell({ user, locale, children }: { user: { name: string; role: string }; locale: AdminLocale; children: ReactNode }) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const desktop = screens.lg ?? true;
  const [open, setOpen] = useState(false);


  const side = (
    <div className="admin-side">
      <Link href="/admin" aria-label={BRAND.name} className="admin-side-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND.logo.header.src} alt={BRAND.name} width={BRAND.logo.header.width} height={BRAND.logo.header.height} />
      </Link>
      <nav aria-label={t("nav.menu")} className="admin-side-nav">
        <ul>
          {NAV.map(({ href, key, icon: Icon }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className="admin-side-link">
                  <Icon aria-hidden="true" />
                  <span>{t(`nav.${key}`)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );

  return (
    <Layout style={desktop ? { height: "100dvh", overflow: "hidden" } : { minHeight: "100dvh" }}>
      {desktop ? (
        <Layout.Sider width={264} style={{ height: "100dvh", overflow: "hidden", background: "transparent" }}>{side}</Layout.Sider>
      ) : (
        <Drawer placement="left" open={open} onClose={() => setOpen(false)} size={280} closable={false} styles={{ body: { padding: 0 } }}>
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
