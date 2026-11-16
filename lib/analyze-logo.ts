import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { BrandPalette, RGBColor } from "./formats";
import { buildBrandPalette, hslToHex, rgbToHex, rgbToHsl } from "./palette";
import { createRandomId, DRAFT_TTL_MS, DraftMeta, saveDraft } from "./storage";
import { getSatoriFontsForPair } from "./fonts";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export class LogoAnalysisError extends Error {
  code:
    | "no_file"
    | "file_too_large"
    | "unsupported_format"
    | "unsafe_svg"
    | "unreadable_file";

  constructor(
    code:
      | "no_file"
      | "file_too_large"
      | "unsupported_format"
      | "unsafe_svg"
      | "unreadable_file",
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

export function validateSvgSecurity(svgText: string): void {
  const trimmed = svgText.trim();
  if (!trimmed.includes("<svg") || !trimmed.includes("</svg>")) {
    throw new LogoAnalysisError(
      "unreadable_file",
      "O ficheiro SVG não tem uma estrutura válida."
    );
  }

  const forbiddenPatterns: { regex: RegExp; motivo: string }[] = [
    { regex: /<script\b/i, motivo: "contém etiquetas <script>" },
    { regex: /\bon[a-z]+\s*=/i, motivo: "contém atributos de eventos JavaScript" },
    { regex: /javascript\s*:/i, motivo: "contém instruções javascript:" },
    { regex: /<!ENTITY\b/i, motivo: "declara entidades XML (<!ENTITY>)" },
    { regex: /<!DOCTYPE\b/i, motivo: "declara DOCTYPE/entidades externas" },
    { regex: /<foreignObject\b/i, motivo: "contém <foreignObject>" },
    {
      regex: /(?:xlink:href|href)\s*=\s*["']\s*(?:https?:|\/\/|ftp:)/i,
      motivo: "contém ligações externas",
    },
    {
      regex: /url\(\s*["']?\s*(?:https?:|\/\/)/i,
      motivo: "carrega recursos externos por URL",
    },
    {
      regex: /@import\b/i,
      motivo: "contém importações externas de estilo (@import)",
    },
  ];

  for (const item of forbiddenPatterns) {
    if (item.regex.test(trimmed)) {
      throw new LogoAnalysisError(
        "unsafe_svg",
        `O ficheiro SVG foi recusado por segurança (${item.motivo}). Carregue um SVG limpo sem scripts, entidades ou ligações externas.`
      );
    }
  }
}

function colorDist(a: RGBColor, b: RGBColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export async function analyzeAndStoreLogo(params: {
  buffer: Buffer;
  filename?: string;
  mimeType?: string;
  entrada?: "A" | "B";
  iconSvg?: string;
  variantesEntradaA?: DraftMeta["variantesEntradaA"];
}): Promise<{ meta: DraftMeta; processedPng: Buffer }> {
  const { buffer, filename = "", mimeType = "", entrada = "B" } = params;

  if (!buffer || buffer.length === 0) {
    throw new LogoAnalysisError(
      "no_file",
      "Nenhum ficheiro recebido. Selecione um logótipo em PNG, JPG ou SVG."
    );
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new LogoAnalysisError(
      "file_too_large",
      "O ficheiro excede o limite máximo de 8 MB. Reduza o tamanho do ficheiro e tente novamente."
    );
  }

  const lowerName = filename.toLowerCase();
  const isSvgCandidate =
    mimeType.includes("svg") ||
    lowerName.endsWith(".svg") ||
    buffer.subarray(0, 300).toString("utf8").trimStart().startsWith("<svg") ||
    buffer.subarray(0, 300).toString("utf8").includes("<svg");

  let rasterBuffer: Buffer;
  let originalFormat: "png" | "jpeg" | "svg" = "png";
  let svgSource: string | undefined;

  if (isSvgCandidate) {
    const svgText = buffer.toString("utf8");
    validateSvgSecurity(svgText);
    originalFormat = "svg";
    svgSource = svgText;

    try {
      // Rasterize SVG at ~1400 px width using Resvg or sharp fallback
      const resvg = new Resvg(svgText, {
        fitTo: {
          mode: "width",
          value: 1400,
        },
      });
      rasterBuffer = Buffer.from(resvg.render().asPng());
    } catch {
      try {
        rasterBuffer = await sharp(Buffer.from(svgText), { density: 200 })
          .resize({ width: 1400, withoutEnlargement: false })
          .png()
          .toBuffer();
      } catch {
        throw new LogoAnalysisError(
          "unreadable_file",
          "Não foi possível processar o ficheiro SVG. Verifique se o ficheiro está íntegro."
        );
      }
    }
  } else {
    let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
    try {
      metadata = await sharp(buffer).metadata();
    } catch {
      throw new LogoAnalysisError(
        "unreadable_file",
        "O ficheiro enviado está ilegível ou corrompido. Carregue um ficheiro PNG, JPG ou SVG válido."
      );
    }

    if (metadata.format === "png") {
      originalFormat = "png";
    } else if (metadata.format === "jpeg") {
      originalFormat = "jpeg";
    } else {
      throw new LogoAnalysisError(
        "unsupported_format",
        "Formato não suportado. Carregue apenas ficheiros PNG, JPG ou SVG (até 8 MB)."
      );
    }

    rasterBuffer = buffer;
  }

  // Decode raw RGBA pixels
  const { data, info } = await sharp(rasterBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const totalPixels = width * height;
  const rgba = new Uint8Array(data);

  // 1. Check if image already has meaningful transparency
  let transparentCount = 0;
  let borderTransparentCount = 0;
  let borderCount = 0;

  const getIdx = (x: number, y: number) => (y * width + x) * 4;

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

  let backgroundStatus: DraftMeta["backgroundStatus"] = "transparent_original";
  let backgroundNotice: string | undefined;

  const hasUsefulTransparency =
    transparentCount / totalPixels > 0.03 &&
    borderTransparentCount / Math.max(1, borderCount) > 0.25;

  if (!hasUsefulTransparency) {
    // Inspect border pixels to see if the margin is a uniform color
    const borderSamples: RGBColor[] = [];
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

    // Find median border color
    const rs = borderSamples.map((c) => c.r).sort((a, b) => a - b);
    const gs = borderSamples.map((c) => c.g).sort((a, b) => a - b);
    const bs = borderSamples.map((c) => c.b).sort((a, b) => a - b);
    const mid = Math.floor(borderSamples.length / 2);
    const marginColor: RGBColor = {
      r: rs[mid] ?? 255,
      g: gs[mid] ?? 255,
      b: bs[mid] ?? 255,
    };

    const matchingBorder = borderSamples.filter(
      (c) => colorDist(c, marginColor) <= 28
    ).length;
    const borderUniformRatio = matchingBorder / Math.max(1, borderSamples.length);

    if (borderUniformRatio >= 0.82) {
      // Flood-fill BFS from the margin so enclosed white inside the logo stays opaque!
      backgroundStatus = "margin_removed";
      const visited = new Uint8Array(totalPixels);
      const queue = new Int32Array(totalPixels);
      let head = 0;
      let tail = 0;

      const tryEnqueue = (x: number, y: number) => {
        const pIdx = y * width + x;
        if (visited[pIdx]) return;
        const idx = pIdx * 4;
        const c = { r: rgba[idx], g: rgba[idx + 1], b: rgba[idx + 2] };
        if (colorDist(c, marginColor) <= 32) {
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
        const idx = pIdx * 4;
        rgba[idx + 3] = 0; // Transparent!

        const x = pIdx % width;
        const y = (pIdx - x) / width;

        if (x > 0) tryEnqueue(x - 1, y);
        if (x < width - 1) tryEnqueue(x + 1, y);
        if (y > 0) tryEnqueue(x, y - 1);
        if (y < height - 1) tryEnqueue(x, y + 1);
      }
    } else {
      backgroundStatus = "non_uniform_margin";
      backgroundNotice =
        "A margem da imagem não é uma cor lisa uniforme. O fundo foi mantido; para melhores resultados em todas as peças, recomendamos carregar um ficheiro PNG com fundo transparente.";
    }
  }

  // 2. Extract palette from opaque pixels (alpha >= 128)
  const buckets = new Map<
    string,
    { count: number; rSum: number; gSum: number; bSum: number; sat: number; light: number }
  >();

  let opaquePixels = 0;
  let colorfulPixels = 0;
  let luminanceSum = 0;

  const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / 16000)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = getIdx(x, y);
      const a = rgba[idx + 3];
      if (a < 128) continue;

      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];
      opaquePixels++;

      const hsl = rgbToHsl({ r, g, b });
      luminanceSum += hsl.l;
      if (hsl.s > 22 && hsl.l > 12 && hsl.l < 88) {
        colorfulPixels++;
      }

      // Quantize RGB into 24-unit bins
      const qr = Math.round(r / 24) * 24;
      const qg = Math.round(g / 24) * 24;
      const qb = Math.round(b / 24) * 24;
      const key = `${qr},${qg},${qb}`;
      const prev = buckets.get(key);
      if (prev) {
        prev.count++;
        prev.rSum += r;
        prev.gSum += g;
        prev.bSum += b;
      } else {
        buckets.set(key, {
          count: 1,
          rSum: r,
          gSum: g,
          bSum: b,
          sat: hsl.s,
          light: hsl.l,
        });
      }
    }
  }

  const avgLum = opaquePixels > 0 ? luminanceSum / opaquePixels : 30;
  const colorfulRatio = opaquePixels > 0 ? colorfulPixels / opaquePixels : 0;
  const isDarkMonochrome = colorfulRatio < 0.12 && avgLum < 45;

  // Rank color clusters (prefer chromatic colors that aren't near-white or near-black when available)
  const clusters = Array.from(buckets.values())
    .map((c) => {
      const avgRgb: RGBColor = {
        r: Math.round(c.rSum / c.count),
        g: Math.round(c.gSum / c.count),
        b: Math.round(c.bSum / c.count),
      };
      const hsl = rgbToHsl(avgRgb);
      const hex = rgbToHex(avgRgb);
      const isNearWhite = hsl.l > 88;
      const isNearBlack = hsl.l < 14;
      const chromaticScore =
        isNearWhite
          ? 0.05
          : isNearBlack
          ? 0.35
          : 1 + (hsl.s / 100) * 1.6;
      return {
        rgb: avgRgb,
        hex,
        hsl,
        count: c.count,
        score: c.count * chromaticScore,
        isNearWhite,
      };
    })
    .sort((a, b) => b.score - a.score);

  const nonWhiteClusters = clusters.filter((c) => !c.isNearWhite);
  const primaryCluster = nonWhiteClusters[0] || clusters[0] || {
    rgb: { r: 184, g: 74, b: 36 },
    hex: "#B84A24",
    hsl: { h: 16, s: 67, l: 43 },
  };

  // Find a distinct secondary cluster at least 42 RGB units away
  const secondaryCluster =
    nonWhiteClusters.find((c) => colorDist(c.rgb, primaryCluster.rgb) >= 42) ||
    null;

  const primariaHex = primaryCluster.hex;
  const secundariaHex = secondaryCluster
    ? secondaryCluster.hex
    : hslToHex(
        (primaryCluster.hsl.h + 32) % 360,
        Math.max(45, primaryCluster.hsl.s),
        Math.min(68, Math.max(28, primaryCluster.hsl.l + 14))
      );

  const papelHex = hslToHex(primaryCluster.hsl.h, 22, 97);
  const tintaHex = hslToHex(primaryCluster.hsl.h, 28, 13);

  const paletaExtraida: BrandPalette = buildBrandPalette({
    primaria: primariaHex,
    secundaria: secundariaHex,
    papel: papelHex,
    tinta: tintaHex,
  });

  // 3. Trim transparent margins gently (while keeping a small breathing margin) if background is transparent
  let processedPng: Buffer;
  let finalWidth = width;
  let finalHeight = height;

  const rawProcessed = await sharp(Buffer.from(rgba.buffer), {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();

  if (backgroundStatus !== "non_uniform_margin") {
    try {
      const trimmed = await sharp(rawProcessed)
        .trim({ threshold: 8 })
        .toBuffer({ resolveWithObject: true });
      if (trimmed.info.width >= 16 && trimmed.info.height >= 16) {
        processedPng = trimmed.data;
        finalWidth = trimmed.info.width;
        finalHeight = trimmed.info.height;
      } else {
        processedPng = rawProcessed;
      }
    } catch {
      processedPng = rawProcessed;
    }
  } else {
    processedPng = rawProcessed;
  }

  // 4. Evaluate sharpness / resolution (SVG never gets a low-resolution warning)
  let lowQuality = false;
  let qualityWarning: string | undefined;

  if (originalFormat !== "svg") {
    const minSide = Math.min(width, height);
    const maxSide = Math.max(width, height);
    if (maxSide < 500 || minSide < 240) {
      lowQuality = true;
      qualityWarning = `O ficheiro carregado tem uma resolução baixa (${width}×${height} px), o que pode comprometer a nitidez nas capas, no estacionário de impressão e no guia de marca. Sugerimos redesenhar um logótipo vectorial na Entrada A, ou pode optar por continuar com o ficheiro atual.`;
    }
  }

  // Optional custom icon PNG for Entrada A
  let iconPng: Buffer | undefined;
  if (params.iconSvg) {
    try {
      const resvgIcon = new Resvg(params.iconSvg, {
        fitTo: { mode: "width", value: 1024 },
      });
      iconPng = Buffer.from(resvgIcon.render().asPng());
    } catch {
      iconPng = undefined;
    }
  }

  const now = Date.now();
  const meta: DraftMeta = {
    id: createRandomId("rasc"),
    createdAt: now,
    expiresAt: now + DRAFT_TTL_MS,
    entrada,
    width: finalWidth,
    height: finalHeight,
    originalFormat,
    backgroundStatus,
    backgroundNotice,
    lowQuality,
    qualityWarning,
    isDarkMonochrome,
    paletaExtraida,
    svgSource,
    variantesEntradaA: params.variantesEntradaA,
  };

  saveDraft(meta, processedPng, iconPng);
  return { meta, processedPng };
}
