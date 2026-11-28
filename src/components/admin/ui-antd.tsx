"use client";

import { ExportOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Statistic, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import type { BookingStatus } from "@/db/types";

export function PageHeader({ title, actions, children }: { title: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <Flex wrap justify="space-between" align="flex-end" gap={16} style={{ marginBottom: 24 }}>
      <div style={{ minWidth: 0 }}>
        <Typography.Title level={2} style={{ margin: 0, fontWeight: 700 }}>{title}</Typography.Title>
        {children && <div style={{ marginTop: 6, color: "var(--adm-muted)" }}>{children}</div>}
      </div>
      {actions && <Flex wrap gap={8}>{actions}</Flex>}
    </Flex>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <Card className={className} title={title} extra={actions} style={{ minWidth: 0 }} styles={{ body: { padding: 20 } }}>
      {children}
    </Card>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card styles={{ body: { padding: 20 } }}>
      <Statistic title={label} value={value} styles={{ content: { fontWeight: 700, fontSize: 28, wordBreak: "break-word" } }} />
      {hint && <Typography.Text type="secondary" style={{ fontSize: 13 }}>{hint}</Typography.Text>}
    </Card>
  );
}

const STATUS_COLOR: Record<BookingStatus, string> = { pending: "gold", confirmed: "green", completed: "blue", cancelled: "red" };

export function StatusBadge({ status, label }: { status: BookingStatus; label: string }) {
  return <Tag color={STATUS_COLOR[status]} style={{ fontWeight: 600, marginInlineEnd: 0 }} data-testid="status-badge">{label}</Tag>;
}

/** A link out to the public site, opened in a new tab. Usable from server pages. */
export function SiteLink({ href, children }: { href: string; children: ReactNode }) {
  return <Button href={href} target="_blank" rel="noopener" icon={<ExportOutlined />}>{children}</Button>;
}
