import React from "react";
import satori from "satori";
import {
  BrandPalette,
  FONT_PAIRS,
  FontPairId,
  SECTORS,
  SectorId,
} from "../formats";
import { getSatoriFontsForPair } from "../fonts";
import { buildBrandPalette, hslToHex, mixHex } from "../palette";
import { requestAiConceptEnhancement } from "./ai-provider";

const h = React.createElement;

export interface ReferenceItemInput {
  nomeFicheiro?: string;
  nota: string;
  dataUrl?: string;
}

export interface QuestionnaireInputA {
  nome: string;
  slogan?: string;
  sector: SectorId;
  tresPalavras: string;
  coresPreferidas: string;
  coresEvitar: string;
  referencias: ReferenceItemInput[];
}

export type DirectionId = "classica" | "contemporanea";

export interface StudioLogoOption {
  id: string;
  directionId: DirectionId;
  round: number; // 0 para direções iniciais, 1..3 para refinamentos
  variantIndex: 1 | 2;
  titulo: string;
  subtitulo: string;
  racional: string;
  fontPairId: FontPairId;
  paleta: BrandPalette;
  logoSvg: string;
  simboloSvg: string;
  symbolStyleVariant: number; // 1..6
  lockupLayout: "left-emblem" | "badge-framed" | "stacked-crest" | "editorial-split";
}

export interface FinalVariantsA {
  horizontalSvg: string;
  verticalSvg: string;
  simboloSvg: string;
  monocromaticoSvg: string;
  negativoSvg: string;
}

const STOPWORDS_PT = new Set([
  "da",
  "de",
  "do",
  "das",
  "dos",
  "e",
  "a",
  "o",
  "as",
  "os",
  "na",
  "no",
  "nas",
  "nos",
  "em",
  "para",
  "com",
]);

export function extractBrandTokens(nome: string): {
  mainWord: string;
  restWords: string;
  initials: string;
  firstInitial: string;
  secondInitial: string;
} {
  const rawWords = (nome || "Marca")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const significant = rawWords.filter(
    (w) => !STOPWORDS_PT.has(w.toLowerCase().replace(/[^a-záàâãçéêíóôõú]/gi, ""))
  );

  const pool = significant.length > 0 ? significant : rawWords;
  const cleanChar = (s: string) =>
    (s || "M")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()[0] || "M";

  const firstInitial = cleanChar(pool[0] || "M");
  const secondInitial =
    pool.length > 1
      ? cleanChar(pool[1])
      : cleanChar((pool[0] || "MA").slice(1) || "A");

  return {
    mainWord: rawWords[0] || "Marca",
    restWords: rawWords.slice(1).join(" "),
    initials: `${firstInitial}${secondInitial}`,
    firstInitial,
    secondInitial,
  };
}

const COLOR_KEYWORD_HUES: { keywords: string[]; h: number; s: number; l: number }[] = [
  { keywords: ["terracota", "tijolo", "barro", "forno", "telha"], h: 16, s: 68, l: 43 },
  { keywords: ["ocre", "trigo", "espiga", "dourado", "ouro", "mel", "mostarda", "amarelo"], h: 36, s: 76, l: 48 },
  { keywords: ["castanho", "chocolate", "cafe", "madeira", "terra", "tostado"], h: 24, s: 56, l: 28 },
  { keywords: ["laranja", "cobre", "ferrugem", "ambar", "zarcao"], h: 24, s: 78, l: 48 },
  { keywords: ["vermelho", "carmim", "bordo", "vinho", "rubi", "cereja"], h: 352, s: 66, l: 38 },
  { keywords: ["verde", "oliva", "floresta", "salvia", "musgo", "esmeralda", "folha"], h: 146, s: 46, l: 32 },
  { keywords: ["azul", "marinho", "oceano", "cobalto", "indigo", "petroleo"], h: 214, s: 64, l: 32 },
  { keywords: ["turquesa", "ciano", "agua"], h: 184, s: 62, l: 36 },
  { keywords: ["rosa", "coral", "salmao", "argila"], h: 12, s: 64, l: 56 },
  { keywords: ["roxo", "violeta", "ameixa", "lavanda", "purpura"], h: 274, s: 48, l: 38 },
  { keywords: ["cinza", "ardosia", "grafite", "carvao", "aco", "preto"], h: 215, s: 18, l: 24 },
];

