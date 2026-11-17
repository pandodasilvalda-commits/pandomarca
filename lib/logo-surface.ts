import sharp from "sharp";
import {
  contrastRatio,
  hexToRgb,
  hslToHex,
  rgbToHex,
  rgbToHsl,
} from "./palette";

function boostHexForSurfaceContrast(
  rgb: { r: number; g: number; b: number },
  surfaceHex: string
): [number, number, number] {
  const hex = rgbToHex(rgb);
  const hsl = rgbToHsl(rgb);
  const ratio = contrastRatio(hex, surfaceHex);
  if (ratio >= 4.7 && hsl.l >= 50) {
    return [rgb.r, rgb.g, rgb.b];
  }
  if (hsl.s >= 32 && hsl.l >= 24) {
    let candidateHex = hex;
    let lTarget = Math.max(Math.round(hsl.l) + 4, 52);
    const satTarget = Math.max(72, Math.min(96, Math.round(hsl.s)));
    while (lTarget <= 84 && contrastRatio(candidateHex, surfaceHex) < 4.8) {
      candidateHex = hslToHex(hsl.h, satTarget, lTarget);
      lTarget += 4;
    }
    if (contrastRatio(candidateHex, surfaceHex) < 4.5) {
      candidateHex = hslToHex(hsl.h, 24, 92);
    }
    const adjusted = hexToRgb(candidateHex);
    return [adjusted.r, adjusted.g, adjusted.b];
  }
  return [250, 248, 245];
}

/**
 * Converte píxeis do wordmark numa região [xStart..xEnd, yStart..yEnd] por aglomerados de cor reais
 * para eliminar salpicados com anti-aliasing em fundos escuros, preservando os matizes da marca
 * com contraste >= 4.7:1.
 */
