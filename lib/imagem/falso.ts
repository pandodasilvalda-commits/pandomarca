import fs from "fs";
import path from "path";
import sharp, { type OverlayOptions } from "sharp";
import {
  getRedeSocialConfig,
  getZonaSeguraComum,
  type RedeSocialConfig,
  type RedeSocialId,
} from "../config/redes-sociais";
import { buildBrandPalette, hexToRgb, mixHex } from "../palette";
import { vetorizarImagemLocal } from "../vetorizar";
import {
  ImagemContexto,
  ImagemFormato,
  ImagemProvider,
  ImagemProviderError,
  ImagemResultado,
  VetorResultado,
} from "./types";

const REF_DIR = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "docs",
  "referencias",
  "ia-aprovada"
);

const FIXTURES_DIR = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "tests",
  "fixtures"
);

const refCache = new Map<string, Buffer>();

function loadApprovedRef(filename: "logo.jpg" | "capa-moderna.jpg" | "capa-classica.jpg"): Buffer {
  const cached = refCache.get(filename);
  if (cached) return cached;
  const fullPath = path.join(/*turbopackIgnore: true*/ REF_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `Imagem de referência aprovada em falta: docs/referencias/ia-aprovada/${filename}`
    );
  }
  const buf = fs.readFileSync(fullPath);
  refCache.set(filename, buf);
  return buf;
}

export function getApprovedReferencePaths(): string[] {
  return [
    "docs/referencias/ia-aprovada/logo.jpg",
    "docs/referencias/ia-aprovada/capa-moderna.jpg",
    "docs/referencias/ia-aprovada/capa-classica.jpg",
  ];
}