const SECTOR_DEFAULT_HUES: Record<SectorId, { h1: number; s1: number; l1: number; h2: number; s2: number; l2: number }> = {
  restauracao: { h1: 16, s1: 68, l1: 42, h2: 37, s2: 78, l2: 52 },
  saude: { h1: 158, s1: 45, l1: 33, h2: 192, s2: 54, l2: 42 },
  servicos: { h1: 214, s1: 62, l1: 30, h2: 26, s2: 74, l2: 48 },
  comercio: { h1: 20, s1: 72, l1: 45, h2: 204, s2: 58, l2: 34 },
  tecnologia: { h1: 222, s1: 72, l1: 36, h2: 186, s2: 74, l2: 42 },
  beleza: { h1: 344, s1: 46, l1: 38, h2: 28, s2: 58, l2: 56 },
  construcao: { h1: 24, s1: 74, l1: 44, h2: 212, s2: 36, l2: 26 },
  educacao: { h1: 206, s1: 66, l1: 32, h2: 38, s2: 78, l2: 50 },
  outro: { h1: 208, s1: 58, l1: 34, h2: 28, s2: 72, l2: 48 },
};

function normalizeTextPT(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

export function derivePalettesForDirections(input: QuestionnaireInputA): {
  classicaPalette: BrandPalette;
  contemporaneaPalette: BrandPalette;
} {
  const prefNorm = normalizeTextPT(input.coresPreferidas);
  const avoidNorm = normalizeTextPT(input.coresEvitar);
  const sectorDefaults = SECTOR_DEFAULT_HUES[input.sector] || SECTOR_DEFAULT_HUES.outro;

  const matchedPrefs = COLOR_KEYWORD_HUES.filter((entry) =>
    entry.keywords.some((kw) => prefNorm.includes(kw))
  );
  const matchedAvoids = COLOR_KEYWORD_HUES.filter((entry) =>
    entry.keywords.some((kw) => avoidNorm.includes(kw))
  );

  const isAvoidedHue = (h: number) =>
    matchedAvoids.some((av) => hueDistance(h, av.h) < 34);

  let baseH1 = matchedPrefs[0]?.h ?? sectorDefaults.h1;
  const baseS1 = matchedPrefs[0]?.s ?? sectorDefaults.s1;
  const baseL1 = matchedPrefs[0]?.l ?? sectorDefaults.l1;

  if (isAvoidedHue(baseH1)) {
    baseH1 = (baseH1 + 95) % 360;
  }

  let baseH2 = matchedPrefs[1]?.h ?? sectorDefaults.h2;
  const baseS2 = matchedPrefs[1]?.s ?? sectorDefaults.s2;
  const baseL2 = matchedPrefs[1]?.l ?? sectorDefaults.l2;

  if (isAvoidedHue(baseH2) || hueDistance(baseH1, baseH2) < 18) {
    baseH2 = (baseH1 + 32) % 360;
    if (isAvoidedHue(baseH2)) {
      baseH2 = (baseH1 + 145) % 360;
    }
  }

  // Direction 1 (Clássica): Warm, rich, heritage tones anchored in preferred colors
  const classicaPalette = buildBrandPalette({
    primaria: hslToHex(baseH1, baseS1, baseL1),
    secundaria: hslToHex(baseH2, baseS2, baseL2),
    papel: hslToHex(baseH1, 26, 97),
    tinta: hslToHex(baseH1, 32, 13),
  });

  // Direction 2 (Contemporânea): Distinctly bolder chromatic balance & deeper contrast
  let contempH1 = matchedPrefs[1]?.h ?? (baseH1 + 185) % 360;
  if (isAvoidedHue(contempH1)) {
    contempH1 = (baseH1 + 42) % 360;
  }
  const contempPrimary =
    matchedPrefs.length >= 2
      ? hslToHex(baseH2, Math.min(82, baseS2 + 6), Math.max(26, baseL2 - 10))
      : hslToHex((baseH1 + 160) % 360, 58, 28);
  const contempSecondary = hslToHex(baseH1, Math.min(86, baseS1 + 10), Math.min(56, baseL1 + 8));

  const contemporaneaPalette = buildBrandPalette({
    primaria: contempPrimary,
    secundaria: contempSecondary,
    papel: hslToHex(baseH2, 18, 96),
    tinta: hslToHex((baseH1 + 180) % 360, 28, 12),
  });

  return { classicaPalette, contemporaneaPalette };
}

/**
 * Desenha o símbolo vectorial de estúdio (em SVG puro, 320×320 viewBox)
 * com 6 composições arquitectónicas e emblemáticas distintas (3 clássicas e 3 contemporâneas),
 * adaptadas ao sector e às iniciais da marca. Sem formas stock banais.
 */
export function buildStudioSymbolSvg(params: {
  sector: SectorId;
  directionId: DirectionId;
  symbolStyleVariant: number; // 1..6
  firstInitial: string;
  secondInitial: string;
  primaryHex: string;
  secondaryHex: string;
  inkHex: string;
  paperHex: string;
  monochromeHex?: string;
}): string {
  const {
    sector,
    directionId,
    symbolStyleVariant,
    primaryHex,
    secondaryHex,
    inkHex,
    paperHex,
    monochromeHex,
  } = params;

  const cPrim = monochromeHex || primaryHex;
  const cSec = monochromeHex || secondaryHex;
  const cInk = monochromeHex || inkHex;
  const cPaper = monochromeHex ? "#FFFFFF" : paperHex;

  // Sector motif inner path (320x320 coordinate space, centered at 160,160)
  const renderSectorCoreMotif = (variant: number): string => {
    if (sector === "restauracao") {
      if (directionId === "classica") {
        // Vaulted artisan stone oven arch + rising wheat ear + hearth glow
        return `
          <!-- Abóbada de forno tradicional e espiga de trigo -->
          <path d="M 76 238 L 76 146 C 76 92, 114 56, 160 56 C 206 56, 244 92, 244 146 L 244 238 Z" fill="${cPrim}" />
          <path d="M 96 238 L 96 150 C 96 108, 124 78, 160 78 C 196 78, 224 108, 224 150 L 224 238 Z" fill="${cPaper}" />
          <path d="M 114 238 L 114 156 C 114 124, 134 100, 160 100 C 186 100, 206 124, 206 156 L 206 238 Z" fill="${cInk}" />
          ${
            variant % 2 === 1
              ? `<path d="M 128 238 C 128 198, 142 176, 160 176 C 178 176, 192 198, 192 238 Z" fill="${cSec}" />`
              : `<circle cx="160" cy="198" r="24" fill="${cSec}" />`
          }
          <!-- Espiga botânica central -->
          <rect x="157.5" y="114" width="5" height="114" rx="2.5" fill="${cPaper}" />
          <ellipse cx="145" cy="134" rx="10.5" ry="5" transform="rotate(-32 145 134)" fill="${cSec}" />
          <ellipse cx="175" cy="134" rx="10.5" ry="5" transform="rotate(32 175 134)" fill="${cSec}" />
          <ellipse cx="144" cy="154" rx="11" ry="5.5" transform="rotate(-32 144 154)" fill="${cSec}" />
          <ellipse cx="176" cy="154" rx="11" ry="5.5" transform="rotate(32 176 154)" fill="${cSec}" />
          <ellipse cx="145" cy="174" rx="10.5" ry="5" transform="rotate(-32 145 174)" fill="${cPaper}" />
          <ellipse cx="175" cy="174" rx="10.5" ry="5" transform="rotate(32 175 174)" fill="${cPaper}" />
          <ellipse cx="160" cy="112" rx="5" ry="11" fill="${cSec}" />
          <rect x="64" y="244" width="192" height="14" rx="7" fill="${cInk}" />
        `;
      } else {
        // Contemporary geometric sun-arch & terraced valley grain emblem
        return `
          <!-- Emblema geométrico contemporâneo: Sol nascente no vale + lâmina de trigo -->
          <rect x="52" y="52" width="216" height="216" rx="${variant === 2 ? "48" : "28"}" fill="${cInk}" />
          <path d="M 84 220 C 84 152, 118 112, 160 112 C 202 112, 236 152, 236 220 Z" fill="${cPrim}" />
          <circle cx="160" cy="132" r="34" fill="${cSec}" />
          <!-- Ondas de seara / sulcos do vale -->
          <path d="M 76 220 Q 118 192 160 220 T 244 220 L 244 242 L 76 242 Z" fill="${cPaper}" />
          <path d="M 160 72 L 174 112 L 160 152 L 146 112 Z" fill="${cPaper}" />
          <circle cx="160" cy="72" r="6" fill="${cSec}" />
        `;
      }
    }

    if (sector === "servicos" || sector === "construcao" || sector === "tecnologia") {
      if (directionId === "classica") {
        return `
          <polygon points="104,44 216,44 276,104 276,216 216,276 104,276 44,216 44,104" fill="${cInk}" />
          <polygon points="112,62 208,62 258,112 258,208 208,258 112,258 62,208 62,112" fill="${cPaper}" />
          <path d="M 160 84 L 222 198 L 194 198 L 160 132 L 126 198 L 98 198 Z" fill="${cPrim}" />
          <rect x="116" y="172" width="88" height="14" rx="7" fill="${cSec}" />
          <circle cx="160" cy="96" r="14" fill="${cSec}" />
        `;
      } else {
        return `
          <rect x="48" y="48" width="224" height="224" rx="40" fill="${cPrim}" />
          <path d="M 96 160 L 160 96 L 224 160 L 160 224 Z" fill="${cPaper}" />
          <path d="M 124 160 L 160 124 L 196 160 L 160 196 Z" fill="${cInk}" />
          <circle cx="160" cy="160" r="14" fill="${cSec}" />
        `;
      }
    }

    // Bespoke intertwined architectural crest & botanical/editorial emblem for all other sectors
    if (directionId === "classica") {
      return `
        <path d="M 160 38 L 262 88 L 262 178 C 262 232, 218 268, 160 284 C 102 268, 58 232, 58 178 L 58 88 Z" fill="${cPrim}" />
        <path d="M 160 58 L 244 100 L 244 176 C 244 220, 208 250, 160 264 C 112 250, 76 220, 76 176 L 76 100 Z" fill="${cPaper}" />
        <path d="M 160 84 C 194 84, 218 112, 218 156 C 218 200, 194 226, 160 226 C 126 226, 102 200, 102 156 C 102 112, 126 84, 160 84 Z" fill="${cInk}" />
        <path d="M 160 104 L 182 156 L 160 208 L 138 156 Z" fill="${cSec}" />
        <circle cx="160" cy="156" r="10" fill="${cPaper}" />
      `;
    } else {
      return `
        <rect x="48" y="48" width="224" height="224" rx="52" fill="${cInk}" />
        <path d="M 92 212 L 92 108 L 160 162 L 228 108 L 228 212 L 198 212 L 198 154 L 160 186 L 122 154 L 122 212 Z" fill="${cPaper}" />
        <circle cx="160" cy="112" r="20" fill="${cSec}" />
        <rect x="92" y="224" width="136" height="12" rx="6" fill="${cPrim}" />
      `;
    }
  };

  // Outer framing variations for rounds 1..3 so every refinement is visually distinct
  const renderOuterOrnament = (): string => {
    if (symbolStyleVariant === 1) {
      return `<circle cx="160" cy="160" r="144" fill="none" stroke="${cSec}" stroke-width="4" stroke-dasharray="12 8" />`;
    }
    if (symbolStyleVariant === 2) {
      return `<rect x="20" y="20" width="280" height="280" rx="36" fill="none" stroke="${cPrim}" stroke-width="5" />`;
    }
    if (symbolStyleVariant === 3) {
      return `
        <polygon points="160,12 292,86 292,234 160,308 28,234 28,86" fill="none" stroke="${cSec}" stroke-width="5" />
      `;
    }
    if (symbolStyleVariant === 4) {
      return `
        <circle cx="160" cy="160" r="146" fill="none" stroke="${cInk}" stroke-width="3" />
        <circle cx="160" cy="160" r="136" fill="none" stroke="${cSec}" stroke-width="2" />
      `;
    }
    if (symbolStyleVariant === 5) {
      return `
        <rect x="24" y="24" width="272" height="272" rx="68" fill="none" stroke="${cSec}" stroke-width="6" />
      `;
    }
    return `
      <path d="M 42 80 L 42 42 L 80 42 M 240 42 L 278 42 L 278 80 M 278 240 L 278 278 L 240 278 M 80 278 L 42 278 L 42 240" fill="none" stroke="${cPrim}" stroke-width="6" stroke-linecap="round" />
    `;
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
  ${renderOuterOrnament()}
  ${renderSectorCoreMotif(symbolStyleVariant)}
</svg>`;
}

/**
 * Compõe o logótipo completo (símbolo + tipografia vectorial convertida em curvas via Satori)
 * para garantir tipografia de estúdio perfeitamente espaçada e 100% vectorial em SVG.
 */
export async function composeVectorLogoSvg(params: {
  nome: string;
  slogan?: string;
  sector: SectorId;
  fontPairId: FontPairId;
  paleta: BrandPalette;
  symbolSvg: string;
  layout: "horizontal" | "vertical" | "badge";
  mode?: "color" | "monochrome" | "negative";
}): Promise<string> {
  const {
    nome,
    slogan,
    sector,
    fontPairId,
    paleta,
    symbolSvg,
    layout,
    mode = "color",
  } = params;

  const { pair, fonts } = getSatoriFontsForPair(fontPairId);
  const { mainWord, restWords } = extractBrandTokens(nome);

  const symbolDataUrl = `data:image/svg+xml;base64,${Buffer.from(symbolSvg, "utf8").toString("base64")}`;

  const titleColor =
    mode === "negative"
      ? "#FAF8F5"
      : mode === "monochrome"
      ? "#141413"
      : paleta.tinta.hex;

  const restColor =
    mode === "negative"
      ? paleta.secundaria.hex
      : mode === "monochrome"
      ? "#141413"
      : paleta.primaria.hex;

  const accentRuleColor =
    mode === "negative"
      ? paleta.primaria.hex
      : mode === "monochrome"
      ? "#141413"
      : paleta.secundaria.hex;

  const subtitleColor =
    mode === "negative"
      ? "#E2E8F0"
      : mode === "monochrome"
      ? "#334155"
      : paleta.neutro.hex;

  const bgStyle =
    mode === "negative" ? paleta.tinta.hex : "transparent";

  if (layout === "vertical") {
    const width = 1000;
    const height = 1000;
    const el = h(
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
          backgroundColor: bgStyle,
          padding: "72px",
        },
      },
      h("img", {
        src: symbolDataUrl,
        width: 380,
        height: 380,
        style: { objectFit: "contain" },
      }),
      h(
        "div",
        {
          style: {
            fontFamily: pair.tituloFamily,
            fontWeight: pair.tituloWeight,
            fontSize: mainWord.length > 12 ? "76px" : "92px",
            color: titleColor,
            letterSpacing: "0.04em",
            marginTop: "36px",
            lineHeight: 1.05,
            textAlign: "center",
          },
        },
        mainWord.toUpperCase()
      ),
      restWords
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.textoFamily,
                fontWeight: 400,
                fontSize: "54px",
                color: restColor,
                marginTop: "8px",
                textAlign: "center",
              },
            },
            restWords
          )
        : null,
      h("div", {
        style: {
          width: "140px",
          height: "5px",
          backgroundColor: accentRuleColor,
          borderRadius: "3px",
          marginTop: "22px",
        },
      }),
      h(
        "div",
        {
          style: {
            fontFamily: pair.tituloFamily,
            fontWeight: 400,
            fontSize: "22px",
            letterSpacing: "0.18em",
            color: subtitleColor,
            marginTop: "18px",
            textAlign: "center",
          },
        },
        (slogan || SECTORS[sector]?.rotulo || "").toUpperCase().slice(0, 42)
      )
    );

    return satori(el, { width, height, fonts });
  }

  // Horizontal studio lockup (1400 x 520)
  const width = 1400;
  const height = 520;
  const el = h(
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
        backgroundColor: bgStyle,
        padding: "44px 76px",
        gap: "52px",
        borderRadius: mode === "negative" ? "24px" : "0px",
      },
    },
    h("img", {
      src: symbolDataUrl,
      width: 340,
      height: 340,
      style: { objectFit: "contain" },
    }),
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          maxWidth: "840px",
        },
      },
      h(
        "div",
        {
          style: {
            fontFamily: pair.tituloFamily,
            fontWeight: pair.tituloWeight,
            fontSize: mainWord.length > 12 ? "84px" : "104px",
            color: titleColor,
            letterSpacing: "0.03em",
            lineHeight: 1.02,
          },
        },
        mainWord.toUpperCase()
      ),
      restWords
        ? h(
            "div",
            {
              style: {
                fontFamily: pair.textoFamily,
                fontWeight: 400,
                fontSize: "62px",
                color: restColor,
                marginTop: "6px",
                lineHeight: 1.1,
              },
            },
            restWords
          )
        : null,
      h("div", {
        style: {
          width: "220px",
          height: "6px",
          backgroundColor: accentRuleColor,
          borderRadius: "3px",
          marginTop: "22px",
        },
      }),
      h(
        "div",
        {
          style: {
            fontFamily: pair.tituloFamily,
            fontWeight: 400,
            fontSize: "24px",
            letterSpacing: "0.16em",
            color: subtitleColor,
            marginTop: "18px",
          },
        },
        (slogan || SECTORS[sector]?.rotulo || "").toUpperCase().slice(0, 46)
      )
    )
  );

  return satori(el, { width, height, fonts });
}

export async function generateInitialDirections(
  input: QuestionnaireInputA
): Promise<{
  directions: [StudioLogoOption, StudioLogoOption];
  aiStatus: { usedAiProvider: boolean; providerName: string };
}> {
  const aiStatus = await requestAiConceptEnhancement({
    nome: input.nome,
    sector: input.sector,
    tresPalavras: input.tresPalavras,
    coresPreferidas: input.coresPreferidas,
    coresEvitar: input.coresEvitar,
    notasReferencias: (input.referencias || []).map((r) => r.nota),
  });

  const { firstInitial, secondInitial } = extractBrandTokens(input.nome);
  const { classicaPalette, contemporaneaPalette } =
    derivePalettesForDirections(input);

  const sectorSpec = SECTORS[input.sector] || SECTORS.outro;
  const fontClassica: FontPairId =
    sectorSpec.parSugerido === "moderna" || sectorSpec.parSugerido === "tecnica"
      ? "editorial"
      : sectorSpec.parSugerido;
  const fontContemp: FontPairId =
    sectorSpec.parSugerido === "moderna" ? "tecnica" : "moderna";

  // Direction 1: Clássica & Arquitectónica
  const simbolo1 = buildStudioSymbolSvg({
    sector: input.sector,
    directionId: "classica",
    symbolStyleVariant: 1,
    firstInitial,
    secondInitial,
    primaryHex: classicaPalette.primaria.hex,
    secondaryHex: classicaPalette.secundaria.hex,
    inkHex: classicaPalette.tinta.hex,
    paperHex: classicaPalette.papel.hex,
  });

  const logoSvg1 = await composeVectorLogoSvg({
    nome: input.nome,
    slogan: input.slogan,
    sector: input.sector,
    fontPairId: fontClassica,
    paleta: classicaPalette,
    symbolSvg: simbolo1,
    layout: "horizontal",
  });

  const dirClassica: StudioLogoOption = {
    id: "dir_classica_0",
    directionId: "classica",
    round: 0,
    variantIndex: 1,
    titulo: "Direção I — Selo de Ofício & Tradição",
    subtitulo: `Composição emblemática com par ${FONT_PAIRS[fontClassica].nome}`,
    racional: `Símbolo arquitectónico desenhado à medida do sector (${sectorSpec.rotulo}), combinado com tipografia ${FONT_PAIRS[fontClassica].tituloFamily} + ${FONT_PAIRS[fontClassica].textoFamily} e paleta fiel às cores preferidas.`,
    fontPairId: fontClassica,
    paleta: classicaPalette,
    logoSvg: logoSvg1,
    simboloSvg: simbolo1,
    symbolStyleVariant: 1,
    lockupLayout: "left-emblem",
  };

  // Direction 2: Contemporânea & Geométrica
  const simbolo2 = buildStudioSymbolSvg({
    sector: input.sector,
    directionId: "contemporanea",
    symbolStyleVariant: 2,
    firstInitial,
    secondInitial,
    primaryHex: contemporaneaPalette.primaria.hex,
    secondaryHex: contemporaneaPalette.secundaria.hex,
    inkHex: contemporaneaPalette.tinta.hex,
    paperHex: contemporaneaPalette.papel.hex,
  });

  const logoSvg2 = await composeVectorLogoSvg({
    nome: input.nome,
    slogan: input.slogan,
    sector: input.sector,
    fontPairId: fontContemp,
    paleta: contemporaneaPalette,
    symbolSvg: simbolo2,
    layout: "horizontal",
  });

  const dirContemporanea: StudioLogoOption = {
    id: "dir_contemporanea_0",
    directionId: "contemporanea",
    round: 0,
    variantIndex: 2,
    titulo: "Direção II — Insígnia Geométrica Contemporânea",
    subtitulo: `Síntese estrutural moderna com par ${FONT_PAIRS[fontContemp].nome}`,
    racional: `Geometria contemporânea de alto contraste e leitura imediata em formatos reduzidos, apoiada pelo par tipográfico ${FONT_PAIRS[fontContemp].tituloFamily} + ${FONT_PAIRS[fontContemp].textoFamily}.`,
    fontPairId: fontContemp,
    paleta: contemporaneaPalette,
    logoSvg: logoSvg2,
    simboloSvg: simbolo2,
    symbolStyleVariant: 2,
    lockupLayout: "badge-framed",
  };

  return {
    directions: [dirClassica, dirContemporanea],
    aiStatus,
  };
}

export async function generateRefinementRound(
  input: QuestionnaireInputA,
  directionId: DirectionId,
  round: number
): Promise<[StudioLogoOption, StudioLogoOption]> {
  // Strictly clamp round to 1..3 as specified in section 6.2
  const safeRound = Math.max(1, Math.min(3, Math.round(round)));
  const { firstInitial, secondInitial } = extractBrandTokens(input.nome);
  const { classicaPalette, contemporaneaPalette } =
    derivePalettesForDirections(input);

  const basePalette =
    directionId === "classica" ? classicaPalette : contemporaneaPalette;

  const fontChoices: Record<DirectionId, [FontPairId, FontPairId][]> = {
    classica: [
      ["clara", "editorial"],
      ["confianca", "clara"],
      ["editorial", "confianca"],
    ],
    contemporanea: [
      ["moderna", "tecnica"],
      ["tecnica", "editorial"],
      ["moderna", "clara"],
    ],
  };

  const [fontA, fontB] = fontChoices[directionId][safeRound - 1];

  // Option A of current round: Refined symbol framing + primary palette
  const palA = buildBrandPalette({
    primaria: basePalette.primaria.hex,
    secundaria: basePalette.secundaria.hex,
    papel: basePalette.papel.hex,
    tinta: basePalette.tinta.hex,
  });

  // Option B of current round: Distinct chromatic accent & alternate symbol frame
  const palB = buildBrandPalette({
    primaria: mixHex(basePalette.primaria.hex, basePalette.tinta.hex, 0.18),
    secundaria: mixHex(basePalette.secundaria.hex, "#D97706", 0.35),
    papel: basePalette.papel.hex,
    tinta: basePalette.tinta.hex,
  });

  const variantNumA = ((safeRound - 1) * 2 + 1) % 6 || 6;
  const variantNumB = ((safeRound - 1) * 2 + 2) % 6 || 6;

  const simboloA = buildStudioSymbolSvg({
    sector: input.sector,
    directionId,
    symbolStyleVariant: variantNumA,
    firstInitial,
    secondInitial,
    primaryHex: palA.primaria.hex,
    secondaryHex: palA.secundaria.hex,
    inkHex: palA.tinta.hex,
    paperHex: palA.papel.hex,
  });

  const logoSvgA = await composeVectorLogoSvg({
    nome: input.nome,
    slogan: input.slogan,
    sector: input.sector,
    fontPairId: fontA,
    paleta: palA,
    symbolSvg: simboloA,
    layout: "horizontal",
  });

  const simboloB = buildStudioSymbolSvg({
    sector: input.sector,
    directionId,
    symbolStyleVariant: variantNumB,
    firstInitial,
    secondInitial,
    primaryHex: palB.primaria.hex,
    secondaryHex: palB.secundaria.hex,
    inkHex: palB.tinta.hex,
    paperHex: palB.papel.hex,
  });

  const logoSvgB = await composeVectorLogoSvg({
    nome: input.nome,
    slogan: input.slogan,
    sector: input.sector,
    fontPairId: fontB,
    paleta: palB,
    symbolSvg: simboloB,
    layout: "horizontal",
  });

  const optA: StudioLogoOption = {
    id: `ref_${directionId}_r${safeRound}_a`,
    directionId,
    round: safeRound,
    variantIndex: 1,
    titulo: `Afinação ${safeRound}.A — Equilíbrio Estrutural`,
    subtitulo: `Moldura de precisão com tipografia ${FONT_PAIRS[fontA].nome}`,
    racional: `Ronda ${safeRound}/3: refina as proporções entre o símbolo e o nome com espaçamento óptico calibrado em ${FONT_PAIRS[fontA].tituloFamily}.`,
    fontPairId: fontA,
    paleta: palA,
    logoSvg: logoSvgA,
    simboloSvg: simboloA,
    symbolStyleVariant: variantNumA,
    lockupLayout: "left-emblem",
  };

  const optB: StudioLogoOption = {
    id: `ref_${directionId}_r${safeRound}_b`,
    directionId,
    round: safeRound,
    variantIndex: 2,
    titulo: `Afinação ${safeRound}.B — Insígnia de Destaque`,
    subtitulo: `Variação de emblema e acento com par ${FONT_PAIRS[fontB].nome}`,
    racional: `Ronda ${safeRound}/3: acentua o carácter do símbolo com moldura distinta e contraste tipográfico em ${FONT_PAIRS[fontB].tituloFamily} + ${FONT_PAIRS[fontB].textoFamily}.`,
    fontPairId: fontB,
    paleta: palB,
    logoSvg: logoSvgB,
    simboloSvg: simboloB,
    symbolStyleVariant: variantNumB,
    lockupLayout: "badge-framed",
  };

  return [optA, optB];
}

export async function generateFinalVariantsA(
  input: QuestionnaireInputA,
  chosen: StudioLogoOption
): Promise<FinalVariantsA> {
  const { firstInitial, secondInitial } = extractBrandTokens(input.nome);

  const simboloColor = chosen.simboloSvg;
  const simboloMono = buildStudioSymbolSvg({
    sector: input.sector,
    directionId: chosen.directionId,
    symbolStyleVariant: chosen.symbolStyleVariant,
    firstInitial,
    secondInitial,
    primaryHex: chosen.paleta.primaria.hex,
    secondaryHex: chosen.paleta.secundaria.hex,
    inkHex: chosen.paleta.tinta.hex,
    paperHex: chosen.paleta.papel.hex,
    monochromeHex: "#141413",
  });

  const simboloNeg = buildStudioSymbolSvg({
    sector: input.sector,
    directionId: chosen.directionId,
    symbolStyleVariant: chosen.symbolStyleVariant,
    firstInitial,
    secondInitial,
    primaryHex: chosen.paleta.secundaria.hex,
    secondaryHex: chosen.paleta.primaria.hex,
    inkHex: "#FAF8F5",
    paperHex: chosen.paleta.tinta.hex,
  });

  const horizontalSvg = await composeVectorLogoSvg({
    nome: input.nome,
    slogan: input.slogan,
    sector: input.sector,
    fontPairId: chosen.fontPairId,
    paleta: chosen.paleta,
    symbolSvg: simboloColor,
    layout: "horizontal",
    mode: "color",
  });

  const verticalSvg = await composeVectorLogoSvg({
    nome: input.nome,
    slogan: input.slogan,
    sector: input.sector,
    fontPairId: chosen.fontPairId,
    paleta: chosen.paleta,
    symbolSvg: simboloColor,
    layout: "vertical",
    mode: "color",
  });

  const monocromaticoSvg = await composeVectorLogoSvg({
    nome: input.nome,
    slogan: input.slogan,
    sector: input.sector,
    fontPairId: chosen.fontPairId,
    paleta: chosen.paleta,
    symbolSvg: simboloMono,
    layout: "horizontal",
    mode: "monochrome",
  });

  const negativoSvg = await composeVectorLogoSvg({
    nome: input.nome,
    slogan: input.slogan,
    sector: input.sector,
    fontPairId: chosen.fontPairId,
    paleta: chosen.paleta,
    symbolSvg: simboloNeg,
    layout: "horizontal",
    mode: "negative",
  });

  return {
    horizontalSvg,
    verticalSvg,
    simboloSvg: simboloColor,
    monocromaticoSvg,
    negativoSvg,
  };
}
