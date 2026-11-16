import React from "react";
import sharp from "sharp";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { PDFDocument, rgb } from "pdf-lib";
import {
  BrandData,
  BrandPalette,
  CONTENT_STYLES,
  FontPairId,
  SECTORS,
  StyleId,
} from "../formats";
import { getSatoriFontsForPair } from "../fonts";
import {
  contrastRatio,
  getContrastingTextHex,
  hexToRgb,
  mixHex,
  relativeLuminance,
  rgbToHex,
  rgbToHsl,
} from "../palette";
import { CoverLayoutId, getDefaultCoverLayoutIdForStyle } from "../capas/catalog";
import { renderLayeredCover } from "../capas/composer";
import { gerarArtePublicacaoDaMarca, type LogoVisualDna } from "../imagem";
import { adaptVectorSvgForSurface } from "../vetorizar";

const h = React.createElement;

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

/**
 * Converte píxeis do wordmark por aglomerados de cor reais (nunca píxel-a-píxel isolado)
 * para eliminar qualquer efeito salpicado em letras coloridas ou com anti-aliasing em fundos escuros.
 */
async function convertDarkSurfaceWordmarkClustered(
  data: Buffer | Uint8Array,
  w: number,
  hPx: number,
  splitX: number,
  surfaceHex: string
): Promise<Uint8Array> {
  const out = new Uint8Array(data);
  const clusters: {
    rSum: number;
    gSum: number;
    bSum: number;
    count: number;
    target?: [number, number, number];
  }[] = [];

  for (let y = 0; y < hPx; y += 2) {
    for (let x = splitX; x < w; x += 2) {
      const idx = (y * w + x) * 4;
      if (out[idx + 3] < 195) continue;
      const r = out[idx];
      const g = out[idx + 1];
      const b = out[idx + 2];
      const hit = clusters.find(
        (c) =>
          Math.hypot(r - c.rSum / c.count, g - c.gSum / c.count, b - c.bSum / c.count) < 42
      );
      if (hit) {
        hit.rSum += r;
        hit.gSum += g;
        hit.bSum += b;
        hit.count++;
      } else if (clusters.length < 8) {
        clusters.push({ rSum: r, gSum: g, bSum: b, count: 1 });
      }
    }
  }

  for (const c of clusters) {
    const r = Math.round(c.rSum / c.count);
    const g = Math.round(c.gSum / c.count);
    const b = Math.round(c.bSum / c.count);
    const hex = rgbToHex({ r, g, b });
    const hsl = rgbToHsl({ r, g, b });
    const ratio = contrastRatio(hex, surfaceHex);
    if (ratio >= 4.7 && hsl.l >= 50) {
      c.target = [r, g, b];
    } else if (hsl.s >= 32 && hsl.l >= 26) {
      c.target = hsl.h >= 85 && hsl.h <= 255 ? [226, 240, 232] : [244, 184, 88];
    } else {
      c.target = [250, 248, 245];
    }
  }

  if (clusters.length > 0) {
    for (let y = 0; y < hPx; y++) {
      for (let x = splitX; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (out[idx + 3] < 10) continue;
        const r = out[idx];
        const g = out[idx + 1];
        const b = out[idx + 2];
        let best = clusters[0];
        let bestD = Infinity;
        for (const c of clusters) {
          const d = Math.hypot(
            r - c.rSum / c.count,
            g - c.gSum / c.count,
            b - c.bSum / c.count
          );
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        if (best.target) {
          out[idx] = best.target[0];
          out[idx + 1] = best.target[1];
          out[idx + 2] = best.target[2];
        }
      }
    }
  }

  // No símbolo à esquerda, levanta apenas eventual pedestal horizontal escuro na base (y >= 77%)
  if (splitX > 0) {
    let minSymY = hPx;
    let maxSymY = 0;
    for (let y = 0; y < hPx; y++) {
      for (let x = 0; x < splitX; x++) {
        if (out[(y * w + x) * 4 + 3] >= 128) {
          if (y < minSymY) minSymY = y;
          if (y > maxSymY) maxSymY = y;
        }
      }
    }
    const pedestalY =
      maxSymY > minSymY ? minSymY + Math.round((maxSymY - minSymY) * 0.77) : Math.round(hPx * 0.77);
    for (let y = pedestalY; y < hPx; y++) {
      for (let x = 0; x < splitX; x++) {
        const idx = (y * w + x) * 4;
        if (out[idx + 3] < 110) continue;
        const hsl = rgbToHsl({ r: out[idx], g: out[idx + 1], b: out[idx + 2] });
        if (hsl.l < 26) {
          out[idx] = 250;
          out[idx + 1] = 248;
          out[idx + 2] = 245;
        }
      }
    }
  }

  return out;
}

/**
 * Gera a versão do logótipo para fundos escuros:
 * - Se o logótipo for escuro e quase sem cor (isDarkMonochrome), passa o desenho a branco (#FAF8F5).
 * - Se o logótipo for colorido horizontal, preserva a cavidade do símbolo à esquerda (levantando o pedestal)
 *   e converte por aglomerados uniformes o texto escuro em #FAF8F5 e terracota escuro em #F4B858.
 */
export async function createWhiteKnockoutLogo(
  processedPng: Buffer,
  isDarkMonochrome = false
): Promise<Buffer> {
  const { data, info } = await sharp(processedPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const hPx = info.height;

  if (isDarkMonochrome) {
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 10) {
        out[i] = data[i];
        out[i + 1] = data[i + 1];
        out[i + 2] = data[i + 2];
        out[i + 3] = a;
      } else {
        out[i] = 250;
        out[i + 1] = 248;
        out[i + 2] = 245;
        out[i + 3] = a;
      }
    }
    return sharp(Buffer.from(out.buffer), {
      raw: { width: w, height: hPx, channels: 4 },
    })
      .png()
      .toBuffer();
  }

  let wordmarkStartX = 0;
  if (w > hPx * 1.35) {
    wordmarkStartX = Math.min(w, Math.round(hPx * 0.95));
    const minSearchX = Math.round(w * 0.22);
    const maxSearchX = Math.min(w - 10, Math.round(w * 0.68));
    let seenOpaqueLeft = false;
    for (let x = minSearchX; x <= maxSearchX; x++) {
      let colOpaque = 0;
      for (let y = 0; y < hPx; y++) {
        if (data[(y * w + x) * 4 + 3] > 24) colOpaque++;
      }
      if (colOpaque > 0) {
        seenOpaqueLeft = true;
      } else if (seenOpaqueLeft && colOpaque === 0) {
        wordmarkStartX = x;
        break;
      }
    }
  }

  const out = await convertDarkSurfaceWordmarkClustered(
    data,
    w,
    hPx,
    wordmarkStartX,
    "#1E100A"
  );

  return sharp(Buffer.from(out.buffer), {
    raw: { width: w, height: hPx, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function trimLogoWithRatio(pngBuffer: Buffer): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  aspectRatio: number;
}> {
  try {
    const trimmed = await sharp(pngBuffer)
      .ensureAlpha()
      .trim({ threshold: 4 })
      .png()
      .toBuffer({ resolveWithObject: true });
    const w = Math.max(1, trimmed.info.width);
    const h = Math.max(1, trimmed.info.height);
    return {
      buffer: trimmed.data,
      width: w,
      height: h,
      aspectRatio: w / h,
    };
  } catch {
    const meta = await sharp(pngBuffer).metadata();
    const w = Math.max(1, meta.width || 300);
    const h = Math.max(1, meta.height || 150);
    return {
      buffer: pngBuffer,
      width: w,
      height: h,
      aspectRatio: w / h,
    };
  }
}

export async function createMonochromeLogo(
  processedPng: Buffer,
  hexColor: string
): Promise<Buffer> {
  const { r, g, b } = hexToRgb(hexColor);
  const { data, info } = await sharp(processedPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = data[i + 3];
  }

  return sharp(Buffer.from(out.buffer), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

export async function extractIconSquare(
  processedPng: Buffer,
  customIconPng?: Buffer
): Promise<Buffer> {
  if (customIconPng) {
    return sharp(customIconPng)
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  }

  const { data, info } = await sharp(processedPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const hPx = info.height;

  let sourceForIcon = processedPng;
  // Se o logótipo for horizontal (símbolo à esquerda + texto à direita), procura a coluna transparente entre o símbolo e o texto
  if (w > hPx * 1.35) {
    let splitX = Math.min(w, Math.round(hPx * 0.95));
    const minSearchX = Math.round(w * 0.22);
    const maxSearchX = Math.min(w - 10, Math.round(w * 0.68));

    let seenOpaqueLeft = false;
    for (let x = minSearchX; x <= maxSearchX; x++) {
      let colOpaque = 0;
      for (let y = 0; y < hPx; y++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a > 24) colOpaque++;
      }
      if (colOpaque > 0) {
        seenOpaqueLeft = true;
      } else if (seenOpaqueLeft && colOpaque === 0) {
        splitX = x;
        break;
      }
    }

    try {
      const cropped = await sharp(processedPng)
        .extract({ left: 0, top: 0, width: splitX, height: hPx })
        .trim({ threshold: 8 })
        .toBuffer();
      sourceForIcon = cropped;
    } catch {
      sourceForIcon = processedPng;
    }
  }

  // Fit inside 1024x1024 with comfortable padding
  const inner = 800;
  const resized = await sharp(sourceForIcon)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

export async function renderHorizontalVariant(params: {
  processedPng: Buffer;
  iconPng: Buffer;
  dados: BrandData;
  paleta: BrandPalette;
  fontPairId: FontPairId;
}): Promise<Buffer> {
  const { processedPng, iconPng, dados, paleta, fontPairId } = params;
  const width = 1800;
  const height = 560;

  if (dados.simbolo) {
    const { pair, fonts } = getSatoriFontsForPair(fontPairId);
    const iconB64 = `data:image/png;base64,${iconPng.toString("base64")}`;

    const element = h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 96px",
          gap: "56px",
        },
      },
      h("img", {
        src: iconB64,
        width: 380,
        height: 380,
        style: { objectFit: "contain" },
      }),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          },
        },
        h(
          "div",
          {
            style: {
              fontFamily: pair.tituloFamily,
              fontWeight: pair.tituloWeight,
              fontSize: dados.nome.length > 18 ? "96px" : "116px",
              color: paleta.tinta.hex,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
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
                  fontSize: "38px",
                  color: paleta.primaria.hex,
                  marginTop: "16px",
                },
              },
              dados.slogan
            )
          : null
      )
    );

    const svg = await satori(element, { width, height, fonts });
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
    return Buffer.from(resvg.render().asPng());
  }

  const innerW = 1560;
  const innerH = 440;
  const resized = await sharp(processedPng)
    .resize(innerW, innerH, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

export async function renderSquareOnBackground(params: {
  logoPng: Buffer;
  size: number;
  bgHex: string;
  paddingRatio?: number;
  opaque?: boolean;
}): Promise<Buffer> {
  const { logoPng, size, bgHex, paddingRatio = 0.18, opaque = true } = params;
  const inner = Math.max(12, Math.round(size * (1 - paddingRatio * 2)));
  const resized = await sharp(logoPng)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const { r, g, b } = hexToRgb(bgHex);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r, g, b, alpha: opaque ? 1 : 0 },
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

export async function renderSignatureLogo(processedPng: Buffer): Promise<Buffer> {
  const meta = await sharp(processedPng).metadata();
  const origW = meta.width || 256;
  const origH = meta.height || 128;
  const scaledW = Math.round((origW / origH) * 128);

  if (scaledW <= 480) {
    return sharp(processedPng)
      .resize({ height: 128 })
      .png()
      .toBuffer();
  }

  const fitted = await sharp(processedPng)
    .resize(480, 128, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return fitted;
}

export interface StyleThemeColors {
  isDarkBg: boolean;
  textColor: string;
  mutedTextColor: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  bgRefHex?: string;
}

export function getStyleThemeColors(
  style: StyleId,
  paleta: BrandPalette
): StyleThemeColors {
  switch (style) {
    case "liso": {
      const textColor = getContrastingTextHex(
        paleta.primaria.hex,
        paleta.papel.hex,
        paleta.tinta.hex
      );
      const isDarkBg = textColor === paleta.papel.hex;
      return {
        isDarkBg,
        textColor,
        mutedTextColor: mixHex(textColor, paleta.primaria.hex, 0.2),
        accentColor: paleta.secundaria.hex,
        badgeBg: isDarkBg ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.08)",
        badgeText: textColor,
        bgRefHex: paleta.primaria.hex,
      };
    }
    case "degrade": {
      return {
        isDarkBg: true,
        textColor: paleta.papel.hex,
        mutedTextColor: mixHex(paleta.papel.hex, paleta.primaria.hex, 0.2),
        accentColor: paleta.secundaria.hex,
        badgeBg: "rgba(255,255,255,0.16)",
        badgeText: paleta.papel.hex,
        bgRefHex: mixHex(paleta.tinta.hex, paleta.primaria.hex, 0.45),
      };
    }
    case "fotografia": {
      return {
        isDarkBg: true,
        textColor: "#FAF8F5",
        mutedTextColor: "#E5E0D8",
        accentColor: paleta.primaria.hex,
        badgeBg: "rgba(255,255,255,0.18)",
        badgeText: "#FAF8F5",
        bgRefHex: "#141210",
      };
    }
    case "padrao":
    case "informativo":
    case "minimal":
    default: {
      return {
        isDarkBg: false,
        textColor: paleta.tinta.hex,
        mutedTextColor: paleta.neutro.hex,
        accentColor: paleta.primaria.hex,
        badgeBg: mixHex(paleta.papel.hex, paleta.primaria.hex, 0.14),
        badgeText: paleta.tinta.hex,
        bgRefHex: paleta.papel.hex,
      };
    }
  }
}

export async function renderStyleBackgroundBuffer(params: {
  width: number;
  height: number;
  style: StyleId;
  paleta: BrandPalette;
  photoBuffer?: Buffer;
}): Promise<Buffer> {
  const { width, height, style, paleta, photoBuffer } = params;

  if (style === "fotografia") {
    let baseLayer: Buffer;
    if (photoBuffer && photoBuffer.length > 0) {
      baseLayer = await sharp(photoBuffer)
        .resize(width, height, { fit: "cover", position: "centre" })
        .png()
        .toBuffer();
    } else {
      const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="photoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${paleta.tinta.hex}" />
            <stop offset="55%" stop-color="${mixHex(paleta.tinta.hex, paleta.primaria.hex, 0.5)}" />
            <stop offset="100%" stop-color="${paleta.secundaria.hex}" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#photoGrad)" />
        <circle cx="${Math.round(width * 0.78)}" cy="${Math.round(height * 0.28)}" r="${Math.round(Math.min(width, height) * 0.42)}" fill="${paleta.primaria.hex}" fill-opacity="0.28" />
      </svg>`;
      baseLayer = await sharp(Buffer.from(fallbackSvg)).resize(width, height).png().toBuffer();
    }

    const veilSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="veil" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0D0C0B" stop-opacity="0.72" />
          <stop offset="100%" stop-color="#0D0C0B" stop-opacity="0.54" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#veil)" />
    </svg>`;
    const veilPng = await sharp(Buffer.from(veilSvg)).png().toBuffer();
    return sharp(baseLayer)
      .composite([{ input: veilPng, top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  if (style === "degrade") {
    const deepStart = mixHex(paleta.tinta.hex, paleta.primaria.hex, 0.26);
    const midStop = mixHex(paleta.tinta.hex, paleta.primaria.hex, 0.46);
    const endStop = mixHex(paleta.tinta.hex, paleta.primaria.hex, 0.68);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${deepStart}" />
          <stop offset="52%" stop-color="${midStop}" />
          <stop offset="100%" stop-color="${endStop}" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
      <circle cx="${Math.round(width * 0.88)}" cy="${Math.round(height * 0.18)}" r="${Math.round(Math.max(width, height) * 0.28)}" fill="${paleta.secundaria.hex}" fill-opacity="0.16" />
    </svg>`;
    return sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();
  }

  if (style === "padrao") {
    const cell = Math.max(56, Math.round(Math.min(width, height) / 5));
    const r = Math.round(cell * 0.28);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <pattern id="brandPat" x="0" y="0" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse">
          <path d="M ${cell / 2} ${cell * 0.14} C ${cell * 0.72} ${cell * 0.14}, ${cell * 0.86} ${cell * 0.32}, ${cell * 0.86} ${cell * 0.62} L ${cell * 0.86} ${cell * 0.84} L ${cell * 0.14} ${cell * 0.84} L ${cell * 0.14} ${cell * 0.62} C ${cell * 0.14} ${cell * 0.32}, ${cell * 0.28} ${cell * 0.14}, ${cell / 2} ${cell * 0.14} Z" fill="none" stroke="${paleta.primaria.hex}" stroke-width="2" stroke-opacity="0.09" />
          <circle cx="${cell / 2}" cy="${cell / 2}" r="${r * 0.45}" fill="${paleta.secundaria.hex}" fill-opacity="0.07" />
        </pattern>
      </defs>
      <rect width="${width}" height="${height}" fill="${paleta.papel.hex}" />
      <rect width="${width}" height="${height}" fill="url(#brandPat)" />
      <rect x="0" y="${height - Math.max(8, Math.round(height * 0.025))}" width="${width}" height="${Math.max(8, Math.round(height * 0.025))}" fill="${paleta.primaria.hex}" />
    </svg>`;
    return sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();
  }

  if (style === "informativo") {
    const barH = Math.max(10, Math.round(height * 0.035));
    const sideW = Math.max(12, Math.round(width * 0.018));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="${paleta.papel.hex}" />
      <rect x="0" y="0" width="${sideW}" height="${height}" fill="${paleta.primaria.hex}" />
      <rect x="0" y="${height - barH}" width="${width}" height="${barH}" fill="${paleta.tinta.hex}" />
    </svg>`;
    return sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();
  }

  if (style === "minimal") {
    const pad = Math.max(12, Math.round(Math.min(width, height) * 0.04));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="${paleta.papel.hex}" />
      <rect x="${pad}" y="${pad}" width="${width - pad * 2}" height="${height - pad * 2}" fill="none" stroke="${paleta.neutro.hex}" stroke-opacity="0.25" stroke-width="1.5" />
    </svg>`;
    return sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();
  }

  const accentH = Math.max(8, Math.round(height * 0.03));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${paleta.primaria.hex}" />
    <rect x="0" y="${height - accentH}" width="${width}" height="${accentH}" fill="${paleta.secundaria.hex}" />
  </svg>`;
  return sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();
}

async function sampleSurfaceRectHex(
  bgPng: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  hPx: number
): Promise<{ avgHex: string; minLum: number; maxLum: number }> {
  const rx = Math.max(0, Math.min(width - 4, Math.round(x)));
  const ry = Math.max(0, Math.min(height - 4, Math.round(y)));
  const rw = Math.max(4, Math.min(width - rx, Math.round(w)));
  const rh = Math.max(4, Math.min(height - ry, Math.round(hPx)));

  const { data } = await sharp(bgPng)
    .extract({ left: rx, top: ry, width: rw, height: rh })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const stepX = Math.max(1, Math.floor(rw / 16));
  const stepY = Math.max(1, Math.floor(rh / 12));
  let rS = 0;
  let gS = 0;
  let bS = 0;
  let cnt = 0;
  let minLum = 1;
  let maxLum = 0;

  for (let py = 0; py < rh; py += stepY) {
    for (let px = 0; px < rw; px += stepX) {
      const idx = (py * rw + px) * 3;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const hex = rgbToHex({ r, g, b });
      const lum = relativeLuminance(hex);
      rS += r;
      gS += g;
      bS += b;
      cnt++;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }
  }

  const avgHex =
    cnt > 0
      ? rgbToHex({
          r: Math.round(rS / cnt),
          g: Math.round(gS / cnt),
          b: Math.round(bS / cnt),
        })
      : "#1E100A";

  return { avgHex, minLum, maxLum };
}

function pickWcagHexOnSurface(preferredHex: string, bgHex: string, minRatio = 4.5): string {
  if (contrastRatio(preferredHex, bgHex) >= minRatio) return preferredHex;
  const best = getContrastingTextHex(bgHex, "#FAF8F5", "#1C1917");
  if (contrastRatio(best, bgHex) >= minRatio) return best;
  return contrastRatio("#FFFFFF", bgHex) >= contrastRatio("#000000", bgHex)
    ? "#FFFFFF"
    : "#000000";
}

async function ensureWordmarkContrastOnDarkBg(
  pngBuffer: Buffer,
  bgHex: string
): Promise<Buffer> {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const hPx = info.height;
  if (w <= hPx * 1.35) return pngBuffer;

  let wordmarkStartX = -1;
  const minSearchX = Math.round(w * 0.18);
  const maxSearchX = Math.min(w - 6, Math.round(w * 0.65));
  let seenOpaqueLeft = false;
  for (let x = minSearchX; x <= maxSearchX; x++) {
    let colOpaque = 0;
    for (let y = 0; y < hPx; y++) {
      if (data[(y * w + x) * 4 + 3] > 20) colOpaque++;
    }
    if (colOpaque > 0) {
      seenOpaqueLeft = true;
    } else if (seenOpaqueLeft && colOpaque === 0) {
      wordmarkStartX = x;
      break;
    }
  }
  if (wordmarkStartX <= 0) return pngBuffer;

  const out = await convertDarkSurfaceWordmarkClustered(
    data,
    w,
    hPx,
    wordmarkStartX,
    bgHex
  );

  return sharp(Buffer.from(out.buffer), {
    raw: { width: w, height: hPx, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function prepareFittedLogoElement(params: {
  isDarkBg: boolean;
  processedPng: Buffer;
  whiteLogoPng: Buffer;
  contrastBgHex?: string;
  vectorizedSvg?: string;
  negativeSvg?: string;
  targetHeight: number;
  maxWidth: number;
  maxHeight: number;
}): Promise<{
  width: number;
  height: number;
  aspectRatio: number;
  element: React.ReactElement;
}> {
  let chosenBuf: Buffer;
  if (params.vectorizedSvg) {
    const surface = params.contrastBgHex || (params.isDarkBg ? "#1E100A" : "#FAF6F0");
    const svgSrc =
      params.isDarkBg && params.negativeSvg ? params.negativeSvg : params.vectorizedSvg;
    const adaptedSvg = adaptVectorSvgForSurface(svgSrc, surface);
    chosenBuf = Buffer.from(
      new Resvg(adaptedSvg, { fitTo: { mode: "width", value: 900 } }).render().asPng()
    );
  } else {
    const chosenRaw = params.isDarkBg ? params.whiteLogoPng : params.processedPng;
    const preTrim = await trimLogoWithRatio(chosenRaw);
    chosenBuf =
      params.isDarkBg && params.contrastBgHex
        ? await ensureWordmarkContrastOnDarkBg(preTrim.buffer, params.contrastBgHex)
        : preTrim.buffer;
  }

  const trimmed = await trimLogoWithRatio(chosenBuf);
  let drawH = Math.min(params.maxHeight, Math.max(24, params.targetHeight));
  let drawW = Math.round(drawH * trimmed.aspectRatio);
  if (drawW > params.maxWidth) {
    drawW = params.maxWidth;
    drawH = Math.max(18, Math.round(drawW / trimmed.aspectRatio));
  }
  const src = `data:image/png;base64,${trimmed.buffer.toString("base64")}`;
  return {
    width: drawW,
    height: drawH,
    aspectRatio: trimmed.aspectRatio,
    element: h("img", {
      src,
      width: drawW,
      height: drawH,
      style: { objectFit: "contain" },
    }),
  };
}

export async function renderCoverPiece(params: {
  id: string;
  width: number;
  height: number;
  style: StyleId;
  dados: BrandData;
  paleta: BrandPalette;
  fontPairId: FontPairId;
  processedPng: Buffer;
  whiteLogoPng: Buffer;
  isDarkMonochrome: boolean;
  photoBuffer?: Buffer;
  coverLayoutId?: CoverLayoutId;
  cutoutBuffer?: Buffer;
  vectorizedSvg?: string;
  negativeSvg?: string;
  logoDna?: LogoVisualDna;
  sessaoId?: string;
}): Promise<Buffer> {
  const layoutId =
    params.coverLayoutId || getDefaultCoverLayoutIdForStyle(params.style);
  const res = await renderLayeredCover({
    coverFormatId: params.id,
    width: params.width,
    height: params.height,
    layoutId,
    dados: params.dados,
    paleta: params.paleta,
    fontPairId: params.fontPairId,
    processedPng: params.processedPng,
    whiteLogoPng: params.whiteLogoPng,
    vectorizedSvg: params.vectorizedSvg,
    negativeSvg: params.negativeSvg,
    logoDna: params.logoDna,
    estiloPeca: params.style,
    photoBuffer: params.photoBuffer,
    cutoutBuffer: params.cutoutBuffer,
    sessaoId: params.sessaoId,
  });
  return res.buffer;
}

export async function renderInstagramPost(params: {
  style: StyleId;
  dados: BrandData;
  paleta: BrandPalette;
  fontPairId: FontPairId;
  processedPng: Buffer;
  whiteLogoPng: Buffer;
  isDarkMonochrome: boolean;
  photoBuffer?: Buffer;
  vectorizedSvg?: string;
  negativeSvg?: string;
  logoDna?: LogoVisualDna;
  sessaoId?: string;
}): Promise<Buffer> {
  const width = 1080;
  const height = 1080;
  const {
    style,
    dados,
    paleta,
    fontPairId,
    processedPng,
    whiteLogoPng,
    photoBuffer,
    vectorizedSvg,
    negativeSvg,
    logoDna,
    sessaoId,
  } = params;

  let bgPng: Buffer;
  if (style === "fotografia" && photoBuffer && photoBuffer.length > 0) {
    bgPng = await renderStyleBackgroundBuffer({
      width,
      height,
      style,
      paleta,
      photoBuffer,
    });
  } else {
    const art = await gerarArtePublicacaoDaMarca({
      tipo: "publicacao-instagram",
      nome: dados.nome,
      sector: dados.sector,
      paleta,
      estiloPeca: style,
      logotipoReferencia: processedPng,
      logotipoDna: logoDna,
      sessaoId,
    });
    bgPng = await sharp(art.buffer)
      .resize(width, height, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
  }

  // Amostra luminosidade real da zona superior (logótipo) e centro-esquerdo (textos reais)
  const logoSurface = await sampleSurfaceRectHex(bgPng, width, height, 84, 84, 480, 180);
  const textSurface = await sampleSurfaceRectHex(bgPng, width, height, 84, 290, 740, 440);
  const footSurface = await sampleSurfaceRectHex(bgPng, width, height, 84, 820, 620, 140);

  const isLogoDarkBg = relativeLuminance(logoSurface.avgHex) < 0.28;
  const isTextDarkBg = relativeLuminance(textSurface.avgHex) < 0.3;

  const headlineColor = pickWcagHexOnSurface(
    isTextDarkBg ? "#FAF8F5" : paleta.tinta.hex,
    textSurface.avgHex,
    4.6
  );
  const mutedColor = pickWcagHexOnSurface(
    isTextDarkBg ? "#F4DEC0" : mixHex(paleta.tinta.hex, paleta.neutro.hex, 0.28),
    textSurface.avgHex,
    4.5
  );
  const pillBg = isLogoDarkBg
    ? "rgba(250, 248, 245, 0.16)"
    : mixHex(paleta.primaria.hex, "#FFFFFF", 0.85);
  const pillText = isLogoDarkBg
    ? "#FAF8F5"
    : pickWcagHexOnSurface(paleta.tinta.hex, mixHex(paleta.primaria.hex, "#FFFFFF", 0.85), 4.6);
  const footerText = pickWcagHexOnSurface(
    relativeLuminance(footSurface.avgHex) < 0.3 ? "#FAF8F5" : paleta.tinta.hex,
    footSurface.avgHex,
    4.5
  );

  // Véu localizado discreto apenas se o pior píxel sob o texto falhar contraste
  const worstLum = isTextDarkBg ? textSurface.maxLum : textSurface.minLum;
  const txtLum = relativeLuminance(headlineColor);
  const worstRatio = (Math.max(txtLum, worstLum) + 0.05) / (Math.min(txtLum, worstLum) + 0.05);
  if (worstRatio < 4.5) {
    const scrimHex = isTextDarkBg ? paleta.tinta.hex : paleta.papel.hex;
    const scrimRgb = hexToRgb(scrimHex);
    const veilSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="64" y="290" width="690" height="440" rx="22" fill="rgb(${scrimRgb.r},${scrimRgb.g},${scrimRgb.b})" fill-opacity="0.72" />
    </svg>`;
    bgPng = await sharp(bgPng)
      .composite([
        {
          input: Buffer.from(
            new Resvg(veilSvg, { fitTo: { mode: "width", value: width } }).render().asPng()
          ),
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer();
  }

  const { pair, fonts } = getSatoriFontsForPair(fontPairId);
  const servicosList = (dados.servicos || "")
    .split(/[,;•]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  const fittedPostLogo = await prepareFittedLogoElement({
    isDarkBg: isLogoDarkBg,
    processedPng,
    whiteLogoPng,
    contrastBgHex: logoSurface.avgHex,
    vectorizedSvg,
    negativeSvg,
    targetHeight: style === "minimal" ? 115 : 142,
    maxWidth: 480,
    maxHeight: 165,
  });

  // Se o logótipo já contém o nome (dados.simbolo=false) e existe slogan, destaca o slogan em grande sem repetir o nome
  const hasSeparateHeadline = Boolean(dados.simbolo) || !dados.slogan?.trim();
  const mainHeadline = hasSeparateHeadline ? dados.nome : dados.slogan;
  const secondaryLine = hasSeparateHeadline ? (dados.slogan || "").trim() : "";
  const footerLeft = (dados.website || dados.email || "").trim().replace(/^https?:\/\//i, "");
  const footerRight = (dados.telefone || dados.morada || "").trim();

  const element = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "84px",
      },
    },
    h(
      "div",
      {
        style: {
          width: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
      },
      fittedPostLogo.element,
      (dados.morada || "").trim()
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontWeight: 600,
                fontSize: "22px",
                color: pillText,
                backgroundColor: pillBg,
                padding: "10px 22px",
                borderRadius: "999px",
              },
            },
            dados.morada.trim()
          )
        : null
    ),
    h(
      "div",
      {
        style: {
          width: "74%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          marginTop: "12px",
          marginBottom: "24px",
        },
      },
      mainHeadline
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontWeight: pair.tituloWeight,
                fontSize: mainHeadline.length > 26 ? "62px" : "76px",
                color: headlineColor,
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
              },
            },
            mainHeadline
          )
        : null,
      secondaryLine
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.textoFamily,
                fontWeight: 400,
                fontSize: "34px",
                color: mutedColor,
                marginTop: "22px",
                lineHeight: 1.32,
              },
            },
            secondaryLine
          )
        : null,
      style === "informativo" && servicosList.length > 0
        ? h(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: "14px",
                marginTop: "32px",
              },
            },
            ...servicosList.map((srv, idx) =>
              h(
                "div",
                {
                  key: String(idx),
                  style: {
                    fontFamily: pair.tituloFamily,
                    fontWeight: pair.tituloWeight,
                    fontSize: "24px",
                    color: pillText,
                    backgroundColor: pillBg,
                    padding: "12px 22px",
                    borderRadius: "10px",
                  },
                },
                srv
              )
            )
          )
        : dados.servicos?.trim() && style !== "minimal"
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontWeight: 600,
                fontSize: "26px",
                color: isTextDarkBg ? "#F4B858" : paleta.primaria.hex,
                marginTop: "26px",
              },
            },
            dados.servicos.trim()
          )
        : null
    ),
    footerLeft || footerRight
      ? h(
          "div",
          {
            style: {
              width: "66%",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              borderTop: `2px solid ${isTextDarkBg ? "rgba(250,248,245,0.22)" : "rgba(42,24,16,0.16)"}`,
              paddingTop: "22px",
              gap: "6px",
            },
          },
          footerLeft
            ? h(
                "div",
                {
                  style: {
                    fontFamily: pair.tituloFamily,
                    fontWeight: pair.tituloWeight,
                    fontSize: "24px",
                    color: footerText,
                  },
                },
                footerLeft
              )
            : null,
          footerRight
            ? h(
                "div",
                {
                  style: {
                    fontFamily: pair.textoFamily,
                    fontWeight: 400,
                    fontSize: "22px",
                    color: footerText,
                  },
                },
                footerRight
              )
            : null
        )
      : null
  );

  const fgSvg = await satori(element, { width, height, fonts });
  const fgPng = Buffer.from(
    new Resvg(fgSvg, { fitTo: { mode: "width", value: width } }).render().asPng()
  );

  return sharp(bgPng)
    .composite([{ input: fgPng, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

export async function renderInstagramStory(params: {
  style: StyleId;
  dados: BrandData;
  paleta: BrandPalette;
  fontPairId: FontPairId;
  processedPng: Buffer;
  whiteLogoPng: Buffer;
  isDarkMonochrome: boolean;
  photoBuffer?: Buffer;
  vectorizedSvg?: string;
  negativeSvg?: string;
  logoDna?: LogoVisualDna;
  sessaoId?: string;
}): Promise<Buffer> {
  const width = 1080;
  const height = 1920;
  const {
    style,
    dados,
    paleta,
    fontPairId,
    processedPng,
    whiteLogoPng,
    photoBuffer,
    vectorizedSvg,
    negativeSvg,
    logoDna,
    sessaoId,
  } = params;

  let bgPng: Buffer;
  if (style === "fotografia" && photoBuffer && photoBuffer.length > 0) {
    bgPng = await renderStyleBackgroundBuffer({
      width,
      height,
      style,
      paleta,
      photoBuffer,
    });
  } else {
    const art = await gerarArtePublicacaoDaMarca({
      tipo: "story-instagram",
      nome: dados.nome,
      sector: dados.sector,
      paleta,
      estiloPeca: style,
      logotipoReferencia: processedPng,
      logotipoDna: logoDna,
      sessaoId,
    });
    bgPng = await sharp(art.buffer)
      .resize(width, height, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
  }

  const logoSurface = await sampleSurfaceRectHex(bgPng, width, height, 92, 290, 560, 210);
  const textSurface = await sampleSurfaceRectHex(bgPng, width, height, 92, 650, 740, 520);
  const footSurface = await sampleSurfaceRectHex(bgPng, width, height, 92, 1340, 580, 220);

  const isLogoDarkBg = relativeLuminance(logoSurface.avgHex) < 0.28;
  const isTextDarkBg = relativeLuminance(textSurface.avgHex) < 0.3;

  const headlineColor = pickWcagHexOnSurface(
    isTextDarkBg ? "#FAF8F5" : paleta.tinta.hex,
    textSurface.avgHex,
    4.6
  );
  const mutedColor = pickWcagHexOnSurface(
    isTextDarkBg ? "#F4DEC0" : mixHex(paleta.tinta.hex, paleta.neutro.hex, 0.28),
    textSurface.avgHex,
    4.5
  );
  const badgeBg = isTextDarkBg
    ? "rgba(250, 248, 245, 0.14)"
    : mixHex(paleta.primaria.hex, "#FFFFFF", 0.85);
  const badgeText = isTextDarkBg
    ? "#F4B858"
    : pickWcagHexOnSurface(paleta.tinta.hex, mixHex(paleta.primaria.hex, "#FFFFFF", 0.85), 4.5);
  const footColor = pickWcagHexOnSurface(
    relativeLuminance(footSurface.avgHex) < 0.3 ? "#FAF8F5" : paleta.tinta.hex,
    footSurface.avgHex,
    4.5
  );

  const { pair, fonts } = getSatoriFontsForPair(fontPairId);

  const fittedStoryLogo = await prepareFittedLogoElement({
    isDarkBg: isLogoDarkBg,
    processedPng,
    whiteLogoPng,
    contrastBgHex: logoSurface.avgHex,
    vectorizedSvg,
    negativeSvg,
    targetHeight: 175,
    maxWidth: 620,
    maxHeight: 205,
  });

  const hasSeparateHeadline = Boolean(dados.simbolo) || !dados.slogan?.trim();
  const mainHeadline = hasSeparateHeadline ? dados.nome : dados.slogan;
  const secondaryLine = hasSeparateHeadline ? (dados.slogan || "").trim() : "";

  const element = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        paddingTop: "290px",
        paddingBottom: "320px",
        paddingLeft: "92px",
        paddingRight: "92px",
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        },
      },
      fittedStoryLogo.element
    ),
    h(
      "div",
      {
        style: {
          width: "86%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        },
      },
      mainHeadline
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontWeight: pair.tituloWeight,
                fontSize: mainHeadline.length > 24 ? "74px" : "88px",
                color: headlineColor,
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
              },
            },
            mainHeadline
          )
        : null,
      secondaryLine
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.textoFamily,
                fontWeight: 400,
                fontSize: "40px",
                color: mutedColor,
                marginTop: "26px",
                lineHeight: 1.32,
              },
            },
            secondaryLine
          )
        : null,
      dados.servicos?.trim() && style !== "minimal"
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontWeight: 600,
                fontSize: "28px",
                color: badgeText,
                backgroundColor: badgeBg,
                padding: "16px 26px",
                borderRadius: "14px",
                marginTop: "38px",
                alignSelf: "flex-start",
              },
            },
            dados.servicos.trim()
          )
        : null
    ),
    dados.website?.trim() || dados.morada?.trim() || dados.telefone?.trim()
      ? h(
          "div",
          {
            style: {
              width: "58%",
              display: "flex",
              flexDirection: "column",
              borderTop: `2px solid ${isTextDarkBg ? "rgba(250,248,245,0.22)" : "rgba(42,24,16,0.18)"}`,
              paddingTop: "28px",
              gap: "8px",
            },
          },
          dados.website?.trim()
            ? h(
                "div",
                {
                  style: {
                    fontFamily: pair.tituloFamily,
                    fontWeight: pair.tituloWeight,
                    fontSize: "28px",
                    color: footColor,
                  },
                },
                dados.website.trim().replace(/^https?:\/\//i, "")
              )
            : null,
          dados.morada?.trim() || dados.telefone?.trim()
            ? h(
                "div",
                {
                  style: {
                    fontFamily: pair.textoFamily,
                    fontWeight: 400,
                    fontSize: "24px",
                    color: footColor,
                  },
                },
                [dados.telefone?.trim(), dados.morada?.trim()].filter(Boolean).join("  •  ")
              )
            : null
        )
      : null
  );

  const fgSvg = await satori(element, { width, height, fonts });
  const fgPng = Buffer.from(
    new Resvg(fgSvg, { fitTo: { mode: "width", value: width } }).render().asPng()
  );

  return sharp(bgPng)
    .composite([{ input: fgPng, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

export function renderEmailSignatureHtml(params: {
  style: StyleId;
  dados: BrandData;
  paleta: BrandPalette;
  fontPairId: FontPairId;
}): string {
  const { style, dados, paleta, fontPairId } = params;
  const { pair } = getSatoriFontsForPair(fontPairId);

  let cardBg = "#FFFFFF";
  let headerBandBg = paleta.primaria.hex;
  const borderCol = mixHex(paleta.papel.hex, paleta.tinta.hex, 0.18);
  const nameCol = paleta.tinta.hex;
  let accentCol = paleta.primaria.hex;
  const textCol = "#334155";

  if (style === "liso" || style === "degrade") {
    cardBg = paleta.papel.hex;
    headerBandBg = paleta.primaria.hex;
    accentCol = paleta.secundaria.hex;
  } else if (style === "minimal") {
    cardBg = "#FFFFFF";
    headerBandBg = paleta.tinta.hex;
    accentCol = paleta.tinta.hex;
  } else if (style === "informativo") {
    cardBg = paleta.papel.hex;
    headerBandBg = paleta.tinta.hex;
    accentCol = paleta.primaria.hex;
  }

  const nifClean = (dados.nif || "").trim();
  const websiteClean = (dados.website || "").trim();
  const websiteDisplay = websiteClean.replace(/^https?:\/\//, "");

  return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8" />
  <title>Assinatura de Email — ${escapeHtml(dados.nome)}</title>
</head>
<body style="margin: 0; padding: 16px; background-color: #ffffff; font-family: '${pair.tituloFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; max-width: 560px; width: 100%; background-color: ${cardBg}; border: 1px solid ${borderCol}; border-left: 5px solid ${headerBandBg};">
    <tr>
      <td style="padding: 18px 20px; vertical-align: top;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%;">
          <tr>
            <td style="vertical-align: top; padding-right: 18px; width: 140px;">
              <img src="logotipo-assinatura.png" alt="${escapeHtml(dados.nome)}" height="64" style="display: block; height: 64px; width: auto; max-width: 180px; border: 0;" />
            </td>
            <td style="vertical-align: top;">
              ${
                dados.pessoa
                  ? `<div style="font-size: 16px; font-weight: 700; color: ${nameCol}; line-height: 1.25; margin: 0;">${escapeHtml(dados.pessoa)}</div>`
                  : ""
              }
              ${
                dados.cargo
                  ? `<div style="font-size: 13px; font-weight: 600; color: ${accentCol}; line-height: 1.3; margin-top: 2px;">${escapeHtml(dados.cargo)}</div>`
                  : ""
              }
              <div style="font-size: 15px; font-weight: 700; color: ${nameCol}; line-height: 1.3; margin-top: ${dados.pessoa ? "6px" : "0"};">${escapeHtml(dados.nome)}</div>
              ${
                dados.slogan
                  ? `<div style="font-size: 12px; font-style: italic; color: ${textCol}; line-height: 1.35; margin-top: 2px;">${escapeHtml(dados.slogan)}</div>`
                  : ""
              }
              ${
                dados.servicos && style === "informativo"
                  ? `<div style="font-size: 12px; color: ${nameCol}; background-color: #ffffff; border: 1px solid ${borderCol}; padding: 4px 8px; margin-top: 8px; display: inline-block;">${escapeHtml(dados.servicos)}</div>`
                  : ""
              }
            </td>
          </tr>
        </table>
        ${
          dados.telefone || dados.email || websiteClean || dados.morada || nifClean
            ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%; margin-top: 12px; border-top: 1px solid ${borderCol};">
          <tr>
            <td style="padding-top: 10px; font-size: 12px; color: ${textCol}; line-height: 1.6;">
              ${
                dados.telefone
                  ? `<span style="margin-right: 12px;"><strong>Tel.:</strong> ${escapeHtml(dados.telefone)}</span>`
                  : ""
              }
              ${
                dados.email
                  ? `<span style="margin-right: 12px;"><strong>Email:</strong> <a href="mailto:${escapeHtml(dados.email)}" style="color: ${accentCol}; text-decoration: none;">${escapeHtml(dados.email)}</a></span>`
                  : ""
              }
              ${
                websiteClean
                  ? `<span style="margin-right: 12px;"><strong>Web:</strong> <a href="${escapeHtml(websiteClean)}" style="color: ${accentCol}; text-decoration: none;">${escapeHtml(websiteDisplay)}</a></span>`
                  : ""
              }
              ${
                dados.morada
                  ? `<div style="margin-top: 2px;"><strong>Morada:</strong> ${escapeHtml(dados.morada)}</div>`
                  : ""
              }
              ${
                nifClean
                  ? `<div style="margin-top: 2px;"><strong>NIF:</strong> ${escapeHtml(nifClean)}</div>`
                  : ""
              }
            </td>
          </tr>
        </table>`
            : ""
        }
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function drawCropMarksOnPdfPage(
  page: import("pdf-lib").PDFPage,
  pageW: number,
  pageH: number,
  bleedPt: number
) {
  const markLen = bleedPt * 0.78;
  const c = rgb(0.45, 0.45, 0.45);
  const thickness = 0.4;

  page.drawLine({ start: { x: 0, y: bleedPt }, end: { x: markLen, y: bleedPt }, thickness, color: c });
  page.drawLine({ start: { x: bleedPt, y: 0 }, end: { x: bleedPt, y: markLen }, thickness, color: c });

  page.drawLine({ start: { x: pageW - markLen, y: bleedPt }, end: { x: pageW, y: bleedPt }, thickness, color: c });
  page.drawLine({ start: { x: pageW - bleedPt, y: 0 }, end: { x: pageW - bleedPt, y: markLen }, thickness, color: c });

  page.drawLine({ start: { x: 0, y: pageH - bleedPt }, end: { x: markLen, y: pageH - bleedPt }, thickness, color: c });
  page.drawLine({ start: { x: bleedPt, y: pageH - markLen }, end: { x: bleedPt, y: pageH }, thickness, color: c });

  page.drawLine({ start: { x: pageW - markLen, y: pageH - bleedPt }, end: { x: pageW, y: pageH - bleedPt }, thickness, color: c });
  page.drawLine({ start: { x: pageW - bleedPt, y: pageH - markLen }, end: { x: pageW - bleedPt, y: pageH }, thickness, color: c });
}

export async function renderBusinessCardPdf(params: {
  style: StyleId;
  dados: BrandData;
  paleta: BrandPalette;
  fontPairId: FontPairId;
  processedPng: Buffer;
  whiteLogoPng: Buffer;
  isDarkMonochrome: boolean;
  photoBuffer?: Buffer;
}): Promise<{ pdfBuffer: Buffer; frontPreviewPng: Buffer }> {
  const pxW = 1075;
  const pxH = 720;
  const bleedPx = Math.round((3 / 91) * pxW);

  const {
    style,
    dados,
    paleta,
    fontPairId,
    processedPng,
    whiteLogoPng,
    photoBuffer,
  } = params;

  const { pair, fonts } = getSatoriFontsForPair(fontPairId);
  const theme = getStyleThemeColors(style, paleta);

  const frontBg = await renderStyleBackgroundBuffer({
    width: pxW,
    height: pxH,
    style,
    paleta,
    photoBuffer,
  });

  const fittedFrontLogo = await prepareFittedLogoElement({
    isDarkBg: theme.isDarkBg,
    processedPng,
    whiteLogoPng,
    contrastBgHex: theme.bgRefHex,
    targetHeight: !dados.simbolo ? 210 : 185,
    maxWidth: !dados.simbolo ? 780 : 320,
    maxHeight: 250,
  });

  const frontEl = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: `${bleedPx + 40}px`,
      },
    },
    fittedFrontLogo.element,
    dados.simbolo
      ? h(
          "div",
          {
            style: {
              fontFamily: pair.tituloFamily,
              fontWeight: pair.tituloWeight,
              fontSize: "46px",
              color: theme.textColor,
              marginTop: "24px",
              textAlign: "center",
            },
          },
          dados.nome
        )
      : null,
    dados.simbolo && dados.slogan
      ? h(
          "div",
          {
            style: {
              fontFamily: pair.textoFamily,
              fontWeight: 400,
              fontSize: "23px",
              color: theme.mutedTextColor,
              marginTop: "10px",
              textAlign: "center",
            },
          },
          dados.slogan
        )
      : !dados.simbolo && dados.website
      ? h(
          "div",
          {
            style: {
              fontFamily: pair.textoFamily,
              fontWeight: 400,
              fontSize: "22px",
              color: theme.mutedTextColor,
              marginTop: "24px",
              textAlign: "center",
            },
          },
          dados.website.replace(/^https?:\/\//, "")
        )
      : null
  );

  const frontFgSvg = await satori(frontEl, { width: pxW, height: pxH, fonts });
  const frontFgPng = Buffer.from(
    new Resvg(frontFgSvg, { fitTo: { mode: "width", value: pxW } }).render().asPng()
  );
  const frontPng = await sharp(frontBg)
    .composite([{ input: frontFgPng, top: 0, left: 0 }])
    .png()
    .toBuffer();

  const backLogoSrc = `data:image/png;base64,${processedPng.toString("base64")}`;
  const backEl = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: paleta.papel.hex,
        padding: `${bleedPx + 48}px`,
        borderLeft: `${bleedPx + 14}px solid ${paleta.primaria.hex}`,
      },
    },
    h(
      "div",
      {
        style: {
          width: "100%",
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
          },
        },
        dados.pessoa
          ? h(
              "div",
              {
                style: {
                  fontFamily: pair.tituloFamily,
                  fontWeight: pair.tituloWeight,
                  fontSize: "38px",
                  color: paleta.tinta.hex,
                },
              },
              dados.pessoa
            )
          : h(
              "div",
              {
                style: {
                  fontFamily: pair.tituloFamily,
                  fontWeight: pair.tituloWeight,
                  fontSize: "38px",
                  color: paleta.tinta.hex,
                },
              },
              dados.nome
            ),
        dados.cargo
          ? h(
              "div",
              {
                style: {
                  fontFamily: pair.textoFamily,
                  fontWeight: 400,
                  fontSize: "22px",
                  color: paleta.primaria.hex,
                  marginTop: "6px",
                },
              },
              dados.cargo
            )
          : null
      ),
      h("img", {
        src: backLogoSrc,
        width: 140,
        height: 85,
        style: { objectFit: "contain" },
      })
    ),
    dados.servicos
      ? h(
          "div",
          {
            style: {
              fontFamily: pair.tituloFamily,
              fontWeight: 400,
              fontSize: "20px",
              color: paleta.neutro.hex,
            },
          },
          dados.servicos
        )
      : h("div", { style: { display: "flex" } }),
    dados.telefone || dados.email || dados.website || dados.morada || dados.nif
      ? h(
          "div",
          {
            style: {
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              borderTop: `2px solid ${mixHex(paleta.papel.hex, paleta.tinta.hex, 0.15)}`,
              paddingTop: "20px",
              fontFamily: pair.textoFamily,
              fontSize: "20px",
              color: paleta.tinta.hex,
            },
          },
          dados.telefone ? h("div", null, `Tel.: ${dados.telefone}`) : null,
          dados.email ? h("div", null, `Email: ${dados.email}`) : null,
          dados.website
            ? h("div", null, `Web: ${dados.website.replace(/^https?:\/\//, "")}`)
            : null,
          dados.morada ? h("div", null, dados.morada) : null,
          dados.nif ? h("div", null, `NIF: ${dados.nif}`) : null
        )
      : null
  );

  const backSvg = await satori(backEl, { width: pxW, height: pxH, fonts });
  const backPng = Buffer.from(
    new Resvg(backSvg, { fitTo: { mode: "width", value: pxW } }).render().asPng()
  );

  const pdfDoc = await PDFDocument.create();
  const pageW = mmToPt(91);
  const pageH = mmToPt(61);
  const trimW = mmToPt(85);
  const trimH = mmToPt(55);
  const bleedPt = mmToPt(3);

  const frontImg = await pdfDoc.embedPng(frontPng);
  const backImg = await pdfDoc.embedPng(backPng);

  for (const embeddedImg of [frontImg, backImg]) {
    const page = pdfDoc.addPage([pageW, pageH]);
    page.setBleedBox(0, 0, pageW, pageH);
    page.setTrimBox(bleedPt, bleedPt, trimW, trimH);
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: pageW,
      height: pageH,
    });
    drawCropMarksOnPdfPage(page, pageW, pageH, bleedPt);
  }

  const pdfBytes = await pdfDoc.save();
  return {
    pdfBuffer: Buffer.from(pdfBytes),
    frontPreviewPng: frontPng,
  };
}

export async function renderLetterheadPdf(params: {
  style: StyleId;
  dados: BrandData;
  paleta: BrandPalette;
  fontPairId: FontPairId;
  processedPng: Buffer;
  whiteLogoPng: Buffer;
  isDarkMonochrome: boolean;
  photoBuffer?: Buffer;
}): Promise<{ pdfBuffer: Buffer; previewPng: Buffer }> {
  const pxW = 1240;
  const pxH = 1754;
  const headerH = 260;

  const {
    style,
    dados,
    paleta,
    fontPairId,
    processedPng,
    whiteLogoPng,
    photoBuffer,
  } = params;

  const { pair, fonts } = getSatoriFontsForPair(fontPairId);
  const theme = getStyleThemeColors(style, paleta);

  const headerBg = await renderStyleBackgroundBuffer({
    width: pxW,
    height: headerH,
    style,
    paleta,
    photoBuffer,
  });

  const fittedHeaderLogo = await prepareFittedLogoElement({
    isDarkBg: theme.isDarkBg,
    processedPng,
    whiteLogoPng,
    contrastBgHex: theme.bgRefHex,
    targetHeight: !dados.simbolo ? 128 : 115,
    maxWidth: !dados.simbolo ? 520 : 180,
    maxHeight: 148,
  });

  const headerFgEl = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "36px 64px",
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "28px",
        },
      },
      fittedHeaderLogo.element,
      dados.simbolo
        ? h(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
              },
            },
            h(
              "div",
              {
                style: {
                  fontFamily: pair.tituloFamily,
                  fontWeight: pair.tituloWeight,
                  fontSize: "40px",
                  color: theme.textColor,
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
                      fontSize: "20px",
                      color: theme.mutedTextColor,
                      marginTop: "6px",
                    },
                  },
                  dados.slogan
                )
              : null
          )
        : null
    ),
    dados.servicos
      ? h(
          "div",
          {
            style: {
              fontFamily: pair.tituloFamily,
              fontWeight: 400,
              fontSize: "18px",
              color: theme.badgeText,
              backgroundColor: theme.badgeBg,
              padding: "10px 18px",
              borderRadius: "8px",
              maxWidth: "360px",
            },
          },
          dados.servicos
        )
      : h("div", { style: { display: "flex" } })
  );

  const headerFgSvg = await satori(headerFgEl, {
    width: pxW,
    height: headerH,
    fonts,
  });
  const headerFgPng = Buffer.from(
    new Resvg(headerFgSvg, { fitTo: { mode: "width", value: pxW } })
      .render()
      .asPng()
  );
  const headerComposite = await sharp(headerBg)
    .composite([{ input: headerFgPng, top: 0, left: 0 }])
    .png()
    .toBuffer();

  const headerB64 = `data:image/png;base64,${headerComposite.toString("base64")}`;
  const nifClean = (dados.nif || "").trim();
  const nifText = nifClean ? `NIF: ${nifClean}` : "";

  const pageEl = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
      },
    },
    h("img", {
      src: headerB64,
      width: pxW,
      height: headerH,
      style: { objectFit: "cover" },
    }),
    h("div", {
      style: {
        flexGrow: 1,
        width: "100%",
        backgroundColor: "#FFFFFF",
      },
    }),
    h(
      "div",
      {
        style: {
          width: "100%",
          boxSizing: "border-box",
          padding: "28px 64px 44px 64px",
          borderTop: `3px solid ${paleta.primaria.hex}`,
          backgroundColor: paleta.papel.hex,
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: pair.textoFamily,
          fontSize: "18px",
          color: paleta.tinta.hex,
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          },
        },
        h(
          "div",
          {
            style: {
              fontFamily: pair.tituloFamily,
              fontWeight: pair.tituloWeight,
              fontSize: "19px",
            },
          },
          dados.nome
        ),
        dados.morada ? h("div", null, dados.morada) : null,
        [dados.telefone, dados.email, dados.website]
          .map((s) => (s || "").trim())
          .filter(Boolean).length > 0
          ? h(
              "div",
              null,
              [dados.telefone, dados.email, dados.website]
                .map((s) => (s || "").trim())
                .filter(Boolean)
                .join("  •  ")
            )
          : null
      ),
      nifText
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontWeight: pair.tituloWeight,
                fontSize: "18px",
                color: paleta.tinta.hex,
                padding: "8px 16px",
                border: `1.5px solid ${paleta.neutro.hex}`,
                borderRadius: "6px",
                backgroundColor: "#FFFFFF",
              },
            },
            nifText
          )
        : null
    )
  );

  const pageSvg = await satori(pageEl, { width: pxW, height: pxH, fonts });
  const pagePng = Buffer.from(
    new Resvg(pageSvg, { fitTo: { mode: "width", value: pxW } }).render().asPng()
  );

  const pdfDoc = await PDFDocument.create();
  const a4W = mmToPt(210);
  const a4H = mmToPt(297);
  const page = pdfDoc.addPage([a4W, a4H]);
  const embedded = await pdfDoc.embedPng(pagePng);
  page.drawImage(embedded, { x: 0, y: 0, width: a4W, height: a4H });

  const pdfBytes = await pdfDoc.save();
  return {
    pdfBuffer: Buffer.from(pdfBytes),
    previewPng: pagePng,
  };
}