function normalizeNameForMatch(nome?: string): string {
  return (nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isDefaultFornoBrand(nome?: string): boolean {
  const norm = normalizeNameForMatch(nome);
  return !norm || norm.includes("forno da vilarica") || norm === "forno";
}

function isModernStyle(formato: ImagemFormato, contexto?: ImagemContexto): boolean {
  if (contexto?.estiloVisual === "moderno") return true;
  if (contexto?.estiloVisual === "classico") return false;
  if (formato === "logotipo-moderno") return true;
  if (contexto?.estilo === "moderno") return true;
  if (contexto?.logotipoDna?.estiloDirecao === "moderno") return true;
  if (contexto?.layoutId?.startsWith("moderno-")) return true;
  if (contexto?.paleta?.primaria.hex.toUpperCase() === "#172E2C") return true;
  return false;
}

async function sampleEdgeRgb(
  buf: Buffer,
  x = 12,
  y = 12
): Promise<{ r: number; g: number; b: number }> {
  const meta = await sharp(buf).metadata();
  const px = Math.max(0, Math.min((meta.width || 32) - 1, x));
  const py = Math.max(0, Math.min((meta.height || 32) - 1, y));
  const pixel = await sharp(buf)
    .extract({ left: px, top: py, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();
  return {
    r: pixel[0] ?? 250,
    g: pixel[1] ?? 243,
    b: pixel[2] ?? 225,
  };
}

/**
 * Suaviza progressivamente a opacidade nas margens exteriores para integrar
 * recortes sobre o fundo da peça sem arestas ou retângulos visíveis.
 */
async function featherEdges(
  inputPng: Buffer,
  opts: { topPx?: number; bottomPx?: number; leftPx?: number; rightPx?: number }
): Promise<Buffer> {
  const { data, info } = await sharp(inputPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const rgba = new Uint8Array(data);
  const topPx = Math.max(0, Math.min(Math.floor(h * 0.45), opts.topPx || 0));
  const bottomPx = Math.max(0, Math.min(Math.floor(h * 0.45), opts.bottomPx || 0));
  const leftPx = Math.max(0, Math.min(Math.floor(w * 0.45), opts.leftPx || 0));
  const rightPx = Math.max(0, Math.min(Math.floor(w * 0.45), opts.rightPx || 0));

  const smooth = (t: number) => {
    const c = Math.max(0, Math.min(1, t));
    return c * c * (3 - 2 * c);
  };

  for (let y = 0; y < h; y++) {
    let ay = 1;
    if (topPx > 0 && y < topPx) ay = Math.min(ay, smooth((y + 0.5) / topPx));
    if (bottomPx > 0 && y >= h - bottomPx) {
      ay = Math.min(ay, smooth((h - y - 0.5) / bottomPx));
    }

    for (let x = 0; x < w; x++) {
      let ax = ay;
      if (leftPx > 0 && x < leftPx) ax = Math.min(ax, smooth((x + 0.5) / leftPx));
      if (rightPx > 0 && x >= w - rightPx) {
        ax = Math.min(ax, smooth((w - x - 0.5) / rightPx));
      }
      if (ax < 1) {
        const idx = (y * w + x) * 4 + 3;
        rgba[idx] = Math.round(rgba[idx] * ax);
      }
    }
  }

  return sharp(Buffer.from(rgba.buffer), {
    raw: { width: w, height: h, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function isImageMostlySameAsRef(candidate: Buffer, refName: "logo.jpg" | "capa-moderna.jpg"): Promise<boolean> {
  try {
    const refBuf = loadApprovedRef(refName);
    const [a, b] = await Promise.all([
      sharp(candidate).resize(16, 16, { fit: "fill" }).removeAlpha().raw().toBuffer(),
      sharp(refBuf).resize(16, 16, { fit: "fill" }).removeAlpha().raw().toBuffer(),
    ]);
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff += Math.abs(a[i] - b[i]);
    }
    return diff / a.length < 18;
  } catch {
    return false;
  }
}

async function removeUniformMarginFloodFill(inputPng: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(inputPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const total = width * height;
  const rgba = new Uint8Array(data);
  const idxOf = (x: number, y: number) => (y * width + x) * 4;

  let cornerAlphaZero = 0;
  for (const [cx, cy] of [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ]) {
    if (rgba[idxOf(cx, cy) + 3] < 40) cornerAlphaZero++;
  }
  if (cornerAlphaZero >= 3) {
    return sharp(inputPng).png().toBuffer();
  }

  const samples: { r: number; g: number; b: number }[] = [];
  for (let x = 0; x < width; x++) {
    const it = idxOf(x, 0);
    const ib = idxOf(x, height - 1);
    samples.push({ r: rgba[it], g: rgba[it + 1], b: rgba[it + 2] });
    samples.push({ r: rgba[ib], g: rgba[ib + 1], b: rgba[ib + 2] });
  }
  for (let y = 1; y < height - 1; y++) {
    const il = idxOf(0, y);
    const ir = idxOf(width - 1, y);
    samples.push({ r: rgba[il], g: rgba[il + 1], b: rgba[il + 2] });
    samples.push({ r: rgba[ir], g: rgba[ir + 1], b: rgba[ir + 2] });
  }

  const rs = samples.map((s) => s.r).sort((a, b) => a - b);
  const gs = samples.map((s) => s.g).sort((a, b) => a - b);
  const bs = samples.map((s) => s.b).sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  const bg = { r: rs[mid] ?? 255, g: gs[mid] ?? 255, b: bs[mid] ?? 255 };

  const dist = (idx: number) =>
    Math.hypot(rgba[idx] - bg.r, rgba[idx + 1] - bg.g, rgba[idx + 2] - bg.b);

  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const tryPush = (x: number, y: number) => {
    const p = y * width + x;
    if (visited[p]) return;
    if (dist(p * 4) <= 34) {
      visited[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    rgba[p * 4 + 3] = 0;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) tryPush(x - 1, y);
    if (x < width - 1) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y < height - 1) tryPush(x, y + 1);
  }

  return sharp(Buffer.from(rgba.buffer), {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * Limpa suavemente a ponta inferior direita da tábua de madeira no recorte do bloco esquerdo
 * de `capa-moderna.jpg`, mantendo 100% intacta toda a tipografia «FORNO da Vilariça».
 */
async function cleanLowerRightSliver(
  blockPng: Buffer,
  startX: number,
  startY: number
): Promise<Buffer> {
  const bg = await sampleEdgeRgb(blockPng, 8, 8);
  const { data, info } = await sharp(blockPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const rgba = new Uint8Array(data);
  const feather = 14;
  const smooth = (t: number) => {
    const c = Math.max(0, Math.min(1, t));
    return c * c * (3 - 2 * c);
  };
  for (let y = Math.max(0, startY - feather); y < h; y++) {
    const wy = smooth((y - (startY - feather)) / feather);
    for (let x = Math.max(0, startX - feather); x < w; x++) {
      const wx = smooth((x - (startX - feather)) / feather);
      const t = wx * wy;
      if (t <= 0) continue;
      const i = (y * w + x) * 4;
      rgba[i] = Math.round(rgba[i] * (1 - t) + bg.r * t);
      rgba[i + 1] = Math.round(rgba[i + 1] * (1 - t) + bg.g * t);
      rgba[i + 2] = Math.round(rgba[i + 2] * (1 - t) + bg.b * t);
    }
  }
  return sharp(Buffer.from(rgba.buffer), {
    raw: { width: w, height: h, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * Gera uma proposta de logótipo em modo de demonstração a partir exclusivamente
 * das referências aprovadas em `docs/referencias/ia-aprovada/` via `sharp` puro (sem regras SVG).
 */
async function generateLogoFromApprovedRefs(
  formato: "logotipo-classico" | "logotipo-moderno" | "logotipo-editorial",
  ronda: number,
  contexto?: ImagemContexto
): Promise<{ buffer: Buffer; fixtureNome: string; width: number; height: number }> {
  const size = 1024;
  const r = Math.max(1, Math.min(3, ronda || 1));

  if (formato === "logotipo-moderno") {
    const refCapMod = loadApprovedRef("capa-moderna.jpg");
    // Bloco esquerdo completo (x 68..598) preservando integralmente "FORNO da Vilariça"
    const leftBlockRaw = await sharp(refCapMod)
      .extract({ left: 68, top: 20, width: 530, height: 670 })
      .png()
      .toBuffer();
    const leftBlock = await cleanLowerRightSliver(leftBlockRaw, 492, 496);

    let processedBlock = leftBlock;
    if (r === 2) {
      // Variante verde pinheiro em painel escuro com tipografia integral sem cortes
      processedBlock = await sharp(leftBlock)
        .modulate({ hue: 145, saturation: 1.15, brightness: 1.04 })
        .png()
        .toBuffer();
    } else if (r === 3) {
      // Variante emblema + composição ampla horizontal
      processedBlock = await sharp(refCapMod)
        .extract({ left: 24, top: 20, width: 1230, height: 680 })
        .png()
        .toBuffer();
    }

    const bgRgb = await sampleEdgeRgb(processedBlock, 8, 8);
    const resizedRaw = await sharp(processedBlock)
      .resize(Math.round(size * 0.84), Math.round(size * 0.84), {
        fit: "contain",
        background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 0 },
      })
      .png()
      .toBuffer();
    const resizedLockup = await featherEdges(resizedRaw, {
      topPx: 26,
      bottomPx: 26,
      leftPx: 26,
      rightPx: 26,
    });

    const out = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 1 },
      },
    })
      .composite([{ input: resizedLockup, gravity: "center" }])
      .flatten({ background: bgRgb })
      .png()
      .toBuffer();

    return {
      buffer: out,
      fixtureNome: "docs/referencias/ia-aprovada/capa-moderna.jpg",
      width: size,
      height: size,
    };
  }

  // Clássico ou Editorial: parte diretamente de logo.jpg ou capa-classica.jpg
  if (r === 2) {
    const refClassica = loadApprovedRef("capa-classica.jpg");
    const bgRgb = await sampleEdgeRgb(refClassica, 16, 16);
    const seloRaw = await sharp(refClassica)
      .extract({ left: 250, top: 44, width: 780, height: 632 })
      .resize(Math.round(size * 0.84), Math.round(size * 0.84), {
        fit: "contain",
        background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 0 },
      })
      .png()
      .toBuffer();
    const selo = await featherEdges(seloRaw, {
      topPx: 20,
      bottomPx: 20,
      leftPx: 20,
      rightPx: 20,
    });

    const out = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 1 },
      },
    })
      .composite([{ input: selo, gravity: "center" }])
      .flatten({ background: bgRgb })
      .png()
      .toBuffer();

    return {
      buffer: out,
      fixtureNome: "docs/referencias/ia-aprovada/capa-classica.jpg",
      width: size,
      height: size,
    };
  }

  const refLogo = loadApprovedRef("logo.jpg");
  let pipeline = sharp(refLogo);
  if (r === 3) {
    pipeline = pipeline.modulate({ saturation: 1.15, brightness: 0.96, hue: -6 });
  }
  const modLogo = await pipeline.png().toBuffer();
  const bgRgb = await sampleEdgeRgb(modLogo, 12, 12);
  const scaledRaw = await sharp(modLogo)
    .resize(Math.round(size * 0.9), Math.round(size * 0.9), {
      fit: "contain",
      background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 0 },
    })
    .png()
    .toBuffer();
  const scaled = await featherEdges(scaledRaw, {
    topPx: 20,
    bottomPx: 20,
    leftPx: 20,
    rightPx: 20,
  });

  const out = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 1 },
    },
  })
    .composite([{ input: scaled, gravity: "center" }])
    .flatten({ background: bgRgb })
    .png()
    .toBuffer();

  return {
    buffer: out,
    fixtureNome: "docs/referencias/ia-aprovada/logo.jpg",
    width: size,
    height: size,
  };
}

/**
 * Gera uma foto de perfil 1:1 (avatar) extraída diretamente do emblema da referência de logótipo,
 * centrada com margem circular generosa para leitura perfeita a 40×40 px.
 */
async function generateAvatarFromEmblemRef(
  rede: RedeSocialConfig,
  estiloVisual: "moderno" | "classico",
  contexto?: ImagemContexto
): Promise<{ buffer: Buffer; fixtureNome: string }> {
  const target = rede.widthPx;
  const refBuf = contexto?.logotipoReferencia;
  const isCustomRef =
    refBuf &&
    refBuf.length > 0 &&
    !isDefaultFornoBrand(contexto?.nome) &&
    !(await isImageMostlySameAsRef(refBuf, "logo.jpg"));

  // Cor de fundo coerente e opaca com alto contraste para 40 px
  let bgHex =
    estiloVisual === "moderno"
      ? contexto?.paleta?.tinta.hex || "#25120B"
      : contexto?.paleta?.papel.hex || "#FAF3E1";
  let fixtureNome =
    estiloVisual === "moderno"
      ? "docs/referencias/ia-aprovada/capa-moderna.jpg"
      : "docs/referencias/ia-aprovada/logo.jpg";

  let emblemCrop: Buffer;

  if (isCustomRef && refBuf) {
    fixtureNome = "referencia-cliente";
    const meta = await sharp(refBuf).metadata();
    const rw = meta.width || 400;
    const rh = meta.height || 400;
    const rawTrim = await sharp(refBuf).ensureAlpha().toBuffer();

    // Se o logótipo for empilhado (alto) extrai a metade superior (zona do emblema);
    // se for horizontal extrai o lado esquerdo provável do símbolo
    if (rh >= rw * 0.9 && rh > 220) {
      emblemCrop = await sharp(rawTrim)
        .extract({
          left: Math.round(rw * 0.08),
          top: Math.round(rh * 0.05),
          width: Math.max(40, Math.round(rw * 0.84)),
          height: Math.max(40, Math.round(rh * 0.48)),
        })
        .png()
        .toBuffer();
    } else if (rw > rh * 1.55) {
      emblemCrop = await sharp(rawTrim)
        .extract({
          left: Math.round(rw * 0.02),
          top: Math.round(rh * 0.04),
          width: Math.max(40, Math.round(rw * 0.44)),
          height: Math.max(40, Math.round(rh * 0.92)),
        })
        .png()
        .toBuffer();
    } else {
      emblemCrop = rawTrim;
    }

    emblemCrop = await removeUniformMarginFloodFill(emblemCrop);
    bgHex = estiloVisual === "moderno" ? "#1E1A17" : "#FAF7F2";
  } else if (estiloVisual === "moderno") {
    const capMod = loadApprovedRef("capa-moderna.jpg");
    // Extrai o emblema centrado exatamente em x=334 (x 112..556, y 24..298) e suaviza as bordas
    const rawEmblem = await sharp(capMod)
      .extract({ left: 112, top: 24, width: 444, height: 274 })
      .png()
      .toBuffer();
    emblemCrop = await featherEdges(rawEmblem, {
      topPx: 20,
      bottomPx: 20,
      leftPx: 24,
      rightPx: 24,
    });
    const edge = await sampleEdgeRgb(capMod, 14, 14);
    bgHex = `#${edge.r.toString(16).padStart(2, "0")}${edge.g
      .toString(16)
      .padStart(2, "0")}${edge.b.toString(16).padStart(2, "0")}`;
  } else {
    const refLogo = loadApprovedRef("logo.jpg");
    const rawEmblem = await sharp(refLogo)
      .extract({ left: 104, top: 82, width: 816, height: 392 })
      .png()
      .toBuffer();
    emblemCrop = await featherEdges(rawEmblem, {
      topPx: 20,
      bottomPx: 20,
      leftPx: 24,
      rightPx: 24,
    });
    const edge = await sampleEdgeRgb(refLogo, 12, 12);
    bgHex = `#${edge.r.toString(16).padStart(2, "0")}${edge.g
      .toString(16)
      .padStart(2, "0")}${edge.b.toString(16).padStart(2, "0")}`;
  }

  const bgRgb = hexToRgb(bgHex);
  // 64% no emblema centrado preserva ampla margem nos cantos fora do círculo e leitura clara a 40 px
  const innerSize = Math.max(64, Math.round(target * 0.64));
  const scaledEmblem = await sharp(emblemCrop)
    .resize(innerSize, innerSize, {
      fit: "contain",
      background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 0 },
    })
    .png()
    .toBuffer();

  const finalBuf = await sharp({
    create: {
      width: target,
      height: target,
      channels: 4,
      background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 1 },
    },
  })
    .composite([{ input: scaledEmblem, gravity: "center" }])
    .flatten({ background: bgRgb })
    .png()
    .toBuffer();

  return { buffer: finalBuf, fixtureNome };
}

