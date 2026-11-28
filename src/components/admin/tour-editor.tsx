"use client";

import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  DatePicker,
  Empty,
  Flex,
  Image,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AUDIENCES,
  BOOKING_TYPES,
  CURRENCIES,
  DEPARTURE_STATUSES,
  DIFFICULTIES,
  MEALS,
  TOUR_BADGES,
  TOUR_CATEGORIES,
  type AccommodationItem,
  type BookingType,
  type Currency,
  type DepartureStatus,
  type ExchangeRates,
  type LocalizedText,
  type Meal,
  type MediaItem,
  type RoutePoint,
  type TransportItem,
} from "@/db/types";
import { CURRENCY_EXPONENT, formatMoney, tierPriceIn } from "@/lib/pricing";
import { useAdminApi } from "./booking-actions";
import { EditLanguageProvider, EditLanguageSwitch, emptyLocalized, LocalizedFields, LocalizedLines } from "./localized";
import { Field, GalleryField, HeroImageField, SaveBar } from "./form-kit";

const PointPicker = dynamic(() => import("./point-picker"), { ssr: false });

export interface EditorTour {
  id?: number;
  slug: string;
  audience: "inbound" | "domestic";
  category: (typeof TOUR_CATEGORIES)[number];
  primaryDestinationId: number;
  destinationIds: number[];
  title: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText;
  durationDays: number;
  durationNights: number;
  difficulty: (typeof DIFFICULTIES)[number];
  minGroup: number;
  maxGroup: number;
  baseCurrency: Currency;
  childPricePercent: number;
  compareAtPriceMinor: number | null;
  badges: (typeof TOUR_BADGES)[number][];
  included: LocalizedText[];
  excluded: LocalizedText[];
  accommodation: AccommodationItem[];
  transport: TransportItem[];
  route: RoutePoint[];
  guideLanguages: string[];
  seasonMonths: number[];
  heroImage: string;
  gallery: MediaItem[];
  seoTitle: LocalizedText | null;
  seoDescription: LocalizedText | null;
  isFeatured: boolean;
  isPublished: boolean;
  sortOrder: number;
}

export interface EditorDay {
  dayNumber: number;
  title: LocalizedText;
  description: LocalizedText;
  meals: Meal[];
  overnight: LocalizedText | null;
  distanceKm: number | null;
  walkingHours: number | null;
}

export interface EditorTier {
  bookingType: BookingType;
  minPax: number;
  maxPax: number;
  priceUsd: number | null;
  priceUzs: number | null;
  priceEur: number | null;
}

export interface EditorDeparture {
  id: number;
  startDate: string;
  endDate: string;
  seatsTotal: number;
  seatsBooked: number;
  status: DepartureStatus;
  priceModifierPercent: number;
}

const nonEmpty = (l: LocalizedText) => !!(l.en.trim() || l.uz.trim() || l.ru.trim());
const optionalLocalized = (l: LocalizedText | null) => (l && nonEmpty(l) ? { en: l.en.trim() || l.uz || l.ru, uz: l.uz, ru: l.ru } : null);
/** Long texts need English on the server; when only Uzbek or Russian was written, it stands in for English. */
const longText = (l: LocalizedText) => ({ en: l.en.trim() || l.uz.trim() || l.ru.trim(), uz: l.uz, ru: l.ru });

/** Shape the editor state into the exact body PUT /api/admin/tours/[id] expects. */
export function toUpsertBody(t: EditorTour) {
  return {
    slug: t.slug.trim(),
    audience: t.audience,
    category: t.category,
    primaryDestinationId: t.primaryDestinationId,
    destinationIds: t.destinationIds.filter((d) => d !== t.primaryDestinationId),
    title: t.title,
    summary: longText(t.summary),
    description: longText(t.description),
    durationDays: t.durationDays,
    durationNights: t.durationNights,
    difficulty: t.difficulty,
    minGroup: t.minGroup,
    maxGroup: t.maxGroup,
    baseCurrency: t.baseCurrency,
    childPricePercent: t.childPricePercent,
    compareAtPriceMinor: t.compareAtPriceMinor,
    badges: t.badges,
    included: t.included.filter(nonEmpty).map(longText),
    excluded: t.excluded.filter(nonEmpty).map(longText),
    accommodation: t.accommodation,
    transport: t.transport,
    route: t.route,
    guideLanguages: t.guideLanguages,
    seasonMonths: t.seasonMonths,
    heroImage: t.heroImage.trim(),
    gallery: t.gallery,
    seoTitle: optionalLocalized(t.seoTitle),
    seoDescription: optionalLocalized(t.seoDescription),
    isFeatured: t.isFeatured,
    isPublished: t.isPublished,
    sortOrder: t.sortOrder,
  };
}

