import fs from "fs";
import path from "path";
import sharp, { type OverlayOptions } from "sharp";
import {
  getRedeSocialConfig,
  resolverHierarquiaInformacaoConfig,
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
  ronda: number
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
 * Versão estendida de featherEdges que aplica também um fator global de opacidade
 * e uma máscara limpa para fundir fotografia/padrões de fundo sobre qualquer paleta.
 */
async function featherAndTintLayer(
  inputPng: Buffer,
  opts: {
    topPx?: number;
    bottomPx?: number;
    leftPx?: number;
    rightPx?: number;
    opacity?: number;
  }
): Promise<Buffer> {
  const { data, info } = await sharp(inputPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const rgba = new Uint8Array(data);
  const topPx = Math.max(0, Math.min(Math.floor(h * 0.48), opts.topPx || 0));
  const bottomPx = Math.max(0, Math.min(Math.floor(h * 0.48), opts.bottomPx || 0));
  const leftPx = Math.max(0, Math.min(Math.floor(w * 0.48), opts.leftPx || 0));
  const rightPx = Math.max(0, Math.min(Math.floor(w * 0.48), opts.rightPx || 0));
  const globalOp = Math.max(0, Math.min(1, opts.opacity ?? 1));

  const smooth = (t: number) => {
    const c = Math.max(0, Math.min(1, t));
    return c * c * (3 - 2 * c);
  };

  for (let y = 0; y < h; y++) {
    let ay = globalOp;
    if (topPx > 0 && y < topPx) ay = Math.min(ay, globalOp * smooth((y + 0.5) / topPx));
    if (bottomPx > 0 && y >= h - bottomPx) {
      ay = Math.min(ay, globalOp * smooth((h - y - 0.5) / bottomPx));
    }

    for (let x = 0; x < w; x++) {
      let ax = ay;
      if (leftPx > 0 && x < leftPx) ax = Math.min(ax, globalOp * smooth((x + 0.5) / leftPx));
      if (rightPx > 0 && x >= w - rightPx) {
        ax = Math.min(ax, globalOp * smooth((w - x - 0.5) / rightPx));
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

/**
 * Gera filetes duplos finos em `sharp` puro (sem SVG) para o estilo Clássico editorial,
 * mantendo luminosidade moderada (`alpha ~ 0.50`) para moldura periférica elegante.
 */
async function makeClassicDoubleBorderOverlays(
  W: number,
  H: number,
  inset: number,
  colorRgb: { r: number; g: number; b: number },
  alpha = 0.5
): Promise<OverlayOptions[]> {
  const lumCol = 0.299 * colorRgb.r + 0.587 * colorRgb.g + 0.114 * colorRgb.b;
  const safeAlpha = Math.max(
    0.16,
    Math.min(alpha, 52 / Math.max(1, Math.abs(244 - lumCol)))
  );
  const gap = Math.max(5, Math.round(inset * 0.35));
  const out: OverlayOptions[] = [];

  const addRectOutline = async (x: number, y: number, w: number, h: number, t: number, a: number) => {
    if (w < 24 || h < 24 || t < 1) return;
    const hStrip = await sharp({
      create: { width: w, height: t, channels: 4, background: { ...colorRgb, alpha: a } },
    })
      .png()
      .toBuffer();
    const vStrip = await sharp({
      create: { width: t, height: Math.max(2, h - t * 2), channels: 4, background: { ...colorRgb, alpha: a } },
    })
      .png()
      .toBuffer();
    out.push(
      { input: hStrip, left: x, top: y },
      { input: hStrip, left: x, top: y + h - t },
      { input: vStrip, left: x, top: y + t },
      { input: vStrip, left: x + w - t, top: y + t }
    );
  };

  await addRectOutline(inset, inset, W - inset * 2, H - inset * 2, 2, safeAlpha);
  await addRectOutline(
    inset + gap,
    inset + gap,
    W - (inset + gap) * 2,
    H - (inset + gap) * 2,
    1,
    safeAlpha * 0.78
  );
  return out;
}

/**
 * Compõe `[Emblema]` + `[Wordmark]` lado a lado **em linha horizontal**,
 * maximizando a área útil de leitura em faixas ultra-largas (LinkedIn 4:1 / 5,9:1 e YouTube 1546×423).
 */
async function composeInlineHorizontalPair(opts: {
  emblemBuf: Buffer;
  wordmarkBuf: Buffer;
  targetW: number;
  targetH: number;
  gapRatio?: number;
  emblemWeight?: number;
  wordmarkWeight?: number;
}): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { targetW, targetH } = opts;
  const gapRatio = opts.gapRatio ?? 0.045;
  const emblemWeight = opts.emblemWeight ?? 0.96;
  const wordmarkWeight = opts.wordmarkWeight ?? 0.82;

  const [eMeta, wMeta] = await Promise.all([
    sharp(opts.emblemBuf).metadata(),
    sharp(opts.wordmarkBuf).metadata(),
  ]);
  const eRatio = (eMeta.width || 1) / Math.max(1, eMeta.height || 1);
  const wRatio = (wMeta.width || 1) / Math.max(1, wMeta.height || 1);

  const hRef = Math.round(targetH * 0.88);
  const eh0 = hRef * emblemWeight;
  const ew0 = eh0 * eRatio;
  const wh0 = hRef * wordmarkWeight;
  const ww0 = wh0 * wRatio;
  const gap0 = Math.max(12, Math.round(targetW * gapRatio));

  const scale = Math.min(1, (targetW * 0.94) / Math.max(1, ew0 + gap0 + ww0));
  const eh = Math.max(24, Math.round(eh0 * scale));
  const ew = Math.max(24, Math.round(ew0 * scale));
  const wh = Math.max(20, Math.round(wh0 * scale));
  const ww = Math.max(24, Math.round(ww0 * scale));
  const gap = Math.max(10, Math.round(gap0 * scale));

  const [eScaledRaw, wScaledRaw] = await Promise.all([
    sharp(opts.emblemBuf)
      .resize(ew, eh, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
    sharp(opts.wordmarkBuf)
      .resize(ww, wh, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
  ]);

  const [eScaled, wScaled] = await Promise.all([
    featherEdges(eScaledRaw, { topPx: 8, bottomPx: 8, leftPx: 10, rightPx: 10 }),
    featherEdges(wScaledRaw, { topPx: 8, bottomPx: 8, leftPx: 10, rightPx: 10 }),
  ]);

  const totalW = ew + gap + ww;
  const startX = Math.max(0, Math.round((targetW - totalW) / 2));
  const eTop = Math.max(0, Math.round((targetH - eh) / 2));
  const wTop = Math.max(0, Math.round((targetH - wh) / 2));

  const canvas = await sharp({
    create: {
      width: targetW,
      height: targetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: eScaled, left: startX, top: eTop },
      { input: wScaled, left: startX + ew + gap, top: wTop },
    ])
    .png()
    .toBuffer();

  return { buffer: canvas, width: targetW, height: targetH };
}

/**
 * Compõe `[Emblema destacado]` + `[Wordmark]` (+ opcional `[Slogan]`) em empilhamento vertical
 * para formatos verticais (Instagram 4:5, 1:1 e Story 9:16), dando protagonismo ao emblema.
 */
async function composeVerticalHighlightedStack(opts: {
  emblemBuf: Buffer;
  wordmarkBuf: Buffer;
  sloganBuf?: Buffer;
  targetW: number;
  targetH: number;
}): Promise<Buffer> {
  const { targetW, targetH, sloganBuf } = opts;
  const hasSlogan = Boolean(sloganBuf);

  const emblemSlotH = Math.round(targetH * (hasSlogan ? 0.49 : 0.56));
  const wordmarkSlotH = Math.round(targetH * (hasSlogan ? 0.34 : 0.38));
  const sloganSlotH = hasSlogan ? Math.round(targetH * 0.1) : 0;

  const emblemScaled = await featherEdges(
    await sharp(opts.emblemBuf)
      .resize(Math.round(targetW * 0.92), emblemSlotH, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer(),
    { topPx: 10, bottomPx: 10, leftPx: 12, rightPx: 12 }
  );

  const wordmarkScaled = await featherEdges(
    await sharp(opts.wordmarkBuf)
      .resize(Math.round(targetW * 0.88), wordmarkSlotH, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer(),
    { topPx: 8, bottomPx: 8, leftPx: 12, rightPx: 12 }
  );

  const eMeta = await sharp(emblemScaled).metadata();
  const wMeta = await sharp(wordmarkScaled).metadata();
  const ew = eMeta.width || targetW;
  const eh = eMeta.height || emblemSlotH;
  const ww = wMeta.width || targetW;
  const wh = wMeta.height || wordmarkSlotH;

  const overlays: OverlayOptions[] = [];
  let cursorY = 0;

  let sScaled: Buffer | null = null;
  let sw = 0;
  let sh = 0;
  if (sloganBuf && sloganSlotH > 18) {
    sScaled = await featherEdges(
      await sharp(sloganBuf)
        .resize(Math.round(targetW * 0.82), sloganSlotH, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer(),
      { topPx: 6, bottomPx: 6, leftPx: 8, rightPx: 8 }
    );
    const sMeta = await sharp(sScaled).metadata();
    sw = sMeta.width || targetW;
    sh = sMeta.height || sloganSlotH;
  }

  const gap1 = Math.max(8, Math.round(targetH * 0.025));
  const gap2 = sScaled ? Math.max(8, Math.round(targetH * 0.025)) : 0;
  const usedH = eh + gap1 + wh + gap2 + sh;
  cursorY = Math.max(0, Math.round((targetH - usedH) / 2));

  overlays.push({
    input: emblemScaled,
    left: Math.max(0, Math.round((targetW - ew) / 2)),
    top: cursorY,
  });
  cursorY += eh + gap1;
  overlays.push({
    input: wordmarkScaled,
    left: Math.max(0, Math.round((targetW - ww) / 2)),
    top: cursorY,
  });
  if (sScaled) {
    cursorY += wh + gap2;
    overlays.push({
      input: sScaled,
      left: Math.max(0, Math.round((targetW - sw) / 2)),
      top: cursorY,
    });
  }

  return sharp({
    create: {
      width: targetW,
      height: targetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(overlays)
    .png()
    .toBuffer();
}

interface ExtractedBrandParts {
  baseRgb: { r: number; g: number; b: number };
  emblem: Buffer;
  wordmark: Buffer;
  sloganCrop?: Buffer;
  wheatLeft?: Buffer;
  wheatRight?: Buffer;
  breadArchScene: Buffer;
  breadSoftScene: Buffer;
  isCustomClientLogo: boolean;
}

const partsCache = new Map<string, Promise<ExtractedBrandParts>>();

function getFornoExtractedParts(estiloVisual: "moderno" | "classico"): Promise<ExtractedBrandParts> {
  const key = `forno-${estiloVisual}`;
  const cached = partsCache.get(key);
  if (cached) return cached;

  const promise = (async (): Promise<ExtractedBrandParts> => {
    const capMod = loadApprovedRef("capa-moderna.jpg");
    const breadArchScene = await sharp(capMod)
      .extract({ left: 602, top: 0, width: 678, height: 720 })
      .png()
      .toBuffer();
    const breadSoftScene = await sharp(capMod)
      .extract({ left: 660, top: 170, width: 620, height: 550 })
      .png()
      .toBuffer();

    if (estiloVisual === "moderno") {
      const baseRgb = await sampleEdgeRgb(capMod, 14, 14);
      const emblem = await sharp(capMod)
        .extract({ left: 72, top: 44, width: 526, height: 268 })
        .png()
        .toBuffer();
      const wordmarkRaw = await sharp(capMod)
        .extract({ left: 72, top: 316, width: 526, height: 234 })
        .png()
        .toBuffer();
      const wordmark = await cleanLowerRightSliver(wordmarkRaw, 492, 126);
      const sloganCrop = await sharp(capMod)
        .extract({ left: 118, top: 604, width: 440, height: 48 })
        .png()
        .toBuffer();

      return {
        baseRgb,
        emblem,
        wordmark,
        sloganCrop,
        breadArchScene,
        breadSoftScene,
        isCustomClientLogo: false,
      };
    }

    const capCls = loadApprovedRef("capa-classica.jpg");
    const baseRgb = await sampleEdgeRgb(capCls, 40, 40);
    const emblem = await sharp(capCls)
      .extract({ left: 368, top: 42, width: 544, height: 264 })
      .png()
      .toBuffer();
    const wordmark = await sharp(capCls)
      .extract({ left: 368, top: 312, width: 550, height: 240 })
      .png()
      .toBuffer();
    const sloganCrop = await sharp(capCls)
      .extract({ left: 375, top: 610, width: 540, height: 52 })
      .png()
      .toBuffer();
    const wheatLeft = await sharp(capCls)
      .extract({ left: 44, top: 120, width: 208, height: 490 })
      .png()
      .toBuffer();
    const wheatRight = await sharp(capCls)
      .extract({ left: 996, top: 120, width: 235, height: 490 })
      .png()
      .toBuffer();

    return {
      baseRgb,
      emblem,
      wordmark,
      sloganCrop,
      wheatLeft,
      wheatRight,
      breadArchScene,
      breadSoftScene,
      isCustomClientLogo: false,
    };
  })();

  partsCache.set(key, promise);
  return promise;
}

/**
 * Prepara partes limpas para uma marca personalizada (Entrada B ou outro nome),
 * separando emblema + palavra se o logótipo for empilhado, sem nunca desenhar
 * texto da marca-exemplo Forno da Vilariça por trás.
 */
async function extractCustomClientParts(
  refBuf: Buffer
): Promise<{
  fullClean: Buffer;
  emblem: Buffer;
  wordmark: Buffer;
  canSplitInline: boolean;
}> {
  const clean = await removeUniformMarginFloodFill(refBuf);
  const { data, info } = await sharp(clean)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 28) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 10;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const cropW = Math.max(24, Math.min(w - left, maxX - minX + 1 + pad * 2));
  const cropH = Math.max(24, Math.min(h - top, maxY - minY + 1 + pad * 2));

  const trimmed =
    cropW < w || cropH < h
      ? await sharp(clean).extract({ left, top, width: cropW, height: cropH }).png().toBuffer()
      : clean;

  // Tenta localizar uma banda horizontal limpa entre 35% e 68% para compor em linha nas faixas
  let splitRow = -1;
  if (cropH >= cropW * 0.72 && cropH > 120) {
    const tInfo = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const yStart = Math.round(cropH * 0.35);
    const yEnd = Math.round(cropH * 0.68);
    let bestRunLen = 0;
    let runStart = -1;
    for (let y = yStart; y <= yEnd; y++) {
      let count = 0;
      for (let x = 0; x < tInfo.info.width; x++) {
        if (tInfo.data[(y * tInfo.info.width + x) * 4 + 3] > 32) count++;
      }
      if (count <= 2) {
        if (runStart < 0) runStart = y;
      } else if (runStart >= 0) {
        const len = y - runStart;
        if (len > bestRunLen) {
          bestRunLen = len;
          splitRow = Math.round((runStart + y) / 2);
        }
        runStart = -1;
      }
    }
    if (runStart >= 0 && yEnd - runStart > bestRunLen) {
      splitRow = Math.round((runStart + yEnd) / 2);
    }
  }

  if (splitRow > 24 && splitRow < cropH - 24) {
    const [emb, word] = await Promise.all([
      sharp(trimmed).extract({ left: 0, top: 0, width: cropW, height: splitRow }).png().toBuffer(),
      sharp(trimmed)
        .extract({ left: 0, top: splitRow, width: cropW, height: cropH - splitRow })
        .png()
        .toBuffer(),
    ]);
    return { fullClean: trimmed, emblem: emb, wordmark: word, canSplitInline: true };
  }

  return {
    fullClean: trimmed,
    emblem: trimmed,
    wordmark: trimmed,
    canSplitInline: false,
  };
}

/**
 * Constrói uma peça visual com composição própria adaptada à proporção de destino,
 * separando em 3 camadas:
 * (a) fundo/textura/ambiente fotográfico (que pode sangrar além da zona segura móvel),
 * (b) informação da marca (logótipo, nome, slogan se couber — estritamente na zona móvel),
 * (c) áreas reservadas a foto de perfil e UI da rede social.
 */
async function generateSocialArtworkFromApprovedRefs(
  rede: RedeSocialConfig,
  estiloVisual: "moderno" | "classico",
  contexto?: ImagemContexto
): Promise<{ buffer: Buffer; fixtureNome: string; adapted: boolean }> {
  const W = rede.widthPx;
  const H = rede.heightPx;
  const disposicao = rede.composicao.disposicao;
  const masterName = estiloVisual === "moderno" ? "capa-moderna.jpg" : "capa-classica.jpg";

  const fornoParts = await getFornoExtractedParts(estiloVisual);
  const baseRgb = fornoParts.baseRgb;

  const refBuf = contexto?.logotipoReferencia;
  const isCustomBrand =
    !isDefaultFornoBrand(contexto?.nome) &&
    Boolean(refBuf && refBuf.length > 0) &&
    !(await isImageMostlySameAsRef(refBuf!, "logo.jpg"));

  const hierarquia = resolverHierarquiaInformacaoConfig(
    {
      nome: contexto?.nome || "Forno da Vilariça",
      slogan: contexto?.slogan,
      sector: contexto?.sector,
      website: undefined,
    } as { nome?: string; slogan?: string; website?: string },
    rede
  );

  // Paleta cromática ligeiramente ajustada se marca personalizada tiver cor distinta
  let canvasBgRgb = { ...baseRgb };
  const overlays: OverlayOptions[] = [];
  let adapted = isCustomBrand;

  const borderColorRgb =
    estiloVisual === "moderno"
      ? { r: 217, g: 130, b: 43 }
      : contexto?.paleta?.primaria
      ? hexToRgb(contexto.paleta.primaria.hex)
      : { r: 184, g: 74, b: 36 };

  if (isCustomBrand && contexto?.paleta) {
    canvasBgRgb =
      estiloVisual === "moderno"
        ? hexToRgb(mixHex(contexto.paleta.tinta.hex, "#1D130E", 0.55))
        : hexToRgb(mixHex(contexto.paleta.papel.hex, "#FFF6E8", 0.72));
  }

  const mob = rede.safeZoneMobile;
  const deskMobAvatarRight = Math.max(
    rede.avatarOverlapDesktop ? rede.avatarOverlapDesktop.x + rede.avatarOverlapDesktop.width + 18 : 0,
    rede.avatarOverlapMobile ? rede.avatarOverlapMobile.x + rede.avatarOverlapMobile.width + 18 : 0
  );

  // Prepara bloco informativo adaptado (Forno da Vilariça vs marca externa Entrada B)
  const customParts =
    isCustomBrand && refBuf ? await extractCustomClientParts(refBuf) : null;

  const placeBrandInfoInBox = async (
    box: { x: number; y: number; width: number; height: number },
    mode: "inline" | "stack" | "stack-compact" | "vertical-highlighted"
  ) => {
    if (customParts) {
      // Renderiza logótipo do cliente num cartão coerente de contraste dentro da área segura
      const pillBg =
        estiloVisual === "moderno"
          ? { r: 250, g: 247, b: 242, alpha: 0.95 }
          : { r: 255, g: 249, b: 238, alpha: 0.96 };

      let innerLogo: Buffer;
      if (mode === "inline" && customParts.canSplitInline) {
        const inline = await composeInlineHorizontalPair({
          emblemBuf: customParts.emblem,
          wordmarkBuf: customParts.wordmark,
          targetW: Math.max(80, box.width - 28),
          targetH: Math.max(48, box.height - 20),
        });
        innerLogo = inline.buffer;
      } else {
        innerLogo = await sharp(customParts.fullClean)
          .resize(Math.max(48, box.width - 28), Math.max(48, box.height - 24), {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();
      }

      const cardW = box.width;
      const cardH = box.height;
      const card = await sharp({
        create: { width: cardW, height: cardH, channels: 4, background: pillBg },
      })
        .composite([{ input: innerLogo, gravity: "center" }])
        .png()
        .toBuffer();
      overlays.push({ input: card, left: box.x, top: box.y });
      return;
    }

    if (mode === "inline") {
      const inline = await composeInlineHorizontalPair({
        emblemBuf: fornoParts.emblem,
        wordmarkBuf: fornoParts.wordmark,
        targetW: box.width,
        targetH: box.height,
        gapRatio: W / Math.max(1, H) >= 5 ? 0.04 : 0.05,
      });
      overlays.push({ input: inline.buffer, left: box.x, top: box.y });
      return;
    }

    if (mode === "vertical-highlighted") {
      const stack = await composeVerticalHighlightedStack({
        emblemBuf: fornoParts.emblem,
        wordmarkBuf: fornoParts.wordmark,
        sloganBuf: hierarquia.incluirSlogan ? fornoParts.sloganCrop : undefined,
        targetW: box.width,
        targetH: box.height,
      });
      overlays.push({ input: stack, left: box.x, top: box.y });
      return;
    }

    // `stack` ou `stack-compact`: emblema + wordmark (+ slogan só se mode === "stack" e incluirSlogan)
    const stack = await composeVerticalHighlightedStack({
      emblemBuf: fornoParts.emblem,
      wordmarkBuf: fornoParts.wordmark,
      sloganBuf:
        mode === "stack" && hierarquia.incluirSlogan ? fornoParts.sloganCrop : undefined,
      targetW: box.width,
      targetH: box.height,
    });
    overlays.push({ input: stack, left: box.x, top: box.y });
  };

  // =========================================================================
  // DISPOSIÇÃO 1: FAIXAS ULTRA-LARGAS (LinkedIn Pessoal 4:1, Empresa 5,9:1, YouTube 1546×423)
  // Regra: logótipo + nome EM LINHA HORIZONTAL, sem slogan nem contactos; fundo sangra fora da zona móvel
  // =========================================================================
  if (disposicao === "faixa-ultra-larga") {
    adapted = true;
    const isYt = rede.id === "yt-banner";
    const infoLeft = isYt ? mob.x + 48 : Math.max(mob.x + 20, deskMobAvatarRight + 10);
    const infoRight = mob.x + mob.width - (estiloVisual === "classico" && !isYt ? 96 : 36);
    const infoTop = mob.y + Math.max(10, Math.round(mob.height * 0.08));
    const infoHeight = Math.max(80, mob.height - Math.max(20, Math.round(mob.height * 0.16)));
    const infoWidth = Math.max(240, infoRight - infoLeft);

    if (estiloVisual === "moderno") {
      if (isYt) {
        // TV & Desktop wings (2560×1440): fotografia atmosférica suave em volta da faixa central 1546×423
        const tvBackdrop = await featherAndTintLayer(
          await sharp(fornoParts.breadArchScene)
            .resize(W, H, { fit: "cover", position: "centre" })
            .blur(1.1)
            .png()
            .toBuffer(),
          { topPx: 80, bottomPx: 80, leftPx: 140, rightPx: 140, opacity: 0.42 }
        );
        // Faixa central de monitor (2560×423) com arco/pão suave nas laterais de computador
        const rightWingW = W - (mob.x + mob.width) + 220;
        const rightWing = await featherAndTintLayer(
          await sharp(fornoParts.breadArchScene)
            .resize(rightWingW, mob.height, { fit: "cover", position: "centre" })
            .blur(0.75)
            .png()
            .toBuffer(),
          { leftPx: 160, topPx: 28, bottomPx: 28, opacity: 0.85 }
        );
        const leftWingW = mob.x + 120;
        const leftWing = await featherAndTintLayer(
          await sharp(fornoParts.breadSoftScene)
            .resize(leftWingW, mob.height, { fit: "cover", position: "centre" })
            .blur(1.15)
            .png()
            .toBuffer(),
          { rightPx: 140, topPx: 28, bottomPx: 28, opacity: 0.46 }
        );
        // Faixa calma central atrás da informação dentro de 1546×423
        const safePlate = await featherAndTintLayer(
          await sharp({
            create: {
              width: mob.width - 36,
              height: mob.height - 20,
              channels: 4,
              background: { ...canvasBgRgb, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
          { leftPx: 90, rightPx: 90, topPx: 24, bottomPx: 24, opacity: 0.92 }
        );

        overlays.push(
          { input: tvBackdrop, left: 0, top: 0 },
          { input: leftWing, left: 0, top: mob.y },
          { input: rightWing, left: W - rightWingW, top: mob.y },
          { input: safePlate, left: mob.x + 18, top: mob.y + 10 }
        );
      } else {
        // LinkedIn 4:1 / 5,9:1: lado direito com arco + pão a sangrar até W, lado esquerdo ambiente calmo
        const rightEdgeW = Math.max(180, W - (mob.x + mob.width) + Math.round(W * 0.14));
        const rightScene = await featherAndTintLayer(
          await sharp(fornoParts.breadArchScene)
            .resize(rightEdgeW, H, { fit: "cover", position: "centre" })
            .blur(0.7)
            .png()
            .toBuffer(),
          { leftPx: Math.min(180, Math.round(rightEdgeW * 0.65)), opacity: 0.9 }
        );
        const leftBleedW = Math.max(140, Math.round(mob.x * 0.92));
        const leftBleed = await featherAndTintLayer(
          await sharp(fornoParts.breadSoftScene)
            .resize(leftBleedW, H, { fit: "cover", position: "centre" })
            .blur(1.25)
            .png()
            .toBuffer(),
          { rightPx: Math.round(leftBleedW * 0.45), bottomPx: Math.round(H * 0.35), opacity: 0.32 }
        );
        overlays.push(
          { input: leftBleed, left: 0, top: 0 },
          { input: rightScene, left: W - rightEdgeW, top: 0 }
        );
      }

      await placeBrandInfoInBox(
        { x: infoLeft, y: infoTop, width: infoWidth, height: infoHeight },
        "inline"
      );
    } else {
      // CLÁSSICO ultra-largo: pergaminho quente + luz dourada suave a sangrar fora da zona móvel + moldura dupla
      if (isYt) {
        const warmTvWash = await featherAndTintLayer(
          await sharp(fornoParts.breadSoftScene)
            .resize(W, H, { fit: "cover", position: "centre" })
            .modulate({ brightness: 1.25, saturation: 0.72 })
            .blur(1.5)
            .png()
            .toBuffer(),
          { topPx: 80, bottomPx: 80, leftPx: 120, rightPx: 120, opacity: 0.18 }
        );
        const centerCream = await featherAndTintLayer(
          await sharp({
            create: {
              width: mob.width + 80,
              height: mob.height + 36,
              channels: 4,
              background: { ...canvasBgRgb, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
          { leftPx: 90, rightPx: 90, topPx: 30, bottomPx: 30, opacity: 0.95 }
        );
        overlays.push(
          { input: warmTvWash, left: 0, top: 0 },
          { input: centerCream, left: Math.max(0, mob.x - 40), top: Math.max(0, mob.y - 18) }
        );
      } else {
        const warmSide = await featherAndTintLayer(
          await sharp(fornoParts.breadSoftScene)
            .resize(Math.round(W * 0.28), H, { fit: "cover", position: "centre" })
            .modulate({ brightness: 1.28, saturation: 0.75 })
            .blur(1.4)
            .png()
            .toBuffer(),
          { leftPx: Math.round(W * 0.14), opacity: 0.2 }
        );
        overlays.push({ input: warmSide, left: W - Math.round(W * 0.28), top: 0 });
      }

      const borderInset = isYt ? 44 : Math.max(12, Math.round(H * 0.06));
      overlays.push(
        ...(await makeClassicDoubleBorderOverlays(W, H, borderInset, borderColorRgb, 0.5))
      );

      // Ornamento de espiga clássica à direita estritamente dentro da zona móvel
      if (fornoParts.wheatRight && !isCustomBrand && H >= 190) {
        const sprigH = Math.max(80, Math.round(infoHeight * 0.92));
        const sprigW = Math.max(36, Math.round(sprigH * 0.45));
        const sprigScaled = await featherEdges(
          await sharp(fornoParts.wheatRight)
            .resize(sprigW, sprigH, {
              fit: "contain",
              background: { ...canvasBgRgb, alpha: 0 },
            })
            .png()
            .toBuffer(),
          { topPx: 6, bottomPx: 6, leftPx: 6, rightPx: 6 }
        );
        overlays.push({
          input: sprigScaled,
          left: Math.min(mob.x + mob.width - sprigW - 14, infoLeft + infoWidth + 10),
          top: Math.round(infoTop + (infoHeight - sprigH) / 2),
        });
      }

      await placeBrandInfoInBox(
        { x: infoLeft, y: infoTop, width: infoWidth, height: infoHeight },
        "inline"
      );
    }

    const finalBuf = await sharp({
      create: { width: W, height: H, channels: 4, background: { ...canvasBgRgb, alpha: 1 } },
    })
      .composite(overlays)
      .flatten({ background: canvasBgRgb })
      .png()
      .toBuffer();

    return { buffer: finalBuf, fixtureNome: `docs/referencias/ia-aprovada/${masterName}`, adapted };
  }

  // =========================================================================
  // DISPOSIÇÃO 2: HORIZONTAL BIPARTIDA (Facebook 1640×624 e X 1500×500)
  // Regra: informação à esquerda na zona segura móvel acima/à direita dos avatares + imagem à direita a sangrar
  // =========================================================================
  if (disposicao === "horizontal-bipartida") {
    adapted = true;
    const infoLeft = Math.max(mob.x + 22, deskMobAvatarRight + 10);
    const splitX = Math.round(mob.x + mob.width * 0.625);
    const infoWidth = Math.max(260, splitX - infoLeft - 14);
    const infoTop = mob.y + Math.max(14, Math.round(mob.height * 0.04));
    const infoHeight = Math.max(200, mob.height - Math.max(28, Math.round(mob.height * 0.08)));

    const rightSceneStart = splitX - 18;
    const rightSceneW = W - rightSceneStart;

    if (estiloVisual === "moderno") {
      // Ambiente esquerdo acima do avatar a sangrar para a borda esquerda de computador
      const leftTopBleedW = Math.max(120, Math.round(mob.x * 0.96));
      const leftTopBleedH = Math.max(120, (rede.avatarOverlapDesktop?.y || Math.round(H * 0.6)) - 20);
      const leftBleed = await featherAndTintLayer(
        await sharp(fornoParts.breadSoftScene)
          .resize(leftTopBleedW, leftTopBleedH, { fit: "cover", position: "centre" })
          .blur(1.25)
          .png()
          .toBuffer(),
        { rightPx: 48, bottomPx: 64, opacity: 0.34 }
      );

      // Fotografia editorial hero com arco terracota do centro-direita até à borda W
      const heroRight = await featherAndTintLayer(
        await sharp(fornoParts.breadArchScene)
          .resize(rightSceneW, H, { fit: "cover", position: "centre" })
          .png()
          .toBuffer(),
        { leftPx: Math.min(180, Math.round(rightSceneW * 0.28)), opacity: 1 }
      );

      overlays.push(
        { input: leftBleed, left: 0, top: 0 },
        { input: heroRight, left: rightSceneStart, top: 0 }
      );
    } else {
      // Clássico bipartido: pão dourado luminoso à direita fundido em pergaminho + espiga + filetes duplos
      const heroRightClassic = await featherAndTintLayer(
        await sharp(fornoParts.breadSoftScene)
          .resize(rightSceneW, H, { fit: "cover", position: "centre" })
          .modulate({ brightness: 1.16, saturation: 0.9 })
          .png()
          .toBuffer(),
        { leftPx: Math.min(180, Math.round(rightSceneW * 0.34)), opacity: 0.72 }
      );
      overlays.push({ input: heroRightClassic, left: rightSceneStart, top: 0 });
      overlays.push(
        ...(await makeClassicDoubleBorderOverlays(W, H, Math.round(H * 0.032), borderColorRgb, 0.5))
      );
    }

    await placeBrandInfoInBox(
      { x: infoLeft, y: infoTop, width: infoWidth, height: infoHeight },
      "stack"
    );

    const finalBuf = await sharp({
      create: { width: W, height: H, channels: 4, background: { ...canvasBgRgb, alpha: 1 } },
    })
      .composite(overlays)
      .flatten({ background: canvasBgRgb })
      .png()
      .toBuffer();

    return { buffer: finalBuf, fixtureNome: `docs/referencias/ia-aprovada/${masterName}`, adapted };
  }

  // =========================================================================
  // DISPOSIÇÃO 3: GOOGLE PERFIL DE EMPRESA (1024×576 — mais imagem, menos texto)
  // Regra: >= 65% fotografia protagonista a sangrar; bloco compacto emblema + nome (sem slogan/contactos)
  // =========================================================================
  if (disposicao === "imagem-destaque-min-texto") {
    adapted = true;
    const photoLeft = Math.round(W * 0.22);
    const photoW = W - photoLeft;

    if (estiloVisual === "moderno") {
      const hero = await featherAndTintLayer(
        await sharp(fornoParts.breadArchScene)
          .resize(photoW, H, { fit: "cover", position: "centre" })
          .png()
          .toBuffer(),
        { leftPx: Math.min(260, Math.round(photoW * 0.36)), opacity: 1 }
      );
      overlays.push({ input: hero, left: photoLeft, top: 0 });
    } else {
      const heroClassic = await featherAndTintLayer(
        await sharp(fornoParts.breadSoftScene)
          .resize(photoW, H, { fit: "cover", position: "centre" })
          .modulate({ brightness: 1.14, saturation: 0.92 })
          .png()
          .toBuffer(),
        { leftPx: Math.min(260, Math.round(photoW * 0.38)), opacity: 0.86 }
      );
      overlays.push({ input: heroClassic, left: photoLeft, top: 0 });
      overlays.push(...(await makeClassicDoubleBorderOverlays(W, H, 18, borderColorRgb, 0.48)));
    }

    // Compacto à esquerda estritamente dentro de safeZoneMobile (sem slogan nem contactos)
    const boxW = Math.round(W * 0.28);
    const boxH = Math.round(H * 0.56);
    await placeBrandInfoInBox(
      {
        x: mob.x + 16,
        y: Math.round(mob.y + (mob.height - boxH) / 2),
        width: boxW,
        height: boxH,
      },
      "stack-compact"
    );

    const finalBuf = await sharp({
      create: { width: W, height: H, channels: 4, background: { ...canvasBgRgb, alpha: 1 } },
    })
      .composite(overlays)
      .flatten({ background: canvasBgRgb })
      .png()
      .toBuffer();

    return { buffer: finalBuf, fixtureNome: `docs/referencias/ia-aprovada/${masterName}`, adapted };
  }

  // =========================================================================
  // DISPOSIÇÃO 4 & 5: VERTICAL FEED (Instagram 4:5 e 1:1) e STORY (9:16 com 250 px topo/base livres)
  // Regra: composição vertical, logótipo mais destacado; Story com margens topo/base UI livres
  // =========================================================================
  adapted = true;
  if (disposicao === "vertical-story") {
    const safeTop = (rede.margemTopoPx || 250) + 20;
    const safeBottom = H - (rede.margemBasePx || 250) - 20;
    const safeH = safeBottom - safeTop;

    // Camada (a) Fundo atmosférico calmo nas faixas de 250 px topo e base + laterais
    const ambientStoryBg = await featherAndTintLayer(
      await sharp(fornoParts.breadSoftScene)
        .resize(W, H, { fit: "cover", position: "centre" })
        .modulate(estiloVisual === "classico" ? { brightness: 1.24, saturation: 0.72 } : { brightness: 0.75 })
        .blur(1.45)
        .png()
        .toBuffer(),
      {
        topPx: 140,
        bottomPx: 140,
        leftPx: 60,
        rightPx: 60,
        opacity: estiloVisual === "moderno" ? 0.28 : 0.16,
      }
    );
    overlays.push({ input: ambientStoryBg, left: 0, top: 0 });

    if (estiloVisual === "classico") {
      overlays.push(...(await makeClassicDoubleBorderOverlays(W, H, 28, borderColorRgb, 0.45)));
    }

    // Metade superior dentro da zona segura do Story: fotografia hero apetitosa (y 270..920)
    const photoH = Math.round(safeH * 0.45);
    const photoBand = await featherAndTintLayer(
      await sharp(estiloVisual === "moderno" ? fornoParts.breadArchScene : fornoParts.breadSoftScene)
        .resize(mob.width, photoH, { fit: "cover", position: "centre" })
        .modulate(estiloVisual === "classico" ? { brightness: 1.12, saturation: 0.92 } : {})
        .png()
        .toBuffer(),
      { topPx: 28, bottomPx: 120, leftPx: 32, rightPx: 32, opacity: estiloVisual === "classico" ? 0.84 : 1 }
    );
    overlays.push({ input: photoBand, left: mob.x, top: safeTop });

    // Metade inferior dentro da zona segura: emblema em destaque + wordmark + slogan
    const infoTop = safeTop + photoH + 14;
    const infoH = Math.max(320, safeBottom - infoTop - 8);
    await placeBrandInfoInBox(
      { x: mob.x + 24, y: infoTop, width: mob.width - 48, height: infoH },
      "vertical-highlighted"
    );

    const finalBuf = await sharp({
      create: { width: W, height: H, channels: 4, background: { ...canvasBgRgb, alpha: 1 } },
    })
      .composite(overlays)
      .flatten({ background: canvasBgRgb })
      .png()
      .toBuffer();

    return { buffer: finalBuf, fixtureNome: `docs/referencias/ia-aprovada/${masterName}`, adapted };
  }

  // DISPOSIÇÃO VERTICAL FEED (Instagram 4:5 1080×1350 & 1:1 1080×1080)
  const is45 = H > W;
  const topPhotoH = Math.round(H * (is45 ? 0.42 : 0.39));

  if (estiloVisual === "moderno") {
    // Suave nas margens extremas acima de `mob.y` para sangrar sem gerar arestas textuais
    const photoTop = await featherAndTintLayer(
      await sharp(fornoParts.breadArchScene)
        .resize(W, topPhotoH, { fit: "cover", position: "centre" })
        .blur(0.45)
        .png()
        .toBuffer(),
      { topPx: Math.round(mob.y * 0.4), bottomPx: Math.round(topPhotoH * 0.36), leftPx: 24, rightPx: 24, opacity: 0.96 }
    );
    overlays.push({ input: photoTop, left: 0, top: 0 });
  } else {
    const photoTopCls = await featherAndTintLayer(
      await sharp(fornoParts.breadSoftScene)
        .resize(W, topPhotoH, { fit: "cover", position: "centre" })
        .modulate({ brightness: 1.18, saturation: 0.85 })
        .blur(0.85)
        .png()
        .toBuffer(),
      { topPx: 40, bottomPx: Math.round(topPhotoH * 0.42), leftPx: 28, rightPx: 28, opacity: 0.42 }
    );
    overlays.push({ input: photoTopCls, left: 0, top: 0 });
    overlays.push(...(await makeClassicDoubleBorderOverlays(W, H, 26, borderColorRgb, 0.5)));
  }

  const feedInfoTop = Math.max(mob.y + 12, topPhotoH - Math.round(H * 0.04));
  const feedInfoH = Math.max(300, mob.y + mob.height - feedInfoTop - 16);

  // Nos clássicos verticais, adornos de espiga simétricos estritamente dentro da zona móvel
  if (estiloVisual === "classico" && !isCustomBrand && fornoParts.wheatLeft && fornoParts.wheatRight) {
    const sprigH = Math.round(feedInfoH * 0.58);
    const sprigW = Math.round(sprigH * 0.42);
    const [wL, wR] = await Promise.all([
      featherEdges(
        await sharp(fornoParts.wheatLeft)
          .resize(sprigW, sprigH, { fit: "contain", background: { ...canvasBgRgb, alpha: 0 } })
          .png()
          .toBuffer(),
        { topPx: 8, bottomPx: 8, leftPx: 8, rightPx: 8 }
      ),
      featherEdges(
        await sharp(fornoParts.wheatRight)
          .resize(sprigW, sprigH, { fit: "contain", background: { ...canvasBgRgb, alpha: 0 } })
          .png()
          .toBuffer(),
        { topPx: 8, bottomPx: 8, leftPx: 8, rightPx: 8 }
      ),
    ]);
    overlays.push(
      { input: wL, left: mob.x + 12, top: feedInfoTop + 18 },
      { input: wR, left: mob.x + mob.width - sprigW - 12, top: feedInfoTop + 18 }
    );
  }

  await placeBrandInfoInBox(
    {
      x: mob.x + (estiloVisual === "classico" ? 84 : 24),
      y: feedInfoTop,
      width: mob.width - (estiloVisual === "classico" ? 168 : 48),
      height: feedInfoH,
    },
    "vertical-highlighted"
  );

  const finalBuf = await sharp({
    create: { width: W, height: H, channels: 4, background: { ...canvasBgRgb, alpha: 1 } },
  })
    .composite(overlays)
    .flatten({ background: canvasBgRgb })
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
        const gen = await generateLogoFromApprovedRefs(effFormato, ronda);
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
    _contexto?: ImagemContexto
  ): Promise<ImagemResultado> {
    const cleanInstr = (instrucao || "").trim().toLowerCase();

    let pipe = sharp(imagem).ensureAlpha();
    if (cleanInstr.includes("modern") || cleanInstr.includes("verde")) {
      const mod = await generateLogoFromApprovedRefs("logotipo-moderno", 2);
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
