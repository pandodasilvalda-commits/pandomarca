import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { optimize as svgoOptimize } from "svgo";
import {
  ColorMode,
  Hierarchical,
  PathSimplifyMode,
  vectorize,
} from "@neplex/vectorizer";
import potrace from "potrace";
import React from "react";
import satori from "satori";
import type { BrandData, BrandPalette, FontPairId } from "./formats";
import { getSatoriFontsForPair } from "./fonts";
import { contrastRatio, hexToRgb, relativeLuminance, rgbToHex, rgbToHsl } from "./palette";
import { validateSvgSecurity } from "./analyze-logo";

const h = React.createElement;

export const MAX_VECTOR_SVG_BYTES = 200 * 1024; // 200 KB
export const MAX_VECTOR_COLORS = 8;

export interface VetorizacaoOptions {
  maxColors?: number;
  maxBytes?: number;
  paletteHints?: string[];
  inkHex?: string;
  paperHex?: string;
  simboloApenas?: boolean;
}

export interface VetorizacaoResult {
  colorSvg: string;
  simboloSvg: string;
  simboloNegativoSvg: string;
  monocromaticoSvg: string;
  negativoSvg: string;
  negativoTransparenteSvg: string;
  previewPng: Buffer;
  preview32Png: Buffer;
  previewDataUrl: string;
  preview32DataUrl: string;
  byteSize: number;
  maxBytes: number;
  under200Kb: boolean;
  colorsHex: string[];
  colorsCount: number;
  within8Colors: boolean;
  pathCount: number;
  width: number;
  height: number;
  backgroundRemoved: boolean;
  engine: "vtracer+potrace" | "svg-cleaned";
}

