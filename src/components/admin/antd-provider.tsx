"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider, theme } from "antd";
import enUS from "antd/locale/en_US";
import uzUZ from "antd/locale/uz_UZ";
import dayjs from "dayjs";
import "dayjs/locale/uz-latn";
import { ADMIN_THEME_COOKIE, type AdminTheme } from "@/lib/admin-theme";
import { createContext, useContext, useState, type ReactNode } from "react";

/** Brand colours of the admin: navy of the site, a calm light work surface, gold only as an accent. */
export const ADMIN_COLORS = {
  primary: "#176bcb",
  navy: "#0d304f",
  night: "#061a2e",
  gold: "#d9a441",
  surface: "#f4f6f9",
  text: "#14202b",
  muted: "#55606b",
};


const ThemeContext = createContext<{ mode: AdminTheme; setMode: (m: AdminTheme) => void }>({ mode: "light", setMode: () => {} });
/** Day / Night mode of the admin's work area (the side menu stays dark in both). */
export const useAdminTheme = () => useContext(ThemeContext);

const DARK = { bg: "#0b141e", surface: "#141f2b", elevated: "#1b2836", border: "#2a3a4b", text: "#e6edf3", muted: "#a3b1bf" };

export function AdminAntdProvider({ locale, initialTheme = "light", children }: { locale: "uz" | "en"; initialTheme?: AdminTheme; children: ReactNode }) {
  dayjs.locale(locale === "uz" ? "uz-latn" : "en");
  const [mode, setModeState] = useState<AdminTheme>(initialTheme);
  const setMode = (m: AdminTheme) => {
    setModeState(m);
    document.body.dataset.adminTheme = m;
    document.cookie = `${ADMIN_THEME_COOKIE}=${m}; Path=/admin; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  };
  const dark = mode === "dark";
  return (
    <AntdRegistry>
      <ThemeContext.Provider value={{ mode, setMode }}>
        <ConfigProvider
          locale={locale === "uz" ? uzUZ : enUS}
          theme={{
            algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
            token: {
              colorPrimary: ADMIN_COLORS.primary,
              colorInfo: ADMIN_COLORS.primary,
              colorLink: dark ? "#6fb1ff" : ADMIN_COLORS.primary,
              colorError: dark ? "#ff7875" : "#c62828",
              colorText: dark ? DARK.text : ADMIN_COLORS.text,
              colorTextSecondary: dark ? DARK.muted : ADMIN_COLORS.muted,
              colorTextTertiary: dark ? DARK.muted : ADMIN_COLORS.muted,
              colorTextDescription: dark ? DARK.muted : ADMIN_COLORS.muted,
              colorTextPlaceholder: dark ? "#8394a5" : "#6b7680",
              colorBgLayout: dark ? DARK.bg : ADMIN_COLORS.surface,
              ...(dark ? { colorBgContainer: DARK.surface, colorBgElevated: DARK.elevated, colorBorder: "#3a4b5d", colorBorderSecondary: DARK.border } : {}),
              borderRadius: 8,
              fontFamily: "var(--font-body), Inter, system-ui, sans-serif",
              fontSize: 15,
              controlHeight: 40,
            },
            components: {
              Layout: { siderBg: ADMIN_COLORS.night, headerBg: dark ? DARK.surface : "#ffffff", bodyBg: dark ? DARK.bg : ADMIN_COLORS.surface },
              Menu: {
                darkItemBg: ADMIN_COLORS.night,
                darkSubMenuItemBg: ADMIN_COLORS.night,
                darkItemSelectedBg: ADMIN_COLORS.primary,
                itemHeight: 44,
              },
              Card: { headerFontSize: 17 },
              Table: { headerBg: dark ? DARK.elevated : "#eef2f7" },
              Form: { labelFontSize: 14, verticalLabelPadding: "0 0 6px" },
            },
          }}
        >
          <App>{children}</App>
        </ConfigProvider>
      </ThemeContext.Provider>
    </AntdRegistry>
  );
}