/**
 * Gera qualquer peça visual de capa, publicação (1:1 / 4:5) ou Story (9:16)
 * a partir exclusivamente de `docs/referencias/ia-aprovada/` e da referência de logótipo,
 * mantendo as zonas seguras (computador, telemóvel, sobreposição de avatar, 250 px no Story e 1546×423 no YouTube).
 */
async function generateSocialArtworkFromApprovedRefs(
  rede: RedeSocialConfig,
  estiloVisual: "moderno" | "classico",
  contexto?: ImagemContexto
): Promise<{ buffer: Buffer; fixtureNome: string; adapted: boolean }> {
  const W = rede.widthPx;
  const H = rede.heightPx;
  const masterName = estiloVisual === "moderno" ? "capa-moderna.jpg" : "capa-classica.jpg";
  const masterBuf = loadApprovedRef(masterName);

  const overlays: OverlayOptions[] = [];

  // Amostra exata da superfície base da referência aprovada para fusão sem costuras
  const baseRgb = await sampleEdgeRgb(masterBuf, 14, 14);

  // Caso especial 1: Instagram Story (1080×1920) -> 250 px topo e 250 px base rigorosamente livres
  if (rede.id === "ig-story") {
    const safeTop = (rede.margemTopoPx || 250) + 28;
    const safeBottom = H - (rede.margemBasePx || 250) - 28;
    const safeH = safeBottom - safeTop;
    const safeW = W - 144;

    if (estiloVisual === "moderno") {
      // Topo dentro da zona segura: foto editorial em arco com transição suave para o fundo espresso
      const archRaw = await sharp(masterBuf)
        .extract({ left: 604, top: 0, width: 676, height: 720 })
        .resize(safeW, Math.round(safeH * 0.5), { fit: "cover", position: "centre" })
        .png()
        .toBuffer();
      const archPhoto = await featherEdges(archRaw, {
        topPx: 28,
        bottomPx: 110,
        leftPx: 28,
        rightPx: 28,
      });

      const brandRaw = await sharp(masterBuf)
        .extract({ left: 68, top: 20, width: 530, height: 670 })
        .resize(safeW, Math.round(safeH * 0.46), {
          fit: "contain",
          background: { r: baseRgb.r, g: baseRgb.g, b: baseRgb.b, alpha: 0 },
        })
        .png()
        .toBuffer();
      const brandCard = await featherEdges(brandRaw, {
        topPx: 32,
        bottomPx: 24,
        leftPx: 28,
        rightPx: 28,
      });

      overlays.push(
        { input: archPhoto, left: 72, top: safeTop },
        { input: brandCard, left: 72, top: safeTop + Math.round(safeH * 0.51) }
      );
    } else {
      const innerRaw = await sharp(masterBuf)
        .extract({ left: 90, top: 48, width: 1100, height: 624 })
        .resize(safeW, Math.round(safeH * 0.72), {
          fit: "contain",
          background: { r: baseRgb.r, g: baseRgb.g, b: baseRgb.b, alpha: 0 },
        })
        .png()
        .toBuffer();
      const innerClassic = await featherEdges(innerRaw, {
        topPx: 20,
        bottomPx: 20,
        leftPx: 20,
        rightPx: 20,
      });
      const verticalShift = safeTop + Math.round((safeH - Math.round(safeH * 0.72)) / 2);
      overlays.push({ input: innerClassic, left: 72, top: verticalShift });
    }
  } else if (rede.id === "ig-publicacao" || rede.id === "ig-publicacao-1080x1350") {
    // Publicação 1:1 (1080×1080) e 4:5 (1080×1350) com transição gradual entre foto e marca
    const comum = getZonaSeguraComum(rede);
    if (estiloVisual === "moderno") {
      const archRaw = await sharp(masterBuf)
        .extract({ left: 604, top: 0, width: 676, height: 720 })
        .resize(comum.width, Math.round(comum.height * 0.49), {
          fit: "cover",
          position: "centre",
        })
        .png()
        .toBuffer();
      const archPhoto = await featherEdges(archRaw, {
        topPx: 24,
        bottomPx: 92,
        leftPx: 24,
        rightPx: 24,
      });

      const brandRaw = await sharp(masterBuf)
        .extract({ left: 68, top: 20, width: 530, height: 670 })
        .resize(comum.width, Math.round(comum.height * 0.47), {
          fit: "contain",
          background: { r: baseRgb.r, g: baseRgb.g, b: baseRgb.b, alpha: 0 },
        })
        .png()
        .toBuffer();
      const brandCard = await featherEdges(brandRaw, {
        topPx: 28,
        bottomPx: 20,
        leftPx: 24,
        rightPx: 24,
      });

      overlays.push(
        { input: archPhoto, left: comum.x, top: comum.y },
        { input: brandCard, left: comum.x, top: comum.y + Math.round(comum.height * 0.5) }
      );
    } else {
      const innerRaw = await sharp(masterBuf)
        .extract({ left: 90, top: 48, width: 1100, height: 624 })
        .resize(comum.width, comum.height, {
          fit: "contain",
          background: { r: baseRgb.r, g: baseRgb.g, b: baseRgb.b, alpha: 0 },
        })
        .png()
        .toBuffer();
      const innerClassic = await featherEdges(innerRaw, {
        topPx: 20,
        bottomPx: 20,
        leftPx: 20,
        rightPx: 20,
      });
      overlays.push({ input: innerClassic, left: comum.x, top: comum.y });
    }
  } else {
    // Capas panorâmicas / YouTube Banner: respeita zona comum + evita sobreposição de avatar inferior esquerda
    const comum = getZonaSeguraComum(rede);
    const minLeft = rede.avatarOverlapDesktop
      ? Math.max(comum.x, rede.avatarOverlapDesktop.x + rede.avatarOverlapDesktop.width + 24)
      : comum.x;
    const safeWidth = Math.max(120, comum.x + comum.width - minLeft);
    const safeHeight = comum.height;

    const srcExtract =
      estiloVisual === "classico"
        ? { left: 140, top: 44, width: 1000, height: 632 }
        : { left: 24, top: 18, width: 1236, height: 684 };

    const fitHeroRaw = await sharp(masterBuf)
      .extract(srcExtract)
      .resize(safeWidth, safeHeight, {
        fit: "contain",
        background: { r: baseRgb.r, g: baseRgb.g, b: baseRgb.b, alpha: 0 },
      })
      .png()
      .toBuffer();

    const fitHero = await featherEdges(fitHeroRaw, {
      topPx: 18,
      bottomPx: 18,
      leftPx: 28,
      rightPx: 20,
    });

    overlays.push({ input: fitHero, left: minLeft, top: comum.y });
  }

  let adapted = false;

  // Para outras marcas (ou logótipo carregado na Entrada B diferente de Forno da Vilariça):
  // integra visualmente o logótipo real na área segura para coerência imediata em modo falso
  const refBuf = contexto?.logotipoReferencia;
  const isCustomBrand =
    !isDefaultFornoBrand(contexto?.nome) &&
    Boolean(refBuf && refBuf.length > 0) &&
    !(await isImageMostlySameAsRef(refBuf!, "logo.jpg"));

  if (isCustomBrand && refBuf) {
    adapted = true;
    const comum = getZonaSeguraComum(rede);
    const minLeft = rede.avatarOverlapDesktop
      ? Math.max(comum.x, rede.avatarOverlapDesktop.x + rede.avatarOverlapDesktop.width + 28)
      : comum.x;
    const badgeW = Math.min(Math.round(comum.width * 0.36), 340);
    const badgeH = Math.min(Math.round(comum.height * 0.42), 180);

    try {
      const cleanRef = await removeUniformMarginFloodFill(refBuf);
      const clientLogoScaled = await sharp(cleanRef)
        .resize(Math.max(48, badgeW - 24), Math.max(48, badgeH - 24), {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png()
        .toBuffer();

      const pillBg =
        estiloVisual === "moderno"
          ? { r: 250, g: 247, b: 242, alpha: 0.94 }
          : { r: 254, g: 246, b: 227, alpha: 0.96 };

      const badgeCard = await sharp({
        create: {
          width: badgeW,
          height: badgeH,
          channels: 4,
          background: pillBg,
        },
      })
        .composite([{ input: clientLogoScaled, gravity: "center" }])
        .png()
        .toBuffer();

      overlays.push({
        input: badgeCard,
        left: minLeft + 16,
        top: Math.max(comum.y + 8, Math.round(comum.y + (comum.height - badgeH) / 2)),
      });
    } catch {
      // ignora caso a referência não seja rasterizável
    }
  }

  // Ajuste de paleta subtil caso o utilizador altere significativamente a cor primária (sem SVG)
  const customPrimary = contexto?.paleta?.primaria?.hex;
  const defaultPrimary = estiloVisual === "moderno" ? "#172E2C" : "#B84A24";
  if (customPrimary && !isDefaultFornoBrand(contexto?.nome)) {
    const a = hexToRgb(customPrimary);
    const b = hexToRgb(defaultPrimary);
    if (Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b) > 65) {
      adapted = true;
      const tintHex = mixHex(customPrimary, estiloVisual === "moderno" ? "#1C1410" : "#FAF6EE", 0.65);
      const tintRgb = hexToRgb(tintHex);
      overlays.push({
        input: await sharp({
          create: {
            width: W,
            height: H,
            channels: 4,
            background: { r: tintRgb.r, g: tintRgb.g, b: tintRgb.b, alpha: 0.16 },
          },
        })
          .png()
          .toBuffer(),
        left: 0,
        top: 0,
      });
    }
  }

  const finalBuf = await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: baseRgb.r, g: baseRgb.g, b: baseRgb.b, alpha: 1 },
    },
  })
    .composite(overlays)
    .flatten({ background: baseRgb })
    .png()
    .toBuffer();

  return {
    buffer: finalBuf,
    fixtureNome: `docs/referencias/ia-aprovada/${masterName}`,
    adapted,
  };
}