export async function renderBrandGuidePdf(params: {
  dados: BrandData;
  paleta: BrandPalette;
  fontPairId: FontPairId;
  kitStyle: StyleId;
  principalPng: Buffer;
  iconePng: Buffer;
  horizontalPng: Buffer;
  fundoClaroPng: Buffer;
  fundoEscuroPng: Buffer;
}): Promise<{ pdfBuffer: Buffer; previewPng: Buffer }> {
  const pxW = 1240;
  const pxH = 1754;

  const {
    dados,
    paleta,
    fontPairId,
    kitStyle,
    iconePng,
    horizontalPng,
    fundoClaroPng,
    fundoEscuroPng,
  } = params;

  const { pair, fonts } = getSatoriFontsForPair(fontPairId);

  const b64Icone = `data:image/png;base64,${iconePng.toString("base64")}`;
  const b64Horiz = `data:image/png;base64,${horizontalPng.toString("base64")}`;
  const b64Claro = `data:image/png;base64,${fundoClaroPng.toString("base64")}`;
  const b64Escuro = `data:image/png;base64,${fundoEscuroPng.toString("base64")}`;

  const colorList = [
    { label: "Primária", entry: paleta.primaria },
    { label: "Secundária", entry: paleta.secundaria },
    { label: "Papel", entry: paleta.papel },
    { label: "Tinta", entry: paleta.tinta },
    { label: "Neutro", entry: paleta.neutro },
  ];

  const guideEl = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        padding: "56px 64px",
      },
    },
    h(
      "div",
      {
        style: {
          width: "100%",
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderBottom: `4px solid ${paleta.primaria.hex}`,
          paddingBottom: "22px",
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
          },
        },
        h(
          "div",
          {
            style: {
              fontFamily: pair.tituloFamily,
              fontWeight: 400,
              fontSize: "17px",
              color: paleta.primaria.hex,
              letterSpacing: "0.08em",
            },
          },
          "GUIA DE MARCA — UMA PÁGINA"
        ),
        h(
          "div",
          {
            style: {
              fontFamily: pair.tituloFamily,
              fontWeight: pair.tituloWeight,
              fontSize: "48px",
              color: paleta.tinta.hex,
              marginTop: "6px",
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
                  fontSize: "21px",
                  color: paleta.neutro.hex,
                  marginTop: "4px",
                },
              },
              dados.slogan
            )
          : null
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            fontFamily: pair.textoFamily,
            fontSize: "16px",
            color: paleta.neutro.hex,
          },
        },
        h("div", null, `Sector: ${SECTORS[dados.sector]?.rotulo || "Geral"}`),
        h("div", null, `Estilo base: ${CONTENT_STYLES[kitStyle]?.nome || kitStyle}`)
      )
    ),
    h(
      "div",
      {
        style: {
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        },
      },
      h(
        "div",
        {
          style: {
            fontFamily: pair.tituloFamily,
            fontWeight: pair.tituloWeight,
            fontSize: "23px",
            color: paleta.tinta.hex,
          },
        },
        "1. Variantes do Logótipo"
      ),
      h(
        "div",
        {
          style: {
            width: "100%",
            display: "flex",
            flexDirection: "row",
            gap: "16px",
            height: "260px",
          },
        },
        h(
          "div",
          {
            style: {
              width: "352px",
              backgroundColor: paleta.papel.hex,
              borderRadius: "14px",
              padding: "16px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              border: "1px solid #E2E8F0",
            },
          },
          h("img", {
            src: b64Horiz,
            width: 310,
            height: 175,
            style: { objectFit: "contain" },
          }),
          h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontSize: "14px",
                color: paleta.neutro.hex,
              },
            },
            "Horizontal (1800×560 px)"
          )
        ),
        h(
          "div",
          {
            style: {
              width: "238px",
              backgroundColor: "#F8FAFC",
              borderRadius: "14px",
              padding: "16px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              border: "1px solid #E2E8F0",
            },
          },
          h("img", {
            src: b64Icone,
            width: 165,
            height: 165,
            style: { objectFit: "contain" },
          }),
          h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontSize: "14px",
                color: paleta.neutro.hex,
              },
            },
            "Ícone (1024×1024 px)"
          )
        ),
        h(
          "div",
          {
            style: {
              width: "238px",
              backgroundColor: "#F8FAFC",
              borderRadius: "14px",
              padding: "16px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              border: "1px solid #E2E8F0",
            },
          },
          h("img", {
            src: b64Claro,
            width: 165,
            height: 165,
            style: { objectFit: "contain", borderRadius: "8px" },
          }),
          h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontSize: "14px",
                color: paleta.neutro.hex,
              },
            },
            "Fundo Claro (1200×1200 px)"
          )
        ),
        h(
          "div",
          {
            style: {
              width: "236px",
              backgroundColor: "#F8FAFC",
              borderRadius: "14px",
              padding: "16px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              border: "1px solid #E2E8F0",
            },
          },
          h("img", {
            src: b64Escuro,
            width: 165,
            height: 165,
            style: { objectFit: "contain", borderRadius: "8px" },
          }),
          h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontSize: "14px",
                color: paleta.neutro.hex,
              },
            },
            "Fundo Escuro (1200×1200 px)"
          )
        )
      )
    ),
    h(
      "div",
      {
        style: {
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        },
      },
      h(
        "div",
        {
          style: {
            fontFamily: pair.tituloFamily,
            fontWeight: pair.tituloWeight,
            fontSize: "23px",
            color: paleta.tinta.hex,
          },
        },
        "2. Paleta Cromática Oficial (HEX e RGB)"
      ),
      h(
        "div",
        {
          style: {
            width: "100%",
            display: "flex",
            flexDirection: "row",
            gap: "16px",
          },
        },
        ...colorList.map(({ label, entry }) =>
          h(
            "div",
            {
              key: label,
              style: {
                width: "209px",
                display: "flex",
                flexDirection: "column",
                border: "1px solid #CBD5E1",
                borderRadius: "14px",
                overflow: "hidden",
              },
            },
            h("div", {
              style: {
                width: "100%",
                height: "110px",
                backgroundColor: entry.hex,
              },
            }),
            h(
              "div",
              {
                style: {
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  backgroundColor: "#FFFFFF",
                },
              },
              h(
                "div",
                {
                  style: {
                    fontFamily: pair.tituloFamily,
                    fontWeight: pair.tituloWeight,
                    fontSize: "17px",
                    color: paleta.tinta.hex,
                  },
                },
                label
              ),
              h(
                "div",
                {
                  style: {
                    fontFamily: pair.tituloFamily,
                    fontWeight: 400,
                    fontSize: "15px",
                    color: paleta.primaria.hex,
                  },
                },
                entry.hex
              ),
              h(
                "div",
                {
                  style: {
                    fontFamily: pair.textoFamily,
                    fontWeight: 400,
                    fontSize: "13px",
                    color: paleta.neutro.hex,
                  },
                },
                `RGB(${entry.rgb.r}, ${entry.rgb.g}, ${entry.rgb.b})`
              )
            )
          )
        )
      )
    ),
    h(
      "div",
      {
        style: {
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        },
      },
      h(
        "div",
        {
          style: {
            fontFamily: pair.tituloFamily,
            fontWeight: pair.tituloWeight,
            fontSize: "23px",
            color: paleta.tinta.hex,
          },
        },
        `3. Par Tipográfico — ${pair.nome}`
      ),
      h(
        "div",
        {
          style: {
            width: "100%",
            display: "flex",
            flexDirection: "row",
            gap: "20px",
          },
        },
        h(
          "div",
          {
            style: {
              width: "546px",
              boxSizing: "border-box",
              backgroundColor: paleta.papel.hex,
              borderRadius: "14px",
              padding: "22px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            },
          },
          h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontSize: "14px",
                color: paleta.primaria.hex,
              },
            },
            `TÍTULOS — ${pair.tituloFamily} (Peso ${pair.tituloWeight})`
          ),
          h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontWeight: pair.tituloWeight,
                fontSize: "32px",
                color: paleta.tinta.hex,
              },
            },
            dados.nome
          ),
          h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontWeight: pair.tituloWeight,
                fontSize: "18px",
                color: paleta.neutro.hex,
              },
            },
            "ABCDEFGHIJKLMN OPQRSTUVWXYZ 0123456789"
          )
        ),
        h(
          "div",
          {
            style: {
              width: "546px",
              boxSizing: "border-box",
              backgroundColor: paleta.papel.hex,
              borderRadius: "14px",
              padding: "22px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            },
          },
          h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontSize: "14px",
                color: paleta.primaria.hex,
              },
            },
            `CORPO DE TEXTO — ${pair.textoFamily} (Peso ${pair.textoWeight})`
          ),
          h(
            "div",
            {
              style: {
                fontFamily: pair.textoFamily,
                fontWeight: pair.textoWeight,
                fontSize: "21px",
                color: paleta.tinta.hex,
                lineHeight: 1.4,
              },
            },
            dados.slogan ||
              dados.servicos ||
              "Identidade visual coerente para todas as aplicações digitais e impressas."
          ),
          h(
            "div",
            {
              style: {
                fontFamily: pair.textoFamily,
                fontWeight: pair.textoWeight,
                fontSize: "17px",
                color: paleta.neutro.hex,
              },
            },
            "abcdefghijklmnopqrstuvwxyz áàâãçéêíóôõú"
          )
        )
      )
    ),
    h(
      "div",
      {
        style: {
          width: "100%",
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          borderTop: "1px solid #CBD5E1",
          paddingTop: "14px",
          fontFamily: pair.textoFamily,
          fontSize: "14px",
          color: paleta.neutro.hex,
        },
      },
      h("div", null, `PandoMarca • Kit oficial de ${dados.nome}`),
      h(
        "div",
        null,
        [dados.website, dados.email, dados.telefone]
          .filter(Boolean)
          .join("  •  ")
      )
    )
  );

  const guideSvg = await satori(guideEl, { width: pxW, height: pxH, fonts });
  const guidePng = Buffer.from(
    new Resvg(guideSvg, { fitTo: { mode: "width", value: pxW } }).render().asPng()
  );

  const pdfDoc = await PDFDocument.create();
  const a4W = mmToPt(210);
  const a4H = mmToPt(297);
  const page = pdfDoc.addPage([a4W, a4H]);
  const embedded = await pdfDoc.embedPng(guidePng);
  page.drawImage(embedded, { x: 0, y: 0, width: a4W, height: a4H });

  const pdfBytes = await pdfDoc.save();
  return {
    pdfBuffer: Buffer.from(pdfBytes),
    previewPng: guidePng,
  };
}
