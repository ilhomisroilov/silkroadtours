"use client";

import { CheckOutlined, PictureOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Button, Empty, Flex, Input, Modal, Segmented, Spin, Typography, Upload } from "antd";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client/api";

type Entry = { url: string; name: string; folder: string; uploaded: boolean };

/** Pick an image from the library (or upload a new one) instead of typing its address by hand. */
export function MediaPicker({ onPick, multiple = false, label }: { onPick: (url: string) => void; multiple?: boolean; label?: string }) {
  const t = useTranslations("admin.panel");
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Entry[] | null>(null);
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch<Entry[]>("/api/admin/media");
    setItems(r.ok ? r.data : []);
  }, []);

  const show = () => {
    setOpen(true);
    setPicked([]);
    if (!items) void load();
  };

  const folders = useMemo(() => {
    const set = new Set((items ?? []).map((i) => (i.uploaded ? "uploads" : i.folder.split("/")[0] || "images")));
    return ["all", ...[...set].sort()];
  }, [items]);

  const shown = (items ?? []).filter((i) => {
    const f = i.uploaded ? "uploads" : i.folder.split("/")[0] || "images";
    return (folder === "all" || f === folder) && (!q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase()));
  });

  const choose = (url: string) => {
    if (!multiple) {
      onPick(url);
      setOpen(false);
      return;
    }
    setPicked((p) => (p.includes(url) ? p.filter((x) => x !== url) : [...p, url]));
  };

  const upload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await apiFetch<{ url: string; name: string }>("/api/admin/media", { method: "POST", body: fd });
    setUploading(false);
    if (!r.ok) {
      message.error(t("uploadFailed"));
      return;
    }
    setItems((prev) => [{ url: r.data.url, name: r.data.name, folder: "uploads", uploaded: true }, ...(prev ?? [])]);
    setFolder("all");
    if (multiple) setPicked((p) => [...p, r.data.url]);
    else {
      onPick(r.data.url);
      setOpen(false);
    }
  };

  return (
    <>
      <Button icon={<PictureOutlined />} onClick={show}>{label ?? t("pickImage")}</Button>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title={t("library")}
        width={920}
        destroyOnHidden
        footer={
          multiple ? (
            <Flex justify="space-between" align="center" wrap gap={8}>
              <Typography.Text type="secondary">{t("selected", { n: picked.length })}</Typography.Text>
              <Flex gap={8}>
                <Button onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button
                  type="primary"
                  disabled={!picked.length}
                  onClick={() => {
                    picked.forEach(onPick);
                    setOpen(false);
                  }}
                >
                  {t("addSelected")}
                </Button>
              </Flex>
            </Flex>
          ) : null
        }
      >
        <Flex vertical gap={12}>
          <Flex wrap gap={8} align="center">
            <Input.Search allowClear placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
            <Upload
              accept="image/jpeg,image/png,image/webp,image/avif"
              showUploadList={false}
              beforeUpload={(f) => {
                void upload(f as unknown as File);
                return false;
              }}
            >
              <Button type="primary" icon={<UploadOutlined />} loading={uploading}>{t("upload")}</Button>
            </Upload>
          </Flex>
          {folders.length > 2 && (
            <div style={{ overflowX: "auto" }}>
              <Segmented value={folder} onChange={(v) => setFolder(String(v))} options={folders.map((f) => ({ value: f, label: f === "all" ? t("allFolders") : f === "uploads" ? t("uploads") : f }))} />
            </div>
          )}
          {items === null ? (
            <Flex justify="center" style={{ padding: 40 }}><Spin /></Flex>
          ) : shown.length === 0 ? (
            <Empty description={t("noImages")} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, maxHeight: "60vh", overflowY: "auto", padding: 2 }}>
              {shown.map((i) => {
                const on = picked.includes(i.url);
                return (
                  <button
                    key={i.url}
                    type="button"
                    onClick={() => choose(i.url)}
                    title={i.name}
                    aria-pressed={multiple ? on : undefined}
                    style={{
                      position: "relative",
                      padding: 0,
                      border: on ? "2px solid #176bcb" : "1px solid #dfe4ea",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={i.url} alt="" loading="lazy" style={{ display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover", background: "#eef1f5" }} />
                    <span style={{ display: "block", padding: "4px 8px", fontSize: 12, color: "#55606b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</span>
                    {on && (
                      <span style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, background: "#176bcb", color: "#fff", display: "grid", placeItems: "center" }}>
                        <CheckOutlined />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Flex>
      </Modal>
    </>
  );
}
