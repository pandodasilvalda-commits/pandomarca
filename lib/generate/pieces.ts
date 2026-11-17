import React from "react";
import sharp from "sharp";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { PDFDocument, rgb } from "pdf-lib";
import type { RedeSocialId } from "../config/redes-sociais";
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
  getContrastingTextHex,
  hexToRgb,
  mixHex,
} from "../palette";
import {
  createWhiteKnockoutLogo,
  ensureWordmarkContrastOnDarkBg,
} from "../logo-surface";
import type { CoverLayoutId } from "../capas/catalog";
import {
  gerarPecaRedeSocialComAuditoria,
  type LogoVisualDna,
  type PecaGeradaIA,
} from "../imagem";
import { adaptVectorSvgForSurface } from "../vetorizar";

export { createWhiteKnockoutLogo };

const h = React.createElement;

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
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
  // 1) Se o logótipo for horizontal (símbolo à esquerda + texto à direita), procura a coluna transparente
  if (w > hPx * 1.35) {
    let splitX = Math.min(w, Math.round(hPx * 0.95));
    const minSearchX = Math.round(w * 0.16);
    const maxSearchX = Math.min(w - 10, Math.round(w * 0.68));

    let seenOpaqueLeft = false;
    let gapStart = -1;
    for (let x = minSearchX; x <= maxSearchX; x++) {
      let colOpaque = 0;
      for (let y = 0; y < hPx; y++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a > 24) colOpaque++;
      }
      if (colOpaque > 1) {
        seenOpaqueLeft = true;
        if (gapStart >= 0) {
          splitX = Math.round((gapStart + x) / 2);
          break;
        }
      } else if (seenOpaqueLeft && gapStart < 0) {
        gapStart = x;
      }
    }
    if (gapStart >= 0 && splitX === Math.min(w, Math.round(hPx * 0.95))) {
      splitX = gapStart;
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
  } else if (hPx >= w * 0.9 && hPx >= 200) {
    // 2) Se o logótipo for empilhado (emblema em cima + nome em baixo), procura faixa horizontal livre
    const minSearchY = Math.round(hPx * 0.28);
    const maxSearchY = Math.min(hPx - 12, Math.round(hPx * 0.66));
    let seenOpaqueTop = false;
    let splitY = -1;
    for (let y = minSearchY; y <= maxSearchY; y++) {
      let rowOpaque = 0;
      for (let x = Math.round(w * 0.1); x < Math.round(w * 0.9); x += 2) {
        if (data[(y * w + x) * 4 + 3] > 28) rowOpaque++;
      }
      if (rowOpaque > 3) {
        seenOpaqueTop = true;
      } else if (seenOpaqueTop && rowOpaque <= 2) {
        splitY = y;
        break;
      }
    }
    if (splitY > 40) {
      try {
        const cropped = await sharp(processedPng)
          .extract({ left: 0, top: 0, width: w, height: splitY })
          .trim({ threshold: 8 })
          .toBuffer();
        sourceForIcon = cropped;
      } catch {
        sourceForIcon = processedPng;
      }
    }
  }

  // Enquadra em 1024×1024 com margem limpa para círculos e favicons
  const inner = 780;
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

