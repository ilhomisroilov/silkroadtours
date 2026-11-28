"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, Col, Flex, Input, InputNumber, Popconfirm, Row, Switch, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Attraction, LocalizedText, MediaItem } from "@/db/types";
import { useAdminApi } from "./booking-actions";
import { Field, GalleryField, HeroImageField, SaveBar, useDirty } from "./form-kit";
import { EditLanguageProvider, EditLanguageSwitch, emptyLocalized, LocalizedFields } from "./localized";

export interface EditorDestination {
  id?: number;
  slug: string;
  name: LocalizedText;
  tagline: LocalizedText;
  overview: LocalizedText;
  attractions: Attraction[];
  bestTime: LocalizedText;
  bestMonths: number[];
  lat: number;
  lng: number;
  heroImage: string;
  gallery: MediaItem[];
  seoTitle: LocalizedText | null;
  seoDescription: LocalizedText | null;
  sortOrder: number;
  isPublished: boolean;
}

const opt = (l: LocalizedText | null) => (l && (l.en || l.uz || l.ru) ? { en: l.en || l.uz || l.ru, uz: l.uz, ru: l.ru } : null);
const fill = (l: LocalizedText) => ({ ...l, en: l.en || l.uz || l.ru });

export function DestinationEditor({ initial }: { initial: EditorDestination }) {
  return (
    <EditLanguageProvider>
      <Inner initial={initial} />
    </EditLanguageProvider>
  );
}

