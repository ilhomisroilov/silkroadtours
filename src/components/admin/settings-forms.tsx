"use client";

import { KeyOutlined, ReloadOutlined, SaveOutlined, SendOutlined, UserAddOutlined } from "@ant-design/icons";
import { Button, Col, Flex, Form, Input, InputNumber, Modal, Row, Select, Switch, Table, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminRole, ContactSettings, ExchangeRates } from "@/db/types";
import { useAdminApi } from "./booking-actions";
import { Field } from "./form-kit";
import { EditLanguageProvider, LocalizedFields } from "./localized";

type ContactKey = "agencyName" | "phone" | "email" | "whatsapp" | "telegram" | "licenseNumber";

export function ContactForm({ initial, canEdit }: { initial: ContactSettings; canEdit: boolean }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const call = useAdminApi();
  const [c, setC] = useState(initial);
  const [busy, setBusy] = useState(false);
  const fields: [ContactKey, string, string?][] = [
    ["agencyName", t("agencyName")],
    ["phone", t("phone"), "+998 …"],
    ["email", t("email"), "info@…"],
    ["whatsapp", t("whatsapp"), "+998 …"],
    ["telegram", t("telegram"), "@…"],
    ["licenseNumber", t("licence")],
  ];
  return (
    <EditLanguageProvider>
      <Typography.Paragraph type="secondary">{t("contactHint")}</Typography.Paragraph>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {fields.map(([k, label, ph]) => (
          <Col key={k} xs={24} md={12}>
            <Field label={label}>
              <Input value={c[k]} placeholder={ph} disabled={!canEdit} onChange={(e) => setC({ ...c, [k]: e.target.value })} data-testid={`contact-${k}`} />
            </Field>
          </Col>
        ))}
      </Row>
      <LocalizedFields label={t("address")} value={c.address} onChange={(a) => setC({ ...c, address: a })} />
      {canEdit && (
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={busy}
          data-testid="contact-save"
          onClick={async () => {
            setBusy(true);
            await call("/api/admin/settings/contact", { method: "PUT", json: c }, tc("saved"));
            setBusy(false);
          }}
        >
          {tc("save")}
        </Button>
      )}
    </EditLanguageProvider>
  );
}

export function RatesForm({ initial, canEdit }: { initial: ExchangeRates; canEdit: boolean }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const call = useAdminApi();
  const [uzs, setUzs] = useState<number>(initial.rates.UZS);
  const [eur, setEur] = useState<number>(initial.rates.EUR);
  const [updated, setUpdated] = useState(initial);
  return (
    <Flex vertical gap={12}>
      <Typography.Text type="secondary">
        {t("ratesHint")} {t("ratesUpdated", { date: updated.updatedAt.slice(0, 16).replace("T", " "), source: updated.source })}
      </Typography.Text>
      <Row gutter={[16, 16]} align="bottom">
        <Col xs={24} sm={12} md={8}>
          <Field label={t("rateUzs")}>
            <InputNumber style={{ width: "100%" }} min={1} step={0.01} value={uzs} disabled={!canEdit} onChange={(v) => setUzs(Number(v ?? 0))} prefix="1 USD =" suffix="UZS" />
          </Field>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Field label={t("rateEur")}>
            <InputNumber style={{ width: "100%" }} min={0.01} step={0.0001} value={eur} disabled={!canEdit} onChange={(v) => setEur(Number(v ?? 0))} prefix="1 USD =" suffix="EUR" />
          </Field>
        </Col>
      </Row>
      <Flex wrap gap={8}>
        {canEdit && (
          <Button type="primary" icon={<SaveOutlined />} onClick={() => call("/api/admin/settings/exchange_rates", { method: "PUT", json: { rates: { USD: 1, UZS: uzs, EUR: eur } } }, tc("saved"))}>
            {tc("save")}
          </Button>
        )}
        <Button
          icon={<ReloadOutlined />}
          onClick={async () => {
            const r = await call<ExchangeRates>("/api/admin/settings/rates/refresh", { method: "POST" }, tc("saved"));
            if (r && typeof r === "object") {
              setUzs(r.rates.UZS);
              setEur(r.rates.EUR);
              setUpdated(r);
            }
          }}
        >
          {t("refreshCbu")}
        </Button>
      </Flex>
    </Flex>
  );
}

export function TelegramTest() {
  const t = useTranslations("admin.settings");
  const call = useAdminApi();
  return (
    <Flex vertical gap={12} align="flex-start">
      <Typography.Text type="secondary">{t("telegramHint")}</Typography.Text>
      <Button icon={<SendOutlined />} onClick={() => call("/api/admin/settings/telegram/test", { method: "POST" }, t("testSent"))}>{t("sendTest")}</Button>
    </Flex>
  );
}

interface UserRow { id: number; email: string; name: string; role: AdminRole; isActive: boolean; lastLoginAt: string | null }

