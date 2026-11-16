import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { BrandData, BrandPalette, FontPairId, StyleGroupOverrides, StyleId } from "./formats";
import type { CoverLayoutId } from "./capas/catalog";
import type { LogoVisualDna } from "./imagem/types";

const BASE_TMP_DIR = path.join(/*turbopackIgnore: true*/ os.tmpdir(), "pandomarca");
const DRAFTS_DIR = path.join(/*turbopackIgnore: true*/ BASE_TMP_DIR, "rascunhos");
const KITS_DIR = path.join(/*turbopackIgnore: true*/ BASE_TMP_DIR, "kits");

export const DRAFT_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas
export const KIT_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

export interface VectorStatsMeta {
  byteSize: number;
  colorsHex: string[];
  under200Kb: boolean;
  within8Colors: boolean;
}

export interface DraftMeta {
  id: string;
  createdAt: number;
  expiresAt: number;
  entrada: "A" | "B";
  width: number;
  height: number;
  originalFormat: "png" | "jpeg" | "svg";
  backgroundStatus: "transparent_original" | "margin_removed" | "non_uniform_margin";
  backgroundNotice?: string;
  lowQuality: boolean;
  qualityWarning?: string;
  isDarkMonochrome: boolean;
  paletaExtraida: BrandPalette;
  svgSource?: string;
  vectorizedSvg?: string;
  simboloSvg?: string;
  simboloNegativoSvg?: string;
  monochromeSvg?: string;
  negativeSvg?: string;
  vectorStats?: VectorStatsMeta;
  sessaoImagemId?: string;
  logoDna?: LogoVisualDna;
  variantesEntradaA?: {
    horizontalSvg: string;
    verticalSvg: string;
    simboloSvg: string;
    monocromaticoSvg: string;
    negativoSvg: string;
    negativoTransparenteSvg?: string;
  };
}

export interface KitMeta {
  id: string;
  draftId: string;
  createdAt: number;
  expiresAt: number;
  slug: string;
  zipFilename: string;
  dados: BrandData;
  paleta: BrandPalette;
  fontPairId: FontPairId;
  kitStyle: StyleId;
  coverLayoutId?: CoverLayoutId;
  styleOverrides: StyleGroupOverrides;
  coverArtOrigins?: Record<string, string>;
  files: string[];
}

function ensureDirs() {
  fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  fs.mkdirSync(KITS_DIR, { recursive: true });
}

export function createRandomId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function saveDraft(
  meta: DraftMeta,
  processedPng: Buffer,
  iconPng?: Buffer
): void {
  ensureDirs();
  const dir = path.join(/*turbopackIgnore: true*/ DRAFTS_DIR, meta.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(/*turbopackIgnore: true*/ dir, "meta.json"),
    JSON.stringify(meta, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(/*turbopackIgnore: true*/ dir, "processed.png"),
    processedPng
  );
  if (iconPng) {
    fs.writeFileSync(path.join(/*turbopackIgnore: true*/ dir, "icon.png"), iconPng);
  }
}

export function updateDraftMeta(
  draftId: string,
  patch: Partial<DraftMeta>
): DraftMeta | null {
  ensureDirs();
  const cleanId = draftId.replace(/[^a-zA-Z0-9_-]/g, "");
  const dir = path.join(/*turbopackIgnore: true*/ DRAFTS_DIR, cleanId);
  const metaPath = path.join(/*turbopackIgnore: true*/ dir, "meta.json");
  if (!fs.existsSync(metaPath)) return null;
  try {
    const prev = JSON.parse(fs.readFileSync(metaPath, "utf8")) as DraftMeta;
    const next: DraftMeta = { ...prev, ...patch };
    fs.writeFileSync(metaPath, JSON.stringify(next, null, 2), "utf8");
    return next;
  } catch {
    return null;
  }
}

export type LoadDraftResult =
  | { status: "ok"; meta: DraftMeta; processedPng: Buffer; iconPng?: Buffer }
  | { status: "expired" }
  | { status: "not_found" };

export function loadDraft(draftId: string): LoadDraftResult {
  ensureDirs();
  const cleanId = draftId.replace(/[^a-zA-Z0-9_-]/g, "");
  const dir = path.join(/*turbopackIgnore: true*/ DRAFTS_DIR, cleanId);
  const metaPath = path.join(/*turbopackIgnore: true*/ dir, "meta.json");
  const pngPath = path.join(/*turbopackIgnore: true*/ dir, "processed.png");

  if (!fs.existsSync(metaPath) || !fs.existsSync(pngPath)) {
    return { status: "not_found" };
  }

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as DraftMeta;
    if (Date.now() > meta.expiresAt) {
      return { status: "expired" };
    }
    const processedPng = fs.readFileSync(pngPath);
    const iconPath = path.join(/*turbopackIgnore: true*/ dir, "icon.png");
    const iconPng = fs.existsSync(iconPath) ? fs.readFileSync(iconPath) : undefined;
    return { status: "ok", meta, processedPng, iconPng };
  } catch {
    return { status: "not_found" };
  }
}

