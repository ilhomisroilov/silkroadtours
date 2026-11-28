"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider, theme } from "antd";
import enUS from "antd/locale/en_US";
import uzUZ from "antd/locale/uz_UZ";
import dayjs from "dayjs";
import "dayjs/locale/uz-latn";
import type { ReactNode } from "react";

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

export function AdminAntdProvider({ locale, children }: { locale: "uz" | "en"; children: ReactNode }) {
  dayjs.locale(locale === "uz" ? "uz-latn" : "en");
  return (
    <AntdRegistry>
      <ConfigProvider
        locale={locale === "uz" ? uzUZ : enUS}
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: ADMIN_COLORS.primary,
            colorInfo: ADMIN_COLORS.primary,
            colorText: ADMIN_COLORS.text,
            colorTextSecondary: ADMIN_COLORS.muted,
            colorError: "#c62828",
            colorLink: ADMIN_COLORS.primary,
            colorTextTertiary: ADMIN_COLORS.muted,
            colorTextDescription: ADMIN_COLORS.muted,
            colorTextPlaceholder: "#6b7680",
            colorBgLayout: ADMIN_COLORS.surface,
            borderRadius: 8,
            fontFamily: "var(--font-body), Inter, system-ui, sans-serif",
            fontSize: 15,
            controlHeight: 40,
          },
          components: {
            Layout: { siderBg: ADMIN_COLORS.night, headerBg: "#ffffff", bodyBg: ADMIN_COLORS.surface },
            Menu: {
              darkItemBg: ADMIN_COLORS.night,
              darkSubMenuItemBg: ADMIN_COLORS.night,
              darkItemSelectedBg: ADMIN_COLORS.primary,
              itemHeight: 44,
            },
            Card: { headerFontSize: 17 },
            Table: { headerBg: "#eef2f7" },
            Form: { labelFontSize: 14, verticalLabelPadding: "0 0 6px" },
          },
        }}
      >
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