export function UsersManager({ users, meId }: { users: UserRow[]; meId: number }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const call = useAdminApi();
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [pw, setPw] = useState("");
  const [form] = Form.useForm();
  const roles = [
    { value: "editor", label: t("roles.editor") },
    { value: "owner", label: t("roles.owner") },
  ];
  return (
    <Flex vertical gap={16}>
      <Table<UserRow>
        rowKey="id"
        size="middle"
        pagination={false}
        scroll={{ x: 720 }}
        dataSource={users}
        columns={[
          { title: t("name"), render: (_, u) => <Typography.Text strong>{u.name}{u.id === meId ? ` (${t("you")})` : ""}</Typography.Text> },
          { title: t("email"), dataIndex: "email" },
          {
            title: t("role"),
            width: 160,
            render: (_, u) => (
              <Select aria-label={t("role")} defaultValue={u.role} options={roles} style={{ width: 140 }} onChange={(role) => call(`/api/admin/users/${u.id}`, { method: "PATCH", json: { role } }, tc("saved"))} />
            ),
          },
          {
            title: t("active"),
            width: 90,
            render: (_, u) => <Switch checked={u.isActive} disabled={u.id === meId} onChange={(v) => call(`/api/admin/users/${u.id}`, { method: "PATCH", json: { isActive: v } }, tc("saved"))} aria-label={u.isActive ? t("deactivate") : t("activate")} />,
          },
          { title: t("lastLogin"), width: 150, render: (_, u) => <Typography.Text type="secondary">{u.lastLoginAt?.slice(0, 16).replace("T", " ") ?? "—"}</Typography.Text> },
          {
            title: <span className="sr-only">{tc("actions")}</span>,
            width: 170,
            render: (_, u) => <Button size="small" icon={<KeyOutlined />} onClick={() => { setPw(""); setResetFor(u); }}>{t("resetPassword")}</Button>,
          },
        ]}
      />
      <Modal
        open={!!resetFor}
        title={`${t("resetPassword")}: ${resetFor?.name ?? ""}`}
        okText={tc("save")}
        cancelText={tc("cancel")}
        okButtonProps={{ disabled: pw.length < 12 }}
        onCancel={() => setResetFor(null)}
        onOk={async () => {
          if (resetFor && (await call(`/api/admin/users/${resetFor.id}`, { method: "PATCH", json: { password: pw } }, tc("saved")))) setResetFor(null);
        }}
      >
        <Field label={t("newPassword")} help="12+">
          <Input.Password value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </Field>
      </Modal>
      <div style={{ background: "var(--adm-surface-2)", borderRadius: 8, padding: 16 }}>
        <Typography.Title level={5} style={{ marginTop: 0 }}>{t("newUser")}</Typography.Title>
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ role: "editor" }}
          onFinish={async (v) => {
            if (await call("/api/admin/users", { method: "POST", json: v }, tc("saved"))) form.resetFields();
          }}
        >
          <Row gutter={[12, 0]}>
            <Col xs={24} md={6}><Form.Item name="name" label={t("name")} rules={[{ required: true, min: 2 }]}><Input /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item name="email" label={t("email")} rules={[{ required: true, type: "email" }]}><Input /></Form.Item></Col>
            <Col xs={24} md={5}><Form.Item name="password" label={t("password")} rules={[{ required: true, min: 12 }]}><Input.Password autoComplete="new-password" /></Form.Item></Col>
            <Col xs={24} md={4}><Form.Item name="role" label={t("role")}><Select options={roles} /></Form.Item></Col>
            <Col xs={24} md={3}><Form.Item label=" "><Button type="primary" htmlType="submit" icon={<UserAddOutlined />} block>{tc("add")}</Button></Form.Item></Col>
          </Row>
        </Form>
      </div>
    </Flex>
  );
}

export function OwnPasswordForm() {
  const t = useTranslations("admin.settings");
  const call = useAdminApi();
  const [form] = Form.useForm();
  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      onFinish={async (v) => {
        if (await call("/api/admin/auth/password", { method: "POST", json: { currentPassword: v.current, newPassword: v.next } }, t("changePassword"))) form.resetFields();
      }}
    >
      <Row gutter={[12, 0]} align="bottom">
        <Col xs={24} md={9}><Form.Item name="current" label={t("currentPassword")} rules={[{ required: true }]}><Input.Password autoComplete="current-password" /></Form.Item></Col>
        <Col xs={24} md={9}><Form.Item name="next" label={t("newPassword")} rules={[{ required: true, min: 12 }]}><Input.Password autoComplete="new-password" /></Form.Item></Col>
        <Col xs={24} md={6}><Form.Item label=" "><Button htmlType="submit" icon={<KeyOutlined />} block>{t("changePassword")}</Button></Form.Item></Col>
      </Row>
    </Form>
  );
}

/** The signed-in admin's own details: name can be changed here; email and role are set by the owner. */
export function OwnProfileForm({ initial }: { initial: { name: string; email: string; role: string; lastLoginAt: string | null } }) {
  const t = useTranslations("admin");
  const call = useAdminApi();
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [busy, setBusy] = useState(false);
  return (
    <Flex vertical gap={16}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Field label={t("settings.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" data-testid="own-name" />
          </Field>
        </Col>
        <Col xs={24} md={12}>
          <Field label={t("settings.email")} help={t("panel.emailFixed")}>
            <Input value={initial.email} disabled />
          </Field>
        </Col>
        <Col xs={24} md={12}>
          <Field label={t("settings.role")}>
            <Input value={initial.role} disabled />
          </Field>
        </Col>
        <Col xs={24} md={12}>
          <Field label={t("settings.lastLogin")}>
            <Input value={initial.lastLoginAt?.slice(0, 16).replace("T", " ") ?? "—"} disabled />
          </Field>
        </Col>
      </Row>
      <Typography.Text type="secondary">{t("panel.autoSignOut")}</Typography.Text>
      <div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={busy}
          disabled={name.trim().length < 2 || name.trim() === initial.name}
          data-testid="own-profile-save"
          onClick={async () => {
            setBusy(true);
            if (await call("/api/admin/auth/me", { method: "PATCH", json: { name: name.trim() } }, t("common.saved"))) router.refresh();
            setBusy(false);
          }}
        >
          {t("common.save")}
        </Button>
      </div>
    </Flex>
  );
}
