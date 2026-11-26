import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { getManifest } from "@/lib/images";

/**
 * Uploaded media lives next to the database on the persistent volume (/data/media in Docker,
 * ./data/media locally) and is served from /media/<file>. Files in public/images ship with the build.
 */
export function mediaDir(): string {
  if (process.env.MEDIA_DIR) return resolve(process.env.MEDIA_DIR);
  const db = process.env.DATABASE_URL || "file:./data/silkroad.db";
  const dbPath = db.startsWith("file:") ? db.slice(5) : "./data/silkroad.db";
  return join(dirname(resolve(dbPath)), "media");
}

export const MEDIA_MAX_BYTES = 6 * 1024 * 1024;

const TYPES = {
  jpg: { mime: "image/jpeg", magic: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  png: { mime: "image/png", magic: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  webp: { mime: "image/webp", magic: (b: Buffer) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
} as const;
type Ext = keyof typeof TYPES;

/** Only names we generated ourselves: lowercase slug, dash, random suffix, known extension. */
const SAFE_NAME = /^[a-z0-9][a-z0-9-]{0,80}\.(jpg|png|webp)$/;

export function isSafeMediaName(name: string): boolean {
  return SAFE_NAME.test(name);
}

export function mediaMime(name: string): string | null {
  const ext = name.split(".").pop() as Ext;
  return TYPES[ext]?.mime ?? null;
}

/** Detects the real type from the file's first bytes; the browser-supplied name and type are not trusted. */
export function sniffImage(buf: Buffer): Ext | null {
  for (const [ext, t] of Object.entries(TYPES) as [Ext, (typeof TYPES)[Ext]][]) if (t.magic(buf)) return ext;
  return null;
}

export function slugifyName(original: string): string {
  const base = original.replace(/\.[^.]*$/, "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (base || "image").slice(0, 60);
}

export async function saveUpload(buf: Buffer, originalName: string): Promise<{ name: string; url: string; size: number }> {
  const ext = sniffImage(buf);
  if (!ext) throw new Error("unsupported_type");
  if (buf.length > MEDIA_MAX_BYTES) throw new Error("too_large");
  const name = `${slugifyName(originalName)}-${randomBytes(4).toString("hex")}.${ext}`;
  const dir = mediaDir();
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), buf, { flag: "wx" });
  return { name, url: `/media/${name}`, size: buf.length };
}

export async function readUpload(name: string): Promise<Buffer | null> {
  if (!isSafeMediaName(name)) return null;
  try {
    return await readFile(join(mediaDir(), name));
  } catch {
    return null;
  }
}

export async function deleteUpload(name: string): Promise<boolean> {
  if (!isSafeMediaName(name)) return false;
  try {
    await unlink(join(mediaDir(), name));
    return true;
  } catch {
    return false;
  }
}

export interface MediaEntry {
  url: string;
  name: string;
  folder: string;
  uploaded: boolean;
  size?: number;
  modified?: string;
}

export async function listUploads(): Promise<MediaEntry[]> {
  let names: string[] = [];
  try {
    names = await readdir(mediaDir());
  } catch {
    return [];
  }
  const out: MediaEntry[] = [];
  for (const name of names.filter(isSafeMediaName)) {
    const s = await stat(join(mediaDir(), name)).catch(() => null);
    if (s?.isFile()) out.push({ url: `/media/${name}`, name, folder: "uploads", uploaded: true, size: s.size, modified: s.mtime.toISOString() });
  }
  return out.sort((a, b) => (b.modified ?? "").localeCompare(a.modified ?? ""));
}

/** Uploaded files first, then the photos that ship with the site (grouped by folder). */
export async function listMediaLibrary(): Promise<MediaEntry[]> {
  const shipped = [...getManifest()].map((url) => {
    const parts = url.split("/");
    return { url, name: parts.at(-1)!, folder: parts.slice(2, -1).join("/") || "images", uploaded: false };
  });
  return [...(await listUploads()), ...shipped];
}