export interface VariantesDoVetor {
  horizontalSvg: string;
  verticalSvg: string;
  simboloSvg: string;
  monocromaticoSvg: string;
  negativoSvg: string;
  negativoTransparenteSvg: string;
  processedPng: Buffer;
  iconPng: Buffer;
  whiteLogoPng: Buffer;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function colorDist(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function parseHexColor(colorStr: string): RGB | null {
  const clean = colorStr.trim();
  const m6 = clean.match(/^#([0-9a-f]{6})$/i);
  if (m6) {
    return {
      r: parseInt(m6[1].slice(0, 2), 16),
      g: parseInt(m6[1].slice(2, 4), 16),
      b: parseInt(m6[1].slice(4, 6), 16),
    };
  }
  const m3 = clean.match(/^#([0-9a-f]{3})$/i);
  if (m3) {
    return {
      r: parseInt(m3[1][0] + m3[1][0], 16),
      g: parseInt(m3[1][1] + m3[1][1], 16),
      b: parseInt(m3[1][2] + m3[1][2], 16),
    };
  }
  const mRgb = clean.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (mRgb) {
    return {
      r: Math.min(255, Number(mRgb[1])),
      g: Math.min(255, Number(mRgb[2])),
      b: Math.min(255, Number(mRgb[3])),
    };
  }
  return null;
}

function isSvgBuffer(buf: Buffer): boolean {
  const head = buf.subarray(0, 400).toString("utf8").trimStart();
  return head.startsWith("<svg") || head.includes("<svg");
}

function traceWithPotrace(
  pngBuffer: Buffer,
  options: potrace.PotraceOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(pngBuffer, options, (err, svg) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

function removeUniformBorderInPlace(
  rgba: Uint8Array,
  width: number,
  height: number
): boolean {
  const totalPixels = width * height;
  const getIdx = (x: number, y: number) => (y * width + x) * 4;

  let transparentCount = 0;
  let borderTransparentCount = 0;
  let borderCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = rgba[getIdx(x, y) + 3];
      if (a < 180) transparentCount++;
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        borderCount++;
        if (a < 180) borderTransparentCount++;
      }
    }
  }

  if (
    transparentCount / Math.max(1, totalPixels) > 0.03 &&
    borderTransparentCount / Math.max(1, borderCount) > 0.35
  ) {
    return false;
  }

  const borderSamples: RGB[] = [];
  for (let x = 0; x < width; x++) {
    const iTop = getIdx(x, 0);
    const iBot = getIdx(x, height - 1);
    borderSamples.push({ r: rgba[iTop], g: rgba[iTop + 1], b: rgba[iTop + 2] });
    borderSamples.push({ r: rgba[iBot], g: rgba[iBot + 1], b: rgba[iBot + 2] });
  }
  for (let y = 1; y < height - 1; y++) {
    const iLeft = getIdx(0, y);
    const iRight = getIdx(width - 1, y);
    borderSamples.push({ r: rgba[iLeft], g: rgba[iLeft + 1], b: rgba[iLeft + 2] });
    borderSamples.push({ r: rgba[iRight], g: rgba[iRight + 1], b: rgba[iRight + 2] });
  }

  const rs = borderSamples.map((c) => c.r).sort((a, b) => a - b);
  const gs = borderSamples.map((c) => c.g).sort((a, b) => a - b);
  const bs = borderSamples.map((c) => c.b).sort((a, b) => a - b);
  const mid = Math.floor(borderSamples.length / 2);
  const marginColor: RGB = {
    r: rs[mid] ?? 255,
    g: gs[mid] ?? 255,
    b: bs[mid] ?? 255,
  };

  const uniformCount = borderSamples.filter(
    (c) => colorDist(c, marginColor) <= 28
  ).length;

  if (uniformCount / Math.max(1, borderSamples.length) < 0.78) {
    return false;
  }

  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const tryEnqueue = (x: number, y: number) => {
    const pIdx = y * width + x;
    if (visited[pIdx]) return;
    const idx = pIdx * 4;
    if (rgba[idx + 3] < 24) {
      visited[pIdx] = 1;
      rgba[idx + 3] = 0;
      queue[tail++] = pIdx;
      return;
    }
    const c: RGB = { r: rgba[idx], g: rgba[idx + 1], b: rgba[idx + 2] };
    if (colorDist(c, marginColor) <= 34) {
      visited[pIdx] = 1;
      queue[tail++] = pIdx;
    }
  };

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  while (head < tail) {
    const pIdx = queue[head++];
    rgba[pIdx * 4 + 3] = 0;
    const x = pIdx % width;
    const y = (pIdx - x) / width;
    if (x > 0) tryEnqueue(x - 1, y);
    if (x < width - 1) tryEnqueue(x + 1, y);
    if (y > 0) tryEnqueue(x, y - 1);
    if (y < height - 1) tryEnqueue(x, y + 1);
  }

  // Em lockups horizontais (símbolo à esquerda + texto à direita), abre os furos fechados de letras
  // (ex.: O, R, d, a, A, D) que retiveram a cor do fundo exterior por não estarem ligados à margem.
  if (width > height * 1.25) {
    let splitX: number | null = null;
    let seenLeft = false;
    const minSx = Math.round(width * 0.16);
    const maxSx = Math.min(width - 8, Math.round(width * 0.65));
    for (let x = minSx; x <= maxSx; x++) {
      let colOp = 0;
      for (let y = 0; y < height; y++) {
        if (rgba[(y * width + x) * 4 + 3] > 32) colOp++;
      }
      if (colOp > 0) {
        seenLeft = true;
      } else if (seenLeft && colOp === 0) {
        splitX = x;
        break;
      }
    }

    if (splitX !== null) {
      let wx0 = width;
      let wx1 = 0;
      let wy0 = height;
      let wy1 = 0;
      let wmOpaque = 0;
      for (let y = 0; y < height; y++) {
        for (let x = splitX; x < width; x++) {
          if (rgba[(y * width + x) * 4 + 3] >= 128) {
            wmOpaque++;
            if (x < wx0) wx0 = x;
            if (x > wx1) wx1 = x;
            if (y < wy0) wy0 = y;
            if (y > wy1) wy1 = y;
          }
        }
      }
      const wmArea = Math.max(1, (wx1 - wx0 + 1) * (wy1 - wy0 + 1));
      const wmDensity = wmOpaque / wmArea;
      // Letras soltas sobre fundo do canvas têm densidade < 0.65 (nunca uma barra sólida com texto branco)
      if (wmOpaque > 0 && wmDensity < 0.65) {
        for (let y = wy0; y <= wy1; y++) {
          for (let x = wx0; x <= wx1; x++) {
            const pIdx = y * width + x;
            const idx = pIdx * 4;
            if (rgba[idx + 3] < 24) continue;
            const c: RGB = { r: rgba[idx], g: rgba[idx + 1], b: rgba[idx + 2] };
            if (colorDist(c, marginColor) <= 68) {
              visited[pIdx] = 1;
              rgba[idx + 3] = 0;
            }
          }
        }
      }
    }
  }

  // Remove até 2 px de auréola anti-aliased na fronteira (exterior e interior de letras) junto ao fundo removido
  for (let pass = 0; pass < 2; pass++) {
    const haloPixels: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pIdx = y * width + x;
        if (visited[pIdx] || rgba[pIdx * 4 + 3] < 24) continue;
        const adjTransparent =
          (x > 0 && visited[pIdx - 1] === 1) ||
          (x < width - 1 && visited[pIdx + 1] === 1) ||
          (y > 0 && visited[pIdx - width] === 1) ||
          (y < height - 1 && visited[pIdx + width] === 1);
        if (!adjTransparent) continue;
        const idx = pIdx * 4;
        const c: RGB = { r: rgba[idx], g: rgba[idx + 1], b: rgba[idx + 2] };
        if (colorDist(c, marginColor) <= 98) {
          haloPixels.push(pIdx);
        }
      }
    }
    for (const pIdx of haloPixels) {
      visited[pIdx] = 1;
      rgba[pIdx * 4 + 3] = 0;
    }
  }

  return true;
}

function isCollinearTransitionCluster(
  c: { rgb: RGB; count: number },
  allCenters: { rgb: RGB; count: number }[]
): boolean {
  const donors = allCenters.filter((d) => d !== c && d.count >= c.count * 2.2);
  for (let i = 0; i < donors.length; i++) {
    for (let j = i + 1; j < donors.length; j++) {
      const a = donors[i].rgb;
      const b = donors[j].rgb;
      const abx = b.r - a.r;
      const aby = b.g - a.g;
      const abz = b.b - a.b;
      const lenSq = abx * abx + aby * aby + abz * abz;
      if (lenSq < 1600) continue;
      const t =
        ((c.rgb.r - a.r) * abx + (c.rgb.g - a.g) * aby + (c.rgb.b - a.b) * abz) /
        lenSq;
      if (t < 0.14 || t > 0.86) continue;
      const px = a.r + t * abx;
      const py = a.g + t * aby;
      const pz = a.b + t * abz;
      const dPerp = Math.hypot(c.rgb.r - px, c.rgb.g - py, c.rgb.b - pz);
      if (dPerp <= 22) return true;
    }
  }
  return false;
}

function clusterRgbaToPaletteInPlace(
  rgba: Uint8Array,
  width: number,
  height: number,
  maxColors: number,
  paletteHints?: string[]
): string[] {
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 28000)));
  const buckets = new Map<
    string,
    { rSum: number; gSum: number; bSum: number; count: number }
  >();
  let totalSampled = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      // Amostra apenas pixels quase 100% opacos para ignorar margens semitransparentes
      if (rgba[idx + 3] < 200) continue;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];
      // 12-unit fine bins keep sharp distinct hues before merging
      const kr = Math.round(r / 12) * 12;
      const kg = Math.round(g / 12) * 12;
      const kb = Math.round(b / 12) * 12;
      const key = `${kr},${kg},${kb}`;
      const prev = buckets.get(key);
      totalSampled++;
      if (prev) {
        prev.rSum += r;
        prev.gSum += g;
        prev.bSum += b;
        prev.count++;
      } else {
        buckets.set(key, { rSum: r, gSum: g, bSum: b, count: 1 });
      }
    }
  }

  // Merge anti-aliased intermediate bins within 42 RGB units into dominant peaks
  const sortedBuckets = Array.from(buckets.values())
    .map((b) => ({
      rgb: {
        r: Math.round(b.rSum / b.count),
        g: Math.round(b.gSum / b.count),
        b: Math.round(b.bSum / b.count),
      },
      count: b.count,
    }))
    .sort((a, b) => b.count - a.count);

  const centers: { rgb: RGB; count: number }[] = [];
  for (const item of sortedBuckets) {
    const existing = centers.find((c) => colorDist(c.rgb, item.rgb) < 42);
    if (existing) {
      const total = existing.count + item.count;
      existing.rgb = {
        r: Math.round((existing.rgb.r * existing.count + item.rgb.r * item.count) / total),
        g: Math.round((existing.rgb.g * existing.count + item.rgb.g * item.count) / total),
        b: Math.round((existing.rgb.b * existing.count + item.rgb.b * item.count) / total),
      };
      existing.count = total;
    } else {
      centers.push({ rgb: item.rgb, count: item.count });
    }
  }

  // Elimina pequenos grupos residuais de anti-aliasing de fronteira (ex.: #D7C4BC ou misturas lineares < 2.2%)
  const dominantCenters = centers.filter((c, index) => {
    if (index < 2) return true;
    const share = c.count / Math.max(1, totalSampled);
    const hsl = rgbToHsl(c.rgb);
    if (share < 0.004) return false;
    if (share < 0.018 && hsl.s < 32 && hsl.l > 52 && hsl.l < 88) return false;
    if (share < 0.022 && isCollinearTransitionCluster(c, centers)) return false;
    return true;
  });

  const targetK = Math.min(MAX_VECTOR_COLORS, Math.max(1, maxColors));
  let paletteCenters: RGB[] = (dominantCenters.length > 0 ? dominantCenters : centers)
    .slice(0, targetK)
    .map((c) => c.rgb);

  // Snap to optional user/brand palette hints if close (< 28 Euclidean distance)
  if (paletteHints && paletteHints.length > 0) {
    const hintRgbs = paletteHints
      .map(parseHexColor)
      .filter((x): x is RGB => Boolean(x));
    paletteCenters = paletteCenters.map((c) => {
      const nearHint = hintRgbs.find((hRgb) => colorDist(c, hRgb) <= 28);
      return nearHint || c;
    });
  }

  if (paletteCenters.length === 0) {
    paletteCenters = [{ r: 42, g: 24, b: 16 }];
  }

  const usedSet = new Set<string>();
  const len = rgba.length;
  for (let i = 0; i < len; i += 4) {
    if (rgba[i + 3] < 140) {
      rgba[i] = 0;
      rgba[i + 1] = 0;
      rgba[i + 2] = 0;
      rgba[i + 3] = 0;
      continue;
    }

    const px: RGB = { r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] };
    let best = paletteCenters[0];
    let bestD = colorDist(px, best);
    for (let k = 1; k < paletteCenters.length; k++) {
      const d = colorDist(px, paletteCenters[k]);
      if (d < bestD) {
        bestD = d;
        best = paletteCenters[k];
      }
    }

    rgba[i] = best.r;
    rgba[i + 1] = best.g;
    rgba[i + 2] = best.b;
    rgba[i + 3] = 255;
    usedSet.add(rgbToHex(best));
  }

  return Array.from(usedSet);
}