/**
 * Fornecedor local em modo falso (teste / demonstração sem custos).
 * Utiliza exclusivamente as referências visuais aprovadas em `docs/referencias/ia-aprovada/`
 * processadas por `sharp` puro (zero SVG de regras).
 */
export class FalsoImagemProvider implements ImagemProvider {
  readonly nome = "falso";
  readonly modo = "falso" as const;

  async gerar(
    _prompt: string,
    formato: ImagemFormato,
    n = 1,
    contexto?: ImagemContexto
  ): Promise<ImagemResultado[]> {
    const count = Math.max(1, Math.min(4, n || 1));

    // 1. Geração de logótipos (Entrada A — rondas 1..3)
    if (
      formato === "logotipo-classico" ||
      formato === "logotipo-moderno" ||
      formato === "logotipo-editorial"
    ) {
      const ronda = Math.max(1, Math.min(3, contexto?.ronda || 1));
      const results: ImagemResultado[] = [];
      for (let i = 0; i < count; i++) {
        const effFormato =
          count === 2 && i === 1 && formato === "logotipo-classico"
            ? "logotipo-moderno"
            : formato;
        const gen = await generateLogoFromApprovedRefs(effFormato, ronda, contexto);
        results.push({
          buffer: gen.buffer,
          mimeType: "image/png",
          width: gen.width,
          height: gen.height,
          origem: ronda === 1 && effFormato === "logotipo-classico" ? "fixture" : "falso-adaptado",
          fixtureNome: gen.fixtureNome,
          custoEur: 0,
          metadata: {
            ronda,
            formato: effFormato,
            tom: contexto?.tom || "tradicional",
            soImagemPura: true,
          },
        });
      }
      return results;
    }

    // Para todas as peças visuais (avatares, capas, publicações, stories),
    // o logótipo escolhido como referência é obrigatório
    if (!contexto?.logotipoReferencia || contexto.logotipoReferencia.length === 0) {
      throw new ImagemProviderError(
        "invalid_input",
        "O logótipo escolhido é obrigatório como imagem de referência para gerar peças visuais."
      );
    }

    const estiloVisual: "moderno" | "classico" = isModernStyle(formato, contexto)
      ? "moderno"
      : "classico";

    // Determinar a configuração da rede social alvo
    let redeId: RedeSocialId = contexto?.redeId || "fb-capa";
    if (!contexto?.redeId) {
      if (formato === "publicacao-instagram") redeId = "ig-publicacao";
      else if (formato === "publicacao-instagram-4x5") redeId = "ig-publicacao-1080x1350";
      else if (formato === "story-instagram") redeId = "ig-story";
      else if (formato === "rede-avatar") redeId = "fb-perfil";
    }
    const redeSpec = getRedeSocialConfig(redeId);

    // 2. Avatares de perfil nascidos do emblema e legíveis em círculo a 40 px
    if (formato === "rede-avatar" || redeSpec.tipoPeca === "perfil") {
      const av = await generateAvatarFromEmblemRef(redeSpec, estiloVisual, contexto);
      return Array.from({ length: count }, () => ({
        buffer: av.buffer,
        mimeType: "image/png" as const,
        width: redeSpec.widthPx,
        height: redeSpec.heightPx,
        origem: "falso-adaptado" as const,
        fixtureNome: av.fixtureNome,
        custoEur: 0,
        metadata: {
          redeId: redeSpec.id,
          estiloVisual,
          nascidoDoEmblema: true,
          referenciaLogoUsada: true,
          tom: contexto?.tom || "tradicional",
        },
      }));
    }

    // 3. Capas, publicações e stories em 2 propostas (moderna em camadas vs clássica)
    const art = await generateSocialArtworkFromApprovedRefs(redeSpec, estiloVisual, contexto);
    return Array.from({ length: count }, () => ({
      buffer: art.buffer,
      mimeType: "image/png" as const,
      width: redeSpec.widthPx,
      height: redeSpec.heightPx,
      origem: art.adapted ? ("falso-adaptado" as const) : ("fixture" as const),
      fixtureNome: art.fixtureNome,
      custoEur: 0,
      metadata: {
        redeId: redeSpec.id,
        estiloVisual,
        referenciaLogoUsada: true,
        aspectRatioGemini: redeSpec.aspectRatioGemini,
        tom: contexto?.tom || "tradicional",
      },
    }));
  }