function Inner({ initial }: { initial: EditorDestination }) {
  const t = useTranslations("admin");
  const td = useTranslations("admin.destinations");
  const tt = useTranslations("admin.tours");
  const tm = useTranslations("monthsShort");
  const router = useRouter();
  const call = useAdminApi();
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const { dirty, markSaved } = useDirty(d);
  const set = <K extends keyof EditorDestination>(k: K, v: EditorDestination[K]) => setD((x) => ({ ...x, [k]: v }));
  const setAttr = (i: number, patch: Partial<Attraction>) => set("attractions", d.attractions.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    const { id, ...body } = d;
    const payload = {
      ...body,
      overview: fill(d.overview),
      bestTime: fill(d.bestTime),
      seoTitle: opt(d.seoTitle),
      seoDescription: opt(d.seoDescription),
      attractions: d.attractions.map((a) => ({ ...a, description: fill(a.description), lat: a.lat ?? undefined, lng: a.lng ?? undefined, image: a.image || undefined })),
    };
    setBusy(true);
    if (id) {
      if (await call(`/api/admin/destinations/${id}`, { method: "PUT", json: payload }, t("common.saved"))) markSaved();
    } else {
      const r = await call<{ id: number }>("/api/admin/destinations", { method: "POST", json: payload }, t("common.saved"));
      if (r && typeof r === "object") {
        markSaved();
        router.push(`/admin/destinations/${r.id}`);
      }
    }
    setBusy(false);
  };

  return (
    <Flex vertical gap={16}>
      <Card size="small"><EditLanguageSwitch /></Card>
      <Card>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Field label={tt("slug")} help={`…/destinations/${d.slug || "…"}`}>
              <Input value={d.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
            </Field>
          </Col>
          <Col xs={12} md={6}><Field label={tt("sortOrder")}><InputNumber style={{ width: "100%" }} value={d.sortOrder} onChange={(v) => set("sortOrder", v ?? 0)} /></Field></Col>
          <Col xs={12} md={6}>
            <Field label={tt("isPublished")}>
              <Switch checked={d.isPublished} onChange={(v) => set("isPublished", v)} checkedChildren={t("common.published")} unCheckedChildren={t("common.draft")} />
            </Field>
          </Col>
        </Row>
        <LocalizedFields label={td("name")} value={d.name} onChange={(v) => set("name", v)} required />
        <LocalizedFields label={td("tagline")} value={d.tagline} onChange={(v) => set("tagline", v)} required />
        <LocalizedFields label={td("overview")} value={d.overview} onChange={(v) => set("overview", v)} multiline rows={6} required />
        <LocalizedFields label={td("bestTime")} value={d.bestTime} onChange={(v) => set("bestTime", v)} multiline rows={2} required />
        <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>{td("bestMonths")}</Typography.Text>
        <Checkbox.Group
          value={d.bestMonths}
          onChange={(v) => set("bestMonths", [...(v as number[])].sort((a, b) => a - b))}
          options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: tm(String(i + 1) as never) }))}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}
        />
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={12}><Field label={tt("lat")}><InputNumber style={{ width: "100%" }} step={0.0001} value={d.lat} onChange={(v) => set("lat", v ?? 0)} /></Field></Col>
          <Col xs={12}><Field label={tt("lng")}><InputNumber style={{ width: "100%" }} step={0.0001} value={d.lng} onChange={(v) => set("lng", v ?? 0)} /></Field></Col>
        </Row>
      </Card>

      <HeroImageField label={tt("heroImage")} value={d.heroImage} onChange={(url) => set("heroImage", url)} />
      <GalleryField label={tt("gallery")} value={d.gallery} onChange={(v) => set("gallery", v)} alt={d.name} />

      <Card
        title={`${td("attractions")} (${d.attractions.length})`}
        extra={<Button icon={<PlusOutlined />} onClick={() => set("attractions", [...d.attractions, { name: emptyLocalized(), description: emptyLocalized() }])}>{td("addAttraction")}</Button>}
      >
        <Flex vertical gap={12}>
          {d.attractions.map((a, i) => (
            <Card
              key={i}
              size="small"
              type="inner"
              title={`${i + 1}. ${a.name.uz || a.name.en || "…"}`}
              extra={
                <Popconfirm title={t("common.confirmDelete")} onConfirm={() => set("attractions", d.attractions.filter((_, j) => j !== i))}>
                  <Button size="small" danger icon={<DeleteOutlined />}>{t("common.remove")}</Button>
                </Popconfirm>
              }
            >
              <LocalizedFields label={td("attractionName")} value={a.name} onChange={(v) => setAttr(i, { name: v })} required />
              <LocalizedFields label={td("attractionDescription")} value={a.description} multiline rows={2} onChange={(v) => setAttr(i, { description: v })} />
              <Row gutter={[12, 12]}>
                <Col xs={12}><Field label={tt("lat")}><InputNumber style={{ width: "100%" }} step={0.0001} value={a.lat ?? null} onChange={(v) => setAttr(i, { lat: v ?? undefined })} /></Field></Col>
                <Col xs={12}><Field label={tt("lng")}><InputNumber style={{ width: "100%" }} step={0.0001} value={a.lng ?? null} onChange={(v) => setAttr(i, { lng: v ?? undefined })} /></Field></Col>
              </Row>
            </Card>
          ))}
        </Flex>
      </Card>

      <Card title="SEO">
        <LocalizedFields label={tt("seoTitle")} value={d.seoTitle} onChange={(v) => set("seoTitle", v)} />
        <LocalizedFields label={tt("seoDescription")} value={d.seoDescription} multiline rows={2} onChange={(v) => set("seoDescription", v)} />
      </Card>

      <SaveBar dirty={dirty} busy={busy} onSave={save} testId="destination-save" />
    </Flex>
  );
}

export function DeleteButton({ url, label, confirmText, redirectTo }: { url: string; label: string; confirmText: string; redirectTo?: string }) {
  const call = useAdminApi();
  const router = useRouter();
  return (
    <Popconfirm
      title={confirmText}
      okButtonProps={{ danger: true }}
      onConfirm={async () => {
        if ((await call(url, { method: "DELETE" })) && redirectTo) router.push(redirectTo);
      }}
    >
      <Button type="text" danger icon={<DeleteOutlined />}>{label}</Button>
    </Popconfirm>
  );
}