function extractDistinctSvgHexColors(svg: string): string[] {
  const found = new Set<string>();
  const matches = svg.matchAll(/(?:fill|stroke)\s*=\s*["']([^"']+)["']/gi);
  for (const m of matches) {
    const val = (m[1] || "").trim().toLowerCase();
    if (!val || val === "none" || val === "transparent" || val === "currentcolor") {
      continue;
    }
    const rgb = parseHexColor(val);
    if (rgb) {
      found.add(rgbToHex(rgb));
    }
  }
  return Array.from(found);
}

function normalizeAndClampSvgColors(
  svg: string,
  allowedHexes: string[]
): string {
  if (allowedHexes.length === 0) return svg;
  const allowedRgbs = allowedHexes.map((hex) => ({
    hex,
    rgb: hexToRgb(hex),
  }));

  const mapColor = (rawColor: string): string => {
    const clean = rawColor.trim().toLowerCase();
    if (clean === "none" || clean === "transparent") return rawColor;
    const parsed = parseHexColor(clean);
    if (!parsed) return rawColor;
    let best = allowedRgbs[0];
    let bestD = colorDist(parsed, best.rgb);
    for (let i = 1; i < allowedRgbs.length; i++) {
      const d = colorDist(parsed, allowedRgbs[i].rgb);
      if (d < bestD) {
        bestD = d;
        best = allowedRgbs[i];
      }
    }
    return best.hex;
  };

  return svg.replace(
    /((?:fill|stroke)\s*=\s*["'])([^"']+)(["'])/gi,
    (_m, pre, val, post) => `${pre}${mapColor(val)}${post}`
  );
}

function optimizeSvgWithSvgo(svg: string, floatPrecision: number): string {
  const result = svgoOptimize(svg, {
    multipass: true,
    floatPrecision,
    plugins: ["preset-default", "removeDimensions"],
  });
  return result.data;
}

