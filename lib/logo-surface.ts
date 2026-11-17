import sharp from "sharp";
import {
  contrastRatio,
  hexToRgb,
  hslToHex,
  rgbToHex,
  rgbToHsl,
} from "./palette";

/**
 * Converte píxeis do wordmark por aglomerados de cor reais (nunca píxel-a-píxel isolado)
 * para eliminar qualquer efeito salpicado em letras coloridas ou com anti-aliasing em fundos escuros,
 * preservando os matizes da marca (ex.: azul eléctrico PandoWeb) com contraste >= 4.7:1.
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
    } else if (hsl.s >= 32 && hsl.l >= 24) {
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
      c.target = [adjusted.r, adjusted.g, adjusted.b];
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

  // No símbolo à esquerda, levanta APENAS eventual pedestal horizontal plano e escuro na base
  // (exclui ilustrações/mascotes como a pata/fato preto do panda para não criar cortes brancos).
  if (splitX > 0) {
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

    const pedestalRows: number[] = [];
    for (let y = pedestalY; y <= maxSymY; y++) {
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
      if (
        rowOpaque > 8 &&
        rowDarkNonVivid / rowOpaque >= 0.82 &&
        darkSpan >= symW * 0.55
      ) {
        pedestalRows.push(y);
      }
    }

    if (pedestalRows.length >= Math.max(3, Math.round(symH * 0.03))) {
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
  }

  return out;
}

/**
 * Adapta o logótipo transparente carregado para fundos escuros mantendo intacta
 * a mascote/ilustração e passando texto escuro a claro com contraste >= 4.7:1.
 * Devolve `appliedKnockout: true` quando conseguiu adaptar sem precisar de cartão opaco.
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

  let wordmarkStartX = 0;
  if (w > hPx * 1.35) {
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
        wordmarkStartX = x;
        break;
      }
    }
  }

  if (wordmarkStartX <= 0) {
    return { buffer: processedPng, appliedKnockout: false, hasSplitWordmark: false };
  }

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

/**
 * Gera a versão do logótipo para fundos escuros:
 * - Se o logótipo for escuro e quase sem cor (isDarkMonochrome), passa o desenho a branco (#FAF8F5).
 * - Se o logótipo for colorido horizontal, preserva a ilustração à esquerda e converte por aglomerados
 *   uniformes o texto escuro em #FAF8F5 preservando o matiz das letras coloridas.
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