export async function resolveOptionalFaviconSourcePng(params: {
  iconePng: Buffer;
  simboloSvg?: string;
  usarVetorizacaoOpcional?: boolean;
}): Promise<Buffer> {
  if (params.usarVetorizacaoOpcional && params.simboloSvg?.trim()) {
    try {
      const rendered = Buffer.from(
        new Resvg(params.simboloSvg, {
          fitTo: { mode: "width", value: 1024 },
        })
          .render()
          .asPng()
      );
      return await extractIconSquare(rendered);
    } catch {
      return params.iconePng;
    }
  }
  return params.iconePng;
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
          fontFamily: pair.textoFamily,
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

export async function renderSolidSurfaceBuffer(params: {
  width: number;
  height: number;
  style: StyleId;
  paleta: BrandPalette;
  photoBuffer?: Buffer;
}): Promise<Buffer> {
  const { width, height, style, paleta, photoBuffer } = params;

  if (style === "fotografia" && photoBuffer && photoBuffer.length > 0) {
    const basePhoto = await sharp(photoBuffer)
      .resize(width, height, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    const darkVeil = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 14, g: 12, b: 10, alpha: 0.64 },
      },
    })
      .png()
      .toBuffer();
    return sharp(basePhoto)
      .composite([{ input: darkVeil, left: 0, top: 0 }])
      .png()
      .toBuffer();
  }

  let bgHex = paleta.primaria.hex;
  let accentHex = paleta.secundaria.hex;
  if (style === "degrade" || style === "fotografia") {
    bgHex = mixHex(paleta.tinta.hex, paleta.primaria.hex, 0.36);
    accentHex = paleta.secundaria.hex;
  } else if (style === "padrao" || style === "informativo" || style === "minimal") {
    bgHex = paleta.papel.hex;
    accentHex = paleta.primaria.hex;
  }

  const bgRgb = hexToRgb(bgHex);
  const accRgb = hexToRgb(accentHex);
  const accentH = Math.max(6, Math.round(height * 0.03));

  const accentBar = await sharp({
    create: {
      width,
      height: accentH,
      channels: 4,
      background: { r: accRgb.r, g: accRgb.g, b: accRgb.b, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 1 },
    },
  })
    .composite(
      style === "minimal" ? [] : [{ input: accentBar, left: 0, top: height - accentH }]
    )
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
  usarVetorizacaoOpcional?: boolean;
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
  if (params.usarVetorizacaoOpcional && params.vectorizedSvg) {
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

function resolveEstiloVisualFromParams(params: {
  estiloVisual?: "moderno" | "classico";
  coverLayoutId?: CoverLayoutId;
  style?: StyleId;
  logoDna?: LogoVisualDna;
}): "moderno" | "classico" {
  if (params.estiloVisual === "moderno" || params.estiloVisual === "classico") {
    return params.estiloVisual;
  }
  if (params.coverLayoutId?.startsWith("classico-")) return "classico";
  if (params.coverLayoutId?.startsWith("moderno-")) return "moderno";
  if (params.logoDna?.estiloDirecao === "moderno" || params.logoDna?.estiloDirecao === "classico") {
    return params.logoDna.estiloDirecao;
  }
  if (params.style === "informativo" || params.style === "minimal") return "classico";
  return "moderno";
}

export async function renderRedeSocialPiece(params: {
  redeId: RedeSocialId;
  estiloVisual: "moderno" | "classico";
  dados: BrandData;
  paleta: BrandPalette;
  processedPng: Buffer;
  logoDna?: LogoVisualDna;
  style?: StyleId;
  fontPairId?: FontPairId;
  sessaoId?: string;
  bypassCache?: boolean;
}): Promise<PecaGeradaIA> {
  return gerarPecaRedeSocialComAuditoria({
    redeId: params.redeId,
    estiloVisual: params.estiloVisual,
    dados: params.dados,
    paleta: params.paleta,
    logotipoReferencia: params.processedPng,
    logotipoDna: params.logoDna,
    estiloPeca: params.style,
    fontPairId: params.fontPairId,
    sessaoId: params.sessaoId,
    bypassCache: params.bypassCache,
  });
}

export async function renderCoverPiece(params: {
  id: RedeSocialId;
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
  estiloVisual?: "moderno" | "classico";
  logoDna?: LogoVisualDna;
  sessaoId?: string;
}): Promise<Buffer> {
  const peca = await renderRedeSocialPiece({
    redeId: params.id,
    estiloVisual: resolveEstiloVisualFromParams(params),
    dados: params.dados,
    paleta: params.paleta,
    processedPng: params.processedPng,
    logoDna: params.logoDna,
    style: params.style,
    fontPairId: params.fontPairId,
    sessaoId: params.sessaoId,
  });
  return peca.buffer;
}

export async function renderInstagramPost(params: {
  redeId?: "ig-publicacao" | "ig-publicacao-1080x1350";
  style: StyleId;
  dados: BrandData;
  paleta: BrandPalette;
  fontPairId: FontPairId;
  processedPng: Buffer;
  whiteLogoPng: Buffer;
  isDarkMonochrome: boolean;
  photoBuffer?: Buffer;
  coverLayoutId?: CoverLayoutId;
  estiloVisual?: "moderno" | "classico";
  logoDna?: LogoVisualDna;
  sessaoId?: string;
}): Promise<Buffer> {
  const peca = await renderRedeSocialPiece({
    redeId: params.redeId || "ig-publicacao",
    estiloVisual: resolveEstiloVisualFromParams(params),
    dados: params.dados,
    paleta: params.paleta,
    processedPng: params.processedPng,
    logoDna: params.logoDna,
    style: params.style,
    fontPairId: params.fontPairId,
    sessaoId: params.sessaoId,
  });
  return peca.buffer;
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
  coverLayoutId?: CoverLayoutId;
  estiloVisual?: "moderno" | "classico";
  logoDna?: LogoVisualDna;
  sessaoId?: string;
}): Promise<Buffer> {
  const peca = await renderRedeSocialPiece({
    redeId: "ig-story",
    estiloVisual: resolveEstiloVisualFromParams(params),
    dados: params.dados,
    paleta: params.paleta,
    processedPng: params.processedPng,
    logoDna: params.logoDna,
    style: params.style,
    fontPairId: params.fontPairId,
    sessaoId: params.sessaoId,
  });
  return peca.buffer;
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
  const websiteDisplay = websiteClean.replace(/^https?:\/\//i, "");
  const websiteHref = websiteClean
    ? /^https?:\/\//i.test(websiteClean)
      ? websiteClean
      : `https://${websiteClean}`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8" />
  <title>Assinatura de Email — ${escapeHtml(dados.nome)}</title>
</head>
<body style="margin: 0; padding: 16px; background-color: #ffffff; font-family: '${pair.textoFamily}', ${pair.textoCssFallback};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; max-width: 580px; width: 100%; background-color: ${cardBg}; border: 1px solid ${borderCol}; border-left: 5px solid ${headerBandBg}; font-family: '${pair.textoFamily}', ${pair.textoCssFallback};">
    <tr>
      <td style="padding: 18px 20px; vertical-align: top;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%;">
          <tr>
            <td style="vertical-align: middle; padding-right: 18px; white-space: nowrap;">
              <img src="logotipo-assinatura.png" alt="${escapeHtml(dados.nome)}" height="64" style="display: block; height: 64px; width: auto; max-width: 240px; border: 0;" />
            </td>
            <td style="vertical-align: top; font-family: '${pair.textoFamily}', ${pair.textoCssFallback};">
              ${
                dados.pessoa
                  ? `<div style="font-family: '${pair.tituloFamily}', ${pair.tituloCssFallback}; font-size: 16px; font-weight: 700; color: ${nameCol}; line-height: 1.25; margin: 0;">${escapeHtml(dados.pessoa)}</div>`
                  : ""
              }
              ${
                dados.cargo
                  ? `<div style="font-family: '${pair.textoFamily}', ${pair.textoCssFallback}; font-size: 13px; font-weight: 600; color: ${accentCol}; line-height: 1.3; margin-top: 2px;">${escapeHtml(dados.cargo)}</div>`
                  : ""
              }
              <div style="font-family: '${pair.tituloFamily}', ${pair.tituloCssFallback}; font-size: 15px; font-weight: 700; color: ${nameCol}; line-height: 1.3; margin-top: ${dados.pessoa ? "6px" : "0"};">${escapeHtml(dados.nome)}</div>
              ${
                dados.slogan
                  ? `<div style="font-family: '${pair.textoFamily}', ${pair.textoCssFallback}; font-size: 12px; color: ${textCol}; line-height: 1.35; margin-top: 2px;">${escapeHtml(dados.slogan)}</div>`
                  : ""
              }
              ${
                dados.servicos && style === "informativo"
                  ? `<div style="font-family: '${pair.textoFamily}', ${pair.textoCssFallback}; font-size: 12px; color: ${nameCol}; background-color: #ffffff; border: 1px solid ${borderCol}; padding: 4px 8px; margin-top: 8px; display: inline-block;">${escapeHtml(dados.servicos)}</div>`
                  : ""
              }
            </td>
          </tr>
        </table>
        ${
          dados.telefone || dados.email || websiteClean || dados.morada || nifClean
            ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%; margin-top: 12px; border-top: 1px solid ${borderCol};">
          <tr>
            <td style="padding-top: 10px; font-family: '${pair.textoFamily}', ${pair.textoCssFallback}; font-size: 12px; color: ${textCol}; line-height: 1.6;">
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
                websiteHref
                  ? `<span style="margin-right: 12px;"><strong>Web:</strong> <a href="${escapeHtml(websiteHref)}" style="color: ${accentCol}; text-decoration: none;">${escapeHtml(websiteDisplay)}</a></span>`
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
  vectorizedSvg?: string;
  negativeSvg?: string;
  usarVetorizacaoOpcional?: boolean;
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
    vectorizedSvg,
    negativeSvg,
    usarVetorizacaoOpcional,
  } = params;

  const { pair, fonts } = getSatoriFontsForPair(fontPairId);
  const theme = getStyleThemeColors(style, paleta);

  const frontBg = await renderSolidSurfaceBuffer({
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
    vectorizedSvg,
    negativeSvg,
    usarVetorizacaoOpcional,
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
        fontFamily: pair.textoFamily,
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
              fontWeight: 500,
              fontSize: "26px",
              color: theme.mutedTextColor,
              marginTop: "12px",
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
              fontWeight: 500,
              fontSize: "26px",
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
        padding: `${bleedPx + 44}px`,
        borderLeft: `${bleedPx + 14}px solid ${paleta.primaria.hex}`,
        fontFamily: pair.textoFamily,
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
            maxWidth: "590px",
          },
        },
        dados.pessoa
          ? h(
              "div",
              {
                style: {
                  fontFamily: pair.tituloFamily,
                  fontWeight: pair.tituloWeight,
                  fontSize: "42px",
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
                  fontSize: "42px",
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
                  fontWeight: 600,
                  fontSize: "26px",
                  color: paleta.primaria.hex,
                  marginTop: "6px",
                },
              },
              dados.cargo
            )
          : !dados.pessoa && dados.slogan
          ? h(
              "div",
              {
                style: {
                  fontFamily: pair.textoFamily,
                  fontWeight: 400,
                  fontSize: "26px",
                  color: paleta.neutro.hex,
                  marginTop: "8px",
                  maxWidth: "570px",
                },
              },
              dados.slogan
            )
          : null
      ),
      h("img", {
        src: backLogoSrc,
        width: !dados.simbolo ? 240 : 140,
        height: !dados.simbolo ? 90 : 85,
        style: { objectFit: "contain" },
      })
    ),
    dados.servicos
      ? h(
          "div",
          {
            style: {
              fontFamily: pair.textoFamily,
              fontWeight: 500,
              fontSize: "25px",
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
              gap: "6px",
              borderTop: `2px solid ${mixHex(paleta.papel.hex, paleta.tinta.hex, 0.15)}`,
              paddingTop: "18px",
              fontFamily: pair.textoFamily,
              fontWeight: 500,
              fontSize: "27px",
              lineHeight: 1.32,
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
  vectorizedSvg?: string;
  negativeSvg?: string;
  usarVetorizacaoOpcional?: boolean;
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
    vectorizedSvg,
    negativeSvg,
    usarVetorizacaoOpcional,
  } = params;

  const { pair, fonts } = getSatoriFontsForPair(fontPairId);
  const theme = getStyleThemeColors(style, paleta);

  const headerBg = await renderSolidSurfaceBuffer({
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
    vectorizedSvg,
    negativeSvg,
    usarVetorizacaoOpcional,
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
        fontFamily: pair.textoFamily,
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
                  fontSize: "42px",
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
                      fontSize: "22px",
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
              fontFamily: pair.textoFamily,
              fontWeight: 600,
              fontSize: "20px",
              color: theme.badgeText,
              backgroundColor: theme.badgeBg,
              padding: "10px 18px",
              borderRadius: "8px",
              maxWidth: "380px",
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
        fontFamily: pair.textoFamily,
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
          fontWeight: 500,
          fontSize: "20px",
          lineHeight: 1.35,
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
              fontSize: "22px",
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
                fontSize: "20px",
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
        fontFamily: pair.textoFamily,
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
              fontFamily: pair.textoFamily,
              fontWeight: 700,
              fontSize: "18px",
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
              fontSize: "50px",
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
                  fontWeight: 500,
                  fontSize: "23px",
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
            fontWeight: 500,
            fontSize: "18px",
            lineHeight: 1.35,
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
            fontSize: "24px",
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
                fontFamily: pair.textoFamily,
                fontWeight: 500,
                fontSize: "16px",
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
                fontFamily: pair.textoFamily,
                fontWeight: 500,
                fontSize: "16px",
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
                fontFamily: pair.textoFamily,
                fontWeight: 500,
                fontSize: "16px",
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
                fontFamily: pair.textoFamily,
                fontWeight: 500,
                fontSize: "16px",
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
            fontSize: "24px",
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
                    fontSize: "18px",
                    color: paleta.tinta.hex,
                  },
                },
                label
              ),
              h(
                "div",
                {
                  style: {
                    fontFamily: pair.textoFamily,
                    fontWeight: 600,
                    fontSize: "17px",
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
                    fontSize: "15px",
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
            fontSize: "24px",
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
                fontFamily: pair.textoFamily,
                fontWeight: 700,
                fontSize: "16px",
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
                fontSize: "34px",
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
                fontSize: "19px",
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
                fontFamily: pair.textoFamily,
                fontWeight: 700,
                fontSize: "16px",
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
                fontSize: "22px",
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
                fontSize: "18px",
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
          fontWeight: 500,
          fontSize: "17px",
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