function ensureSvgViewBoxAndDimensions(
  svg: string,
  width: number,
  height: number
): string {
  if (/viewBox=/i.test(svg) && /\bwidth=/i.test(svg)) {
    return svg;
  }
  let out = svg;
  if (!/viewBox=/i.test(out)) {
    out = out.replace("<svg", `<svg viewBox="0 0 ${width} ${height}"`);
  }
  if (!/\bwidth=/i.test(out)) {
    out = out.replace("<svg", `<svg width="${width}" height="${height}"`);
  }
  return out;
}

async function findSymbolWordmarkSplitX(
  sourcePng: Buffer,
  width: number,
  height: number
): Promise<number | null> {
  if (width <= height * 1.25) return null;
  const { data } = await sharp(sourcePng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const minSearchX = Math.round(width * 0.16);
  const maxSearchX = Math.min(width - 8, Math.round(width * 0.65));
  let seenOpaqueLeft = false;

  for (let x = minSearchX; x <= maxSearchX; x++) {
    let colOpaque = 0;
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * 4 + 3] > 32) {
        colOpaque++;
      }
    }
    if (colOpaque > 0) {
      seenOpaqueLeft = true;
    } else if (seenOpaqueLeft && colOpaque === 0) {
      return x;
    }
  }
  return Math.round(height * 0.92);
}

function hasChromaticColor(colorsHex: string[]): boolean {
  return colorsHex.some((hex) => {
    const c = parseHexColor(hex);
    if (!c) return false;
    const hsl = rgbToHsl(c);
    return hsl.s >= 22 && hsl.l >= 20 && hsl.l <= 82;
  });
}

function mapWordmarkPixelForDarkBg(r: number, g: number, b: number): [number, number, number] | null {
  const hex = rgbToHex({ r, g, b });
  const cRatio = contrastRatio(hex, "#1E100A");
  const hsl = rgbToHsl({ r, g, b });
  if (cRatio >= 4.9 && hsl.l >= 50) {
    return null;
  }
  // Subtítulo cromático (ex.: terracota "da Vilariça") passa uniformemente a dourado luminoso #F4B858
  if (hsl.s >= 32 && hsl.l >= 26) {
    if (hsl.h >= 85 && hsl.h <= 255) {
      return [226, 240, 232]; // tom claro frio para verdes/azuis
    }
    return [244, 184, 88]; // #F4B858 (> 8.6:1 em fundo escuro)
  }
  // Tinta escura (ex.: "FORNO") passa uniformemente a branco creme #FAF8F5
  return [250, 248, 245];
}

async function createNegativeVariantSvg(params: {
  sourcePng: Buffer;
  colorSvg: string;
  monoNegativeSvg: string;
  width: number;
  height: number;
  colorsHex: string[];
  splitX: number | null;
  maxBytes: number;
}): Promise<string> {
  const { sourcePng, colorSvg, monoNegativeSvg, colorsHex, splitX, maxBytes } = params;
  const hasChromaticBrandColor = hasChromaticColor(colorsHex);

  if (splitX !== null && hasChromaticBrandColor) {
    try {
      const { data, info } = await sharp(sourcePng)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const w = info.width;
      const hPx = info.height;
      const out = new Uint8Array(data);
      let changed = false;

      // Calcula caixa vertical efetiva do símbolo à esquerda para levantar apenas o pedestal escuro inferior
      let symMinY = hPx;
      let symMaxY = 0;
      for (let y = 0; y < hPx; y++) {
        for (let x = 0; x < splitX; x++) {
          if (out[(y * w + x) * 4 + 3] >= 128) {
            if (y < symMinY) symMinY = y;
            if (y > symMaxY) symMaxY = y;
          }
        }
      }
      const symPedestalThresholdY =
        symMaxY > symMinY
          ? symMinY + Math.round((symMaxY - symMinY) * 0.77)
          : Math.round(hPx * 0.77);

      // 1) À esquerda (símbolo): mantém cavidade interna escura, mas levanta a base escura inferior para branco creme
      for (let y = symPedestalThresholdY; y < hPx; y++) {
        for (let x = 0; x < splitX; x++) {
          const idx = (y * w + x) * 4;
          if (out[idx + 3] < 128) continue;
          const hsl = rgbToHsl({ r: out[idx], g: out[idx + 1], b: out[idx + 2] });
          if (hsl.l < 26) {
            out[idx] = 250;
            out[idx + 1] = 248;
            out[idx + 2] = 245;
            changed = true;
          }
        }
      }

      // 2) À direita (texto): converte tinta escura -> #FAF8F5 e terracota de baixo contraste -> #F4B858 uniformemente
      for (let y = 0; y < hPx; y++) {
        for (let x = splitX; x < w; x++) {
          const idx = (y * w + x) * 4;
          if (out[idx + 3] < 128) continue;
          const mapped = mapWordmarkPixelForDarkBg(out[idx], out[idx + 1], out[idx + 2]);
          if (mapped) {
            out[idx] = mapped[0];
            out[idx + 1] = mapped[1];
            out[idx + 2] = mapped[2];
            changed = true;
          }
        }
      }

      if (changed) {
        const negInput = await sharp(Buffer.from(out.buffer), {
          raw: { width: w, height: hPx, channels: 4 },
        })
          .png()
          .toBuffer();

        const rawNegSvg = await vectorize(negInput, {
          colorMode: ColorMode.Color,
          hierarchical: Hierarchical.Stacked,
          filterSpeckle: 6,
          colorPrecision: 8,
          layerDifference: 24,
          mode: PathSimplifyMode.Spline,
          cornerThreshold: 58,
          lengthThreshold: 3.5,
          maxIterations: 10,
          spliceThreshold: 45,
          pathPrecision: 2,
        });

        const allowedWithWhite = Array.from(
          new Set([...colorsHex, "#FAF8F5", "#F4B858"])
        );
        const clamped = normalizeAndClampSvgColors(rawNegSvg, allowedWithWhite);
        const optimized = ensureSvgViewBoxAndDimensions(
          optimizeSvgWithSvgo(clamped, 2),
          w,
          hPx
        );
        if (Buffer.byteLength(optimized, "utf8") < maxBytes) {
          return optimized;
        }
      }
    } catch {
      // Continua para alternativa de fallback abaixo
    }
  }

  // Fallback para marcas só com símbolo ou monocromáticas:
  let hasChanged = false;
  const converted = colorSvg.replace(
    /((?:fill|stroke)\s*=\s*["'])([^"']+)(["'])/gi,
    (full, pre, val, post) => {
      const parsed = parseHexColor(val);
      if (!parsed) return full;
      const mapped = mapWordmarkPixelForDarkBg(parsed.r, parsed.g, parsed.b);
      if (mapped) {
        hasChanged = true;
        return `${pre}${rgbToHex({ r: mapped[0], g: mapped[1], b: mapped[2] })}${post}`;
      }
      return full;
    }
  );
  return hasChanged ? converted : monoNegativeSvg;
}