function convertRegionClustersForDarkSurface(
  out: Uint8Array,
  w: number,
  xStart: number,
  xEnd: number,
  yStart: number,
  yEnd: number,
  surfaceHex: string
): void {
  const clusters: {
    rSum: number;
    gSum: number;
    bSum: number;
    count: number;
    target?: [number, number, number];
  }[] = [];

  for (let y = yStart; y < yEnd; y += 2) {
    for (let x = xStart; x < xEnd; x += 2) {
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
    const rgb = {
      r: Math.round(c.rSum / c.count),
      g: Math.round(c.gSum / c.count),
      b: Math.round(c.bSum / c.count),
    };
    c.target = boostHexForSurfaceContrast(rgb, surfaceHex);
  }

  if (clusters.length === 0) return;

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
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

/**
 * Levanta APENAS um pedestal horizontal plano e separado na base do símbolo esquerdo
 * (ex.: soleira desligada do corpo principal), sem nunca cortar caixas, selos ou escudos maciços.
 */
function liftDetachedBottomPedestal(
  out: Uint8Array,
  w: number,
  hPx: number,
  splitX: number
): void {
  if (splitX <= 0) return;

  let minSymX = splitX;
  let maxSymX = 0;
  let minSymY = hPx;
  let maxSymY = 0;
  for (let y = 0; y < hPx; y++) {
    for (let x = 0; x < splitX; x++) {
      if (out[(y * w + x) * 4 + 3] >= 128) {
        if (x < minSymX) minSymX = x;
        if (x > maxSymX) maxSymX = x;
        if (y < minSymY) minSymY = y;
        if (y > maxSymY) maxSymY = y;
      }
    }
  }
  const symW = Math.max(1, maxSymX - minSymX + 1);
  const symH = Math.max(1, maxSymY - minSymY + 1);
  const pedestalY = minSymY + Math.round(symH * 0.77);

  const measureDarkRow = (y: number) => {
    let rowOpaque = 0;
    let rowDarkNonVivid = 0;
    let rowMinDarkX = splitX;
    let rowMaxDarkX = 0;
    for (let x = minSymX; x <= maxSymX; x++) {
      const idx = (y * w + x) * 4;
      if (out[idx + 3] < 110) continue;
      rowOpaque++;
      const hsl = rgbToHsl({ r: out[idx], g: out[idx + 1], b: out[idx + 2] });
      if (hsl.l < 28 && hsl.s < 65) {
        rowDarkNonVivid++;
        if (x < rowMinDarkX) rowMinDarkX = x;
        if (x > rowMaxDarkX) rowMaxDarkX = x;
      }
    }
    const darkSpan = rowMaxDarkX >= rowMinDarkX ? rowMaxDarkX - rowMinDarkX + 1 : 0;
    return { rowOpaque, rowDarkNonVivid, darkSpan };
  };

  const pedestalRows: number[] = [];
  for (let y = pedestalY; y <= maxSymY; y++) {
    const m = measureDarkRow(y);
    if (
      m.rowOpaque > 8 &&
      m.rowDarkNonVivid / m.rowOpaque >= 0.82 &&
      m.darkSpan >= symW * 0.55
    ) {
      pedestalRows.push(y);
    }
  }

  if (
    pedestalRows.length < Math.max(3, Math.round(symH * 0.03)) ||
    pedestalRows.length > Math.round(symH * 0.16)
  ) {
    return;
  }

  const firstPedestalY = pedestalRows[0];
  const firstRowMetrics = measureDarkRow(firstPedestalY);
  let hasClearBreakAbove = false;
  const checkStart = Math.max(minSymY, firstPedestalY - 12);
  for (let y = checkStart; y < firstPedestalY; y++) {
    const above = measureDarkRow(y);
    if (
      above.rowOpaque <= Math.max(2, Math.round(symW * 0.04)) ||
      above.darkSpan < firstRowMetrics.darkSpan * 0.48 ||
      above.rowDarkNonVivid / Math.max(1, above.rowOpaque) < 0.35
    ) {
      hasClearBreakAbove = true;
      break;
    }
  }

  if (!hasClearBreakAbove) return;

  for (const y of pedestalRows) {
    for (let x = minSymX; x <= maxSymX; x++) {
      const idx = (y * w + x) * 4;
      if (out[idx + 3] < 110) continue;
      const hsl = rgbToHsl({ r: out[idx], g: out[idx + 1], b: out[idx + 2] });
      if (hsl.l < 28 && hsl.s < 65) {
        out[idx] = 250;
        out[idx + 1] = 248;
        out[idx + 2] = 245;
      }
    }
  }
}

/**
 * Converte um logótipo escuro quase monocromático preservando letras ou recorte branco
 * interior dentro de caixas/emblemas cheios (evita que uma caixa escura com letras brancas
 * se transforme num quadrado todo branco sem leitura).
 */
function convertDarkMonochromePreservingCutouts(
  data: Buffer | Uint8Array,
  surfaceHex: string
): Uint8Array {
  const out = new Uint8Array(data);
  let opaqueCount = 0;
  let whiteOpaqueCount = 0;
  let darkOpaqueCount = 0;

  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3];
    if (a < 10) continue;
    opaqueCount++;
    if (a >= 128) {
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const hsl = rgbToHsl({ r, g, b });
      if (lum >= 180 && hsl.s < 35) whiteOpaqueCount++;
      if (lum < 95) darkOpaqueCount++;
    }
  }

  const hasInteriorBrightDetail =
    whiteOpaqueCount >= Math.max(24, opaqueCount * 0.015) &&
    darkOpaqueCount >= opaqueCount * 0.15;

  const surfRgb = hexToRgb(surfaceHex);
  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3];
    if (a < 10) continue;

    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const hsl = rgbToHsl({ r, g, b });

    if (hsl.s >= 42 && hsl.l >= 22 && hsl.l <= 78) {
      const boosted = boostHexForSurfaceContrast({ r, g, b }, surfaceHex);
      out[i] = boosted[0];
      out[i + 1] = boosted[1];
      out[i + 2] = boosted[2];
      continue;
    }

    if (hasInteriorBrightDetail) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const t = Math.max(0, Math.min(1, (lum - 45) / 180));
      out[i] = Math.round(250 + (surfRgb.r - 250) * t);
      out[i + 1] = Math.round(248 + (surfRgb.g - 248) * t);
      out[i + 2] = Math.round(245 + (surfRgb.b - 245) * t);
    } else {
      out[i] = 250;
      out[i + 1] = 248;
      out[i + 2] = 245;
    }
  }

  return out;
}