  async editar(
    imagem: Buffer,
    instrucao: string,
    contexto?: ImagemContexto
  ): Promise<ImagemResultado> {
    const cleanInstr = (instrucao || "").trim().toLowerCase();

    let pipe = sharp(imagem).ensureAlpha();
    if (cleanInstr.includes("modern") || cleanInstr.includes("verde")) {
      const mod = await generateLogoFromApprovedRefs("logotipo-moderno", 2, contexto);
      return {
        buffer: mod.buffer,
        mimeType: "image/png",
        width: mod.width,
        height: mod.height,
        origem: "falso-adaptado",
        fixtureNome: mod.fixtureNome,
        custoEur: 0,
        metadata: { instrucao: instrucao.trim() },
      };
    }

    if (cleanInstr.includes("escur") || cleanInstr.includes("contraste") || cleanInstr.includes("forte")) {
      pipe = pipe.modulate({ brightness: 0.93, saturation: 1.18 }).linear(1.08, -6);
    } else if (cleanInstr.includes("quente") || cleanInstr.includes("dourad") || cleanInstr.includes("trigo")) {
      pipe = pipe.modulate({ hue: 10, saturation: 1.16, brightness: 1.02 });
    } else if (cleanInstr.includes("suav") || cleanInstr.includes("clar") || cleanInstr.includes("minimal")) {
      pipe = pipe.modulate({ saturation: 0.84, brightness: 1.04 });
    } else {
      pipe = pipe.modulate({ hue: -8, saturation: 1.12 });
    }

    const editedBuf = await pipe.png().toBuffer();
    const meta = await sharp(editedBuf).metadata();
    return {
      buffer: editedBuf,
      mimeType: "image/png",
      width: meta.width || 1024,
      height: meta.height || 1024,
      origem: "falso-adaptado",
      custoEur: 0,
      metadata: { instrucao: instrucao.trim() },
    };
  }