async function detectSymbolSplitAndBuildSvgs(params: {
  sourcePng: Buffer;
  colorSvg: string;
  monoNegativeSvg: string;
  width: number;
  height: number;
  colorsHex: string[];
  simboloApenas?: boolean;
  splitX?: number | null;
}): Promise<{ simboloSvg: string; simboloNegativoSvg: string }> {
  const { sourcePng, colorSvg, monoNegativeSvg, height, colorsHex, simboloApenas } = params;
  const splitX =
    params.splitX !== undefined
      ? params.splitX
      : await findSymbolWordmarkSplitX(sourcePng, params.width, height);
  const hasChromatic = hasChromaticColor(colorsHex);

  const buildMonochromeLightSymbol = (baseSvg: string): string => {
    let any = false;
    const out = baseSvg.replace(
      /((?:fill|stroke)\s*=\s*["'])([^"']+)(["'])/gi,
      (full, pre, val, post) => {
        const parsed = parseHexColor(val);
        if (!parsed) return full;
        if (contrastRatio(rgbToHex(parsed), "#1C1917") < 4.5) {
          any = true;
          return `${pre}#FAF8F5${post}`;
        }
        return full;
      }
    );
    return any ? out : monoNegativeSvg;
  };

  if (simboloApenas || splitX === null) {
    return {
      simboloSvg: colorSvg,
      simboloNegativoSvg: hasChromatic
        ? adaptVectorSvgForSurface(colorSvg, "#1C1917")
        : buildMonochromeLightSymbol(colorSvg),
    };
  }

  // Render symbol region tightly and vectorize just the symbol into clean square SVGs (claro e escuro)
  try {
    const croppedSym = await sharp(sourcePng)
      .extract({ left: 0, top: 0, width: Math.max(24, splitX), height })
      .trim({ threshold: 6 })
      .resize(512, 512, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const symRawSvg = await vectorize(croppedSym, {
      colorMode: ColorMode.Color,
      hierarchical: Hierarchical.Stacked,
      filterSpeckle: 4,
      colorPrecision: 8,
      layerDifference: 16,
      mode: PathSimplifyMode.Spline,
      cornerThreshold: 58,
      lengthThreshold: 3.5,
      maxIterations: 10,
      spliceThreshold: 45,
      pathPrecision: 2,
    });
    const simboloSvg = ensureSvgViewBoxAndDimensions(
      optimizeSvgWithSvgo(normalizeAndClampSvgColors(symRawSvg, colorsHex), 2),
      512,
      512
    );

    // Construir versão para fundo escuro com a base inferior visível
    let simboloNegativoSvg = simboloSvg;
    if (!hasChromatic) {
      simboloNegativoSvg = buildMonochromeLightSymbol(simboloSvg);
    } else {
      const symDec = await sharp(croppedSym)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const sRgba = new Uint8Array(symDec.data);
      const sw = symDec.info.width;
      const sh = symDec.info.height;
      let minSymY = sh;
      let maxSymY = 0;
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          if (sRgba[(y * sw + x) * 4 + 3] >= 128) {
            if (y < minSymY) minSymY = y;
            if (y > maxSymY) maxSymY = y;
          }
        }
      }
      const threshY =
        maxSymY > minSymY
          ? minSymY + Math.round((maxSymY - minSymY) * 0.77)
          : Math.round(sh * 0.77);

      let symChanged = false;
      for (let y = threshY; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const idx = (y * sw + x) * 4;
          if (sRgba[idx + 3] < 128) continue;
          const hsl = rgbToHsl({ r: sRgba[idx], g: sRgba[idx + 1], b: sRgba[idx + 2] });
          if (hsl.l < 26) {
            sRgba[idx] = 250;
            sRgba[idx + 1] = 248;
            sRgba[idx + 2] = 245;
            symChanged = true;
          }
        }
      }

      if (symChanged) {
        const negSymPng = await sharp(Buffer.from(sRgba.buffer), {
          raw: { width: sw, height: sh, channels: 4 },
        })
          .png()
          .toBuffer();
        const negSymRaw = await vectorize(negSymPng, {
          colorMode: ColorMode.Color,
          hierarchical: Hierarchical.Stacked,
          filterSpeckle: 4,
          colorPrecision: 8,
          layerDifference: 16,
          mode: PathSimplifyMode.Spline,
          cornerThreshold: 58,
          lengthThreshold: 3.5,
          maxIterations: 10,
          spliceThreshold: 45,
          pathPrecision: 2,
        });
        simboloNegativoSvg = ensureSvgViewBoxAndDimensions(
          optimizeSvgWithSvgo(
            normalizeAndClampSvgColors(negSymRaw, [...colorsHex, "#FAF8F5"]),
            2
          ),
          512,
          512
        );
      }
    }

    return { simboloSvg, simboloNegativoSvg };
  } catch {
    return {
      simboloSvg: colorSvg,
      simboloNegativoSvg: buildMonochromeLightSymbol(colorSvg),
    };
  }
}