/** What would make the server refuse the tour, in words the editor can act on. */
function problems(t: EditorTour, tt: (k: string, v?: Record<string, string>) => string): string[] {
  const out: string[] = [];
  const langs = { en: "English", uz: "Oʻzbekcha", ru: "Русский" } as const;
  for (const l of ["en", "uz", "ru"] as const) if (!t.title[l].trim()) out.push(`${tt("titleField")}: ${tt("missingTranslation", { lang: langs[l] })}`);
  if (!nonEmpty(t.summary)) out.push(`${tt("summary")}: —`);
  if (!nonEmpty(t.description)) out.push(`${tt("description")}: —`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.slug.trim())) out.push(`${tt("slug")}: a-z, 0-9, -`);
  if (t.maxGroup < t.minGroup) out.push(`${tt("maxGroup")} < ${tt("minGroup")}`);
  return out;
}

export function TourEditor(props: {
  initial: EditorTour;
  itinerary: EditorDay[];
  tiers: EditorTier[];
  departures: EditorDeparture[];
  destinations: { id: number; name: string }[];
  rates: ExchangeRates;
}) {
  return (
    <EditLanguageProvider>
      <TourEditorInner {...props} />
    </EditLanguageProvider>
  );
}

function TourEditorInner({
  initial,
  itinerary: initialDays,
  tiers: initialTiers,
  departures,
  destinations,
  rates,
}: {
  initial: EditorTour;
  itinerary: EditorDay[];
  tiers: EditorTier[];
  departures: EditorDeparture[];
  destinations: { id: number; name: string }[];
  rates: ExchangeRates;
}) {
  const t = useTranslations("admin");
  const tt = useTranslations("admin.tours");
  const tc = useTranslations("categories");
  const tb = useTranslations("badges");
  const td = useTranslations("difficulty");
  const tm = useTranslations("monthsShort");
  const tmeal = useTranslations("meals");
  const router = useRouter();
  const search = useSearchParams();
  const call = useAdminApi();
  const [tour, setTour] = useState<EditorTour>(initial);
  const [days, setDays] = useState<EditorDay[]>(initialDays);
  const [tiers, setTiers] = useState<EditorTier[]>(initialTiers);
  const [saved, setSaved] = useState({ tour: JSON.stringify(initial), days: JSON.stringify(initialDays), tiers: JSON.stringify(initialTiers) });
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const isNew = !tour.id;
  const set = <K extends keyof EditorTour>(k: K, v: EditorTour[K]) => setTour((x) => ({ ...x, [k]: v }));
  const dirtyTour = JSON.stringify(tour) !== saved.tour;
  const dirtyDays = JSON.stringify(days) !== saved.days;
  const dirtyTiers = JSON.stringify(tiers) !== saved.tiers;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyTour || dirtyDays || dirtyTiers) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyTour, dirtyDays, dirtyTiers]);

  const saveTour = async () => {
    const found = problems(tour, tt as never);
    setIssues(found);
    if (found.length) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBusy(true);
    const body = toUpsertBody(tour);
    if (isNew) {
      const r = await call<{ id: number }>("/api/admin/tours", { method: "POST", json: body }, tt("createdNotice"));
      setBusy(false);
      if (r && typeof r === "object") {
        setSaved((s) => ({ ...s, tour: JSON.stringify(tour) }));
        router.push(`/admin/tours/${r.id}?tab=itinerary`);
      }
      return;
    }
    const ok = await call(`/api/admin/tours/${tour.id}`, { method: "PUT", json: body }, t("common.saved"));
    if (ok) setSaved((s) => ({ ...s, tour: JSON.stringify(tour) }));
    setBusy(false);
  };

  const destOptions = destinations.map((d) => ({ value: d.id, label: d.name }));

  // ── Main ───────────────────────────────────────────────────────────────
  const content = (
    <Flex vertical gap={16}>
      <Card title={tt("tabs.content")}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <LocalizedFields label={tt("titleField")} value={tour.title} onChange={(v) => set("title", v)} required />
          </Col>
          <Col xs={24} md={12}>
            <Field label={tt("slug")} help={`gulistantravel.uz/…/tours/${tour.slug || "…"}`}>
              <Input value={tour.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
            </Field>
          </Col>
          <Col xs={24}>
            <LocalizedFields label={tt("summary")} value={tour.summary} onChange={(v) => set("summary", v)} multiline rows={2} required />
            <LocalizedFields label={tt("description")} value={tour.description} onChange={(v) => set("description", v)} multiline rows={6} required />
          </Col>
        </Row>
      </Card>

      <Card title={tt("primaryDestination")}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Field label={tt("audience")}>
              <Select style={{ width: "100%" }} value={tour.audience} onChange={(v) => set("audience", v)} options={AUDIENCES.map((a) => ({ value: a, label: a === "inbound" ? "Inbound" : "Domestic" }))} />
            </Field>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Field label={tt("category")}>
              <Select style={{ width: "100%" }} value={tour.category} onChange={(v) => set("category", v)} options={TOUR_CATEGORIES.map((c) => ({ value: c, label: tc(c) }))} />
            </Field>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Field label={tt("primaryDestination")}>
              <Select showSearch optionFilterProp="label" style={{ width: "100%" }} value={tour.primaryDestinationId} onChange={(v) => set("primaryDestinationId", v)} options={destOptions} />
            </Field>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Field label={tt("difficulty")}>
              <Select style={{ width: "100%" }} value={tour.difficulty} onChange={(v) => set("difficulty", v)} options={DIFFICULTIES.map((d) => ({ value: d, label: td(d) }))} />
            </Field>
          </Col>
          <Col xs={24}>
            <Field label={tt("otherDestinations")}>
              <Select
                mode="multiple"
                allowClear
                optionFilterProp="label"
                style={{ width: "100%" }}
                value={tour.destinationIds.filter((d) => d !== tour.primaryDestinationId)}
                onChange={(v) => set("destinationIds", v)}
                options={destOptions.filter((d) => d.value !== tour.primaryDestinationId)}
              />
            </Field>
          </Col>
        </Row>
      </Card>

      <Card title={tt("durationDays")}>
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}><Field label={tt("durationDays")}><InputNumber style={{ width: "100%" }} min={1} max={60} value={tour.durationDays} onChange={(v) => set("durationDays", v ?? 1)} /></Field></Col>
          <Col xs={12} md={6}><Field label={tt("durationNights")}><InputNumber style={{ width: "100%" }} min={0} max={60} value={tour.durationNights} onChange={(v) => set("durationNights", v ?? 0)} /></Field></Col>
          <Col xs={12} md={6}><Field label={tt("minGroup")}><InputNumber style={{ width: "100%" }} min={1} value={tour.minGroup} onChange={(v) => set("minGroup", v ?? 1)} /></Field></Col>
          <Col xs={12} md={6}><Field label={tt("maxGroup")}><InputNumber style={{ width: "100%" }} min={1} value={tour.maxGroup} status={tour.maxGroup < tour.minGroup ? "error" : undefined} onChange={(v) => set("maxGroup", v ?? 1)} /></Field></Col>
          <Col xs={24}>
            <Field label={tt("seasonMonths")}>
              <Flex wrap gap={6}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <Tag.CheckableTag
                    key={m}
                    checked={tour.seasonMonths.includes(m)}
                    onChange={(on) => set("seasonMonths", on ? [...tour.seasonMonths, m].sort((a, b) => a - b) : tour.seasonMonths.filter((x) => x !== m))}
                    style={{ padding: "6px 12px", fontSize: 14, border: "1px solid #d9d9d9" }}
                  >
                    {tm(String(m) as never)}
                  </Tag.CheckableTag>
                ))}
              </Flex>
            </Field>
          </Col>
          <Col xs={24} md={12}>
            <Field label={tt("guideLanguages")}>
              <Select
                mode="tags"
                style={{ width: "100%" }}
                value={tour.guideLanguages}
                onChange={(v: string[]) => set("guideLanguages", v.map((x) => x.trim().toLowerCase()).filter((x) => /^[a-z]{2}$/.test(x)))}
                options={["en", "ru", "uz", "de", "fr", "it", "es", "ja", "zh", "ko", "tr", "ar"].map((l) => ({ value: l, label: l.toUpperCase() }))}
              />
            </Field>
          </Col>
          <Col xs={24} md={12}>
            <Field label={tt("badges")}>
              <Checkbox.Group value={tour.badges} onChange={(v) => set("badges", v as EditorTour["badges"])} options={TOUR_BADGES.map((b) => ({ value: b, label: tb(b) }))} />
            </Field>
          </Col>
        </Row>
      </Card>

      <Card title={tt("tabs.pricing")}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Field label={tt("baseCurrency")}>
              <Select style={{ width: "100%" }} value={tour.baseCurrency} onChange={(v) => set("baseCurrency", v)} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
            </Field>
          </Col>
          <Col xs={24} sm={8}>
            <Field label={tt("childPercent")} help={t("panel.childPercent")}>
              <InputNumber style={{ width: "100%" }} min={0} max={100} suffix="%" value={tour.childPricePercent} onChange={(v) => set("childPricePercent", v ?? 0)} />
            </Field>
          </Col>
          <Col xs={24} sm={8}>
            <Field label={tt("compareAt")}>
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                prefix={tour.baseCurrency}
                value={tour.compareAtPriceMinor == null ? null : tour.compareAtPriceMinor / 10 ** CURRENCY_EXPONENT[tour.baseCurrency]}
                onChange={(v) => set("compareAtPriceMinor", v == null ? null : Math.round(Number(v) * 10 ** CURRENCY_EXPONENT[tour.baseCurrency]))}
              />
            </Field>
          </Col>
        </Row>
        <Typography.Paragraph type="secondary" style={{ margin: "12px 0 0" }}>{tt("previewNote")}</Typography.Paragraph>
      </Card>

      <Card title={`${tt("included")} / ${tt("excluded")}`}>
        <Row gutter={[16, 0]}>
          <Col xs={24} md={12}><LocalizedLines label={tt("included")} value={tour.included} onChange={(v) => set("included", v)} help={t("panel.lines")} /></Col>
          <Col xs={24} md={12}><LocalizedLines label={tt("excluded")} value={tour.excluded} onChange={(v) => set("excluded", v)} help={t("panel.lines")} /></Col>
        </Row>
      </Card>

      <Collapse
        items={[{
          key: "seo",
          label: tt("seo"),
          children: (
            <>
              <LocalizedFields label={tt("seoTitle")} value={tour.seoTitle} onChange={(v) => set("seoTitle", v)} />
              <LocalizedFields label={tt("seoDescription")} value={tour.seoDescription} onChange={(v) => set("seoDescription", v)} multiline rows={2} />
            </>
          ),
        }]}
      />

      <Card>
        <Flex wrap gap={24} align="center">
          <label style={{ display: "inline-flex", gap: 10, alignItems: "center", fontWeight: 600 }}>
            <Switch checked={tour.isPublished} onChange={(v) => set("isPublished", v)} data-testid="tour-published" /> {tt("isPublished")}
          </label>
          <label style={{ display: "inline-flex", gap: 10, alignItems: "center", fontWeight: 600 }}>
            <Switch checked={tour.isFeatured} onChange={(v) => set("isFeatured", v)} /> {tt("isFeatured")}
          </label>
          <label style={{ display: "inline-flex", gap: 10, alignItems: "center", fontWeight: 600 }}>
            {tt("sortOrder")} <InputNumber value={tour.sortOrder} onChange={(v) => set("sortOrder", v ?? 0)} style={{ width: 100 }} />
          </label>
        </Flex>
      </Card>
      <SaveBar dirty={dirtyTour} busy={busy} onSave={saveTour} testId="tour-save" />
    </Flex>
  );

  // ── Itinerary ──────────────────────────────────────────────────────────
  const renumber = (list: EditorDay[]) => list.map((d, i) => ({ ...d, dayNumber: i + 1 }));
  const updDay = (i: number, patch: Partial<EditorDay>) => setDays(days.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...days];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    setDays(renumber(next));
  };
  const itinerary = (
    <Flex vertical gap={12}>
      {days.length === 0 && <Empty description={t("common.empty")} />}
      <Collapse
        defaultActiveKey={days.length ? ["0"] : []}
        items={days.map((d, i) => ({
          key: String(i),
          label: (
            <Flex gap={8} align="center" wrap>
              <Tag color="blue" style={{ marginInlineEnd: 0 }}>{tt("day", { day: d.dayNumber })}</Tag>
              <span>{d.title.uz || d.title.en || d.title.ru || "…"}</span>
            </Flex>
          ),
          extra: (
            <Space size={4} onClick={(e) => e.stopPropagation()}>
              <Button size="small" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("common.moveUp")} />
              <Button size="small" icon={<ArrowDownOutlined />} disabled={i === days.length - 1} onClick={() => move(i, 1)} aria-label={t("common.moveDown")} />
              <Popconfirm title={t("common.confirmDelete")} onConfirm={() => setDays(renumber(days.filter((_, j) => j !== i)))}>
                <Button size="small" danger icon={<DeleteOutlined />} aria-label={t("common.remove")} />
              </Popconfirm>
            </Space>
          ),
          children: (
            <>
              <LocalizedFields label={tt("titleField")} value={d.title} onChange={(v) => updDay(i, { title: v })} required />
              <LocalizedFields label={tt("description")} value={d.description} multiline onChange={(v) => updDay(i, { description: v })} required />
              <LocalizedFields label={tt("overnight")} value={d.overnight} onChange={(v) => updDay(i, { overnight: v })} />
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Field label={tt("meals")}>
                    <Checkbox.Group value={d.meals} onChange={(v) => updDay(i, { meals: v as Meal[] })} options={MEALS.map((m) => ({ value: m, label: tmeal(m) }))} />
                  </Field>
                </Col>
                <Col xs={12} md={6}><Field label={tt("distanceKm")}><InputNumber style={{ width: "100%" }} min={0} value={d.distanceKm} onChange={(v) => updDay(i, { distanceKm: v })} /></Field></Col>
                <Col xs={12} md={6}><Field label={tt("walkingHours")}><InputNumber style={{ width: "100%" }} min={0} step={0.5} value={d.walkingHours} onChange={(v) => updDay(i, { walkingHours: v })} /></Field></Col>
              </Row>
            </>
          ),
        }))}
      />
      <Button type="dashed" block icon={<PlusOutlined />} onClick={() => setDays([...days, { dayNumber: days.length + 1, title: emptyLocalized(), description: emptyLocalized(), meals: [], overnight: null, distanceKm: null, walkingHours: null }])}>
        {tt("addDay")}
      </Button>
      <SaveBar
        dirty={dirtyDays}
        busy={busy}
        testId="itinerary-save"
        onSave={async () => {
          setBusy(true);
          const ok = await call(`/api/admin/tours/${tour.id}/itinerary`, {
            method: "PUT",
            json: days.map((d) => ({ ...d, description: longText(d.description), overnight: optionalLocalized(d.overnight) })),
          }, t("common.saved"));
          if (ok) setSaved((s) => ({ ...s, days: JSON.stringify(days) }));
          setBusy(false);
        }}
      />
    </Flex>
  );

  // ── Pricing ────────────────────────────────────────────────────────────
  const priceCols: { key: "priceUsd" | "priceUzs" | "priceEur"; cur: Currency }[] = [
    { key: "priceUsd", cur: "USD" },
    { key: "priceUzs", cur: "UZS" },
    { key: "priceEur", cur: "EUR" },
  ];
  const preview = (tier: EditorTier, cur: Currency) => {
    try {
      return formatMoney(tierPriceIn(tier, cur, tour.baseCurrency, rates).amountMinor, cur, "en");
    } catch {
      return "—";
    }
  };
  const updTier = (i: number, patch: Partial<EditorTier>) => setTiers(tiers.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const pricing = (
    <Flex vertical gap={12}>
      <Alert type="info" showIcon message={`${tt("previewNote")} USD 1 = ${rates.rates.UZS.toLocaleString("en")} UZS = ${rates.rates.EUR} EUR`} />
      <Table<EditorTier & { i: number }>
        rowKey="i"
        pagination={false}
        scroll={{ x: 900 }}
        dataSource={tiers.map((x, i) => ({ ...x, i }))}
        columns={[
          { title: tt("tierType"), width: 150, render: (_, r) => <Select aria-label={tt("tierType")} style={{ width: 140 }} value={r.bookingType} onChange={(v) => updTier(r.i, { bookingType: v })} options={BOOKING_TYPES.map((b) => ({ value: b, label: b }))} /> },
          { title: tt("tierMin"), width: 100, render: (_, r) => <InputNumber aria-label={tt("tierMin")} min={1} value={r.minPax} onChange={(v) => updTier(r.i, { minPax: v ?? 1 })} style={{ width: 80 }} /> },
          { title: tt("tierMax"), width: 100, render: (_, r) => <InputNumber aria-label={tt("tierMax")} min={1} value={r.maxPax} status={r.maxPax < r.minPax ? "error" : undefined} onChange={(v) => updTier(r.i, { maxPax: v ?? 1 })} style={{ width: 80 }} /> },
          ...priceCols.map((c) => ({
            title: <span>{c.cur}{c.cur === tour.baseCurrency && <Badge status="processing" style={{ marginInlineStart: 6 }} />}</span>,
            width: 160,
            render: (_: unknown, r: EditorTier & { i: number }) => (
              <InputNumber
                aria-label={c.cur}
                min={0}
                step={c.cur === "UZS" ? 10000 : 10}
                style={{ width: 150 }}
                value={r[c.key] == null ? null : r[c.key]! / 10 ** CURRENCY_EXPONENT[c.cur]}
                placeholder={c.cur === tour.baseCurrency ? "" : preview(r, c.cur)}
                formatter={(v) => (v == null || String(v) === "" ? "" : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " "))}
                parser={(v) => Number((v ?? "").replace(/\s/g, "")) as never}
                onChange={(v) => updTier(r.i, { [c.key]: v == null ? null : Math.round(Number(v) * 10 ** CURRENCY_EXPONENT[c.cur]) })}
              />
            ),
          })),
          { title: tt("preview"), render: (_, r) => <Typography.Text type="secondary" style={{ fontSize: 12 }}>{CURRENCIES.map((c) => preview(r, c)).join(" · ")}</Typography.Text> },
          {
            title: <span className="sr-only">{t("common.actions")}</span>,
            width: 60,
            render: (_, r) => <Button danger type="text" icon={<DeleteOutlined />} aria-label={t("common.remove")} onClick={() => setTiers(tiers.filter((_, j) => j !== r.i))} />,
          },
        ]}
      />
      <Button type="dashed" icon={<PlusOutlined />} onClick={() => setTiers([...tiers, { bookingType: "private", minPax: (tiers.at(-1)?.maxPax ?? 0) + 1, maxPax: (tiers.at(-1)?.maxPax ?? 0) + 2, priceUsd: null, priceUzs: null, priceEur: null }])}>
        {tt("addTier")}
      </Button>
      <SaveBar
        dirty={dirtyTiers}
        busy={busy}
        testId="pricing-save"
        onSave={async () => {
          setBusy(true);
          const ok = await call(`/api/admin/tours/${tour.id}/pricing`, { method: "PUT", json: tiers }, t("common.saved"));
          if (ok) setSaved((s) => ({ ...s, tiers: JSON.stringify(tiers) }));
          setBusy(false);
        }}
      />
    </Flex>
  );

  // ── Media ──────────────────────────────────────────────────────────────
  const media = (
    <Flex vertical gap={16}>
      <HeroImageField label={tt("heroImage")} hint={tt("imageHint")} value={tour.heroImage} onChange={(url) => set("heroImage", url)} />
      <GalleryField label={tt("gallery")} value={tour.gallery} onChange={(v) => set("gallery", v)} alt={tour.title} />
      <SaveBar dirty={dirtyTour} busy={busy} onSave={saveTour} testId="media-save" />
    </Flex>
  );

  // ── Route ──────────────────────────────────────────────────────────────
  const route = (
    <Flex vertical gap={16}>
      <Card title={tt("routePoints")}>
        <Typography.Paragraph type="secondary">{tt("pickOnMap")}</Typography.Paragraph>
        <div style={{ height: 320, overflow: "hidden", borderRadius: 8 }}>
          <PointPicker points={tour.route.map((p) => ({ lat: p.lat, lng: p.lng, label: p.label.en }))} onPick={(lat, lng) => set("route", [...tour.route, { lat, lng, label: emptyLocalized(), day: tour.route.length + 1 }])} />
        </div>
        <Flex vertical gap={12} style={{ marginTop: 16 }}>
          {tour.route.map((p, i) => (
            <Card key={i} size="small" title={`${i + 1}. ${p.label.uz || p.label.en || "…"}`} extra={<Button size="small" danger icon={<DeleteOutlined />} onClick={() => set("route", tour.route.filter((_, j) => j !== i))}>{t("common.remove")}</Button>}>
              <Row gutter={[12, 12]}>
                <Col xs={12} md={8}><Field label={tt("lat")}><InputNumber style={{ width: "100%" }} step={0.0001} value={p.lat} onChange={(v) => set("route", tour.route.map((x, j) => (j === i ? { ...x, lat: v ?? x.lat } : x)))} /></Field></Col>
                <Col xs={12} md={8}><Field label={tt("lng")}><InputNumber style={{ width: "100%" }} step={0.0001} value={p.lng} onChange={(v) => set("route", tour.route.map((x, j) => (j === i ? { ...x, lng: v ?? x.lng } : x)))} /></Field></Col>
                <Col xs={24} md={8}><Field label={tt("dayLabel")}><InputNumber style={{ width: "100%" }} min={1} value={p.day ?? null} onChange={(v) => set("route", tour.route.map((x, j) => (j === i ? { ...x, day: v ?? undefined } : x)))} /></Field></Col>
              </Row>
              <div style={{ marginTop: 12 }}>
                <LocalizedFields label={tt("label")} value={p.label} onChange={(v) => set("route", tour.route.map((x, j) => (j === i ? { ...x, label: v } : x)))} required />
              </div>
            </Card>
          ))}
        </Flex>
      </Card>
      <SaveBar dirty={dirtyTour} busy={busy} onSave={saveTour} testId="route-save" />
    </Flex>
  );

  const [tab, setTab] = useState(isNew ? "content" : search.get("tab") ?? "content");
  return (
    <Flex vertical gap={16}>
      <Card size="small">
        <EditLanguageSwitch />
      </Card>
      {issues.length > 0 && <Alert type="error" showIcon closable onClose={() => setIssues([])} message={t("panel.fixBeforeSave")} description={<ul style={{ margin: 0, paddingInlineStart: 18 }}>{issues.map((x) => <li key={x}>{x}</li>)}</ul>} />}
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: "content", label: <Badge dot={dirtyTour} offset={[6, 0]}>{tt("tabs.content")}</Badge>, children: content },
          { key: "itinerary", label: <Badge dot={dirtyDays} offset={[6, 0]}>{tt("tabs.itinerary")}</Badge>, disabled: isNew, children: itinerary },
          { key: "pricing", label: <Badge dot={dirtyTiers} offset={[6, 0]}>{tt("tabs.pricing")}</Badge>, disabled: isNew, children: pricing },
          { key: "departures", label: tt("tabs.departures"), disabled: isNew, children: tour.id ? <DeparturesTab tourId={tour.id} durationDays={tour.durationDays} departures={departures} /> : null },
          { key: "media", label: tt("tabs.media"), children: media },
          { key: "route", label: tt("tabs.route"), children: route },
        ]}
      />
    </Flex>
  );
}