function findHorizontalWordmarkSplitX(
  data: Buffer | Uint8Array,
  w: number,
  hPx: number
): number {
  if (w <= hPx * 1.35) return 0;
  const minSearchX = Math.round(w * 0.18);
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
      return x;
    }
  }
  return 0;
}

function findStackedWordmarkSplitY(
  data: Buffer | Uint8Array,
  w: number,
  hPx: number
): number {
  if (w > hPx * 1.45 || hPx < 120) return 0;
  const yStart = Math.round(hPx * 0.25);
  const yEnd = Math.max(yStart + 10, hPx - 14);
  let seenOpaqueTop = false;
  let gapStart = -1;
  let bestRunLen = 0;
  let bestSplitY = 0;

  for (let y = yStart; y <= yEnd; y++) {
    let rowOpaque = 0;
    for (let x = Math.round(w * 0.08); x < Math.round(w * 0.92); x += 2) {
      if (data[(y * w + x) * 4 + 3] > 28) rowOpaque++;
    }
    if (rowOpaque <= 2) {
      if (seenOpaqueTop && gapStart < 0) gapStart = y;
    } else {
      seenOpaqueTop = true;
      if (gapStart >= 0) {
        const len = y - gapStart;
        if (len > bestRunLen) {
          bestRunLen = len;
          bestSplitY = Math.round((gapStart + y) / 2);
        }
        gapStart = -1;
      }
    }
  }

  const minGapPx = Math.max(8, Math.round(hPx * 0.03));
  return bestRunLen >= minGapPx && bestSplitY > 24 && bestSplitY < hPx - 20
    ? bestSplitY
    : 0;
}

async function convertDarkSurfaceWordmarkClustered(
  data: Buffer | Uint8Array,
  w: number,
  hPx: number,
  splitX: number,
  surfaceHex: string
): Promise<Uint8Array> {
  const out = new Uint8Array(data);
  convertRegionClustersForDarkSurface(out, w, splitX, w, 0, hPx, surfaceHex);
  liftDetachedBottomPedestal(out, w, hPx, splitX);
  return out;
}

/**
 * Adapta o logótipo transparente carregado para fundos escuros mantendo intacta
 * a mascote/emblema e passando texto escuro a claro com contraste >= 4.7:1.
 * Suporta composições horizontais (splitX) e empilhadas verticais (splitY).
 */