/**
 * Adapta uniformemente as cores inteiras dos caminhos SVG para garantir contraste em fundos escuros ou claros,
 * evitando por completo manchas pixel-a-pixel em letras.
 */
export function adaptVectorSvgForSurface(svgStr: string, surfaceHex: string): string {
  const isDarkSurface = relativeLuminance(surfaceHex) < 0.28;
  const distinct = extractDistinctSvgHexColors(svgStr);
  const nonBgCount = distinct.filter((c) => {
    const hsl = rgbToHsl(hexToRgb(c));
    return hsl.l < 90;
  }).length;

  return svgStr.replace(
    /((?:fill|stroke)\s*=\s*["'])([^"']+)(["'])/gi,
    (full, pre, val, post) => {
      const parsed = parseHexColor(val);
      if (!parsed) return full;
      const hex = rgbToHex(parsed);
      const ratio = contrastRatio(hex, surfaceHex);
      if (ratio >= 4.2) return full;

      const hsl = rgbToHsl(parsed);
      if (isDarkSurface) {
        // Preserva eventual interior escuro só quando houver múltiplas cores e for quase neutro preto num fundo escuro?
        // Nota: em negativoSvg as palavras já estão convertidas; só adaptamos caso o utilizador carregue um SVG monocromático ou escuro direto.
        if (nonBgCount <= 2 && hsl.l < 35) {
          return `${pre}#FAF8F5${post}`;
        }
        if (hsl.s >= 32 && hsl.l >= 26) {
          return `${pre}#F4B858${post}`;
        }
        if (hsl.l < 28 && nonBgCount <= 3) {
          return `${pre}#FAF8F5${post}`;
        }
      } else if (hsl.l > 78 && nonBgCount <= 2) {
        return `${pre}#1C1917${post}`;
      }
      return full;
    }
  );
}