function addDays(isoDate: string, n: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function DeparturesTab({ tourId, durationDays, departures }: { tourId: number; durationDays: number; departures: EditorDeparture[] }) {
  const t = useTranslations("admin");
  const tt = useTranslations("admin.tours");
  const call = useAdminApi();
  const [rows, setRows] = useState(departures);
  const [draft, setDraft] = useState({ startDate: "", seatsTotal: 12, status: "open" as DepartureStatus, priceModifierPercent: 0 });
  const taken = useMemo(() => new Set(rows.map((r) => r.startDate)), [rows]);
  const upd = (id: number, patch: Partial<EditorDeparture>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const body = (r: EditorDeparture) => ({ startDate: r.startDate, endDate: r.endDate, seatsTotal: r.seatsTotal, status: r.status, priceModifierPercent: r.priceModifierPercent });
  const add = async () => {
    if (!draft.startDate) return;
    const endDate = addDays(draft.startDate, Math.max(0, durationDays - 1));
    const r = await call<{ id: number }>(`/api/admin/tours/${tourId}/departures`, { method: "POST", json: { ...draft, endDate } }, t("common.saved"));
    if (r && typeof r === "object") {
      setRows([...rows, { id: r.id, startDate: draft.startDate, endDate, seatsTotal: draft.seatsTotal, seatsBooked: 0, status: draft.status, priceModifierPercent: draft.priceModifierPercent }].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      setDraft({ ...draft, startDate: "" });
    }
  };
  return (
    <Flex vertical gap={16}>
      <Card title={tt("addDeparture")}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} sm={12} md={7}>
            <Field label={tt("startDate")} help={draft.startDate ? `${tt("endDate")}: ${addDays(draft.startDate, Math.max(0, durationDays - 1))}` : t("panel.calendarHint")}>
              <DatePicker
                style={{ width: "100%" }}
                format="DD.MM.YYYY"
                value={draft.startDate ? dayjs(draft.startDate) : null}
                disabledDate={(d) => d.isBefore(dayjs(), "day") || taken.has(d.format("YYYY-MM-DD"))}
                onChange={(d) => setDraft({ ...draft, startDate: d ? d.format("YYYY-MM-DD") : "" })}
              />
            </Field>
          </Col>
          <Col xs={12} sm={6} md={5}><Field label={tt("seatsTotal")}><InputNumber style={{ width: "100%" }} min={1} max={500} value={draft.seatsTotal} onChange={(v) => setDraft({ ...draft, seatsTotal: v ?? 1 })} /></Field></Col>
          <Col xs={12} sm={6} md={5}><Field label={tt("modifier")}><InputNumber style={{ width: "100%" }} min={-90} max={300} suffix="%" value={draft.priceModifierPercent} onChange={(v) => setDraft({ ...draft, priceModifierPercent: v ?? 0 })} /></Field></Col>
          <Col xs={24} md={7}><Button type="primary" block icon={<PlusOutlined />} disabled={!draft.startDate} onClick={add}>{tt("addDeparture")}</Button></Col>
        </Row>
      </Card>
      <Table<EditorDeparture>
        rowKey="id"
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        scroll={{ x: 860 }}
        dataSource={rows}
        locale={{ emptyText: t("common.empty") }}
        columns={[
          { title: tt("startDate"), render: (_, r) => <DatePicker aria-label={tt("startDate")} format="DD.MM.YYYY" allowClear={false} value={dayjs(r.startDate)} onChange={(d) => d && upd(r.id, { startDate: d.format("YYYY-MM-DD"), endDate: addDays(d.format("YYYY-MM-DD"), Math.max(0, durationDays - 1)) })} /> },
          { title: tt("endDate"), render: (_, r) => dayjs(r.endDate).format("DD.MM.YYYY") },
          { title: tt("seatsTotal"), render: (_, r) => <InputNumber aria-label={tt("seatsTotal")} min={Math.max(1, r.seatsBooked)} value={r.seatsTotal} onChange={(v) => upd(r.id, { seatsTotal: v ?? r.seatsTotal })} style={{ width: 90 }} /> },
          { title: tt("seatsBooked"), render: (_, r) => <Tag color={r.seatsBooked >= r.seatsTotal ? "red" : r.seatsBooked ? "gold" : "default"}>{r.seatsBooked} / {r.seatsTotal}</Tag> },
          { title: tt("depStatus"), render: (_, r) => <Select aria-label={tt("depStatus")} style={{ width: 150 }} value={r.status} onChange={(v) => upd(r.id, { status: v })} options={DEPARTURE_STATUSES.map((s) => ({ value: s, label: tt(`depStatuses.${s}`) }))} /> },
          { title: tt("modifier"), render: (_, r) => <InputNumber aria-label={tt("modifier")} min={-90} max={300} suffix="%" value={r.priceModifierPercent} onChange={(v) => upd(r.id, { priceModifierPercent: v ?? 0 })} style={{ width: 100 }} /> },
          {
            title: <span className="sr-only">{t("common.actions")}</span>,
            render: (_, r) => (
              <Space>
                <Button size="small" type="primary" ghost onClick={() => call(`/api/admin/tours/${tourId}/departures/${r.id}`, { method: "PATCH", json: body(r) }, t("common.saved"))}>{t("common.save")}</Button>
                <Popconfirm
                  title={t("common.confirmDelete")}
                  onConfirm={async () => {
                    if (await call(`/api/admin/tours/${tourId}/departures/${r.id}`, { method: "DELETE" }, t("common.saved"))) setRows(rows.filter((x) => x.id !== r.id));
                  }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} aria-label={t("common.delete")} disabled={r.seatsBooked > 0} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </Flex>
  );
}