export async function adaptLogoForDarkSurface(
  processedPng: Buffer,
  isDarkMonochrome = false,
  surfaceHex = "#142A4D"
): Promise<{ buffer: Buffer; appliedKnockout: boolean; hasSplitWordmark: boolean }> {
  const { data, info } = await sharp(processedPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const hPx = info.height;

  // Verificar se as margens têm transparência real (senão precisa de base se for JPG opaco)
  let cornerTransparent = 0;
  for (const [cx, cy] of [
    [0, 0],
    [w - 1, 0],
    [0, hPx - 1],
    [w - 1, hPx - 1],
  ]) {
    if (data[(cy * w + cx) * 4 + 3] < 40) cornerTransparent++;
  }
  if (cornerTransparent < 3) {
    return { buffer: processedPng, appliedKnockout: false, hasSplitWordmark: false };
  }

  const wordmarkStartX = findHorizontalWordmarkSplitX(data, w, hPx);

  if (isDarkMonochrome) {
    const out = convertDarkMonochromePreservingCutouts(data, surfaceHex);
    return {
      buffer: await sharp(Buffer.from(out.buffer), {
        raw: { width: w, height: hPx, channels: 4 },
      })
        .png()
        .toBuffer(),
      appliedKnockout: true,
      hasSplitWordmark: wordmarkStartX > 0,
    };
  }

  if (wordmarkStartX > 0) {
    const out = await convertDarkSurfaceWordmarkClustered(
      data,
      w,
      hPx,
      wordmarkStartX,
      surfaceHex
    );
    return {
      buffer: await sharp(Buffer.from(out.buffer), {
        raw: { width: w, height: hPx, channels: 4 },
      })
        .png()
        .toBuffer(),
      appliedKnockout: true,
      hasSplitWordmark: true,
    };
  }

  const stackedSplitY = findStackedWordmarkSplitY(data, w, hPx);
  if (stackedSplitY > 0) {
    const out = new Uint8Array(data);
    convertRegionClustersForDarkSurface(out, w, 0, w, stackedSplitY, hPx, surfaceHex);
    return {
      buffer: await sharp(Buffer.from(out.buffer), {
        raw: { width: w, height: hPx, channels: 4 },
      })
        .png()
        .toBuffer(),
      appliedKnockout: true,
      hasSplitWordmark: false,
    };
  }

  return { buffer: processedPng, appliedKnockout: false, hasSplitWordmark: false };
}

/**
 * Gera a versão do logótipo para fundos escuros:
 * - Se o logótipo for escuro e quase sem cor (isDarkMonochrome), passa o desenho a branco
 *   preservando eventuais letras ou recortes brancos interiores com alto contraste.
 * - Se for horizontal ou empilhado com cor, preserva o emblema e converte por aglomerados
 *   uniformes o wordmark escuro mantendo os matizes coloridos legíveis.
 */
export async function createWhiteKnockoutLogo(
  processedPng: Buffer,
  isDarkMonochrome = false,
  surfaceHex = "#1E100A"
): Promise<Buffer> {
  const { data, info } = await sharp(processedPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const hPx = info.height;

  if (isDarkMonochrome) {
    const out = convertDarkMonochromePreservingCutouts(data, surfaceHex);
    return sharp(Buffer.from(out.buffer), {
      raw: { width: w, height: hPx, channels: 4 },
    })
      .png()
      .toBuffer();
  }

  const wordmarkStartX = findHorizontalWordmarkSplitX(data, w, hPx);
  if (wordmarkStartX > 0) {
    const out = await convertDarkSurfaceWordmarkClustered(
      data,
      w,
      hPx,
      wordmarkStartX,
      surfaceHex
    );
    return sharp(Buffer.from(out.buffer), {
      raw: { width: w, height: hPx, channels: 4 },
    })
      .png()
      .toBuffer();
  }

  const stackedSplitY = findStackedWordmarkSplitY(data, w, hPx);
  if (stackedSplitY > 0) {
    const out = new Uint8Array(data);
    convertRegionClustersForDarkSurface(out, w, 0, w, stackedSplitY, hPx, surfaceHex);
    return sharp(Buffer.from(out.buffer), {
      raw: { width: w, height: hPx, channels: 4 },
    })
      .png()
      .toBuffer();
  }

  const out = await convertDarkSurfaceWordmarkClustered(
    data,
    w,
    hPx,
    0,
    surfaceHex
  );

  return sharp(Buffer.from(out.buffer), {
    raw: { width: w, height: hPx, channels: 4 },
  })
    .png()
    .toBuffer();
}

export async function ensureWordmarkContrastOnDarkBg(
  pngBuffer: Buffer,
  bgHex: string
): Promise<Buffer> {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const hPx = info.height;

  const wordmarkStartX = findHorizontalWordmarkSplitX(data, w, hPx);
  if (wordmarkStartX > 0) {
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

  const stackedSplitY = findStackedWordmarkSplitY(data, w, hPx);
  if (stackedSplitY > 0) {
    const out = new Uint8Array(data);
    convertRegionClustersForDarkSurface(out, w, 0, w, stackedSplitY, hPx, bgHex);
    return sharp(Buffer.from(out.buffer), {
      raw: { width: w, height: hPx, channels: 4 },
    })
      .png()
      .toBuffer();
  }

  return pngBuffer;
}