export async function vetorizarImagemLocal(
  inputBuffer: Buffer,
  options: VetorizacaoOptions = {}
): Promise<VetorizacaoResult> {
  const maxColors = Math.min(MAX_VECTOR_COLORS, Math.max(2, options.maxColors || 8));
  const maxBytes = options.maxBytes || MAX_VECTOR_SVG_BYTES;
  const inkHex = options.inkHex || "#1C1917";

  if (!inputBuffer || inputBuffer.length === 0) {
    throw new Error("Nenhuma imagem recebida para vetorizar.");
  }

  const inputIsSvg = isSvgBuffer(inputBuffer);
  let normalizedRasterPng: Buffer;
  let backgroundRemoved = false;
  let targetWidth = 1024;
  let targetHeight = 520;
  let engine: VetorizacaoResult["engine"] = "vtracer+potrace";
  let cleanedInputSvg: string | null = null;

  if (inputIsSvg) {
    const rawSvg = inputBuffer.toString("utf8");
    validateSvgSecurity(rawSvg);
    const resvg = new Resvg(rawSvg, { fitTo: { mode: "width", value: 1024 } });
    const renderedPng = Buffer.from(resvg.render().asPng());
    const meta = await sharp(renderedPng).metadata();
    targetWidth = meta.width || 1024;
    targetHeight = meta.height || 520;
    normalizedRasterPng = renderedPng;

    const optSvg = optimizeSvgWithSvgo(rawSvg, 2);
    const existingColors = extractDistinctSvgHexColors(optSvg);
    if (existingColors.length <= maxColors && Buffer.byteLength(optSvg, "utf8") < maxBytes) {
      cleanedInputSvg = ensureSvgViewBoxAndDimensions(optSvg, targetWidth, targetHeight);
      engine = "svg-cleaned";
    }
  } else {
    const meta = await sharp(inputBuffer).metadata();
    const origW = meta.width || 800;
    const scaleW = origW < 640 ? 960 : origW > 1280 ? 1152 : origW;
    normalizedRasterPng = await sharp(inputBuffer)
      .resize({ width: scaleW, withoutEnlargement: false })
      .ensureAlpha()
      .png()
      .toBuffer();
  }

  // Decode normalized raster, clean margin, trim, quantize <= maxColors
  const decoded = await sharp(normalizedRasterPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgba = new Uint8Array(decoded.data);
  backgroundRemoved = removeUniformBorderInPlace(
    rgba,
    decoded.info.width,
    decoded.info.height
  );

  let cleanTransparentPng = await sharp(Buffer.from(rgba.buffer), {
    raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  try {
    const trimmed = await sharp(cleanTransparentPng)
      .trim({ threshold: 8 })
      .toBuffer({ resolveWithObject: true });
    if (trimmed.info.width >= 16 && trimmed.info.height >= 16) {
      cleanTransparentPng = trimmed.data;
    }
  } catch {
    // Keep untrimmed if already tight
  }

  const quantizedMeta = await sharp(cleanTransparentPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  targetWidth = quantizedMeta.info.width;
  targetHeight = quantizedMeta.info.height;

  const qRgba = new Uint8Array(quantizedMeta.data);
  let colorsHex = clusterRgbaToPaletteInPlace(
    qRgba,
    targetWidth,
    targetHeight,
    maxColors,
    options.paletteHints
  );

  const quantizedPng = await sharp(Buffer.from(qRgba.buffer), {
    raw: { width: targetWidth, height: targetHeight, channels: 4 },
  })
    .png()
    .toBuffer();

  let colorSvg = cleanedInputSvg || "";

  if (!colorSvg) {
    // Run VTracer vectorization with progressively lighter fallback passes if SVG >= 200 KB
    const attempts = [
      { width: targetWidth, filterSpeckle: 6, lengthThreshold: 3.5, precision: 2 },
      { width: Math.min(targetWidth, 820), filterSpeckle: 10, lengthThreshold: 4.5, precision: 1 },
      { width: Math.min(targetWidth, 620), filterSpeckle: 14, lengthThreshold: 6.0, precision: 1 },
    ];

    for (const att of attempts) {
      let traceInputPng = quantizedPng;
      if (att.width < targetWidth) {
        const down = await sharp(quantizedPng)
          .resize({ width: att.width })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const dRgba = new Uint8Array(down.data);
        colorsHex = clusterRgbaToPaletteInPlace(
          dRgba,
          down.info.width,
          down.info.height,
          maxColors,
          options.paletteHints
        );
        traceInputPng = await sharp(Buffer.from(dRgba.buffer), {
          raw: { width: down.info.width, height: down.info.height, channels: 4 },
        })
          .png()
          .toBuffer();
        targetWidth = down.info.width;
        targetHeight = down.info.height;
      }

      const rawTraced = await vectorize(traceInputPng, {
        colorMode: ColorMode.Color,
        hierarchical: Hierarchical.Stacked,
        filterSpeckle: att.filterSpeckle,
        colorPrecision: 8,
        layerDifference: 24,
        mode: PathSimplifyMode.Spline,
        cornerThreshold: 58,
        lengthThreshold: att.lengthThreshold,
        maxIterations: 10,
        spliceThreshold: 45,
        pathPrecision: att.precision,
      });

      const clamped = normalizeAndClampSvgColors(rawTraced, colorsHex);
      const optimized = ensureSvgViewBoxAndDimensions(
        optimizeSvgWithSvgo(clamped, att.precision),
        targetWidth,
        targetHeight
      );
      colorSvg = optimized;
      if (Buffer.byteLength(colorSvg, "utf8") < maxBytes) {
        break;
      }
    }
  }

  validateSvgSecurity(colorSvg);

  // Extract monochrome silhouette for Potrace by flattening over pure white & inverting transparency
  const monoSilhouetteRgba = await sharp(quantizedPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mData = new Uint8Array(monoSilhouetteRgba.data);
  for (let i = 0; i < mData.length; i += 4) {
    if (mData[i + 3] < 128) {
      mData[i] = 255;
      mData[i + 1] = 255;
      mData[i + 2] = 255;
      mData[i + 3] = 255;
    } else {
      mData[i] = 0;
      mData[i + 1] = 0;
      mData[i + 2] = 0;
      mData[i + 3] = 255;
    }
  }
  const monoInputPng = await sharp(Buffer.from(mData.buffer), {
    raw: {
      width: monoSilhouetteRgba.info.width,
      height: monoSilhouetteRgba.info.height,
      channels: 4,
    },
  })
    .flatten({ background: "#FFFFFF" })
    .png()
    .toBuffer();

  const potraceInkRaw = await traceWithPotrace(monoInputPng, {
    color: inkHex,
    background: "transparent",
    turdSize: 4,
    optTolerance: 0.35,
  });
  const monocromaticoSvg = ensureSvgViewBoxAndDimensions(
    optimizeSvgWithSvgo(potraceInkRaw, 1),
    monoSilhouetteRgba.info.width,
    monoSilhouetteRgba.info.height
  );
  validateSvgSecurity(monocromaticoSvg);

  const potraceNegRaw = await traceWithPotrace(monoInputPng, {
    color: "#FAF8F5",
    background: "transparent",
    turdSize: 4,
    optTolerance: 0.35,
  });
  const monoNegativeSvg = ensureSvgViewBoxAndDimensions(
    optimizeSvgWithSvgo(potraceNegRaw, 1),
    monoSilhouetteRgba.info.width,
    monoSilhouetteRgba.info.height
  );
  validateSvgSecurity(monoNegativeSvg);

  const finalColors = extractDistinctSvgHexColors(colorSvg).slice(0, MAX_VECTOR_COLORS);
  const splitX = await findSymbolWordmarkSplitX(quantizedPng, targetWidth, targetHeight);

  const negativoSvg = await createNegativeVariantSvg({
    sourcePng: quantizedPng,
    colorSvg,
    monoNegativeSvg,
    width: targetWidth,
    height: targetHeight,
    colorsHex: finalColors,
    splitX,
    maxBytes,
  });
  validateSvgSecurity(negativoSvg);

  const { simboloSvg, simboloNegativoSvg } = await detectSymbolSplitAndBuildSvgs({
    sourcePng: quantizedPng,
    colorSvg,
    monoNegativeSvg,
    width: targetWidth,
    height: targetHeight,
    colorsHex: finalColors,
    simboloApenas: options.simboloApenas,
    splitX,
  });
  validateSvgSecurity(simboloSvg);
  validateSvgSecurity(simboloNegativoSvg);

  // Render crisp preview & 32px micro preview directly from the finalized color SVG
  const previewPng = Buffer.from(
    new Resvg(colorSvg, { fitTo: { mode: "width", value: 640 } }).render().asPng()
  );

  // Render square 32x32 legibility preview from symbol (best signal at favicon scale)
  const preview32Raw = Buffer.from(
    new Resvg(simboloSvg, { fitTo: { mode: "width", value: 128 } }).render().asPng()
  );
  const preview32Png = await sharp(preview32Raw)
    .resize(32, 32, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const pathCount = (colorSvg.match(/<(?:path|circle|rect|ellipse|polygon)\b/gi) || []).length;
  const byteSize = Buffer.byteLength(colorSvg, "utf8");

  return {
    colorSvg,
    simboloSvg,
    simboloNegativoSvg,
    monocromaticoSvg,
    negativoSvg,
    negativoTransparenteSvg: negativoSvg,
    previewPng,
    preview32Png,
    previewDataUrl: `data:image/png;base64,${previewPng.toString("base64")}`,
    preview32DataUrl: `data:image/png;base64,${preview32Png.toString("base64")}`,
    byteSize,
    maxBytes,
    under200Kb: byteSize < maxBytes,
    colorsHex: finalColors,
    colorsCount: finalColors.length,
    within8Colors: finalColors.length <= MAX_VECTOR_COLORS,
    pathCount,
    width: targetWidth,
    height: targetHeight,
    backgroundRemoved,
    engine,
  };
}

function extractInnerSvg(svgStr: string): {
  viewBox: string;
  inner: string;
} {
  const vbMatch = svgStr.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  const viewBox = vbMatch ? vbMatch[1] : "0 0 512 512";
  const openEnd = svgStr.indexOf(">");
  const closeStart = svgStr.lastIndexOf("</svg>");
  const inner =
    openEnd >= 0 && closeStart > openEnd
      ? svgStr.slice(openEnd + 1, closeStart)
      : "";
  return { viewBox, inner };
}

export async function gerar5VariantesDoVetor(params: {
  vetor: Pick<
    VetorizacaoResult,
    "colorSvg" | "simboloSvg" | "monocromaticoSvg" | "negativoSvg" | "negativoTransparenteSvg"
  >;
  dados: BrandData;
  paleta: BrandPalette;
  fontPairId: FontPairId;
}): Promise<VariantesDoVetor> {
  const { vetor, dados, paleta, fontPairId } = params;
  validateSvgSecurity(vetor.colorSvg);
  validateSvgSecurity(vetor.simboloSvg);
  validateSvgSecurity(vetor.monocromaticoSvg);
  validateSvgSecurity(vetor.negativoSvg);

  const { pair, fonts } = getSatoriFontsForPair(fontPairId);
  const colorMeta = await sharp(
    Buffer.from(new Resvg(vetor.colorSvg, { fitTo: { mode: "width", value: 1400 } }).render().asPng())
  ).metadata();
  const isWide = (colorMeta.width || 1400) > (colorMeta.height || 700) * 1.25;

  const symParsed = extractInnerSvg(vetor.simboloSvg);
  const symPng = Buffer.from(
    new Resvg(vetor.simboloSvg, { fitTo: { mode: "width", value: 1024 } }).render().asPng()
  );

  // Build pure vector typography SVG via Satori (converts text to <path> elements)
  const buildWordmarkSvg = async (w: number, hPx: number, centered: boolean) => {
    const el = h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: centered ? "center" : "flex-start",
          textAlign: centered ? "center" : "left",
        },
      },
      h(
        "div",
        {
          style: {
            fontFamily: pair.tituloFamily,
            fontWeight: pair.tituloWeight,
            fontSize: dados.nome.length > 18 ? (centered ? "44px" : "56px") : centered ? "56px" : "68px",
            color: paleta.tinta.hex,
            lineHeight: 1.05,
          },
        },
        dados.nome
      ),
      dados.slogan
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.textoFamily,
                fontWeight: 400,
                fontSize: centered ? "21px" : "24px",
                color: paleta.primaria.hex,
                marginTop: "8px",
              },
            },
            dados.slogan
          )
        : null
    );
    return satori(el, { width: w, height: hPx, fonts });
  };

  // 1. Horizontal variant directly from confirmed vector (or pure vector symbol + wordmark if symbol-only)
  let horizontalSvg = vetor.colorSvg;
  if (dados.simbolo || !isWide) {
    const wmSvg = extractInnerSvg(await buildWordmarkSvg(760, 260, false));
    horizontalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 340" width="1120" height="340">
  <svg x="48" y="45" width="250" height="250" viewBox="${symParsed.viewBox}">${symParsed.inner}</svg>
  <svg x="336" y="40" width="760" height="260" viewBox="${wmSvg.viewBox}">${wmSvg.inner}</svg>
</svg>`;
    validateSvgSecurity(horizontalSvg);
  }

  // 2. Vertical variant combining confirmed symbol centered above pure-vector wordmark
  const wmVert = extractInnerSvg(await buildWordmarkSvg(720, 190, true));
  const verticalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 620" width="820" height="620">
  <svg x="275" y="48" width="270" height="270" viewBox="${symParsed.viewBox}">${symParsed.inner}</svg>
  <svg x="50" y="346" width="720" height="190" viewBox="${wmVert.viewBox}">${wmVert.inner}</svg>
</svg>`;
  validateSvgSecurity(verticalSvg);

  const processedPng = Buffer.from(
    new Resvg(horizontalSvg, { fitTo: { mode: "width", value: 1400 } }).render().asPng()
  );
  const iconPng = await sharp(symPng)
    .resize(1024, 1024, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const negSrc = vetor.negativoTransparenteSvg || vetor.negativoSvg;
  const whiteLogoPng = Buffer.from(
    new Resvg(negSrc, { fitTo: { mode: "width", value: 1400 } }).render().asPng()
  );

  return {
    horizontalSvg,
    verticalSvg,
    simboloSvg: vetor.simboloSvg,
    monocromaticoSvg: vetor.monocromaticoSvg,
    negativoSvg: vetor.negativoSvg,
    negativoTransparenteSvg: negSrc,
    processedPng,
    iconPng,
    whiteLogoPng,
  };
}
