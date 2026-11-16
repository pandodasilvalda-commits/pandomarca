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
import { getContrastingTextHex, hexToRgb, mixHex, rgbToHsl } from "../palette";

const h = React.createElement;

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

/**
 * Gera a versão do logótipo para fundos escuros:
 * - Se o logótipo for escuro e quase sem cor (isDarkMonochrome), passa o desenho a branco (#FAF8F5).
 * - Se o logótipo for colorido, mantém todas as cores vivas e converte apenas os píxeis
 *   muito escuros (como texto castanho-escuro ou preto) em branco quente (#FAF8F5),
 *   garantindo leitura perfeita do nome e mantendo as cores do símbolo.
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

  // Para logótipos horizontais coloridos (símbolo à esquerda + texto à direita),
  // encontramos a separação entre o símbolo e o texto para preservar 100% das cores internas do símbolo.
  let wordmarkStartX = 0;
  if (!isDarkMonochrome && w > hPx * 1.35) {
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

  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 10) {
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = a;
      continue;
    }

    if (isDarkMonochrome) {
      out[i] = 250;
      out[i + 1] = 248;
      out[i + 2] = 245;
      out[i + 3] = a;
    } else {
      const pxIndex = i / 4;
      const x = pxIndex % w;
      const hsl = rgbToHsl({ r, g, b });
      // Mantém todas as cores do símbolo intactas; no texto escuro, passa a branco quente para legibilidade em fundo escuro
      if (x >= wordmarkStartX && hsl.l < 22) {
        out[i] = 250;
        out[i + 1] = 248;
        out[i + 2] = 245;
        out[i + 3] = a;
      } else {
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
        out[i + 3] = a;
      }
    }
  }

  return sharp(Buffer.from(out.buffer), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
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
    const deepEnd = mixHex(paleta.tinta.hex, paleta.secundaria.hex, 0.42);
    const midStop = mixHex(paleta.primaria.hex, paleta.tinta.hex, 0.28);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${paleta.primaria.hex}" />
          <stop offset="52%" stop-color="${midStop}" />
          <stop offset="100%" stop-color="${deepEnd}" />
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

function getLogoDataUrlForTheme(
  isDarkBg: boolean,
  processedPng: Buffer,
  darkReadyLogoPng: Buffer
): string {
  const chosen = isDarkBg ? darkReadyLogoPng : processedPng;
  return `data:image/png;base64,${chosen.toString("base64")}`;
}

function renderThemedLogoElement(params: {
  isDarkBg: boolean;
  isDarkMonochrome: boolean;
  processedPng: Buffer;
  whiteLogoPng: Buffer;
  paleta: BrandPalette;
  width: number;
  height: number;
}) {
  const {
    isDarkBg,
    isDarkMonochrome,
    processedPng,
    whiteLogoPng,
    paleta,
    width,
    height,
  } = params;

  if (isDarkBg && !isDarkMonochrome) {
    const src = `data:image/png;base64,${processedPng.toString("base64")}`;
    const padX = Math.max(10, Math.round(height * 0.14));
    const padY = Math.max(8, Math.round(height * 0.1));
    return h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: paleta.papel.hex,
          padding: `${padY}px ${padX}px`,
          borderRadius: `${Math.max(10, Math.round(height * 0.12))}px`,
        },
      },
      h("img", {
        src,
        width: Math.max(36, width - padX * 2),
        height: Math.max(28, height - padY * 2),
        style: { objectFit: "contain" },
      })
    );
  }

  const src = getLogoDataUrlForTheme(isDarkBg, processedPng, whiteLogoPng);
  return h("img", {
    src,
    width,
    height,
    style: { objectFit: "contain" },
  });
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
}): Promise<Buffer> {
  const {
    id,
    width,
    height,
    style,
    dados,
    paleta,
    fontPairId,
    processedPng,
    whiteLogoPng,
    isDarkMonochrome,
    photoBuffer,
  } = params;

  const bgPng = await renderStyleBackgroundBuffer({
    width,
    height,
    style,
    paleta,
    photoBuffer,
  });

  const theme = getStyleThemeColors(style, paleta);
  const { pair, fonts } = getSatoriFontsForPair(fontPairId);

  const isYoutubeBanner = id === "yt-banner";
  const hasBottomLeftAvatar =
    id === "fb-capa" ||
    id === "x-cabecalho" ||
    id === "li-capa-pessoal" ||
    id === "li-capa-empresa";

  const scale = isYoutubeBanner ? 0.95 : Math.min(width / 1200, height / 360);
  const titleSize = Math.max(22, Math.min(68, Math.round(42 * scale)));
  const sloganSize = Math.max(14, Math.min(32, Math.round(20 * scale)));
  const metaSize = Math.max(12, Math.min(22, Math.round(15 * scale)));
  const logoH = Math.max(46, Math.min(170, Math.round(height * (isYoutubeBanner ? 0.14 : 0.38))));
  const logoW = Math.round(logoH * 1.55);

  const leftPad = hasBottomLeftAvatar
    ? Math.round(width * 0.25)
    : Math.round(width * 0.07);
  const rightPad = Math.round(width * 0.06);

  const contactItems = [dados.website, dados.telefone, dados.morada]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .slice(0, 2)
    .join("  •  ");

  const contentBoxStyle: Record<string, string | number> = isYoutubeBanner
    ? {
        width: "1544px",
        height: "423px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "32px 56px",
      }
    : {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: `${leftPad}px`,
        paddingRight: `${rightPad}px`,
        paddingTop: `${Math.round(height * 0.1)}px`,
        paddingBottom: `${Math.round(height * 0.12)}px`,
      };

  const innerContent = h(
    "div",
    { style: contentBoxStyle },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: `${Math.max(16, Math.round(24 * scale))}px`,
          maxWidth: style === "informativo" ? "65%" : "92%",
        },
      },
      style !== "minimal"
        ? renderThemedLogoElement({
            isDarkBg: theme.isDarkBg,
            isDarkMonochrome,
            processedPng,
            whiteLogoPng,
            paleta,
            width: logoW,
            height: logoH,
          })
        : null,
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
              fontSize: `${titleSize}px`,
              color: theme.textColor,
              lineHeight: 1.08,
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
                  fontSize: `${sloganSize}px`,
                  color: theme.mutedTextColor,
                  marginTop: "6px",
                },
              },
              dados.slogan
            )
          : null,
        (style === "informativo" || dados.servicos) && height >= 300
          ? h(
              "div",
              {
                style: {
                  fontFamily: pair.tituloFamily,
                  fontWeight: 400,
                  fontSize: `${metaSize}px`,
                  color: theme.textColor,
                  marginTop: "10px",
                  backgroundColor: theme.badgeBg,
                  padding: "5px 12px",
                  borderRadius: "6px",
                },
              },
              dados.servicos || SECTORS[dados.sector]?.rotulo || ""
            )
          : null
      )
    ),
    style === "informativo" && contactItems
      ? h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              justifyContent: "center",
              backgroundColor: theme.badgeBg,
              padding: "12px 18px",
              borderRadius: "10px",
              maxWidth: "32%",
            },
          },
          dados.telefone
            ? h(
                "div",
                {
                  style: {
                    fontFamily: pair.tituloFamily,
                    fontWeight: pair.tituloWeight,
                    fontSize: `${metaSize}px`,
                    color: theme.textColor,
                  },
                },
                dados.telefone
              )
            : null,
          dados.website
            ? h(
                "div",
                {
                  style: {
                    fontFamily: pair.textoFamily,
                    fontWeight: 400,
                    fontSize: `${Math.max(11, metaSize - 2)}px`,
                    color: theme.mutedTextColor,
                    marginTop: "4px",
                  },
                },
                dados.website.replace(/^https?:\/\//, "")
              )
            : null
        )
      : null
  );

  const rootElement = isYoutubeBanner
    ? h(
        "div",
        {
          style: {
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        },
        innerContent
      )
    : innerContent;

  const fgSvg = await satori(rootElement, { width, height, fonts });
  const fgPng = Buffer.from(
    new Resvg(fgSvg, { fitTo: { mode: "width", value: width } }).render().asPng()
  );

  return sharp(bgPng)
    .composite([{ input: fgPng, top: 0, left: 0 }])
    .png()
    .toBuffer();
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
    isDarkMonochrome,
    photoBuffer,
  } = params;

  const bgPng = await renderStyleBackgroundBuffer({
    width,
    height,
    style,
    paleta,
    photoBuffer,
  });

  const theme = getStyleThemeColors(style, paleta);
  const { pair, fonts } = getSatoriFontsForPair(fontPairId);

  const servicosList = (dados.servicos || "")
    .split(/[,;•]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

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
      renderThemedLogoElement({
        isDarkBg: theme.isDarkBg,
        isDarkMonochrome,
        processedPng,
        whiteLogoPng,
        paleta,
        width: style === "minimal" ? 180 : 250,
        height: style === "minimal" ? 110 : 155,
      }),
      h(
        "div",
        {
          style: {
            fontFamily: pair.tituloFamily,
            fontWeight: 400,
            fontSize: "22px",
            color: theme.badgeText,
            backgroundColor: theme.badgeBg,
            padding: "10px 22px",
            borderRadius: "999px",
          },
        },
        SECTORS[dados.sector]?.rotulo || "Apresentação"
      )
    ),
    h(
      "div",
      {
        style: {
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          marginTop: "24px",
          marginBottom: "24px",
        },
      },
      h(
        "div",
        {
          style: {
            fontFamily: pair.tituloFamily,
            fontWeight: pair.tituloWeight,
            fontSize: dados.nome.length > 20 ? "72px" : "86px",
            color: theme.textColor,
            lineHeight: 1.06,
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
                fontSize: "36px",
                color: theme.mutedTextColor,
                marginTop: "22px",
                lineHeight: 1.35,
              },
            },
            dados.slogan
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
                marginTop: "36px",
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
                    color: theme.textColor,
                    backgroundColor: theme.badgeBg,
                    padding: "12px 22px",
                    borderRadius: "10px",
                  },
                },
                srv
              )
            )
          )
        : dados.servicos && style !== "minimal"
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontWeight: 400,
                fontSize: "26px",
                color: theme.textColor,
                marginTop: "28px",
              },
            },
            dados.servicos
          )
        : null
    ),
    h(
      "div",
      {
        style: {
          width: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `2px solid ${theme.badgeBg}`,
          paddingTop: "28px",
        },
      },
      h(
        "div",
        {
          style: {
            fontFamily: pair.tituloFamily,
            fontWeight: pair.tituloWeight,
            fontSize: "24px",
            color: theme.textColor,
          },
        },
        (dados.website || dados.email || "").replace(/^https?:\/\//, "")
      ),
      h(
        "div",
        {
          style: {
            fontFamily: pair.textoFamily,
            fontWeight: 400,
            fontSize: "22px",
            color: theme.mutedTextColor,
          },
        },
        dados.telefone || dados.morada || ""
      )
    )
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
    isDarkMonochrome,
    photoBuffer,
  } = params;

  const bgPng = await renderStyleBackgroundBuffer({
    width,
    height,
    style,
    paleta,
    photoBuffer,
  });

  const theme = getStyleThemeColors(style, paleta);
  const { pair, fonts } = getSatoriFontsForPair(fontPairId);

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
        paddingTop: "300px",
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
      renderThemedLogoElement({
        isDarkBg: theme.isDarkBg,
        isDarkMonochrome,
        processedPng,
        whiteLogoPng,
        paleta,
        width: 300,
        height: 190,
      })
    ),
    h(
      "div",
      {
        style: {
          width: "100%",
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
            fontSize: dados.nome.length > 20 ? "82px" : "96px",
            color: theme.textColor,
            lineHeight: 1.06,
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
                fontSize: "42px",
                color: theme.mutedTextColor,
                marginTop: "28px",
                lineHeight: 1.35,
              },
            },
            dados.slogan
          )
        : null,
      dados.servicos && style !== "minimal"
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontWeight: 400,
                fontSize: "30px",
                color: theme.badgeText,
                backgroundColor: theme.badgeBg,
                padding: "18px 28px",
                borderRadius: "14px",
                marginTop: "42px",
              },
            },
            dados.servicos
          )
        : null
    ),
    h(
      "div",
      {
        style: {
          width: "100%",
          display: "flex",
          flexDirection: "column",
          borderTop: `2px solid ${theme.badgeBg}`,
          paddingTop: "32px",
          gap: "8px",
        },
      },
      dados.website
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontWeight: pair.tituloWeight,
                fontSize: "30px",
                color: theme.textColor,
              },
            },
            dados.website.replace(/^https?:\/\//, "")
          )
        : null,
      dados.morada || dados.telefone
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.textoFamily,
                fontWeight: 400,
                fontSize: "26px",
                color: theme.mutedTextColor,
              },
            },
            [dados.telefone, dados.morada].filter(Boolean).join("  •  ")
          )
        : null
    )
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
  let borderCol = mixHex(paleta.papel.hex, paleta.tinta.hex, 0.18);
  let nameCol = paleta.tinta.hex;
  let accentCol = paleta.primaria.hex;
  let textCol = "#334155";

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
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%; margin-top: 12px; border-top: 1px solid ${borderCol};">
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
        </table>
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
    isDarkMonochrome,
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
    renderThemedLogoElement({
      isDarkBg: theme.isDarkBg,
      isDarkMonochrome,
      processedPng,
      whiteLogoPng,
      paleta,
      width: 280,
      height: 175,
    }),
    h(
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
    ),
    dados.slogan
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
    h(
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
    isDarkMonochrome,
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
      renderThemedLogoElement({
        isDarkBg: theme.isDarkBg,
        isDarkMonochrome,
        processedPng,
        whiteLogoPng,
        paleta,
        width: 180,
        height: 115,
      }),
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
  const nifText = (dados.nif || "").trim()
    ? `NIF: ${dados.nif.trim()}`
    : "NIF: ______________________";

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
        h(
          "div",
          null,
          [dados.telefone, dados.email, dados.website]
            .map((s) => (s || "").trim())
            .filter(Boolean)
            .join("  •  ")
        )
      ),
      h(
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