  async removerFundo(imagem: Buffer): Promise<ImagemResultado> {
    const cleanPng = await removeUniformMarginFloodFill(imagem);
    const meta = await sharp(cleanPng).metadata();
    return {
      buffer: cleanPng,
      mimeType: "image/png",
      width: meta.width || 1024,
      height: meta.height || 1024,
      origem: "falso-adaptado",
      custoEur: 0,
    };
  }

  /**
   * Vetorização local estritamente opcional (apenas quando ativada para favicon ou impressão).
   */
  async vetorizar(
    imagem: Buffer,
    opcoes?: { maxColors?: number; inkHex?: string }
  ): Promise<VetorResultado> {
    const res = await vetorizarImagemLocal(imagem, {
      maxColors: opcoes?.maxColors || 8,
      inkHex: opcoes?.inkHex || "#2A1810",
    });
    return {
      svg: res.colorSvg,
      simboloSvg: res.simboloSvg,
      simboloNegativoSvg: res.simboloNegativoSvg,
      monocromaticoSvg: res.monocromaticoSvg,
      negativoSvg: res.negativoSvg,
      byteSize: res.byteSize,
      colorsHex: res.colorsHex,
    };
  }
}

export function extractSuggestedPaletteFromColorList(
  colorsHex: string[]
): ReturnType<typeof buildBrandPalette> {
  if (!colorsHex || colorsHex.length === 0) {
    return buildBrandPalette({
      primaria: "#B84A24",
      secundaria: "#D9822B",
      papel: "#FAF6F0",
      tinta: "#2A1810",
    });
  }
  return buildBrandPalette({
    primaria: colorsHex[0] || "#B84A24",
    secundaria: colorsHex[1] || colorsHex[0] || "#D9822B",
    papel: "#FAF6F0",
    tinta: "#2A1810",
  });
}

// Re-export não usado em runtime de produção (apenas compatibilidade se fixtures existirem)
export function hasLegacyFixturesDir(): boolean {
  return fs.existsSync(FIXTURES_DIR);
}
