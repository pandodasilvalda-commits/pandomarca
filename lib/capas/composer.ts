import React from "react";
import sharp, { type OverlayOptions } from "sharp";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { BrandData, BrandPalette, FontPairId, StyleId } from "../formats";
import { getSatoriFontsForPair } from "../fonts";
import {
  gerarArteCapaDaMarca,
  type ImagemResultado,
  type LogoVisualDna,
} from "../imagem";
import {
  contrastRatio,
  getContrastingTextHex,
  hexToRgb,
  mixHex,
  relativeLuminance,
  rgbToHex,
  rgbToHsl,
} from "../palette";
import { adaptVectorSvgForSurface } from "../vetorizar";
import { CoverLayoutId, CoverLayoutSpec, getCoverLayoutById } from "./catalog";

const h = React.createElement;

export interface SafeBoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoverAuditInfo {
  layoutId: CoverLayoutId;
  categoria: CoverLayoutSpec["categoria"];
  textColorHex: string;
  surfaceHex: string;
  contrastRatio: number;
  wcagAaPassed: boolean;
  logoHeightPx: number;
  logoHeightRatio: number;
  logoOverlappedByObject: boolean;
  safeZoneRespectsAvatar: boolean;
  linesRendered: string[];
  origemArte: ImagemResultado["origem"];
  referenciaLogoUsada: boolean;
  formasDoLogotipo: string;
  estiloDoLogotipo: string;
  promptResumo: string;
}

export interface LayeredCoverResult {
  buffer: Buffer;
  audit: CoverAuditInfo;
}

/**
 * Garante contraste WCAG AA (mínimo 4.5:1 para texto normal, 3.0:1 para títulos grandes).
 */
export function ensureWcagContrast(
  preferredHex: string,
  backgroundHex: string,
  minRatio = 4.5
): string {
  if (contrastRatio(preferredHex, backgroundHex) >= minRatio) {
    return preferredHex;
  }

  const candidates = [
    "#141210",
    "#1C1917",
    "#0F172A",
    "#000000",
    "#FAF8F5",
    "#FFFFFF",
  ];

  let best = getContrastingTextHex(backgroundHex, "#FAF8F5", "#141210");
  let bestRatio = contrastRatio(best, backgroundHex);

  for (const c of candidates) {
    const r = contrastRatio(c, backgroundHex);
    if (r >= minRatio && r > bestRatio) {
      best = c;
      bestRatio = r;
    }
  }

  if (bestRatio >= minRatio) return best;
  return contrastRatio("#FFFFFF", backgroundHex) >=
    contrastRatio("#000000", backgroundHex)
    ? "#FFFFFF"
    : "#000000";
}

