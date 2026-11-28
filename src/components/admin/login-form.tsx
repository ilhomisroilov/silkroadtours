"use client";

import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input } from "antd";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { apiFetch, translateCode } from "@/lib/client/api";

export function LoginForm({ idle = false }: { idle?: boolean }) {
  const t = useTranslations("admin.login");
  const tp = useTranslations("admin.panel");
  const te = useTranslations("errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
    {idle && <Alert type="info" showIcon title={t("idle")} style={{ marginBottom: 16 }} data-testid="admin-idle-notice" />}
    <Form
      layout="vertical"
      requiredMark={false}
      size="large"
      onFinish={async (v: { email: string; password: string }) => {
        setBusy(true);
        setError(null);
        const r = await apiFetch("/api/admin/auth/login", { method: "POST", json: v });
        setBusy(false);
        if (r.ok) {
          router.replace("/admin");
          router.refresh();
        } else setError(translateCode(r.error.code, te as never));
      }}
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} data-testid="login-error" />}
      <Form.Item label={t("email")} name="email" rules={[{ required: true, type: "email", message: tp("required") }]}>
        <Input id="email" prefix={<MailOutlined />} type="email" autoComplete="username" />
      </Form.Item>
      <Form.Item label={t("password")} name="password" rules={[{ required: true, message: tp("required") }]}>
        <Input.Password id="password" prefix={<LockOutlined />} autoComplete="current-password" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={busy} data-testid="login-submit">{t("submit")}</Button>
    </Form>
    </>
  );
}
