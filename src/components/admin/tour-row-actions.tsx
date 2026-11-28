"use client";

import { CopyOutlined, DeleteOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, MoreOutlined, StarFilled } from "@ant-design/icons";
import { App, Button, Dropdown, Flex, Table, Tag, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/client/api";
import { useAdminApi } from "./booking-actions";
import { toUpsertBody, type EditorTour } from "./tour-editor";

type AdminTourResponse = Omit<EditorTour, "destinationIds"> & { id: number; destinationLinks: { destinationId: number }[] };

export interface TourListRow {
  id: number;
  slug: string;
  title: string;
  destination: string;
  audience: string;
  durationDays: number;
  price: string;
  isPublished: boolean;
  isFeatured: boolean;
  bookingCount: number;
}

function useTourActions() {
  const t = useTranslations("admin");
  const call = useAdminApi();
  const router = useRouter();
  const { modal } = App.useApp();
  return {
    toggle: async (id: number, isPublished: boolean) => {
      const r = await apiFetch<AdminTourResponse>(`/api/admin/tours/${id}`);
      if (!r.ok) return;
      const tour: EditorTour = { ...r.data, destinationIds: r.data.destinationLinks.map((l) => l.destinationId) };
      await call(`/api/admin/tours/${id}`, { method: "PUT", json: { ...toUpsertBody(tour), isPublished: !isPublished } }, t("common.saved"));
    },
    duplicate: async (id: number) => {
      const r = await call<{ id: number }>(`/api/admin/tours/${id}/duplicate`, { method: "POST" }, t("tours.duplicated"));
      if (r && typeof r === "object") router.push(`/admin/tours/${r.id}`);
    },
    remove: (id: number, bookingCount: number) =>
      modal.confirm({
        title: bookingCount > 0 ? t("tours.deleteBlocked") : t("common.confirmDelete"),
        okText: t("common.delete"),
        okButtonProps: { danger: true },
        cancelText: t("common.cancel"),
        onOk: () => call(`/api/admin/tours/${id}`, { method: "DELETE" }, t("common.saved")),
      }),
  };
}

export function ToursTable({ rows }: { rows: TourListRow[] }) {
  const t = useTranslations("admin");
  const a = useTourActions();
  return (
    <Table<TourListRow>
      rowKey="id"
      dataSource={rows}
      pagination={rows.length > 30 ? { pageSize: 30, showSizeChanger: false } : false}
      scroll={{ x: 760 }}
      columns={[
        {
          title: t("tours.titleField"),
          render: (_, r) => (
            <Flex vertical gap={2}>
              <Link href={`/admin/tours/${r.id}`} style={{ fontWeight: 600 }}>{r.title}</Link>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {r.destination} · {t("tours.bookings", { count: r.bookingCount })}
              </Typography.Text>
            </Flex>
          ),
        },
        { title: t("tours.audience"), width: 110, render: (_, r) => <Tag>{r.audience}</Tag> },
        { title: t("tours.durationDays"), width: 80, align: "center", dataIndex: "durationDays" },
        { title: t("bookings.quote"), width: 110, dataIndex: "price" },
        {
          title: t("bookings.status"),
          width: 150,
          render: (_, r) => (
            <Flex wrap gap={4}>
              <Tag color={r.isPublished ? "green" : "default"} style={{ marginInlineEnd: 0 }}>{r.isPublished ? t("common.published") : t("common.draft")}</Tag>
              {r.isFeatured && <Tag color="gold" icon={<StarFilled />} style={{ marginInlineEnd: 0 }}>{t("tours.featured")}</Tag>}
            </Flex>
          ),
        },
        {
          title: <span className="sr-only">{t("common.actions")}</span>,
          width: 116,
          fixed: "right",
          render: (_, r) => (
            <Flex gap={4} justify="flex-end">
              <Link href={`/admin/tours/${r.id}`} aria-label={t("common.edit")}><Button icon={<EditOutlined />} aria-hidden tabIndex={-1} /></Link>
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    { key: "toggle", icon: r.isPublished ? <EyeInvisibleOutlined /> : <EyeOutlined />, label: r.isPublished ? t("tours.unpublish") : t("tours.publish"), onClick: () => a.toggle(r.id, r.isPublished) },
                    { key: "dup", icon: <CopyOutlined />, label: t("tours.duplicate"), onClick: () => a.duplicate(r.id) },
                    { type: "divider" },
                    { key: "del", icon: <DeleteOutlined />, danger: true, label: t("common.delete"), onClick: () => a.remove(r.id, r.bookingCount) },
                  ],
                }}
              >
                <Button icon={<MoreOutlined />} aria-label={t("common.actions")} data-testid={`tour-actions-${r.id}`} />
              </Dropdown>
            </Flex>
          ),
        },
      ]}
    />
  );
}
