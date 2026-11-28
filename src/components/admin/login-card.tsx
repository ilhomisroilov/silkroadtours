"use client";

import { Card, Flex, Typography } from "antd";
import Image from "next/image";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { ADMIN_COLORS } from "./antd-provider";

export function LoginCard({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <main id="main" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: `radial-gradient(circle at 30% 20%, ${ADMIN_COLORS.navy}, ${ADMIN_COLORS.night} 70%)` }}>
      <Card style={{ width: "100%", maxWidth: 420 }} styles={{ body: { padding: 32 } }}>
        <Flex vertical gap={20}>
          <Flex align="center" gap={12}>
            <Image src={BRAND.logo.png} alt={BRAND.name} width={56} height={56} style={{ objectFit: "contain", width: 56, height: "auto" }} />
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>{BRAND.name}</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>{title}</Typography.Title>
            </div>
          </Flex>
          {children}
          <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>{note}</Typography.Paragraph>
        </Flex>
      </Card>
    </main>
  );
}