export function extractRealClientLines(dados: BrandData): {
  nome: string;
  slogan: string | null;
  servicos: string | null;
  localidade: string | null;
  telefone: string | null;
  website: string | null;
  email: string | null;
} {
  return {
    nome: (dados.nome || "").trim(),
    slogan: (dados.slogan || "").trim() || null,
    servicos: (dados.servicos || "").trim() || null,
    localidade: (dados.morada || "").trim() || null,
    telefone: (dados.telefone || "").trim() || null,
    website: (dados.website || "").trim().replace(/^https?:\/\//i, "") || null,
    email: (dados.email || "").trim() || null,
  };
}

function clampRectToCanvas(rect: SafeBoxRect, maxW: number, maxH: number): SafeBoxRect {
  const x = Math.max(0, Math.min(maxW - 4, Math.round(rect.x)));
  const y = Math.max(0, Math.min(maxH - 4, Math.round(rect.y)));
  const width = Math.max(4, Math.min(maxW - x, Math.round(rect.width)));
  const height = Math.max(4, Math.min(maxH - y, Math.round(rect.height)));
  return { x, y, width, height };
}

/**
 * Mede a luminosidade real da arte gerada por detrás da caixa onde o logótipo ou os textos serão compostos.
 */
async function measureSurfaceInRect(
  canvasPng: Buffer,
  canvasW: number,
  canvasH: number,
  rect: SafeBoxRect
): Promise<{
  avgHex: string;
  avgLum: number;
  minLum: number;
  maxLum: number;
}> {
  const r = clampRectToCanvas(rect, canvasW, canvasH);
  const { data } = await sharp(canvasPng)
    .extract({ left: r.x, top: r.y, width: r.width, height: r.height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const stepX = Math.max(1, Math.floor(r.width / 20));
  const stepY = Math.max(1, Math.floor(r.height / 10));
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;
  let minLum = 1;
  let maxLum = 0;

  for (let y = 0; y < r.height; y += stepY) {
    for (let x = 0; x < r.width; x += stepX) {
      const idx = (y * r.width + x) * 3;
      const red = data[idx];
      const green = data[idx + 1];
      const blue = data[idx + 2];
      const hex = rgbToHex({ r: red, g: green, b: blue });
      const lum = relativeLuminance(hex);
      rSum += red;
      gSum += green;
      bSum += blue;
      count++;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }
  }

  const avgHex =
    count > 0
      ? rgbToHex({
          r: Math.round(rSum / count),
          g: Math.round(gSum / count),
          b: Math.round(bSum / count),
        })
      : "#1E100A";

  return {
    avgHex,
    avgLum: relativeLuminance(avgHex),
    minLum,
    maxLum,
  };
}

/**
 * Adapta uma imagem rasterizada do logótipo (quando não existe SVG vetorizado) usando quantização por aglomerados
 * para que nenhuma letra fique manchada com píxeis misturados.
 */
async function mapRasterWordmarkClustersUniformly(
  logoPng: Buffer,
  surfaceHex: string
): Promise<Buffer> {
  const isDarkSurface = relativeLuminance(surfaceHex) < 0.28;
  if (!isDarkSurface) return logoPng;

  const { data, info } = await sharp(logoPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const hPx = info.height;
  const out = new Uint8Array(data);
  let splitX = w > hPx * 1.35 ? Math.round(hPx * 0.9) : 0;

  if (w > hPx * 1.35) {
    let seen = false;
    for (let x = Math.round(w * 0.16); x <= Math.min(w - 8, Math.round(w * 0.65)); x++) {
      let col = 0;
      for (let y = 0; y < hPx; y++) {
        if (data[(y * w + x) * 4 + 3] > 24) col++;
      }
      if (col > 0) seen = true;
      else if (seen && col === 0) {
        splitX = x;
        break;
      }
    }
  }

  // Agrupa cores reais interiores (alta opacidade) do wordmark em clusters discretos
  const clusters: { rSum: number; gSum: number; bSum: number; count: number; target?: [number, number, number] }[] = [];
  for (let y = 0; y < hPx; y += 2) {
    for (let x = splitX; x < w; x += 2) {
      const idx = (y * w + x) * 4;
      if (out[idx + 3] < 200) continue;
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

  // Levanta eventual base escura inferior do símbolo (y >= 77%)
  if (splitX > 0) {
    const startY = Math.round(hPx * 0.77);
    for (let y = startY; y < hPx; y++) {
      for (let x = 0; x < splitX; x++) {
        const idx = (y * w + x) * 4;
        if (out[idx + 3] < 120) continue;
        const hsl = rgbToHsl({ r: out[idx], g: out[idx + 1], b: out[idx + 2] });
        if (hsl.l < 26) {
          out[idx] = 250;
          out[idx + 1] = 248;
          out[idx + 2] = 245;
        }
      }
    }
  }

  return sharp(Buffer.from(out.buffer), {
    raw: { width: w, height: hPx, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function trimLogoTransparent(pngBuf: Buffer): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  aspectRatio: number;
}> {
  try {
    const trimmed = await sharp(pngBuf)
      .ensureAlpha()
      .trim({ threshold: 6 })
      .png()
      .toBuffer({ resolveWithObject: true });
    const w = Math.max(1, trimmed.info.width);
    const hPx = Math.max(1, trimmed.info.height);
    return {
      buffer: trimmed.data,
      width: w,
      height: hPx,
      aspectRatio: w / hPx,
    };
  } catch {
    const meta = await sharp(pngBuf).metadata();
    const w = Math.max(1, meta.width || 300);
    const hPx = Math.max(1, meta.height || 150);
    return {
      buffer: pngBuf,
      width: w,
      height: hPx,
      aspectRatio: w / hPx,
    };
  }
}

async function prepareCrispLogoForCover(params: {
  vectorizedSvg?: string;
  negativeSvg?: string;
  processedPng: Buffer;
  whiteLogoPng: Buffer;
  surfaceHex: string;
  targetRenderWidth: number;
}): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  aspectRatio: number;
}> {
  const {
    vectorizedSvg,
    negativeSvg,
    processedPng,
    whiteLogoPng,
    surfaceHex,
    targetRenderWidth,
  } = params;
  const isDark = relativeLuminance(surfaceHex) < 0.28;

  if (vectorizedSvg) {
    const rawSvg = isDark && negativeSvg ? negativeSvg : vectorizedSvg;
    const adaptedSvg = adaptVectorSvgForSurface(rawSvg, surfaceHex);
    const rendered = Buffer.from(
      new Resvg(adaptedSvg, {
        fitTo: { mode: "width", value: Math.max(800, targetRenderWidth) },
      })
        .render()
        .asPng()
    );
    return trimLogoTransparent(rendered);
  }

  const chosen = isDark ? whiteLogoPng : processedPng;
  const clean = await mapRasterWordmarkClustersUniformly(chosen, surfaceHex);
  return trimLogoTransparent(clean);
}

/**
 * Adapta a arte gerada de largura panorâmica (ex.: 1600×600) às medidas exatas da plataforma
 * sem cortar os motivos ilustrados nem desfigurar a zona segura (especialmente YouTube 2560×1440 e Google Business 1024×576).
 */
async function fitArtworkToCoverDimensions(params: {
  artworkBuf: Buffer;
  width: number;
  height: number;
  isYoutubeBanner: boolean;
  safeBox: SafeBoxRect;
  layoutId: CoverLayoutId;
}): Promise<Buffer> {
  const { artworkBuf, width, height, isYoutubeBanner, safeBox, layoutId } = params;
  const srcMeta = await sharp(artworkBuf).metadata();
  const srcW = srcMeta.width || 1600;
  const srcH = srcMeta.height || 600;
  const srcAspect = srcW / srcH;
  const dstAspect = width / height;

  if (isYoutubeBanner) {
    // No YouTube (2560x1440), compomos a arte na faixa segura expandida (~1680x630 centrada)
    // prolongando os bordos laterais e verticais com as cores reais das margens para que o motivo da direita fique dentro de 1544x423.
    const bandW = 1680;
    const bandH = Math.round(bandW / srcAspect);
    const bandBuf = await sharp(artworkBuf)
      .resize(bandW, bandH, { fit: "fill" })
      .png()
      .toBuffer();

    const bandLeft = Math.round((width - bandW) / 2);
    const bandTop = Math.round((height - bandH) / 2);

    const leftEdgeStrip = await sharp(bandBuf)
      .extract({ left: 1, top: 0, width: 2, height: bandH })
      .resize(bandLeft + 28, bandH, { fit: "fill" })
      .png()
      .toBuffer();

    const rightEdgeStrip = await sharp(bandBuf)
      .extract({ left: bandW - 3, top: 0, width: 2, height: bandH })
      .resize(width - (bandLeft + bandW) + 28, bandH, { fit: "fill" })
      .png()
      .toBuffer();

    const featherMaskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bandW}" height="${bandH}">
      <defs>
        <linearGradient id="fh" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="white" stop-opacity="0" />
          <stop offset="1.8%" stop-color="white" stop-opacity="1" />
          <stop offset="98.2%" stop-color="white" stop-opacity="1" />
          <stop offset="100%" stop-color="white" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="fv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="white" stop-opacity="0" />
          <stop offset="4.5%" stop-color="white" stop-opacity="1" />
          <stop offset="95.5%" stop-color="white" stop-opacity="1" />
          <stop offset="100%" stop-color="white" stop-opacity="0" />
        </linearGradient>
        <mask id="mv">
          <rect width="${bandW}" height="${bandH}" fill="url(#fv)" />
        </mask>
      </defs>
      <rect width="${bandW}" height="${bandH}" fill="url(#fh)" mask="url(#mv)" />
    </svg>`;
    const featherMaskPng = Buffer.from(
      new Resvg(featherMaskSvg, { fitTo: { mode: "width", value: bandW } }).render().asPng()
    );
    const featheredBandBuf = await sharp(bandBuf)
      .ensureAlpha()
      .composite([{ input: featherMaskPng, blend: "dest-in" }])
      .png()
      .toBuffer();

    const middleRowBase = await sharp({
      create: {
        width,
        height: bandH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: leftEdgeStrip, left: 0, top: 0 },
        { input: rightEdgeStrip, left: bandLeft + bandW - 28, top: 0 },
        { input: bandBuf, left: bandLeft, top: 0 },
      ])
      .png()
      .toBuffer();

    const topExtend = await sharp(middleRowBase)
      .extract({ left: 0, top: 1, width, height: 2 })
      .resize(width, bandTop + 28, { fit: "fill" })
      .png()
      .toBuffer();

    const botExtend = await sharp(middleRowBase)
      .extract({ left: 0, top: bandH - 3, width, height: 2 })
      .resize(width, height - (bandTop + bandH) + 28, { fit: "fill" })
      .png()
      .toBuffer();

    const rawBg = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 24, g: 16, b: 12, alpha: 1 },
      },
    })
      .composite([
        { input: topExtend, left: 0, top: 0 },
        { input: botExtend, left: 0, top: bandTop + bandH - 28 },
        { input: leftEdgeStrip, left: 0, top: bandTop },
        { input: rightEdgeStrip, left: bandLeft + bandW - 28, top: bandTop },
        { input: featheredBandBuf, left: bandLeft, top: bandTop },
      ])
      .png()
      .toBuffer();

    // Para YouTube garante sutil guias discretos fora da zona desktop segura em molduras fechadas
    if (layoutId === "classico-moldura") {
      const sideGuideSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <line x1="${safeBox.x + 28}" y1="${safeBox.y + 14}" x2="${safeBox.x + safeBox.width - 28}" y2="${safeBox.y + 14}" stroke="#B84A24" stroke-opacity="0.35" stroke-width="1.5" />
        <line x1="${safeBox.x + 28}" y1="${safeBox.y + safeBox.height - 14}" x2="${safeBox.x + safeBox.width - 28}" y2="${safeBox.y + safeBox.height - 14}" stroke="#B84A24" stroke-opacity="0.35" stroke-width="1.5" />
      </svg>`;
      return sharp(rawBg)
        .composite([{ input: Buffer.from(sideGuideSvg), left: 0, top: 0 }])
        .png()
        .toBuffer();
    }
    return rawBg;
  }

  // Se o destino for relativamente mais alto que 1600x600 (ex.: Google Business 1024x576 = 1.78:1),
  // estendemos topo e base com as bordas da própria arte para não cortar o motivo à direita nem distorcer formas.
  if (dstAspect < srcAspect * 0.8) {
    const innerH = Math.round(width / srcAspect);
    const bandBuf = await sharp(artworkBuf)
      .resize(width, innerH, { fit: "fill" })
      .png()
      .toBuffer();
    const topY = Math.round((height - innerH) / 2);

    const topExt = await sharp(bandBuf)
      .extract({ left: 0, top: 0, width, height: 8 })
      .resize(width, topY + 6, { fit: "fill" })
      .png()
      .toBuffer();
    const botExt = await sharp(bandBuf)
      .extract({ left: 0, top: innerH - 8, width, height: 8 })
      .resize(width, height - (topY + innerH) + 6, { fit: "fill" })
      .png()
      .toBuffer();

    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 24, g: 16, b: 12, alpha: 1 },
      },
    })
      .composite([
        { input: topExt, left: 0, top: 0 },
        { input: botExt, left: 0, top: topY + innerH - 6 },
        { input: bandBuf, left: 0, top: topY },
      ])
      .png()
      .toBuffer();
  }

  // Caso panorâmico padrão (Facebook 851x315, X 1500x500, LinkedIn 1584x396 / 1512x256)
  return sharp(artworkBuf)
    .resize(width, height, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
}

/**
 * Compositor de Capas Nascidas do Logótipo:
 * 1. Obtém via `gerarArteCapaDaMarca` (camada `lib/imagem/`) uma cena/fundo gerada especificamente a partir
 *    do logótipo de referência, da sua paleta, formas e estilo (sem capas genéricas por regras e sem texto cozido).
 * 2. Adapta essa arte com segurança às dimensões exatas e zonas seguras (incluindo avatar e YouTube 1544x423).
 * 3. Compõe por cima APENAS: eventual foto real carregada pelo cliente (no recorte), moldura fina quando aplicável,
 *    o logótipo vetorizado adaptado em nitidez máxima (>= 36% altura) e os textos reais preenchidos (contrast WCAG AA).
 */
export async function renderLayeredCover(params: {
  coverFormatId: string;
  width: number;
  height: number;
  layoutId: CoverLayoutId;
  dados: BrandData;
  paleta: BrandPalette;
  fontPairId: FontPairId;
  processedPng: Buffer;
  whiteLogoPng: Buffer;
  vectorizedSvg?: string;
  negativeSvg?: string;
  logoDna?: LogoVisualDna;
  estiloPeca?: StyleId;
  photoBuffer?: Buffer;
  cutoutBuffer?: Buffer;
  sessaoId?: string;
}): Promise<LayeredCoverResult> {
  const {
    coverFormatId,
    width,
    height,
    layoutId,
    dados,
    paleta,
    fontPairId,
    processedPng,
    whiteLogoPng,
    vectorizedSvg,
    negativeSvg,
    logoDna,
    estiloPeca,
    photoBuffer,
    sessaoId,
  } = params;

  const layout = getCoverLayoutById(layoutId);
  if (!layout) {
    throw new Error(`Layout de capa não encontrado: ${layoutId}`);
  }

  const { pair, fonts } = getSatoriFontsForPair(fontPairId);
  const realLines = extractRealClientLines(dados);
  const isYoutubeBanner = coverFormatId === "yt-banner";
  const hasBottomLeftAvatar =
    coverFormatId === "fb-capa" ||
    coverFormatId === "x-cabecalho" ||
    coverFormatId === "li-capa-pessoal" ||
    coverFormatId === "li-capa-empresa";

  const safeBox: SafeBoxRect = isYoutubeBanner
    ? {
        x: Math.round((width - 1544) / 2),
        y: Math.round((height - 423) / 2),
        width: 1544,
        height: 423,
      }
    : { x: 0, y: 0, width, height };

  const avatarMarginLeft = hasBottomLeftAvatar
    ? Math.round(width * 0.185)
    : Math.round(safeBox.width * 0.052);
  const sidePadRight = Math.round(safeBox.width * 0.05);
  const topPad = Math.max(12, Math.round(safeBox.height * 0.075));
  const botPad = Math.max(14, Math.round(safeBox.height * 0.085));

  const safeInner: SafeBoxRect = {
    x: safeBox.x + avatarMarginLeft,
    y: safeBox.y + topPad,
    width: Math.max(220, safeBox.width - avatarMarginLeft - sidePadRight),
    height: Math.max(100, safeBox.height - topPad - botPad),
  };

  // ---------------------------------------------------------------------------
  // 1) GERAR ARTE DE CAPA NASCIDA DO LOGÓTIPO (prompt + logotipoReferencia + ADN)
  // ---------------------------------------------------------------------------
  const art = await gerarArteCapaDaMarca({
    layout,
    nome: dados.nome,
    sector: dados.sector,
    paleta,
    estiloPeca: estiloPeca || layout.estiloSugerido,
    logotipoReferencia: processedPng,
    logotipoDna: logoDna,
    sessaoId,
  });

  let canvasBuf = await fitArtworkToCoverDimensions({
    artworkBuf: art.buffer,
    width,
    height,
    isYoutubeBanner,
    safeBox,
    layoutId: layout.id,
  });

  // Se o cliente carregou uma fotografia própria para o recorte à direita, aplica recorte arco limpo
  const recorteArchFrac = layout.molduraRecorte.larguraFotoRatio || 0.36;
  const recorteArchStartX = isYoutubeBanner
    ? safeBox.x + Math.round(safeBox.width * (1 - recorteArchFrac + 0.04))
    : Math.round(width * (1 - recorteArchFrac));
  const recorteCurvePull = Math.round(Math.min(width * 0.065, height * 0.28));
  const recorteVertexX = recorteArchStartX - Math.round(recorteCurvePull * 0.78);

  if (layout.id === "moderno-recorte" && photoBuffer && photoBuffer.length > 0) {
    const photoFull = await sharp(photoBuffer)
      .resize(width, height, { fit: "cover", position: "centre" })
      .ensureAlpha()
      .png()
      .toBuffer();

    const archPath = `M ${recorteArchStartX} 0 C ${recorteArchStartX - recorteCurvePull} ${height * 0.28}, ${recorteArchStartX - recorteCurvePull} ${height * 0.72}, ${recorteArchStartX} ${height} L ${width} ${height} L ${width} 0 Z`;
    const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${archPath}" fill="#FFFFFF" /></svg>`;
    const maskBuf = Buffer.from(
      new Resvg(maskSvg, { fitTo: { mode: "width", value: width } }).render().asPng()
    );
    const clippedPhoto = await sharp(photoFull)
      .composite([{ input: maskBuf, blend: "dest-in" }])
      .png()
      .toBuffer();
    const rimSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <path d="M ${recorteArchStartX} 0 C ${recorteArchStartX - recorteCurvePull} ${height * 0.28}, ${recorteArchStartX - recorteCurvePull} ${height * 0.72}, ${recorteArchStartX} ${height}" stroke="${paleta.primaria.hex}" stroke-width="5" fill="none" />
    </svg>`;
    const rimBuf = Buffer.from(
      new Resvg(rimSvg, { fitTo: { mode: "width", value: width } }).render().asPng()
    );
    canvasBuf = await sharp(canvasBuf)
      .composite([
        { input: clippedPhoto, top: 0, left: 0 },
        { input: rimBuf, top: 0, left: 0 },
      ])
      .png()
      .toBuffer();
  }

  // Fino acabamento de moldura dupla clássica (só na moldura clássica em formatos sem recorte rígido de TV)
  if (layout.id === "classico-moldura" && !isYoutubeBanner) {
    const mOuter = Math.max(10, Math.round(Math.min(width, height) * 0.036));
    const mInner = mOuter + 7;
    const frameSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect x="${mOuter}" y="${mOuter}" width="${width - mOuter * 2}" height="${height - mOuter * 2}" fill="none" stroke="${paleta.primaria.hex}" stroke-opacity="0.72" stroke-width="2.2" />
      <rect x="${mInner}" y="${mInner}" width="${width - mInner * 2}" height="${height - mInner * 2}" fill="none" stroke="${paleta.secundaria.hex}" stroke-opacity="0.52" stroke-width="1" />
    </svg>`;
    const framePng = Buffer.from(
      new Resvg(frameSvg, { fitTo: { mode: "width", value: width } }).render().asPng()
    );
    canvasBuf = await sharp(canvasBuf)
      .composite([{ input: framePng, top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  // ---------------------------------------------------------------------------
  // 2) MEDIR SUPERFÍCIE REAL PARA POSICIONAR LOGÓTIPO VETORIZADO + TEXTOS REAIS
  // ---------------------------------------------------------------------------
  const isCenteredStack = layout.id === "classico-moldura";
  const maxSolidLeftW = Math.max(180, recorteVertexX - safeInner.x - 18);
  const maxLogoW =
    layout.id === "moderno-recorte"
      ? maxSolidLeftW
      : isCenteredStack
      ? Math.round(safeInner.width * 0.56)
      : Math.round(safeInner.width * (layout.logotipo.larguraMaxRatio || 0.48));

  const logoHMin = Math.ceil(safeBox.height * Math.max(0.36, layout.logotipo.alturaMinRatio));
  const logoHTarget = Math.max(
    logoHMin,
    Math.round(safeBox.height * (layout.logotipo.alturaAlvoRatio || 0.42))
  );
  const maxLogoH = isCenteredStack
    ? Math.max(logoHMin, Math.round(safeInner.height * 0.54))
    : layout.id === "moderno-texto-atras" || layout.id === "moderno-recorte"
    ? Math.max(logoHMin, Math.round(safeInner.height * 0.52))
    : Math.max(logoHMin, Math.round(safeInner.height * 0.68));

  // Caixa preliminar do logótipo para amostrar a luminosidade real da arte de fundo
  const approxLogoBox: SafeBoxRect = isCenteredStack
    ? {
        x: safeInner.x + Math.round((safeInner.width - maxLogoW) / 2),
        y: safeInner.y + Math.max(4, Math.round(safeInner.height * 0.04)),
        width: maxLogoW,
        height: maxLogoH,
      }
    : layout.id === "moderno-recorte" || layout.id === "moderno-texto-atras"
    ? {
        x: safeInner.x,
        y: safeInner.y + Math.max(4, Math.round(safeInner.height * 0.05)),
        width: maxLogoW,
        height: maxLogoH,
      }
    : {
        x: safeInner.x + 6,
        y: safeInner.y + Math.round((safeInner.height - maxLogoH) / 2),
        width: maxLogoW,
        height: maxLogoH,
      };

  const logoSurfSample = await measureSurfaceInRect(canvasBuf, width, height, approxLogoBox);

  const logoPrepared = await prepareCrispLogoForCover({
    vectorizedSvg,
    negativeSvg,
    processedPng,
    whiteLogoPng,
    surfaceHex: logoSurfSample.avgHex,
    targetRenderWidth: Math.round(maxLogoW * 1.4),
  });

  let drawLogoH = Math.max(logoHMin, Math.min(maxLogoH, logoHTarget));
  let drawLogoW = Math.round(drawLogoH * logoPrepared.aspectRatio);
  if (drawLogoW > maxLogoW) {
    drawLogoW = maxLogoW;
    drawLogoH = Math.max(24, Math.round(drawLogoW / logoPrepared.aspectRatio));
  }
  if (drawLogoH < logoHMin && logoHMin * logoPrepared.aspectRatio <= maxLogoW * 1.06) {
    drawLogoH = logoHMin;
    drawLogoW = Math.min(maxLogoW, Math.round(drawLogoH * logoPrepared.aspectRatio));
  }

  let logoBox: SafeBoxRect;
  if (isCenteredStack) {
    logoBox = {
      x: safeInner.x + Math.round((safeInner.width - drawLogoW) / 2),
      y: safeInner.y + Math.max(4, Math.round(safeInner.height * 0.04)),
      width: drawLogoW,
      height: drawLogoH,
    };
  } else if (layout.id === "moderno-recorte" || layout.id === "moderno-texto-atras") {
    logoBox = {
      x: safeInner.x,
      y: safeInner.y + Math.max(4, Math.round(safeInner.height * 0.05)),
      width: drawLogoW,
      height: drawLogoH,
    };
  } else {
    logoBox = {
      x: safeInner.x + 4,
      y: safeInner.y + Math.round((safeInner.height - drawLogoH) / 2),
      width: drawLogoW,
      height: drawLogoH,
    };
  }

  // Zona exata de Textos Reais
  let textZoneBox: SafeBoxRect;
  if (layout.id === "classico-moldura") {
    const textW = Math.round(safeInner.width * 0.68);
    textZoneBox = {
      x: safeInner.x + Math.round((safeInner.width - textW) / 2),
      y: logoBox.y + logoBox.height + 10,
      width: textW,
      height: Math.max(44, safeInner.y + safeInner.height - (logoBox.y + logoBox.height) - 10),
    };
  } else if (layout.id === "moderno-recorte") {
    const textW = Math.max(180, recorteVertexX - safeInner.x - 18);
    textZoneBox = {
      x: safeInner.x,
      y: logoBox.y + logoBox.height + 10,
      width: textW,
      height: Math.max(46, safeInner.y + safeInner.height - (logoBox.y + logoBox.height) - 10),
    };
  } else if (layout.id === "moderno-texto-atras") {
    const textW = Math.round(safeInner.width * 0.56);
    textZoneBox = {
      x: safeInner.x,
      y: logoBox.y + logoBox.height + 10,
      width: textW,
      height: Math.max(46, safeInner.y + safeInner.height - (logoBox.y + logoBox.height) - 10),
    };
  } else if (layout.id === "classico-rotulo") {
    const xStart = logoBox.x + logoBox.width + 18;
    const emblemRight = safeInner.x + Math.round(safeInner.width * 0.72);
    textZoneBox = {
      x: xStart,
      y: safeInner.y + 12,
      width: Math.max(150, emblemRight - xStart),
      height: safeInner.height - 24,
    };
  } else {
    // moderno-monolito / classico-informativo -> painel direito livre da zona do símbolo à direita extrema
    const xStart = logoBox.x + logoBox.width + 18;
    const maxTextRight = safeInner.x + Math.round(safeInner.width * 0.75);
    textZoneBox = {
      x: xStart,
      y: safeInner.y + 10,
      width: Math.max(180, maxTextRight - xStart),
      height: safeInner.height - 20,
    };
  }

  // Mede contraste real dentro de `textZoneBox`; apenas aplica um véu suave localizado se os píxeis abaixo não bastarem
  const textSurfSample = await measureSurfaceInRect(canvasBuf, width, height, textZoneBox);
  const isTextSurfDark = textSurfSample.avgLum < 0.3;
  let actualSurfaceHex = textSurfSample.avgHex;
  const preliminaryTextHex = ensureWcagContrast(
    isTextSurfDark ? "#FAF8F5" : paleta.tinta.hex,
    actualSurfaceHex,
    4.8
  );
  const worstBgLum = isTextSurfDark ? textSurfSample.maxLum : textSurfSample.minLum;
  const textLum = relativeLuminance(preliminaryTextHex);
  const worstRatio =
    (Math.max(textLum, worstBgLum) + 0.05) / (Math.min(textLum, worstBgLum) + 0.05);

  const preOverlays: OverlayOptions[] = [];
  if (worstRatio < 4.55 || contrastRatio(preliminaryTextHex, actualSurfaceHex) < 4.7) {
    const scrimHex = isTextSurfDark
      ? mixHex(paleta.tinta.hex, "#140D09", 0.45)
      : mixHex(paleta.papel.hex, "#FFFFFF", 0.35);
    const scrimRgb = hexToRgb(scrimHex);
    const scrimSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect x="${Math.max(0, textZoneBox.x - 12)}" y="${Math.max(0, textZoneBox.y - 4)}" width="${Math.min(width, textZoneBox.width + 24)}" height="${Math.min(height, textZoneBox.height + 8)}" rx="12" fill="rgb(${scrimRgb.r},${scrimRgb.g},${scrimRgb.b})" fill-opacity="0.78" />
    </svg>`;
    preOverlays.push({
      input: Buffer.from(
        new Resvg(scrimSvg, { fitTo: { mode: "width", value: width } }).render().asPng()
      ),
      left: 0,
      top: 0,
    });
    actualSurfaceHex = mixHex(actualSurfaceHex, scrimHex, 0.78);
  } else if (layout.id === "classico-rotulo" || layout.id === "classico-moldura") {
    // Subtil filete separador artesanal sem caixas opacas pesadas
    const ruleY =
      layout.id === "classico-moldura"
        ? textZoneBox.y - 4
        : textZoneBox.y + 8;
    const ruleSvg =
      layout.id === "classico-moldura"
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><line x1="${textZoneBox.x + 28}" y1="${ruleY}" x2="${textZoneBox.x + textZoneBox.width - 28}" y2="${ruleY}" stroke="${paleta.secundaria.hex}" stroke-opacity="0.55" stroke-width="1.5" /></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><line x1="${logoBox.x + logoBox.width + 8}" y1="${safeInner.y + 14}" x2="${logoBox.x + logoBox.width + 8}" y2="${safeInner.y + safeInner.height - 14}" stroke="${paleta.secundaria.hex}" stroke-opacity="0.55" stroke-width="1.6" /></svg>`;
    preOverlays.push({
      input: Buffer.from(
        new Resvg(ruleSvg, { fitTo: { mode: "width", value: width } }).render().asPng()
      ),
      left: 0,
      top: 0,
    });
  }

  const finalTextHex = ensureWcagContrast(
    isTextSurfDark ? "#FAF8F5" : paleta.tinta.hex,
    actualSurfaceHex,
    4.6
  );
  const finalMutedHex = ensureWcagContrast(
    isTextSurfDark
      ? mixHex("#FAF8F5", paleta.secundaria.hex, 0.16)
      : mixHex(paleta.tinta.hex, paleta.neutro.hex, 0.3),
    actualSurfaceHex,
    4.6
  );
  const finalAccentHex = ensureWcagContrast(
    isTextSurfDark ? "#F4B858" : paleta.primaria.hex,
    actualSurfaceHex,
    4.5
  );

  const ratioContrast = contrastRatio(finalTextHex, actualSurfaceHex);

  // ---------------------------------------------------------------------------
  // 3) TEXTOS REAIS E LOGÓTIPO VETORIZADO POR CIMA
  // ---------------------------------------------------------------------------
  const scale = isYoutubeBanner ? 0.96 : Math.min(safeBox.width / 1000, safeBox.height / 320);
  const titlePx = Math.max(18, Math.min(54, Math.round(32 * scale)));
  const sloganPx = Math.max(13, Math.min(25, Math.round(18 * scale)));
  const metaPx = Math.max(11, Math.min(18, Math.round(13.2 * scale)));

  const isCompactBanner = safeBox.height <= 275;
  const linesRendered: string[] = [];
  const showSeparateBrandName = Boolean(dados.simbolo);
  if (showSeparateBrandName && realLines.nome) {
    linesRendered.push(realLines.nome);
  }
  const showSlogan = layout.textosReais.mostrarSlogan && Boolean(realLines.slogan);
  const showServicos =
    layout.textosReais.mostrarServicos &&
    Boolean(realLines.servicos) &&
    textZoneBox.height >= 80;
  const showLocalidade =
    layout.textosReais.mostrarLocalidade &&
    Boolean(realLines.localidade) &&
    !isCompactBanner &&
    textZoneBox.height >= 74;
  const contactParts = [
    realLines.telefone,
    realLines.website,
    !realLines.telefone && !realLines.website ? realLines.email : null,
  ].filter((v): v is string => Boolean(v));
  const contactLine = contactParts.join("  •  ");
  const showContactos = layout.textosReais.mostrarContactos && Boolean(contactLine);

  if (showSlogan && realLines.slogan) linesRendered.push(realLines.slogan);
  if (showServicos && realLines.servicos) linesRendered.push(realLines.servicos);
  if (showLocalidade && realLines.localidade) linesRendered.push(realLines.localidade);
  if (showContactos && contactLine) linesRendered.push(contactLine);

  const logoSrcB64 = `data:image/png;base64,${logoPrepared.buffer.toString("base64")}`;
  const textAlignCentered = layout.id === "classico-moldura";
  const textAlignRight =
    layout.id === "moderno-monolito" || layout.id === "classico-informativo";

  const fgEl = h(
    "div",
    {
      style: {
        width: `${width}px`,
        height: `${height}px`,
        position: "relative",
        display: "flex",
      },
    },
    h(
      "div",
      {
        style: {
          position: "absolute",
          left: `${logoBox.x}px`,
          top: `${logoBox.y}px`,
          width: `${logoBox.width}px`,
          height: `${logoBox.height}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: textAlignCentered ? "center" : "flex-start",
        },
      },
      h("img", {
        src: logoSrcB64,
        width: logoBox.width,
        height: logoBox.height,
        style: { objectFit: "contain" },
      })
    ),
    linesRendered.length > 0
      ? h(
          "div",
          {
            style: {
              position: "absolute",
              left: `${textZoneBox.x}px`,
              top: `${textZoneBox.y}px`,
              width: `${textZoneBox.width}px`,
              height: `${textZoneBox.height}px`,
              boxSizing: "border-box",
              padding: layout.id === "classico-moldura" ? "6px 14px" : "4px 6px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: textAlignCentered
                ? "center"
                : textAlignRight
                ? "flex-end"
                : "flex-start",
              textAlign: textAlignCentered
                ? "center"
                : textAlignRight
                ? "right"
                : "left",
              gap: isCompactBanner ? "3px" : "5px",
            },
          },
          showSeparateBrandName && realLines.nome
            ? h(
                "div",
                {
                  style: {
                    fontFamily: pair.tituloFamily,
                    fontWeight: pair.tituloWeight,
                    fontSize: `${Math.max(16, isCompactBanner ? titlePx - 4 : titlePx)}px`,
                    color: finalTextHex,
                    lineHeight: 1.08,
                  },
                },
                realLines.nome
              )
            : null,
          showSlogan && realLines.slogan
            ? h(
                "div",
                {
                  style: {
                    fontFamily: pair.textoFamily,
                    fontWeight: 400,
                    fontSize: `${Math.max(12, isCompactBanner ? sloganPx - 2 : sloganPx)}px`,
                    color: finalTextHex,
                    lineHeight: 1.24,
                  },
                },
                realLines.slogan
              )
            : null,
          showServicos && realLines.servicos
            ? h(
                "div",
                {
                  style: {
                    fontFamily: pair.tituloFamily,
                    fontWeight: 600,
                    fontSize: `${Math.max(11, metaPx)}px`,
                    color: finalAccentHex,
                    lineHeight: 1.2,
                  },
                },
                realLines.servicos
              )
            : null,
          showLocalidade && realLines.localidade
            ? h(
                "div",
                {
                  style: {
                    fontFamily: pair.textoFamily,
                    fontWeight: 400,
                    fontSize: `${Math.max(10, metaPx - 1)}px`,
                    color: finalMutedHex,
                    lineHeight: 1.2,
                  },
                },
                realLines.localidade
              )
            : null,
          showContactos && contactLine
            ? h(
                "div",
                {
                  style: {
                    fontFamily: pair.textoFamily,
                    fontWeight: 600,
                    fontSize: `${Math.max(10, metaPx - 1)}px`,
                    color: finalMutedHex,
                    lineHeight: 1.2,
                  },
                },
                contactLine
              )
            : null
        )
      : null
  );

  const fgSvg = await satori(fgEl, { width, height, fonts });
  const fgPng = Buffer.from(
    new Resvg(fgSvg, { fitTo: { mode: "width", value: width } }).render().asPng()
  );

  const outBuf = await sharp(canvasBuf)
    .composite([...preOverlays, { input: fgPng, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return {
    buffer: outBuf,
    audit: {
      layoutId: layout.id,
      categoria: layout.categoria,
      textColorHex: finalTextHex,
      surfaceHex: actualSurfaceHex,
      contrastRatio: Math.round(ratioContrast * 100) / 100,
      wcagAaPassed: ratioContrast >= 4.5,
      logoHeightPx: logoBox.height,
      logoHeightRatio: Math.round((logoBox.height / safeBox.height) * 100) / 100,
      logoOverlappedByObject: false,
      safeZoneRespectsAvatar: !hasBottomLeftAvatar || safeInner.x >= Math.round(width * 0.165),
      linesRendered,
      origemArte: art.origem,
      referenciaLogoUsada: art.referenciaLogoUsada,
      formasDoLogotipo: art.dna.formasPrincipais,
      estiloDoLogotipo: art.dna.estiloDirecao,
      promptResumo: art.promptUsado.slice(0, 240),
    },
  };
}
