"use client";

import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Card, Col, Empty, Flex, Image, Input, Row, Space, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import type { LocalizedText, MediaItem } from "@/db/types";
import { MediaPicker } from "./media-picker";

export const NO_IMAGE =
  "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="#eef1f5"/></svg>');

/** A labelled control: label on top, optional hint below. */
export function Field({ label, children, help }: { label: string; children: ReactNode; help?: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontWeight: 600, fontSize: 14 }}>
      {label}
      <span style={{ fontWeight: 400 }}>{children}</span>
      {help && <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>{help}</Typography.Text>}
    </label>
  );
}

/** Sticky bar at the bottom of a form: shows whether anything is unsaved and holds the save button. */
export function SaveBar({ dirty, busy, onSave, testId, extra }: { dirty: boolean; busy: boolean; onSave: () => void; testId?: string; extra?: ReactNode }) {
  const t = useTranslations("admin");
  return (
    <div style={{ position: "sticky", bottom: 0, zIndex: 20, marginTop: 16, paddingBlock: 8, background: "#f4f6f9" }}>
      <Flex justify="space-between" align="center" gap={12} wrap style={{ background: "#fff", border: "1px solid #dfe4ea", borderRadius: 10, padding: "10px 14px", boxShadow: "0 -4px 16px rgba(16,32,48,0.06)" }}>
        <Typography.Text type={dirty ? "warning" : "secondary"}>{dirty ? t("panel.unsaved") : t("panel.noChanges")}</Typography.Text>
        <Space wrap>
          {extra}
          <Button type="primary" icon={<SaveOutlined />} loading={busy} onClick={onSave} data-testid={testId}>{t("common.save")}</Button>
        </Space>
      </Flex>
    </div>
  );
}

/** Tracks whether a value differs from what was last saved and warns before leaving the page with changes. */
export function useDirty<T>(value: T) {
  const [saved, setSaved] = useState(() => JSON.stringify(value));
  const dirty = JSON.stringify(value) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return { dirty, markSaved: () => setSaved(JSON.stringify(value)) };
}

export function AddByUrl({ onAdd }: { onAdd: (url: string) => void }) {
  const t = useTranslations("admin.panel");
  const [url, setUrl] = useState("");
  return (
    <Space.Compact style={{ width: "100%", marginTop: 12 }}>
      <Input aria-label={t("imageUrl")} placeholder={t("imageUrl")} value={url} onChange={(e) => setUrl(e.target.value)} />
      <Button icon={<PlusOutlined />} disabled={!url.trim()} onClick={() => { onAdd(url.trim()); setUrl(""); }}>{t("addImage")}</Button>
    </Space.Compact>
  );
}

/** Main picture: preview, library picker, and the address for those who paste one. */
export function HeroImageField({ label, hint, value, onChange }: { label: string; hint?: ReactNode; value: string; onChange: (url: string) => void }) {
  return (
    <Card title={label}>
      {hint && <Typography.Paragraph type="secondary">{hint}</Typography.Paragraph>}
      <Flex gap={16} wrap align="flex-start">
        {value ? <Image src={value} alt={label} width={260} height={180} style={{ objectFit: "cover", borderRadius: 8 }} fallback={NO_IMAGE} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
        <Flex vertical gap={8} style={{ flex: "1 1 260px", minWidth: 0 }}>
          <Input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder="/images/…" />
          <MediaPicker onPick={onChange} />
        </Flex>
      </Flex>
    </Card>
  );
}

/** Photo gallery as thumbnails: add from the library, reorder, remove. */
export function GalleryField({ label, value, onChange, alt }: { label: string; value: MediaItem[]; onChange: (v: MediaItem[]) => void; alt: LocalizedText }) {
  const t = useTranslations("admin");
  const add = (url: string, list: MediaItem[]) => (list.some((g) => g.url === url) ? list : [...list, { url, type: "image" as const, alt: { ...alt } }]);
  let pending = value;
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    onChange(next);
  };
  return (
    <Card
      title={`${label} (${value.length})`}
      extra={<MediaPicker multiple onPick={(url) => { pending = add(url, pending); onChange(pending); }} />}
    >
      {value.length === 0 ? (
        <Empty description={t("common.empty")} />
      ) : (
        <Row gutter={[12, 12]}>
          {value.map((g, i) => (
            <Col key={g.url} xs={12} sm={8} lg={6}>
              <Card size="small" cover={<Image src={g.url} alt={`${label} ${i + 1}`} height={140} style={{ objectFit: "cover" }} fallback={NO_IMAGE} />} styles={{ body: { padding: 8 } }}>
                <Flex justify="space-between">
                  <Space size={4}>
                    <Button size="small" icon={<ArrowUpOutlined rotate={-90} />} disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("common.moveUp")} />
                    <Button size="small" icon={<ArrowDownOutlined rotate={-90} />} disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={t("common.moveDown")} />
                  </Space>
                  <Button size="small" danger icon={<DeleteOutlined />} aria-label={t("common.remove")} onClick={() => onChange(value.filter((_, j) => j !== i))} />
                </Flex>
              </Card>
            </Col>
          ))}
        </Row>
      )}
      <AddByUrl onAdd={(url) => onChange(add(url, value))} />
    </Card>
  );
}
