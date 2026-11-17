import fs from "fs";
import path from "path";
import React from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp, { type OverlayOptions } from "sharp";
import {
  getRedeSocialConfig,
  resolverHierarquiaInformacaoConfig,
  type RedeSocialConfig,
  type RedeSocialId,
  type SafeZoneRect,
  type TomDaMarca,
} from "../config/redes-sociais";
import { getSatoriFontsForPair } from "../fonts";
import {
  resolverParTipograficoMarca,
  SECTORS,
  type SectorId,
} from "../formats";
import { buildBrandPalette, contrastRatio, hexToRgb, mixHex, rgbToHex } from "../palette";
import { adaptLogoForDarkSurface } from "../logo-surface";
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

const PT_INITIAL_STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "a",
  "o",
  "as",
  "os",
]);

function extractMonogramInitials(nome: string): string {
  const clean = (nome || "").trim();
  if (!clean) return "PM";

  const words = clean
    .replace(/[^A-Za-zÀ-ÿ0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);

  const significant =
    words.length > 1
      ? words.filter((w) => !PT_INITIAL_STOPWORDS.has(w.toLowerCase()))
      : words;
  const pickWords = significant.length > 0 ? significant : words;

  if (pickWords.length >= 2) {
    return `${pickWords[0][0] || ""}${pickWords[1][0] || ""}`.toUpperCase();
  }

  const single = pickWords[0] || clean;
  const camelCaps = single.slice(1).match(/[A-ZÀ-Ý]/);
  if (camelCaps) {
    return `${single[0]}${camelCaps[0]}`.toUpperCase();
  }
  return single.slice(0, 2).toUpperCase();
}

/**
 * Gera uma proposta de logótipo em modo de demonstração para qualquer marca
 * (sem fugas do ensaio Forno da Vilariça), respeitando a direção (clássica vs moderna),
 * a paleta e o par tipográfico derivado do tom e sector do cliente, sobre fundo branco
 * uniforme para que a remoção de margem automática crie transparência limpa.
 */
async function generateCustomMockLogoForFalso(
  formato: "logotipo-classico" | "logotipo-moderno" | "logotipo-editorial",
  ronda: number,
  contexto?: ImagemContexto
): Promise<{ buffer: Buffer; fixtureNome: string; width: number; height: number }> {
  const size = 1024;
  const r = Math.max(1, Math.min(3, ronda || 1));
  const nome = (contexto?.nome || "Marca Cliente").trim();
  const initials = extractMonogramInitials(nome);
  const sector: SectorId =
    contexto?.sector && contexto.sector in SECTORS ? contexto.sector : "servicos";
  const sectorLabel = SECTORS[sector].rotulo.toUpperCase();

  const pal =
    contexto?.paleta ||
    buildBrandPalette({
      primaria: "#334155",
      secundaria: "#475569",
      papel: "#F8FAFC",
      tinta: "#0F172A",
    });

  const estiloDir = formato === "logotipo-moderno" ? "moderno" : "classico";
  const pairId =
    contexto?.fontPairId ||
    resolverParTipograficoMarca({
      tom: contexto?.tom,
      sector,
      estiloDirecao: estiloDir,
    });
  const { pair, fonts } = getSatoriFontsForPair(pairId);
  const h = React.createElement;

  const badgeInkOnPrim =
    contrastRatio("#FFFFFF", pal.primaria.hex) >= 4.5 ? "#FFFFFF" : pal.papel.hex;
  const badgeInkOnTinta =
    contrastRatio("#FFFFFF", pal.tinta.hex) >= 4.5 ? "#FFFFFF" : pal.papel.hex;

  let el: React.ReactElement;

  if (formato === "logotipo-moderno") {
    // Composição horizontal [Emblema à esquerda] + [48 px livres] + [Nome à direita]
    // Mantém largura > 1,35 × altura após recorte para destacar ícone a 40 px e adaptar em fundos escuros
    const titleSize = nome.length > 20 ? 52 : nome.length > 14 ? 62 : 74;

    const badgeEl =
      r === 2
        ? h(
            "div",
            {
              style: {
                width: "228px",
                height: "228px",
                borderRadius: "114px",
                backgroundColor: pal.primaria.hex,
                border: `8px solid ${pal.secundaria.hex}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              },
            },
            h(
              "div",
              {
                style: {
                  fontFamily: pair.tituloFamily,
                  fontWeight: 800,
                  fontSize: "88px",
                  color: badgeInkOnPrim,
                  letterSpacing: "-0.02em",
                },
              },
              initials
            )
          )
        : r === 3
        ? h(
            "div",
            {
              style: {
                width: "228px",
                height: "228px",
                borderRadius: "36px",
                backgroundColor: pal.tinta.hex,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                flexShrink: 0,
              },
            },
            h("div", {
              style: {
                position: "absolute",
                left: "20px",
                top: "38px",
                bottom: "38px",
                width: "12px",
                borderRadius: "6px",
                backgroundColor: pal.primaria.hex,
              },
            }),
            h(
              "div",
              {
                style: {
                  fontFamily: pair.tituloFamily,
                  fontWeight: 800,
                  fontSize: "86px",
                  color: badgeInkOnTinta,
                  letterSpacing: "-0.02em",
                  marginLeft: "10px",
                },
              },
              initials
            )
          )
        : h(
            "div",
            {
              style: {
                width: "228px",
                height: "228px",
                borderRadius: "48px",
                backgroundColor: pal.primaria.hex,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                flexShrink: 0,
              },
            },
            h("div", {
              style: {
                position: "absolute",
                right: "24px",
                top: "24px",
                width: "28px",
                height: "28px",
                borderRadius: "999px",
                backgroundColor: pal.secundaria.hex,
              },
            }),
            h(
              "div",
              {
                style: {
                  fontFamily: pair.tituloFamily,
                  fontWeight: 800,
                  fontSize: "88px",
                  color: badgeInkOnPrim,
                  letterSpacing: "-0.02em",
                },
              },
              initials
            )
          );

    el = h(
      "div",
      {
        style: {
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: pair.textoFamily,
        },
      },
      h(
        "div",
        {
          style: {
            width: "896px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          },
        },
        badgeEl,
        h("div", { style: { width: "48px", height: "16px", flexShrink: 0 } }),
        h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
              maxWidth: "590px",
            },
          },
          h(
            "div",
            {
              style: {
                fontFamily: pair.tituloFamily,
                fontWeight: 800,
                fontSize: `${titleSize}px`,
                color: pal.tinta.hex,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
              },
            },
            nome
          ),
          h(
            "div",
            {
              style: {
                marginTop: "18px",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "14px",
              },
            },
            h("div", {
              style: {
                width: "44px",
                height: "6px",
                borderRadius: "3px",
                backgroundColor: pal.primaria.hex,
              },
            }),
            h(
              "div",
              {
                style: {
                  fontFamily: pair.textoFamily,
                  fontWeight: 700,
                  fontSize: "19px",
                  letterSpacing: "0.1em",
                  color: pal.primaria.hex,
                },
              },
              sectorLabel
            )
          )
        )
      )
    );
  } else {
    // Composição clássica/editorial empilhada com faixa horizontal limpa de 64 px entre emblema e texto
    // Mantém altura >= largura para separação limpa do ícone no Favicon e Cartão
    const titleSize = nome.length > 18 ? 50 : nome.length > 12 ? 58 : 66;

    const crestEl =
      r === 2
        ? h(
            "div",
            {
              style: {
                width: "260px",
                height: "272px",
                borderRadius: "38px 38px 124px 124px",
                backgroundColor: pal.primaria.hex,
                border: `7px solid ${pal.secundaria.hex}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              },
            },
            h(
              "div",
              {
                style: {
                  fontFamily: pair.tituloFamily,
                  fontWeight: 700,
                  fontSize: "92px",
                  color: badgeInkOnPrim,
                  lineHeight: 1,
                },
              },
              initials
            ),
            h("div", {
              style: {
                marginTop: "12px",
                width: "64px",
                height: "4px",
                borderRadius: "2px",
                backgroundColor: pal.secundaria.hex,
              },
            })
          )
        : r === 3
        ? h(
            "div",
            {
              style: {
                width: "264px",
                height: "264px",
                borderRadius: "132px",
                backgroundColor: pal.tinta.hex,
                border: `8px solid ${pal.secundaria.hex}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              },
            },
            h(
              "div",
              {
                style: {
                  fontFamily: pair.tituloFamily,
                  fontWeight: 700,
                  fontSize: "92px",
                  color: badgeInkOnTinta,
                },
              },
              initials
            )
          )
        : h(
            "div",
            {
              style: {
                width: "268px",
                height: "268px",
                borderRadius: "134px",
                backgroundColor: pal.papel.hex,
                border: `10px solid ${pal.primaria.hex}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px",
              },
            },
            h(
              "div",
              {
                style: {
                  width: "100%",
                  height: "100%",
                  borderRadius: "120px",
                  border: `3px solid ${pal.secundaria.hex}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                },
              },
              h(
                "div",
                {
                  style: {
                    fontFamily: pair.tituloFamily,
                    fontWeight: 700,
                    fontSize: "90px",
                    color: pal.tinta.hex,
                  },
                },
                initials
              )
            )
          );

    el = h(
      "div",
      {
        style: {
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: pair.textoFamily,
        },
      },
      crestEl,
      h("div", { style: { width: "40px", height: "64px" } }),
      h(
        "div",
        {
          style: {
            maxWidth: "440px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          },
        },
        h(
          "div",
          {
            style: {
              fontFamily: pair.tituloFamily,
              fontWeight: 700,
              fontSize: `${titleSize}px`,
              color: pal.tinta.hex,
              lineHeight: 1.08,
              textAlign: "center",
            },
          },
          nome
        ),
        h("div", {
          style: {
            marginTop: "18px",
            width: "108px",
            height: "5px",
            borderRadius: "2.5px",
            backgroundColor: pal.primaria.hex,
          },
        }),
        h(
          "div",
          {
            style: {
              marginTop: "14px",
              fontFamily: pair.textoFamily,
              fontWeight: 600,
              fontSize: "20px",
              letterSpacing: "0.14em",
              color: pal.primaria.hex,
              textAlign: "center",
            },
          },
          sectorLabel
        )
      )
    );
  }

  const svg = await satori(el, { width: size, height: size, fonts });
  const pngBuf = Buffer.from(
    new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng()
  );
  const out = await sharp(pngBuf)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  return {
    buffer: out,
    fixtureNome: `falso-estudio:${formato}`,
    width: size,
    height: size,
  };
}

/**
 * Gera uma proposta de logótipo em modo de demonstração: para o ensaio «Forno da Vilariça»
 * usa as referências aprovadas em `docs/referencias/ia-aprovada/`; para qualquer outra marca
 * sintetiza propostas limpas e exclusivas a partir da paleta e tipografia dessa marca.
 */
async function generateLogoFromApprovedRefs(
  formato: "logotipo-classico" | "logotipo-moderno" | "logotipo-editorial",
  ronda: number,
  contexto?: ImagemContexto
): Promise<{ buffer: Buffer; fixtureNome: string; width: number; height: number }> {
  if (contexto?.nome && !isDefaultFornoBrand(contexto.nome)) {
    return generateCustomMockLogoForFalso(formato, ronda, contexto);
  }

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

async function measureOpaqueStats(pngBuf: Buffer): Promise<{
  meanLum: number;
  brightFraction: number;
  darkFraction: number;
}> {
  const { data, info } = await sharp(pngBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 4000)));
  let count = 0;
  let lumSum = 0;
  let brightCount = 0;
  let darkCount = 0;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] < 80) continue;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      count++;
      lumSum += lum;
      if (lum > 170) brightCount++;
      if (lum < 65) darkCount++;
    }
  }
  if (count === 0) return { meanLum: 128, brightFraction: 0.5, darkFraction: 0.5 };
  return {
    meanLum: lumSum / count,
    brightFraction: brightCount / count,
    darkFraction: darkCount / count,
  };
}

async function buildCenteredStudioHaloBg(
  target: number,
  outerRgb: { r: number; g: number; b: number },
  innerRgb: { r: number; g: number; b: number }
): Promise<Buffer> {
  const dim = Math.max(64, Math.min(200, Math.round(target / 2)));
  const raw = Buffer.alloc(dim * dim * 4);
  const half = (dim - 1) / 2;
  const rInner = 0.27;
  const rOuter = 0.445;
  for (let y = 0; y < dim; y++) {
    const dy = (y - half) / dim;
    for (let x = 0; x < dim; x++) {
      const dx = (x - half) / dim;
      const r = Math.hypot(dx, dy);
      let t = 1;
      if (r <= rInner) {
        t = 0;
      } else if (r < rOuter) {
        const u = (r - rInner) / (rOuter - rInner);
        t = u * u * (3 - 2 * u);
      }
      const idx = (y * dim + x) * 4;
      raw[idx] = Math.round(innerRgb.r * (1 - t) + outerRgb.r * t);
      raw[idx + 1] = Math.round(innerRgb.g * (1 - t) + outerRgb.g * t);
      raw[idx + 2] = Math.round(innerRgb.b * (1 - t) + outerRgb.b * t);
      raw[idx + 3] = 255;
    }
  }
  return sharp(raw, { raw: { width: dim, height: dim, channels: 4 } })
    .resize(target, target, { kernel: sharp.kernel.cubic })
    .png()
    .toBuffer();
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

  let bgHex =
    estiloVisual === "moderno"
      ? contexto?.paleta?.tinta.hex || "#25120B"
      : contexto?.paleta?.papel.hex || "#FAF3E1";
  let fixtureNome =
    estiloVisual === "moderno"
      ? "docs/referencias/ia-aprovada/capa-moderna.jpg"
      : "docs/referencias/ia-aprovada/logo.jpg";

  let emblemCrop: Buffer;
  let customHaloInnerRgb: { r: number; g: number; b: number } | null = null;

  if (isCustomRef && refBuf) {
    fixtureNome = "referencia-cliente";
    const cleaned = await removeUniformMarginFloodFill(refBuf);
    let rawTrim = cleaned;
    try {
      rawTrim = await sharp(cleaned).ensureAlpha().trim({ threshold: 8 }).png().toBuffer();
    } catch {
      rawTrim = cleaned;
    }

    const { data: tData, info: tInfo } = await sharp(rawTrim)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const rw = tInfo.width || 400;
    const rh = tInfo.height || 400;

    if (rw > rh * 1.35) {
      let splitX = Math.min(rw, Math.round(rh * 1.05));
      const minSearchX = Math.round(rw * 0.16);
      const maxSearchX = Math.min(rw - 8, Math.round(rw * 0.65));
      let seenOpaqueLeft = false;
      let gapStart = -1;
      for (let x = minSearchX; x <= maxSearchX; x++) {
        let colOpaque = 0;
        for (let y = 0; y < rh; y++) {
          if (tData[(y * rw + x) * 4 + 3] > 24) colOpaque++;
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
      if (gapStart >= 0 && splitX === Math.min(rw, Math.round(rh * 1.05))) {
        splitX = gapStart;
      }
      const extracted = await sharp(rawTrim)
        .extract({ left: 0, top: 0, width: Math.max(24, splitX), height: rh })
        .png()
        .toBuffer();
      try {
        emblemCrop = await sharp(extracted).ensureAlpha().trim({ threshold: 8 }).png().toBuffer();
      } catch {
        emblemCrop = extracted;
      }
    } else if (rh >= rw * 0.9 && rh > 120) {
      let splitY = -1;
      const minSearchY = Math.round(rh * 0.24);
      const maxSearchY = Math.min(rh - 12, Math.round(rh * 0.68));
      let seenOpaqueTop = false;
      let gapStart = -1;
      for (let y = minSearchY; y <= maxSearchY; y++) {
        let rowOpaque = 0;
        for (let x = Math.round(rw * 0.08); x < Math.round(rw * 0.92); x += 2) {
          if (tData[(y * rw + x) * 4 + 3] > 28) rowOpaque++;
        }
        if (rowOpaque > 3) {
          seenOpaqueTop = true;
          if (gapStart >= 0) {
            splitY = Math.round((gapStart + y) / 2);
            break;
          }
        } else if (seenOpaqueTop && gapStart < 0) {
          gapStart = y;
        }
      }
      if (gapStart >= 0 && splitY < 0) splitY = gapStart;
      const finalSplitY = splitY > 24 ? splitY : Math.max(36, Math.round(rh * 0.55));
      const extracted = await sharp(rawTrim)
        .extract({ left: 0, top: 0, width: rw, height: finalSplitY })
        .png()
        .toBuffer();
      try {
        emblemCrop = await sharp(extracted).ensureAlpha().trim({ threshold: 8 }).png().toBuffer();
      } catch {
        emblemCrop = extracted;
      }
    } else {
      emblemCrop = rawTrim;
    }

    const stats = await measureOpaqueStats(emblemCrop);
    const pal = contexto?.paleta;
    const darkSurfaceHex = pal
      ? mixHex(pal.tinta.hex, pal.secundaria.hex, 0.35)
      : "#16253A";
    const lightSurfaceHex = pal ? pal.papel.hex : "#F6F7F9";

    if (estiloVisual === "moderno") {
      if (stats.meanLum < 60 && stats.brightFraction < 0.2) {
        bgHex = lightSurfaceHex;
      } else {
        bgHex = darkSurfaceHex;
        if (stats.darkFraction >= 0.14 && stats.meanLum < 185) {
          customHaloInnerRgb = hexToRgb(mixHex(lightSurfaceHex, "#FFFFFF", 0.72));
        }
      }
    } else {
      if (stats.meanLum > 205 && stats.brightFraction > 0.72) {
        bgHex = darkSurfaceHex;
      } else {
        bgHex = mixHex(lightSurfaceHex, pal?.primaria.hex || "#334155", 0.22);
        customHaloInnerRgb = { r: 255, g: 255, b: 255 };
      }
    }
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
  const innerRatio = isCustomRef ? (rede.isCircle ? 0.62 : 0.66) : 0.64;
  const innerSize = Math.max(48, Math.round(target * innerRatio));
  const scaledEmblem = await sharp(emblemCrop)
    .resize(innerSize, innerSize, {
      fit: "contain",
      background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 0 },
    })
    .png()
    .toBuffer();

  if (customHaloInnerRgb) {
    const haloBg = await buildCenteredStudioHaloBg(target, bgRgb, customHaloInnerRgb);
    const finalBuf = await sharp(haloBg)
      .composite([{ input: scaledEmblem, gravity: "center" }])
      .flatten({ background: bgRgb })
      .png()
      .toBuffer();
    return { buffer: finalBuf, fixtureNome };
  }

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
  align?: "center" | "left";
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
  const startX =
    opts.align === "left" ? 0 : Math.max(0, Math.round((targetW - totalW) / 2));
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
  align?: "center" | "left";
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
  const groupW = Math.max(ew, ww, sw);
  const groupLeft =
    opts.align === "left" ? 0 : Math.max(0, Math.round((targetW - groupW) / 2));

  overlays.push({
    input: emblemScaled,
    left: groupLeft + Math.max(0, Math.round((groupW - ew) / 2)),
    top: cursorY,
  });
  cursorY += eh + gap1;
  overlays.push({
    input: wordmarkScaled,
    left: groupLeft + Math.max(0, Math.round((groupW - ww) / 2)),
    top: cursorY,
  });
  if (sScaled) {
    cursorY += wh + gap2;
    overlays.push({
      input: sScaled,
      left: groupLeft + Math.max(0, Math.round((groupW - sw) / 2)),
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
 * preservando integralmente o logótipo enviado sem redesenho e sem misturar
 * elementos de outras marcas de amostra.
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
  const pad = 4;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const cropW = Math.max(24, Math.min(w - left, maxX - minX + 1 + pad * 2));
  const cropH = Math.max(24, Math.min(h - top, maxY - minY + 1 + pad * 2));

  const trimmed =
    cropW < w || cropH < h
      ? await sharp(clean).extract({ left, top, width: cropW, height: cropH }).png().toBuffer()
      : clean;

  // Para logótipos empilhados verticais, separa banda horizontal limpa entre 35% e 68%
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

function mixRgbChannels(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number
): { r: number; g: number; b: number } {
  const k = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(a.r + (b.r - a.r) * k),
    g: Math.round(a.g + (b.g - a.g) * k),
    b: Math.round(a.b + (b.b - a.b) * k),
  };
}

async function createMascotBacklightGlow(
  diameter: number,
  glowRgb: { r: number; g: number; b: number },
  peakOpacity = 0.34
): Promise<Buffer> {
  const dim = Math.max(48, Math.min(220, Math.round(diameter / 3)));
  const raw = Buffer.alloc(dim * dim * 4);
  const half = (dim - 1) / 2;
  const edgeExp = Math.exp(-3.8);
  for (let y = 0; y < dim; y++) {
    const dy = (y - half) / Math.max(1, half);
    for (let x = 0; x < dim; x++) {
      const dx = (x - half) / Math.max(1, half);
      const r2 = dx * dx + dy * dy;
      let a = 0;
      if (r2 < 0.96) {
        const g = (Math.exp(-3.8 * r2) - edgeExp) / (1 - edgeExp);
        a = Math.max(0, Math.min(1, g)) * peakOpacity;
      }
      const idx = (y * dim + x) * 4;
      raw[idx] = glowRgb.r;
      raw[idx + 1] = glowRgb.g;
      raw[idx + 2] = glowRgb.b;
      raw[idx + 3] = Math.round(255 * a);
    }
  }
  return sharp(raw, { raw: { width: dim, height: dim, channels: 4 } })
    .resize(diameter, diameter, { kernel: sharp.kernel.cubic })
    .png()
    .toBuffer();
}

/**
 * Sintetiza o fundo atmosférico de Camada (a) estritamente a partir da paleta extraída
 * da marca cliente, com zonas de luz arquitectónicas e planos translúcidos que sangram
 * até às bordas exteriores da capa/publicação mantendo leitura limpa na zona segura.
 */
async function buildCustomBrandAmbientBackdrop(opts: {
  W: number;
  H: number;
  estiloVisual: "moderno" | "classico";
  disposicao: RedeSocialConfig["composicao"]["disposicao"];
  redeId: RedeSocialId;
  paleta: ReturnType<typeof buildBrandPalette>;
}): Promise<{ buffer: Buffer; canvasBgRgb: { r: number; g: number; b: number } }> {
  const { W, H, estiloVisual, disposicao, redeId, paleta } = opts;

  const cPrim = hexToRgb(paleta.primaria.hex);
  const cSec = hexToRgb(paleta.secundaria.hex);
  const cPapel = hexToRgb(paleta.papel.hex);

  const darkHexPre = mixHex(paleta.tinta.hex, paleta.primaria.hex, 0.18);
  const darkPreRgb = hexToRgb(darkHexPre);
  const darkPreLum =
    0.299 * darkPreRgb.r + 0.587 * darkPreRgb.g + 0.114 * darkPreRgb.b;
  const darkBaseRgb =
    darkPreLum > 46
      ? {
          r: Math.max(8, Math.round((darkPreRgb.r * 40) / darkPreLum)),
          g: Math.max(10, Math.round((darkPreRgb.g * 40) / darkPreLum)),
          b: Math.max(12, Math.round((darkPreRgb.b * 40) / darkPreLum)),
        }
      : darkPreRgb;
  const lightBaseRgb = cPapel;

  const canvasBgRgb = estiloVisual === "moderno" ? darkBaseRgb : lightBaseRgb;

  const scaleW = Math.min(420, Math.max(180, Math.round(W / 4)));
  const scaleH = Math.max(60, Math.round((H * scaleW) / Math.max(1, W)));
  const raw = Buffer.alloc(scaleW * scaleH * 4);

  interface GlowSpot {
    u: number;
    v: number;
    rx: number;
    ry: number;
    rgb: { r: number; g: number; b: number };
    strength: number;
  }

  const spots: GlowSpot[] = [];
  const brightAccent = mixRgbChannels(cPrim, { r: 255, g: 255, b: 255 }, 0.36);
  const softIce = mixRgbChannels(cPrim, { r: 255, g: 255, b: 255 }, 0.64);
  const deepAccent = mixRgbChannels(cSec, cPrim, 0.38);

  if (estiloVisual === "moderno") {
    if (disposicao === "horizontal-bipartida") {
      spots.push(
        { u: 0.78, v: 0.44, rx: 0.30, ry: 0.60, rgb: cPrim, strength: 0.76 },
        { u: 0.89, v: 0.28, rx: 0.20, ry: 0.40, rgb: brightAccent, strength: 0.48 },
        { u: 0.74, v: 0.58, rx: 0.14, ry: 0.28, rgb: softIce, strength: 0.24 },
        { u: 0.93, v: 0.84, rx: 0.28, ry: 0.48, rgb: deepAccent, strength: 0.56 },
        { u: 0.08, v: 0.18, rx: 0.16, ry: 0.36, rgb: cPrim, strength: 0.28 }
      );
    } else if (redeId === "yt-banner") {
      spots.push(
        { u: 0.08, v: 0.50, rx: 0.22, ry: 0.48, rgb: cPrim, strength: 0.72 },
        { u: 0.92, v: 0.50, rx: 0.22, ry: 0.48, rgb: cPrim, strength: 0.72 },
        { u: 0.12, v: 0.34, rx: 0.14, ry: 0.26, rgb: brightAccent, strength: 0.36 },
        { u: 0.88, v: 0.66, rx: 0.14, ry: 0.26, rgb: brightAccent, strength: 0.36 },
        { u: 0.50, v: 0.14, rx: 0.46, ry: 0.24, rgb: deepAccent, strength: 0.58 },
        { u: 0.50, v: 0.86, rx: 0.46, ry: 0.24, rgb: deepAccent, strength: 0.58 }
      );
    } else if (disposicao === "faixa-ultra-larga") {
      spots.push(
        { u: 0.90, v: 0.46, rx: 0.22, ry: 0.72, rgb: cPrim, strength: 0.76 },
        { u: 0.95, v: 0.24, rx: 0.15, ry: 0.46, rgb: brightAccent, strength: 0.44 },
        { u: 0.06, v: 0.25, rx: 0.14, ry: 0.55, rgb: cPrim, strength: 0.28 }
      );
    } else if (disposicao === "imagem-destaque-min-texto") {
      spots.push(
        { u: 0.73, v: 0.46, rx: 0.36, ry: 0.64, rgb: cPrim, strength: 0.82 },
        { u: 0.86, v: 0.28, rx: 0.22, ry: 0.42, rgb: brightAccent, strength: 0.54 },
        { u: 0.71, v: 0.50, rx: 0.14, ry: 0.26, rgb: softIce, strength: 0.32 },
        { u: 0.62, v: 0.84, rx: 0.30, ry: 0.44, rgb: deepAccent, strength: 0.56 }
      );
    } else if (disposicao === "vertical-story") {
      spots.push(
        { u: 0.54, v: 0.21, rx: 0.48, ry: 0.21, rgb: cPrim, strength: 0.72 },
        { u: 0.76, v: 0.13, rx: 0.34, ry: 0.14, rgb: brightAccent, strength: 0.40 },
        { u: 0.46, v: 0.88, rx: 0.46, ry: 0.17, rgb: deepAccent, strength: 0.52 }
      );
    } else {
      spots.push(
        { u: 0.50, v: 0.16, rx: 0.48, ry: 0.26, rgb: cPrim, strength: 0.70 },
        { u: 0.82, v: 0.22, rx: 0.32, ry: 0.22, rgb: brightAccent, strength: 0.44 },
        { u: 0.18, v: 0.88, rx: 0.36, ry: 0.22, rgb: deepAccent, strength: 0.44 }
      );
    }
  } else {
    const softBlueWash = mixRgbChannels(cPapel, cPrim, 0.22);
    const softNavyWash = mixRgbChannels(cPapel, cSec, 0.12);
    if (disposicao === "horizontal-bipartida") {
      spots.push(
        { u: 0.82, v: 0.46, rx: 0.34, ry: 0.66, rgb: softBlueWash, strength: 0.90 },
        { u: 0.94, v: 0.80, rx: 0.26, ry: 0.45, rgb: softNavyWash, strength: 0.68 },
        { u: 0.08, v: 0.16, rx: 0.16, ry: 0.34, rgb: softBlueWash, strength: 0.55 }
      );
    } else if (redeId === "yt-banner") {
      spots.push(
        { u: 0.08, v: 0.50, rx: 0.22, ry: 0.48, rgb: softBlueWash, strength: 0.86 },
        { u: 0.92, v: 0.50, rx: 0.22, ry: 0.48, rgb: softBlueWash, strength: 0.86 },
        { u: 0.50, v: 0.12, rx: 0.46, ry: 0.20, rgb: softNavyWash, strength: 0.62 },
        { u: 0.50, v: 0.88, rx: 0.46, ry: 0.20, rgb: softNavyWash, strength: 0.62 }
      );
    } else if (disposicao === "faixa-ultra-larga") {
      spots.push(
        { u: 0.90, v: 0.48, rx: 0.24, ry: 0.72, rgb: softBlueWash, strength: 0.90 },
        { u: 0.08, v: 0.28, rx: 0.14, ry: 0.55, rgb: softNavyWash, strength: 0.58 }
      );
    } else if (disposicao === "imagem-destaque-min-texto") {
      spots.push(
        { u: 0.76, v: 0.48, rx: 0.36, ry: 0.68, rgb: softBlueWash, strength: 0.94 },
        { u: 0.90, v: 0.24, rx: 0.24, ry: 0.44, rgb: softNavyWash, strength: 0.64 }
      );
    } else if (disposicao === "vertical-story") {
      spots.push(
        { u: 0.52, v: 0.20, rx: 0.48, ry: 0.22, rgb: softBlueWash, strength: 0.86 },
        { u: 0.50, v: 0.88, rx: 0.48, ry: 0.16, rgb: softNavyWash, strength: 0.68 }
      );
    } else {
      spots.push(
        { u: 0.52, v: 0.18, rx: 0.50, ry: 0.26, rgb: softBlueWash, strength: 0.86 },
        { u: 0.82, v: 0.86, rx: 0.38, ry: 0.24, rgb: softNavyWash, strength: 0.64 }
      );
    }
  }

  for (let y = 0; y < scaleH; y++) {
    const v = scaleH > 1 ? y / (scaleH - 1) : 0.5;
    for (let x = 0; x < scaleW; x++) {
      const u = scaleW > 1 ? x / (scaleW - 1) : 0.5;
      let r = canvasBgRgb.r;
      let g = canvasBgRgb.g;
      let b = canvasBgRgb.b;

      if (estiloVisual === "moderno") {
        const sweep = Math.max(0, Math.min(1, 0.55 * u + 0.35 * (1 - v)));
        const primShift = mixRgbChannels(darkBaseRgb, cPrim, 0.22);
        const baseSw = mixRgbChannels(darkBaseRgb, primShift, sweep * 0.65);
        r = baseSw.r;
        g = baseSw.g;
        b = baseSw.b;
      }

      for (const s of spots) {
        const dx = (u - s.u) / Math.max(0.02, s.rx);
        const dy = (v - s.v) / Math.max(0.02, s.ry);
        const d2 = dx * dx + dy * dy;
        if (d2 > 3.6) continue;
        const w = Math.exp(-d2 * 1.45) * s.strength;
        r = Math.round(r * (1 - w) + s.rgb.r * w);
        g = Math.round(g * (1 - w) + s.rgb.g * w);
        b = Math.round(b * (1 - w) + s.rgb.b * w);
      }

      // Planos diagonais luminosos suaves (sem saltos abruptos) para profundeza arquitetónica/tecnológica
      if (
        disposicao === "horizontal-bipartida" ||
        disposicao === "imagem-destaque-min-texto"
      ) {
        const beamPivot = disposicao === "imagem-destaque-min-texto" ? 0.62 : 0.72;
        const dBeam = Math.abs((u - beamPivot) * 0.85 + (v - 0.5) * 0.42);
        const beamW = Math.exp(-(dBeam * dBeam) / 0.018) * (estiloVisual === "moderno" ? 0.16 : 0.10);
        const beamTint = estiloVisual === "moderno" ? brightAccent : cPrim;
        r = Math.round(r * (1 - beamW) + beamTint.r * beamW);
        g = Math.round(g * (1 - beamW) + beamTint.g * beamW);
        b = Math.round(b * (1 - beamW) + beamTint.b * beamW);
      } else if (redeId === "yt-banner") {
        const ribbonDist = Math.abs(v - 0.5);
        const edgeBand = ribbonDist > 0.17 && ribbonDist < 0.23
          ? Math.exp(-Math.pow((ribbonDist - 0.20) / 0.024, 2)) * (estiloVisual === "moderno" ? 0.14 : 0.08)
          : 0;
        if (edgeBand > 0) {
          const bandTint = estiloVisual === "moderno" ? brightAccent : cPrim;
          r = Math.round(r * (1 - edgeBand) + bandTint.r * edgeBand);
          g = Math.round(g * (1 - edgeBand) + bandTint.g * edgeBand);
          b = Math.round(b * (1 - edgeBand) + bandTint.b * edgeBand);
        }
      }

      // Ondulação luminosa orgânica muito suave na Camada (a) para textura de estúdio
      const wave = Math.sin(u * 4.2 + v * 2.6) * 0.5 + 0.5;
      const waveWeight = estiloVisual === "moderno" ? 0.045 : 0.025;
      const targetTone = estiloVisual === "moderno" ? cPrim : cSec;
      r = Math.max(0, Math.min(255, Math.round(r * (1 - wave * waveWeight) + targetTone.r * wave * waveWeight)));
      g = Math.max(0, Math.min(255, Math.round(g * (1 - wave * waveWeight) + targetTone.g * wave * waveWeight)));
      b = Math.max(0, Math.min(255, Math.round(b * (1 - wave * waveWeight) + targetTone.b * wave * waveWeight)));

      const idx = (y * scaleW + x) * 4;
      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = 255;
    }
  }

  const buffer = await sharp(raw, { raw: { width: scaleW, height: scaleH, channels: 4 } })
    .resize(W, H, { kernel: sharp.kernel.cubic })
    .png()
    .toBuffer();

  return { buffer, canvasBgRgb };
}

async function createRoundedLogoPlate(opts: {
  fittedLogo: Buffer;
  logoW: number;
  logoH: number;
  plateBgHex: string;
  accentHex: string;
  borderHex: string;
}): Promise<{ buffer: Buffer; width: number; height: number }> {
  const padX = Math.max(22, Math.min(36, Math.round(opts.logoW * 0.055)));
  const padY = Math.max(14, Math.min(28, Math.round(opts.logoH * 0.14)));
  const plateW = opts.logoW + padX * 2;
  const plateH = opts.logoH + padY * 2;
  const rx = Math.max(10, Math.min(24, Math.round(Math.min(plateW, plateH) * 0.11)));

  const plateSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${plateW}" height="${plateH}" viewBox="0 0 ${plateW} ${plateH}">
    <defs>
      <clipPath id="plateClip">
        <rect x="1" y="1" width="${plateW - 2}" height="${plateH - 2}" rx="${rx}" />
      </clipPath>
    </defs>
    <g clip-path="url(#plateClip)">
      <rect x="1" y="1" width="${plateW - 2}" height="${plateH - 2}" rx="${rx}" fill="${opts.plateBgHex}" />
      <rect x="10" y="${Math.round(plateH * 0.2)}" width="4" height="${Math.round(plateH * 0.6)}" rx="2" fill="${opts.accentHex}" />
    </g>
    <rect x="1" y="1" width="${plateW - 2}" height="${plateH - 2}" rx="${rx}" fill="none" stroke="${opts.borderHex}" stroke-width="1.5" />
  </svg>`;
  const plateBuf = Buffer.from(
    new Resvg(plateSvg, { fitTo: { mode: "width", value: plateW } }).render().asPng()
  );
  const composed = await sharp(plateBuf)
    .composite([{ input: opts.fittedLogo, left: padX, top: padY }])
    .png()
    .toBuffer();
  return { buffer: composed, width: plateW, height: plateH };
}

function packPillLines(
  rawItems: string[],
  maxCharsPerLine = 34,
  maxOutLines = 3
): string[] {
  const tokens: string[] = [];
  for (const raw of rawItems) {
    const clean = raw.trim();
    if (!clean) continue;
    if (clean.length <= maxCharsPerLine) {
      tokens.push(clean);
      continue;
    }
    if (clean.includes("•")) {
      const subParts = clean
        .split("•")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const sp of subParts) {
        tokens.push(sp);
      }
      continue;
    }
    tokens.push(clean);
  }

  const splitBalancedLine = (text: string): string[] => {
    if (text.length <= maxCharsPerLine) return [text];
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= 1) return [text.slice(0, maxCharsPerLine)];

    if (text.length <= maxCharsPerLine * 2 - 2) {
      let bestSplit = -1;
      let bestDiff = Infinity;
      let leftLen = 0;
      for (let i = 0; i < words.length - 1; i++) {
        leftLen += (i > 0 ? 1 : 0) + words[i].length;
        const rightLen = text.length - leftLen - 1;
        if (leftLen <= maxCharsPerLine && rightLen <= maxCharsPerLine) {
          const diff = Math.abs(leftLen - rightLen);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestSplit = i;
          }
        }
      }
      if (bestSplit >= 0) {
        return [
          words.slice(0, bestSplit + 1).join(" "),
          words.slice(bestSplit + 1).join(" "),
        ];
      }
    }

    const wrapped: string[] = [];
    let current = "";
    for (const w of words) {
      if (!current) {
        current = w;
      } else if (current.length + 1 + w.length <= maxCharsPerLine) {
        current = `${current} ${w}`;
      } else {
        wrapped.push(current);
        current = w;
      }
    }
    if (current) wrapped.push(current);
    return wrapped;
  };

  const expanded: string[] = [];
  for (const tok of tokens) {
    expanded.push(...splitBalancedLine(tok));
  }

  const packed: string[] = [];
  for (const line of expanded) {
    const prev = packed[packed.length - 1];
    if (
      prev &&
      !prev.includes("•") &&
      !line.includes("•") &&
      prev.length + 3 + line.length <= 31 &&
      (expanded.length > maxOutLines || (prev.length <= 16 && line.length <= 16))
    ) {
      packed[packed.length - 1] = `${prev} • ${line}`;
    } else {
      packed.push(line);
    }
  }

  return packed.slice(0, maxOutLines);
}

async function renderCustomContactPill(opts: {
  lines: string[];
  maxWidth: number;
  canvasW: number;
  canvasH: number;
  estiloVisual: "moderno" | "classico";
  paleta: ReturnType<typeof buildBrandPalette>;
  fontPairId?: ImagemContexto["fontPairId"];
  tom?: TomDaMarca;
  sector?: SectorId;
}): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  const packedLines = packPillLines(opts.lines, 34, 3);
  if (packedLines.length === 0) return null;

  const resolvedPairId =
    opts.fontPairId ||
    resolverParTipograficoMarca({
      tom: opts.tom,
      sector: opts.sector,
      estiloDirecao: opts.estiloVisual,
    });
  const { pair, fonts } = getSatoriFontsForPair(resolvedPairId);

  const isDark = opts.estiloVisual === "moderno";
  const baseDarkHex = mixHex(opts.paleta.tinta.hex, opts.paleta.primaria.hex, 0.16);
  const darkRgb = hexToRgb(baseDarkHex);
  const darkLuma = 0.299 * darkRgb.r + 0.587 * darkRgb.g + 0.114 * darkRgb.b;
  const safeDarkRgb =
    darkLuma > 46
      ? {
          r: Math.max(8, Math.round((darkRgb.r * 38) / darkLuma)),
          g: Math.max(10, Math.round((darkRgb.g * 38) / darkLuma)),
          b: Math.max(12, Math.round((darkRgb.b * 38) / darkLuma)),
        }
      : darkRgb;

  const bg = isDark
    ? `rgba(${safeDarkRgb.r}, ${safeDarkRgb.g}, ${safeDarkRgb.b}, 0.90)`
    : "#FFFFFF";
  const border = isDark
    ? mixHex(opts.paleta.primaria.hex, "#FFFFFF", 0.42)
    : mixHex(opts.paleta.primaria.hex, opts.paleta.papel.hex, 0.42);
  const lightSurfaceText =
    contrastRatio(opts.paleta.tinta.hex, "#FFFFFF") >= 7
      ? opts.paleta.tinta.hex
      : "#0F172A";
  const textCol = isDark ? "#FFFFFF" : lightSurfaceText;

  const isMobileIg = opts.canvasW >= 1000 && opts.canvasH >= 1000;
  const maxLineLen = packedLines.reduce((m, s) => Math.max(m, s.length), 0);

  const fontSize = isMobileIg
    ? packedLines.length >= 3
      ? 38
      : maxLineLen > 31
      ? 38
      : maxLineLen > 24
      ? 40
      : 42
    : maxLineLen > 30
    ? 24
    : 27;

  const pillH = isMobileIg
    ? packedLines.length === 1
      ? 104
      : packedLines.length === 2
      ? 156
      : 204
    : packedLines.length === 1
    ? 72
    : 108;

  const borderRadius = packedLines.length === 1 ? "999px" : "28px";
  const h = React.createElement;

  const innerContent =
    packedLines.length === 1
      ? h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: "14px",
              backgroundColor: bg,
              border: `2px solid ${border}`,
              borderRadius,
              padding: isMobileIg ? "18px 34px" : "12px 26px",
              maxWidth: `${opts.maxWidth - 16}px`,
            },
          },
          h("div", {
            style: {
              width: isMobileIg ? "12px" : "9px",
              height: isMobileIg ? "12px" : "9px",
              borderRadius: "999px",
              backgroundColor: opts.paleta.primaria.hex,
              flexShrink: 0,
            },
          }),
          h(
            "div",
            {
              style: {
                fontFamily: pair.textoFamily,
                fontWeight: 600,
                fontSize: `${fontSize}px`,
                color: textCol,
                lineHeight: 1.18,
                textAlign: "center",
              },
            },
            packedLines[0]
          )
        )
      : h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: isMobileIg ? "7px" : "4px",
              backgroundColor: bg,
              border: `2px solid ${border}`,
              borderRadius,
              padding: isMobileIg ? "16px 30px" : "10px 24px",
              maxWidth: `${opts.maxWidth - 16}px`,
            },
          },
          h("div", {
            style: {
              width: isMobileIg ? "44px" : "32px",
              height: "4px",
              borderRadius: "2px",
              backgroundColor: opts.paleta.primaria.hex,
              marginBottom: isMobileIg ? "4px" : "2px",
            },
          }),
          ...packedLines.map((line) =>
            h(
              "div",
              {
                style: {
                  fontFamily: pair.textoFamily,
                  fontWeight: 600,
                  fontSize: `${fontSize}px`,
                  color: textCol,
                  lineHeight: 1.2,
                  textAlign: "center",
                },
              },
              line
            )
          )
        );

  const el = h(
    "div",
    {
      style: {
        width: `${opts.maxWidth}px`,
        height: `${pillH}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: pair.textoFamily,
      },
    },
    innerContent
  );

  const svg = await satori(el, { width: opts.maxWidth, height: pillH, fonts });
  const buf = Buffer.from(
    new Resvg(svg, { fitTo: { mode: "width", value: opts.maxWidth } }).render().asPng()
  );
  return { buffer: buf, width: opts.maxWidth, height: pillH };
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

  const refBuf = contexto?.logotipoReferencia;
  const isCustomBrand =
    !isDefaultFornoBrand(contexto?.nome) &&
    Boolean(refBuf && refBuf.length > 0) &&
    !(await isImageMostlySameAsRef(refBuf!, "logo.jpg"));

  const fornoParts = isCustomBrand ? null : await getFornoExtractedParts(estiloVisual);
  const baseRgb = fornoParts
    ? fornoParts.baseRgb
    : estiloVisual === "moderno"
    ? { r: 22, g: 37, b: 58 }
    : { r: 246, g: 247, b: 249 };

  const hierarquia = resolverHierarquiaInformacaoConfig(
    {
      nome: contexto?.nome || "Forno da Vilariça",
      slogan: contexto?.slogan,
      sector: contexto?.sector,
      website: undefined,
    } as { nome?: string; slogan?: string; website?: string },
    rede
  );

  let canvasBgRgb = { ...baseRgb };
  const overlays: OverlayOptions[] = [];
  let adapted = isCustomBrand;

  const borderColorRgb = contexto?.paleta?.primaria
    ? !isCustomBrand && estiloVisual === "moderno"
      ? { r: 217, g: 130, b: 43 }
      : hexToRgb(contexto.paleta.primaria.hex)
    : estiloVisual === "moderno"
    ? { r: 217, g: 130, b: 43 }
    : { r: 184, g: 74, b: 36 };

  const mob = rede.safeZoneMobile;
  const deskMobAvatarRight = Math.max(
    rede.avatarOverlapDesktop ? rede.avatarOverlapDesktop.x + rede.avatarOverlapDesktop.width + 18 : 0,
    rede.avatarOverlapMobile ? rede.avatarOverlapMobile.x + rede.avatarOverlapMobile.width + 18 : 0
  );

  const customParts =
    isCustomBrand && refBuf ? await extractCustomClientParts(refBuf) : null;
  const customStats = customParts ? await measureOpaqueStats(customParts.fullClean) : null;

  const customPaletaResolved =
    isCustomBrand
      ? contexto?.paleta ||
        buildBrandPalette({
          primaria: "#334155",
          secundaria: "#475569",
          papel: "#F8FAFC",
          tinta: "#0F172A",
        })
      : null;

  let customBackdropBuf: Buffer | null = null;
  if (isCustomBrand && customPaletaResolved) {
    const bd = await buildCustomBrandAmbientBackdrop({
      W,
      H,
      estiloVisual,
      disposicao,
      redeId: rede.id,
      paleta: customPaletaResolved,
    });
    customBackdropBuf = bd.buffer;
    canvasBgRgb = bd.canvasBgRgb;
  }

  const returnFixtureNome = isCustomBrand
    ? "referencia-cliente"
    : `docs/referencias/ia-aprovada/${masterName}`;

  const getCustomExtraContactLines = (): string[] => {
    if (!isCustomBrand) return [];
    const maxLinhas = rede.composicao.maxLinhasContactos ?? 0;
    const nomeLow = (contexto?.nome || "").trim().toLowerCase();
    const sloganTrim = (contexto?.slogan || "").trim();
    const sloganLow = sloganTrim.toLowerCase();

    if (maxLinhas <= 0) {
      if (contexto?.simbolo && hierarquia.incluirSlogan && sloganTrim) {
        return [sloganTrim];
      }
      return [];
    }

    const raw = (contexto?.textosPedidos || []).map((s) => s.trim()).filter(Boolean);
    const filtered = raw.filter((t) => {
      const low = t.toLowerCase();
      if (nomeLow && low === nomeLow) return false;
      if (!contexto?.simbolo && sloganLow && low === sloganLow) return false;
      return true;
    });

    const selected: string[] = [];
    let charBudget = rede.id === "ig-story" ? 44 : 76;
    for (const item of filtered) {
      if (selected.length >= maxLinhas) break;
      if (
        selected.length > 0 &&
        item.length > charBudget &&
        filtered.some(
          (f) => f !== item && f.length <= charBudget && !selected.includes(f)
        )
      ) {
        continue;
      }
      selected.push(item);
      charBudget = Math.max(12, charBudget - item.length);
    }
    return selected;
  };

  const placeBrandInfoInBox = async (
    box: { x: number; y: number; width: number; height: number },
    mode: "inline" | "stack" | "stack-compact" | "vertical-highlighted",
    align: "center" | "left" = "center"
  ) => {
    if (customParts && customPaletaResolved && customStats) {
      const contactLines =
        mode === "vertical-highlighted" ? getCustomExtraContactLines() : [];
      const pill =
        contactLines.length > 0
          ? await renderCustomContactPill({
              lines: contactLines,
              maxWidth: box.width,
              canvasW: W,
              canvasH: H,
              estiloVisual,
              paleta: customPaletaResolved,
              fontPairId: contexto?.fontPairId,
              tom: contexto?.tom,
              sector: contexto?.sector,
            })
          : null;

      const gapPill = pill ? Math.max(24, Math.round(box.height * 0.05)) : 0;
      const pillReservedH = pill ? pill.height + gapPill : 0;
      const logoSlotH = Math.max(48, box.height - pillReservedH);

      const darkSurfaceHex = rgbToHex(canvasBgRgb);
      const needsDarkAdaptation = estiloVisual === "moderno";
      let darkAdapted: {
        buffer: Buffer;
        appliedKnockout: boolean;
        hasSplitWordmark: boolean;
      } | null = null;
      if (needsDarkAdaptation) {
        darkAdapted = await adaptLogoForDarkSurface(
          customParts.fullClean,
          Boolean(contexto?.logotipoDna?.isDarkMonochrome),
          darkSurfaceHex
        );
      }

      const needDarkFallbackPlate =
        estiloVisual === "moderno" &&
        !(darkAdapted?.appliedKnockout) &&
        (customStats.darkFraction >= 0.05 || customStats.meanLum < 155);
      const needLightFallbackPlate =
        estiloVisual === "classico" &&
        customStats.brightFraction >= 0.75 &&
        customStats.darkFraction < 0.06;

      const padReserveX =
        needDarkFallbackPlate || needLightFallbackPlate
          ? 52
          : mode === "inline"
          ? Math.max(24, Math.round(box.width * 0.06))
          : 12;
      const padReserveY =
        needDarkFallbackPlate || needLightFallbackPlate
          ? 36
          : mode === "inline"
          ? Math.max(14, Math.round(logoSlotH * 0.14))
          : 10;
      const maxInnerW = Math.max(48, box.width - padReserveX);
      const maxInnerH = Math.max(36, logoSlotH - padReserveY);

      const logoSourceBuf =
        darkAdapted?.appliedKnockout && darkAdapted.buffer
          ? darkAdapted.buffer
          : customParts.fullClean;

      let rawLogoBuf: Buffer;
      if (mode === "inline" && customParts.canSplitInline) {
        const inlineParts =
          darkAdapted?.appliedKnockout && darkAdapted.buffer
            ? await extractCustomClientParts(darkAdapted.buffer)
            : customParts;
        const inline = await composeInlineHorizontalPair({
          emblemBuf: inlineParts.emblem,
          wordmarkBuf: inlineParts.wordmark,
          targetW: maxInnerW,
          targetH: maxInnerH,
          align,
        });
        rawLogoBuf = inline.buffer;
      } else {
        rawLogoBuf = await sharp(logoSourceBuf)
          .resize(maxInnerW, maxInnerH, { fit: "inside" })
          .png()
          .toBuffer();
      }

      const fittedMeta = await sharp(rawLogoBuf).metadata();
      const fw = fittedMeta.width || maxInnerW;
      const fh = fittedMeta.height || maxInnerH;

      let logoOverlayBuf = rawLogoBuf;
      let logoOverlayW = fw;
      let logoOverlayH = fh;

      if (needDarkFallbackPlate) {
        const plated = await createRoundedLogoPlate({
          fittedLogo: rawLogoBuf,
          logoW: fw,
          logoH: fh,
          plateBgHex: "#FFFFFF",
          accentHex: customPaletaResolved.primaria.hex,
          borderHex: mixHex(customPaletaResolved.primaria.hex, "#FFFFFF", 0.55),
        });
        logoOverlayBuf = plated.buffer;
        logoOverlayW = plated.width;
        logoOverlayH = plated.height;
      } else if (needLightFallbackPlate) {
        const plated = await createRoundedLogoPlate({
          fittedLogo: rawLogoBuf,
          logoW: fw,
          logoH: fh,
          plateBgHex: mixHex(
            customPaletaResolved.tinta.hex,
            customPaletaResolved.secundaria.hex,
            0.35
          ),
          accentHex: customPaletaResolved.primaria.hex,
          borderHex: mixHex(
            customPaletaResolved.primaria.hex,
            customPaletaResolved.tinta.hex,
            0.45
          ),
        });
        logoOverlayBuf = plated.buffer;
        logoOverlayW = plated.width;
        logoOverlayH = plated.height;
      }

      const totalBlockH = logoOverlayH + (pill ? gapPill + pill.height : 0);
      const startY = box.y + Math.max(0, Math.round((box.height - totalBlockH) / 2));
      const logoLeft =
        align === "left"
          ? box.x
          : box.x + Math.max(0, Math.round((box.width - logoOverlayW) / 2));

      // Se aplicámos variante de fundo escuro diretamente sem placa opaca, junta halo radial sem arestas atrás do emblema
      if (darkAdapted?.appliedKnockout) {
        const radius = Math.max(48, Math.round(logoOverlayH * 1.12));
        const diameter = radius * 2;
        const mascotCenterX =
          logoLeft +
          (darkAdapted.hasSplitWordmark
            ? Math.min(Math.round(logoOverlayW * 0.38), Math.round(logoOverlayH * 0.56))
            : Math.round(logoOverlayW * 0.5));
        const mascotCenterY = startY + Math.round(logoOverlayH * 0.5);
        const haloRawLeft = mascotCenterX - radius;
        const haloRawTop = mascotCenterY - radius;
        const cropLeft = Math.max(0, -haloRawLeft);
        const cropTop = Math.max(0, -haloRawTop);
        const targetLeft = Math.max(0, haloRawLeft);
        const targetTop = Math.max(0, haloRawTop);
        const cropW = Math.min(diameter - cropLeft, W - targetLeft);
        const cropH = Math.min(diameter - cropTop, H - targetTop);

        if (cropW >= 32 && cropH >= 32) {
          const glowRgb = mixRgbChannels(
            hexToRgb(customPaletaResolved.primaria.hex),
            hexToRgb(mixHex(customPaletaResolved.papel.hex, "#FFFFFF", 0.6)),
            0.42
          );
          let haloBuf = await createMascotBacklightGlow(diameter, glowRgb, 0.34);
          if (cropW < diameter || cropH < diameter) {
            haloBuf = await sharp(haloBuf)
              .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
              .png()
              .toBuffer();
          }
          overlays.push({
            input: haloBuf,
            left: targetLeft,
            top: targetTop,
          });
        }
      }

      overlays.push({ input: logoOverlayBuf, left: logoLeft, top: startY });
      if (pill) {
        const pillLeft =
          align === "left"
            ? box.x
            : box.x + Math.max(0, Math.round((box.width - pill.width) / 2));
        overlays.push({
          input: pill.buffer,
          left: pillLeft,
          top: startY + logoOverlayH + gapPill,
        });
      }
      return;
    }

    if (!fornoParts) return;

    if (mode === "inline") {
      const inline = await composeInlineHorizontalPair({
        emblemBuf: fornoParts.emblem,
        wordmarkBuf: fornoParts.wordmark,
        targetW: box.width,
        targetH: box.height,
        gapRatio: W / Math.max(1, H) >= 5 ? 0.04 : 0.05,
        align,
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
        align,
      });
      overlays.push({ input: stack, left: box.x, top: box.y });
      return;
    }

    const stack = await composeVerticalHighlightedStack({
      emblemBuf: fornoParts.emblem,
      wordmarkBuf: fornoParts.wordmark,
      sloganBuf:
        mode === "stack" && hierarquia.incluirSlogan ? fornoParts.sloganCrop : undefined,
      targetW: box.width,
      targetH: box.height,
      align,
    });
    overlays.push({ input: stack, left: box.x, top: box.y });
  };

  if (customBackdropBuf) {
    overlays.push({ input: customBackdropBuf, left: 0, top: 0 });
  }

  // =========================================================================
  // DISPOSIÇÃO 1: FAIXAS ULTRA-LARGAS (LinkedIn Pessoal 4:1, Empresa 5,9:1, YouTube 1546×423)
  // Regra: logótipo + nome EM LINHA HORIZONTAL, sem slogan nem contactos; fundo sangra fora da zona móvel
  // =========================================================================
  if (disposicao === "faixa-ultra-larga") {
    adapted = true;
    const isYt = rede.id === "yt-banner";
    const infoLeft = isYt ? mob.x + 48 : Math.max(mob.x + 20, deskMobAvatarRight + 10);
    const infoRight =
      mob.x +
      mob.width -
      (!isCustomBrand && estiloVisual === "classico" && !isYt ? 96 : 28);
    const infoTop = mob.y + Math.max(10, Math.round(mob.height * 0.08));
    const infoHeight = Math.max(80, mob.height - Math.max(20, Math.round(mob.height * 0.16)));
    const infoWidth = Math.max(240, infoRight - infoLeft);

    if (estiloVisual === "moderno") {
      if (!isCustomBrand && fornoParts) {
        if (isYt) {
          const tvBackdrop = await featherAndTintLayer(
            await sharp(fornoParts.breadArchScene)
              .resize(W, H, { fit: "cover", position: "centre" })
              .blur(1.1)
              .png()
              .toBuffer(),
            { topPx: 80, bottomPx: 80, leftPx: 140, rightPx: 140, opacity: 0.42 }
          );
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
      }

      await placeBrandInfoInBox(
        { x: infoLeft, y: infoTop, width: infoWidth, height: infoHeight },
        "inline"
      );
    } else {
      if (!isCustomBrand && fornoParts) {
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
      }

      const borderInset = isYt ? 44 : Math.max(12, Math.round(H * 0.06));
      overlays.push(
        ...(await makeClassicDoubleBorderOverlays(W, H, borderInset, borderColorRgb, 0.5))
      );

      if (!isCustomBrand && fornoParts?.wheatRight && H >= 190) {
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

    return { buffer: finalBuf, fixtureNome: returnFixtureNome, adapted };
  }

  // =========================================================================
  // DISPOSIÇÃO 2: HORIZONTAL BIPARTIDA (Facebook 1640×624 e X 1500×500)
  // Regra: informação à esquerda na zona segura móvel acima/à direita dos avatares + imagem à direita a sangrar
  // =========================================================================
  if (disposicao === "horizontal-bipartida") {
    adapted = true;

    const baseLeft = mob.x + 24;
    const deskRightLeft =
      rede.avatarOverlapDesktop &&
      baseLeft < rede.avatarOverlapDesktop.x + rede.avatarOverlapDesktop.width
        ? Math.max(
            baseLeft,
            rede.avatarOverlapDesktop.x + rede.avatarOverlapDesktop.width + 16
          )
        : baseLeft;

    const verticalBlockers = [
      rede.avatarOverlapDesktop,
      rede.avatarOverlapMobile,
    ].filter(
      (av): av is SafeZoneRect =>
        Boolean(av) && av!.x + av!.width >= deskRightLeft - 24
    );
    const minBlockerTop = verticalBlockers.reduce(
      (acc, av) => Math.min(acc, av.y),
      H
    );
    const infoTop = mob.y + Math.max(14, Math.round(mob.height * 0.04));
    const canSitCleanlyAboveAvatars = minBlockerTop - 18 - infoTop >= 215;

    const infoLeft = canSitCleanlyAboveAvatars
      ? deskRightLeft
      : Math.max(mob.x + 22, deskMobAvatarRight + 10);

    const splitX = Math.min(
      Math.round(W * 0.5),
      Math.round(mob.x + mob.width * 0.56)
    );
    const infoWidth = Math.max(260, splitX - infoLeft - 14);
    const maxSafeBottom = canSitCleanlyAboveAvatars
      ? minBlockerTop - 18
      : mob.y + mob.height - 14;
    const infoHeight = Math.max(180, maxSafeBottom - infoTop);

    if (isCustomBrand) {
      if (estiloVisual === "classico") {
        overlays.push(
          ...(await makeClassicDoubleBorderOverlays(
            W,
            H,
            Math.round(H * 0.032),
            borderColorRgb,
            0.48
          ))
        );
      }

      await placeBrandInfoInBox(
        { x: infoLeft, y: infoTop, width: infoWidth, height: infoHeight },
        "stack",
        "left"
      );
    } else if (fornoParts) {
      const rightSceneStart = splitX - 18;
      const rightSceneW = W - rightSceneStart;

      if (estiloVisual === "moderno") {
        const leftTopBleedW = Math.max(120, Math.round(mob.x * 0.96));
        const leftTopBleedH = Math.max(
          120,
          (rede.avatarOverlapDesktop?.y || Math.round(H * 0.6)) - 20
        );
        const leftBleed = await featherAndTintLayer(
          await sharp(fornoParts.breadSoftScene)
            .resize(leftTopBleedW, leftTopBleedH, {
              fit: "cover",
              position: "centre",
            })
            .blur(1.25)
            .png()
            .toBuffer(),
          { rightPx: 48, bottomPx: 64, opacity: 0.34 }
        );

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
          ...(await makeClassicDoubleBorderOverlays(
            W,
            H,
            Math.round(H * 0.032),
            borderColorRgb,
            0.5
          ))
        );
      }

      await placeBrandInfoInBox(
        { x: infoLeft, y: infoTop, width: infoWidth, height: infoHeight },
        "stack",
        "left"
      );
    }

    const finalBuf = await sharp({
      create: {
        width: W,
        height: H,
        channels: 4,
        background: { ...canvasBgRgb, alpha: 1 },
      },
    })
      .composite(overlays)
      .flatten({ background: canvasBgRgb })
      .png()
      .toBuffer();

    return { buffer: finalBuf, fixtureNome: returnFixtureNome, adapted };
  }

  // =========================================================================
  // DISPOSIÇÃO 3: GOOGLE PERFIL DE EMPRESA (1024×576 — mais imagem, menos texto)
  // Regra: >= 65% imagem/ambiente protagonista a sangrar; bloco compacto emblema + nome (sem slogan/contactos)
  // =========================================================================
  if (disposicao === "imagem-destaque-min-texto") {
    adapted = true;

    if (!isCustomBrand && fornoParts) {
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
    } else if (estiloVisual === "classico") {
      overlays.push(...(await makeClassicDoubleBorderOverlays(W, H, 18, borderColorRgb, 0.48)));
    }

    const boxW = Math.round(W * (isCustomBrand ? 0.34 : 0.28));
    const boxH = Math.round(H * (isCustomBrand ? 0.46 : 0.56));
    await placeBrandInfoInBox(
      {
        x: mob.x + 18,
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

    return { buffer: finalBuf, fixtureNome: returnFixtureNome, adapted };
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

    if (!isCustomBrand && fornoParts) {
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

      const infoTop = safeTop + photoH + 14;
      const infoH = Math.max(320, safeBottom - infoTop - 8);
      await placeBrandInfoInBox(
        { x: mob.x + 24, y: infoTop, width: mob.width - 48, height: infoH },
        "vertical-highlighted"
      );
    } else {
      if (estiloVisual === "classico") {
        overlays.push(...(await makeClassicDoubleBorderOverlays(W, H, 28, borderColorRgb, 0.45)));
      }
      await placeBrandInfoInBox(
        {
          x: mob.x + 32,
          y: safeTop + Math.round(safeH * 0.14),
          width: mob.width - 64,
          height: Math.round(safeH * 0.68),
        },
        "vertical-highlighted"
      );
    }

    const finalBuf = await sharp({
      create: { width: W, height: H, channels: 4, background: { ...canvasBgRgb, alpha: 1 } },
    })
      .composite(overlays)
      .flatten({ background: canvasBgRgb })
      .png()
      .toBuffer();

    return { buffer: finalBuf, fixtureNome: returnFixtureNome, adapted };
  }

  // DISPOSIÇÃO VERTICAL FEED (Instagram 4:5 1080×1350 & 1:1 1080×1080)
  if (!isCustomBrand && fornoParts) {
    const is45 = H > W;
    const topPhotoH = Math.round(H * (is45 ? 0.42 : 0.39));

    if (estiloVisual === "moderno") {
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

    if (estiloVisual === "classico" && fornoParts.wheatLeft && fornoParts.wheatRight) {
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
  } else {
    if (estiloVisual === "classico") {
      overlays.push(...(await makeClassicDoubleBorderOverlays(W, H, 26, borderColorRgb, 0.48)));
    }
    const feedPadY = Math.round(mob.height * 0.08);
    await placeBrandInfoInBox(
      {
        x: mob.x + 32,
        y: mob.y + feedPadY,
        width: mob.width - 64,
        height: mob.height - feedPadY * 2,
      },
      "vertical-highlighted"
    );
  }

  const finalBuf = await sharp({
    create: { width: W, height: H, channels: 4, background: { ...canvasBgRgb, alpha: 1 } },
  })
    .composite(overlays)
    .flatten({ background: canvasBgRgb })
    .png()
    .toBuffer();

  return {
    buffer: finalBuf,
    fixtureNome: returnFixtureNome,
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
    if (
      cleanInstr.includes("modern") ||
      (isDefaultFornoBrand(contexto?.nome) && cleanInstr.includes("verde"))
    ) {
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
