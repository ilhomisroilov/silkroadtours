"use client";

import { BellOutlined, CheckOutlined, MessageOutlined } from "@ant-design/icons";
import { App, Button, Flex, Input, Radio, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { BookingStatus } from "@/db/types";
import { STATUS_TRANSITIONS } from "@/lib/booking-status";
import { apiFetch, translateCode } from "@/lib/client/api";

/** Calls an admin API route, shows a short message, and refreshes the server-rendered page on success. */
export function useAdminApi() {
  const te = useTranslations("errors");
  const router = useRouter();
  const { message } = App.useApp();
  return async function call<T = true>(url: string, init: RequestInit & { json?: unknown }, success?: string): Promise<T | null> {
    const r = await apiFetch<T>(url, init);
    if (!r.ok) {
      const title = translateCode(r.error.code, te as never);
      message.error(r.error.message ? `${title}: ${r.error.message}` : title, 6);
      return null;
    }
    if (success) message.success(success);
    router.refresh();
    return (r.data ?? true) as T;
  };
}

export function BookingStatusControl({ id, status }: { id: number; status: BookingStatus }) {
  const t = useTranslations("admin");
  const call = useAdminApi();
  const options = STATUS_TRANSITIONS[status];
  const [to, setTo] = useState<BookingStatus | "">(options[0] ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (options.length === 0) return <Typography.Text type="secondary">{t("bookings.noTransitions")}</Typography.Text>;
  return (
    <Flex vertical gap={12}>
      <Typography.Text strong id="status-to">{t("bookings.changeStatus")}</Typography.Text>
      <Radio.Group
        aria-labelledby="status-to"
        optionType="button"
        buttonStyle="solid"
        value={to}
        onChange={(e) => setTo(e.target.value as BookingStatus)}
        options={options.map((s) => ({ value: s, label: t(`status.${s}`) }))}
        data-testid="status-select"
        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
      />
      <label htmlFor="status-note" style={{ fontWeight: 600 }}>{t("bookings.statusNote")}</label>
      <Input.TextArea id="status-note" value={note} onChange={(e) => setNote(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} />
      <Button
        type="primary"
        icon={<CheckOutlined />}
        loading={busy}
        disabled={!to}
        data-testid="status-apply"
        style={{ alignSelf: "flex-start" }}
        onClick={async () => {
          if (!to) return;
          setBusy(true);
          const ok = await call(`/api/admin/bookings/${id}`, { method: "PATCH", json: { status: to, note: note || undefined } }, t("common.saved"));
          setBusy(false);
          if (ok) setNote("");
        }}
      >
        {t("bookings.apply")}
      </Button>
    </Flex>
  );
}

export function NoteForm({ url }: { url: string }) {
  const t = useTranslations("admin");
  const call = useAdminApi();
  const [body, setBody] = useState("");
  return (
    <Flex vertical gap={8}>
      <label htmlFor="note-body" className="sr-only">{t("bookings.addNote")}</label>
      <Input.TextArea id="note-body" value={body} placeholder={t("bookings.notePlaceholder")} onChange={(e) => setBody(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} />
      <Button
        icon={<MessageOutlined />}
        disabled={!body.trim()}
        style={{ alignSelf: "flex-start" }}
        onClick={async () => {
          if (await call(url, { method: "POST", json: { body } }, t("common.saved"))) setBody("");
        }}
      >
        {t("bookings.addNote")}
      </Button>
    </Flex>
  );
}

export function ResendButton({ url }: { url: string }) {
  const t = useTranslations("admin");
  const call = useAdminApi();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      icon={<BellOutlined />}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await call(url, { method: "POST" }, t("bookings.resent"));
        setBusy(false);
      }}
    >
      {t("bookings.resend")}
    </Button>
  );
}