export function saveKit(
  meta: KitMeta,
  zipBuffer: Buffer,
  fileMap: Map<string, Buffer>
): void {
  ensureDirs();
  const dir = path.join(/*turbopackIgnore: true*/ KITS_DIR, meta.id);
  const filesDir = path.join(/*turbopackIgnore: true*/ dir, "files");
  fs.mkdirSync(filesDir, { recursive: true });

  fs.writeFileSync(
    path.join(/*turbopackIgnore: true*/ dir, "meta.json"),
    JSON.stringify(meta, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(/*turbopackIgnore: true*/ dir, meta.zipFilename),
    zipBuffer
  );

  for (const [relPath, buf] of fileMap.entries()) {
    const fullPath = path.join(/*turbopackIgnore: true*/ filesDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buf);
  }
}

export type LoadKitMetaResult =
  | { status: "ok"; meta: KitMeta; dir: string }
  | { status: "expired" }
  | { status: "not_found" };

export function loadKitMeta(kitId: string): LoadKitMetaResult {
  ensureDirs();
  const cleanId = kitId.replace(/[^a-zA-Z0-9_-]/g, "");
  const dir = path.join(/*turbopackIgnore: true*/ KITS_DIR, cleanId);
  const metaPath = path.join(/*turbopackIgnore: true*/ dir, "meta.json");
  if (!fs.existsSync(metaPath)) {
    return { status: "not_found" };
  }

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as KitMeta;
    if (Date.now() > meta.expiresAt) {
      return { status: "expired" };
    }
    return { status: "ok", meta, dir };
  } catch {
    return { status: "not_found" };
  }
}

export function loadKitFile(kitId: string, relPath: string): Buffer | null {
  const loaded = loadKitMeta(kitId);
  if (loaded.status !== "ok") return null;

  const normalizedRel = path.posix
    .normalize(relPath)
    .replace(/^(\.\.(\/|\\|$))+/, "")
    .replace(/^\/+/, "");
  const filesRoot = path.join(/*turbopackIgnore: true*/ loaded.dir, "files");
  const fullPath = path.join(/*turbopackIgnore: true*/ filesRoot, normalizedRel);
  if (!fullPath.startsWith(filesRoot)) return null;
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath);
}

export function loadKitZip(kitId: string): { filename: string; buffer: Buffer } | null {
  const loaded = loadKitMeta(kitId);
  if (loaded.status !== "ok") return null;
  const zipPath = path.join(
    /*turbopackIgnore: true*/ loaded.dir,
    loaded.meta.zipFilename
  );
  if (!fs.existsSync(zipPath)) return null;
  return {
    filename: loaded.meta.zipFilename,
    buffer: fs.readFileSync(zipPath),
  };
}
