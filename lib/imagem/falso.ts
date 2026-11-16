import fs from "fs";
import path from "path";
import sharp, { type OverlayOptions } from "sharp";
import { Resvg } from "@resvg/resvg-js";
import {
  ImagemContexto,
  ImagemFormato,
  ImagemProvider,
  ImagemResultado,
  VetorResultado,
} from "./types";
import { vetorizarImagemLocal } from "../vetorizar";
import { buildBrandPalette, rgbToHex, hexToRgb, mixHex } from "../palette";
import {
  generateInitialDirections,
  generateRefinementRound,
} from "../logo-generator/svg-studio";
import { SECTORS } from "../formats";

const FIXTURES_DIR = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "tests",
  "fixtures"
);

function normalizeNameForFixtureMatch(nome?: string): string {
  return (nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isFornoFixtureBrand(nome?: string): boolean {
  const norm = normalizeNameForFixtureMatch(nome);
  return !norm || norm.includes("forno da vilarica") || norm === "forno";
}

function loadFixtureBuffer(filename: string): Buffer {
  const fullPath = path.join(/*turbopackIgnore: true*/ FIXTURES_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Amostra local em falta em tests/fixtures/${filename}`);
  }
  return fs.readFileSync(fullPath);
}

const VALID_LAYOUT_IDS = new Set([
  "moderno-texto-atras",
  "moderno-recorte",
  "moderno-monolito",
  "classico-moldura",
  "classico-rotulo",
  "classico-informativo",
]);

function pickBrandArtworkFixtureName(
  formato: "capa" | "capa-fundo" | "publicacao-instagram" | "story-instagram",
  contexto?: ImagemContexto
): { filename: string; dirSuffix: "classico" | "moderno"; layoutKey: string } {
  const dnaDir = contexto?.logotipoDna?.estiloDirecao;
  const fixtureOrig = (contexto?.logotipoDna?.fixtureLogoOrigem || "").toLowerCase();
  const isModern =
    dnaDir === "moderno" ||
    contexto?.estilo === "moderno" ||
    fixtureOrig.includes("moderno") ||
    contexto?.paleta?.primaria.hex.toUpperCase() === "#172E2C";

  const dirSuffix: "classico" | "moderno" = isModern ? "moderno" : "classico";
  const layoutKey =
    contexto?.layoutId && VALID_LAYOUT_IDS.has(contexto.layoutId)
      ? contexto.layoutId
      : "moderno-texto-atras";

  if (formato === "publicacao-instagram") {
    return {
      filename: `arte-pub-ig-${dirSuffix}.png`,
      dirSuffix,
      layoutKey: "publicacao-instagram",
    };
  }
  if (formato === "story-instagram") {
    return {
      filename: `arte-story-ig-${dirSuffix}.png`,
      dirSuffix,
      layoutKey: "story-instagram",
    };
  }
  return {
    filename: `arte-capa-${layoutKey}-${dirSuffix}.png`,
    dirSuffix,
    layoutKey,
  };
}

async function adaptFixtureArtworkToBrandContext(params: {
  fixtureBuf: Buffer;
  dirSuffix: "classico" | "moderno";
  layoutKey: string;
  contexto?: ImagemContexto;
}): Promise<{ buffer: Buffer; adapted: boolean }> {
  const { fixtureBuf, dirSuffix, layoutKey, contexto } = params;
  const isDefaultBrand = isFornoFixtureBrand(contexto?.nome);
  const customPrimary = contexto?.paleta?.primaria?.hex;
  const defaultPrimary = dirSuffix === "moderno" ? "#172E2C" : "#B84A24";

  let colorShift = false;
  if (customPrimary) {
    const a = hexToRgb(customPrimary);
    const b = hexToRgb(defaultPrimary);
    const dist = Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
    if (dist > 48) {
      colorShift = true;
    }
  }

  const shouldEchoUploadedLogo =
    !isDefaultBrand &&
    Boolean(contexto?.logotipoReferencia && contexto.logotipoReferencia.length > 0);

  if (!colorShift && !shouldEchoUploadedLogo) {
    return { buffer: fixtureBuf, adapted: false };
  }

  const meta = await sharp(fixtureBuf).metadata();
  const w = meta.width || 1600;
  const h = meta.height || 600;
  const overlays: OverlayOptions[] = [];

  if (colorShift && customPrimary && contexto?.paleta) {
    const isLightSurface =
      layoutKey === "moderno-recorte" ||
      layoutKey === "classico-moldura" ||
      layoutKey === "classico-rotulo" ||
      layoutKey === "classico-informativo" ||
      (dirSuffix === "moderno" && layoutKey === "publicacao-instagram");

    const tintHex = isLightSurface
      ? mixHex(contexto.paleta.papel.hex, customPrimary, 0.14)
      : mixHex(contexto.paleta.tinta.hex, customPrimary, 0.32);
    const rgbTint = hexToRgb(tintHex);
    const tintSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="rgb(${rgbTint.r},${rgbTint.g},${rgbTint.b})" fill-opacity="${isLightSurface ? "0.26" : "0.42"}" /></svg>`;
    overlays.push({ input: Buffer.from(tintSvg), top: 0, left: 0 });
  }

  if (shouldEchoUploadedLogo && contexto?.logotipoReferencia) {
    try {
      const refBuf = contexto.logotipoReferencia;
      const echoSize = Math.round(Math.min(w, h) * 0.48);
      const echoImg = await sharp(refBuf)
        .ensureAlpha()
        .resize(echoSize, echoSize, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const eData = new Uint8Array(echoImg.data);
      for (let i = 0; i < eData.length; i += 4) {
        eData[i + 3] = Math.round(eData[i + 3] * 0.12);
      }
      const fadedEcho = await sharp(Buffer.from(eData.buffer), {
        raw: {
          width: echoImg.info.width,
          height: echoImg.info.height,
          channels: 4,
        },
      })
        .png()
        .toBuffer();

      const left =
        layoutKey === "story-instagram" || layoutKey === "publicacao-instagram"
          ? Math.round(w - echoImg.info.width - w * 0.08)
          : Math.round(w - echoImg.info.width - w * 0.06);
      const top =
        layoutKey === "story-instagram"
          ? Math.round(h - echoImg.info.height - h * 0.12)
          : Math.round((h - echoImg.info.height) / 2);

      overlays.push({
        input: fadedEcho,
        left: Math.max(0, left),
        top: Math.max(0, top),
      });
    } catch {
      // Ignora caso a referência de logo não possa ser rasterizada diretamente
    }
  }

  if (overlays.length === 0) {
    return { buffer: fixtureBuf, adapted: false };
  }

  const outBuf = await sharp(fixtureBuf).composite(overlays).png().toBuffer();
  return { buffer: outBuf, adapted: true };
}

function pickLogoFixtureName(
  formato: ImagemFormato,
  ronda: number
): string {
  const r = Math.max(1, Math.min(3, ronda || 1));
  if (formato === "logotipo-moderno") {
    if (r === 2) return "logo-moderno-r2.png";
    if (r === 3) return "logo-moderno-r3.png";
    return "logo-moderno-amostra.png";
  }
  // logotipo-classico e logotipo-editorial
  if (r === 2) return "logo-classico-r2.png";
  if (r === 3) return "logo-classico-r3.png";
  return "logo-classico-amostra.png";
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
    return inputPng;
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
 * Fornecedor local em modo falso (teste / demonstração sem custos).
 * Nunca efectua chamadas externas nem precisa de chaves de API.
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

    // Capas e publicações nascidas diretamente do logótipo escolhido
    if (
      formato === "capa-fundo" ||
      formato === "capa" ||
      formato === "publicacao-instagram" ||
      formato === "story-instagram"
    ) {
      const picked = pickBrandArtworkFixtureName(formato, contexto);
      const fixtureBuf = loadFixtureBuffer(picked.filename);
      const adaptedRes = await adaptFixtureArtworkToBrandContext({
        fixtureBuf,
        dirSuffix: picked.dirSuffix,
        layoutKey: picked.layoutKey,
        contexto,
      });
      const meta = await sharp(adaptedRes.buffer).metadata();
      return Array.from({ length: count }, () => ({
        buffer: adaptedRes.buffer,
        mimeType: "image/png" as const,
        width:
          meta.width ||
          (formato === "publicacao-instagram" || formato === "story-instagram"
            ? 1080
            : 1600),
        height:
          meta.height ||
          (formato === "story-instagram"
            ? 1920
            : formato === "publicacao-instagram"
            ? 1080
            : 600),
        origem: adaptedRes.adapted ? ("falso-adaptado" as const) : ("fixture" as const),
        fixtureNome: picked.filename,
        custoEur: 0,
        metadata: {
          nasceuDoLogotipo: true,
          estiloDirecao: picked.dirSuffix,
          layoutId: picked.layoutKey,
          referenciaLogoUsada: Boolean(
            contexto?.logotipoReferencia && contexto.logotipoReferencia.length > 0
          ),
        },
      }));
    }

    // Fundos e objetos de reservas auxiliares
    if (formato === "fundo-capa") {
      const buf = loadFixtureBuffer("fundo-padaria-tradicional.png");
      const meta = await sharp(buf).metadata();
      return Array.from({ length: count }, () => ({
        buffer: buf,
        mimeType: "image/png" as const,
        width: meta.width || 1600,
        height: meta.height || 900,
        origem: "fixture" as const,
        fixtureNome: "fundo-padaria-tradicional.png",
        custoEur: 0,
      }));
    }

    if (formato === "fundo-textura") {
      const buf = loadFixtureBuffer("fundo-papel-artesanal.png");
      const meta = await sharp(buf).metadata();
      return Array.from({ length: count }, () => ({
        buffer: buf,
        mimeType: "image/png" as const,
        width: meta.width || 1600,
        height: meta.height || 900,
        origem: "fixture" as const,
        fixtureNome: "fundo-papel-artesanal.png",
        custoEur: 0,
      }));
    }

    if (formato === "objeto-recorte") {
      const buf = loadFixtureBuffer("objeto-pao-recortado.png");
      const meta = await sharp(buf).metadata();
      return Array.from({ length: count }, () => ({
        buffer: buf,
        mimeType: "image/png" as const,
        width: meta.width || 800,
        height: meta.height || 800,
        origem: "fixture" as const,
        fixtureNome: "objeto-pao-recortado.png",
        custoEur: 0,
      }));
    }

    // Logótipos para Forno da Vilariça ou contexto padrão: devolve as amostras desenhadas de alta definição
    const ronda = Math.max(1, Math.min(3, contexto?.ronda || 1));
    if (isFornoFixtureBrand(contexto?.nome)) {
      const results: ImagemResultado[] = [];
      for (let i = 0; i < count; i++) {
        const effFormato: ImagemFormato =
          count === 2 && i === 1 && formato === "logotipo-classico"
            ? "logotipo-moderno"
            : formato;
        const fixtureName = pickLogoFixtureName(effFormato, ronda);
        const buf = loadFixtureBuffer(fixtureName);
        const meta = await sharp(buf).metadata();
        results.push({
          buffer: buf,
          mimeType: "image/png",
          width: meta.width || 1024,
          height: meta.height || 520,
          origem: "fixture",
          fixtureNome: fixtureName,
          custoEur: 0,
          metadata: {
            ronda,
            formato: effFormato,
          },
        });
      }
      return results;
    }

    // Outras marcas em modo de demonstração: gera via gerador SVG de reserva e rasteriza para PNG limpo
    const sector =
      contexto?.sector && contexto.sector in SECTORS ? contexto.sector : "restauracao";
    const questionario = {
      nome: contexto?.nome?.trim() || "Nova Marca",
      slogan: contexto?.slogan?.trim() || "",
      sector,
      tresPalavras: contexto?.tresPalavras || "Qualidade, Confiança, Origem",
      coresPreferidas: contexto?.coresPreferidas || "Terracota e creme",
      coresEvitar: contexto?.coresEvitar || "Néons",
      referencias: [{ nota: "Referência de demonstração", nomeFicheiro: "ref.png" }],
    };

    const isModern = formato === "logotipo-moderno";
    const studioOptions =
      ronda > 1
        ? await generateRefinementRound(
            questionario,
            isModern ? "contemporanea" : "classica",
            Math.min(3, ronda)
          )
        : (await generateInitialDirections(questionario)).directions;

    const chosen = isModern ? studioOptions[1] || studioOptions[0] : studioOptions[0];
    const svgSrc = contexto?.simbolo ? chosen.simboloSvg : chosen.logoSvg;
    const rawPng = Buffer.from(
      new Resvg(svgSrc, { fitTo: { mode: "width", value: 1024 } }).render().asPng()
    );
    const meta = await sharp(rawPng).metadata();
    const bgHex = chosen.paleta.papel.hex;
    const bgRgb = hexToRgb(bgHex);

    const flatCanvas = await sharp({
      create: {
        width: 1024,
        height: 520,
        channels: 4,
        background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 1 },
      },
    })
      .composite([
        {
          input: await sharp(rawPng)
            .resize(840, 380, {
              fit: "contain",
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toBuffer(),
          gravity: "center",
        },
      ])
      .png()
      .toBuffer();

    return Array.from({ length: count }, () => ({
      buffer: flatCanvas,
      mimeType: "image/png" as const,
      width: 1024,
      height: 520,
      origem: "falso-adaptado" as const,
      custoEur: 0,
      metadata: {
        ronda,
        reservaSvg: true,
        origWidth: meta.width || 1024,
      },
    }));
  }

  async editar(
    imagem: Buffer,
    instrucao: string,
    contexto?: ImagemContexto
  ): Promise<ImagemResultado> {
    const cleanInstr = (instrucao || "").trim().toLowerCase();

    // Na primeira afinação para o ensaio Forno da Vilariça devolve logo-ajuste-amostra.png
    const ajusteFixture = loadFixtureBuffer("logo-ajuste-amostra.png");
    const useDirectAjusteFixture =
      isFornoFixtureBrand(contexto?.nome) &&
      Buffer.compare(imagem, ajusteFixture) !== 0 &&
      !cleanInstr.includes("modern") &&
      !cleanInstr.includes("verde");

    if (useDirectAjusteFixture) {
      const meta = await sharp(ajusteFixture).metadata();
      return {
        buffer: ajusteFixture,
        mimeType: "image/png",
        width: meta.width || 1024,
        height: meta.height || 520,
        origem: "fixture",
        fixtureNome: "logo-ajuste-amostra.png",
        custoEur: 0,
        metadata: { instrucao: instrucao.trim() },
      };
    }

    // Caso contrário aplica uma transformação real visível sobre o buffer recebido
    let pipe = sharp(imagem).ensureAlpha();
    if (cleanInstr.includes("escur") || cleanInstr.includes("contraste") || cleanInstr.includes("forte")) {
      pipe = pipe.modulate({ brightness: 0.94, saturation: 1.18 }).linear(1.08, -6);
    } else if (cleanInstr.includes("quente") || cleanInstr.includes("dourad") || cleanInstr.includes("trigo")) {
      pipe = pipe.modulate({ hue: 12, saturation: 1.14, brightness: 1.02 });
    } else if (cleanInstr.includes("suav") || cleanInstr.includes("clar") || cleanInstr.includes("minimal")) {
      pipe = pipe.modulate({ saturation: 0.85, brightness: 1.04 });
    } else {
      pipe = pipe.modulate({ hue: -10, saturation: 1.1 });
    }

    const editedBuf = await pipe.png().toBuffer();
    const meta = await sharp(editedBuf).metadata();
    return {
      buffer: editedBuf,
      mimeType: "image/png",
      width: meta.width || 1024,
      height: meta.height || 520,
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
      height: meta.height || 520,
      origem: "falso-adaptado",
      custoEur: 0,
    };
  }

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
  const clean = colorsHex.filter((c) => c.toUpperCase() !== "#FFFFFF" && c.toUpperCase() !== "#FAF8F5");
  const primaria = clean[0] || "#B84A24";
  const secundaria = clean[1] || rgbToHex({ r: 217, g: 130, b: 43 });
  return buildBrandPalette({
    primaria,
    secundaria,
    papel: "#FAF6F0",
    tinta: "#2A1810",
  });
}
