import React from "react";
import satori from "satori";
import {
  BrandPalette,
  FONT_PAIRS,
  FontPairId,
  SECTORS,
  SectorId,
} from "../formats";
import {
  getGeometricSansStudioFonts,
  getSatoriFontsForPair,
} from "../fonts";
import { buildBrandPalette, hexToRgb, hslToHex, mixHex, rgbToHsl } from "../palette";
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

export type WordmarkLockupStyle =
  | "classic-split"
  | "editorial-serif"
  | "crested-eyebrow"
  | "modern-geometric"
  | "modern-monolith";

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
  lockupLayout:
    | "left-emblem"
    | "badge-framed"
    | "stacked-crest"
    | "editorial-split";
  wordmarkStyle?: WordmarkLockupStyle;
}

export interface FinalVariantsA {
  horizontalSvg: string;
  verticalSvg: string;
  simboloSvg: string;
  monocromaticoSvg: string;
  negativoSvg: string;
  negativoTransparenteSvg?: string;
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
  fullUpper: string;
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
    fullUpper: (nome || "Marca").trim().toUpperCase(),
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

  const isAvoidedHue = (hVal: number) =>
    matchedAvoids.some((av) => hueDistance(hVal, av.h) < 34);

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

  // Direção I (Clássica): tons de ofício ricos ancorados nas cores preferidas
  const classicaPalette = buildBrandPalette({
    primaria: hslToHex(baseH1, baseS1, baseL1),
    secundaria: hslToHex(baseH2, baseS2, baseL2),
    papel: hslToHex(baseH1, 24, 97),
    tinta: hslToHex(baseH1, 30, 14),
  });

  // Direção II (Contemporânea): equilíbrio arquitetónico contrastante e nítido
  let contempH1 = (baseH1 + 195) % 360;
  if (isAvoidedHue(contempH1)) {
    contempH1 = (baseH2 + 24) % 360;
  }
  const contempPrimary =
    matchedPrefs.length >= 2
      ? hslToHex(baseH1, Math.min(78, baseS1 + 6), Math.max(32, baseL1 - 4))
      : hslToHex(contempH1, 64, 30);
  const contempSecondary = hslToHex(
    matchedPrefs[1]?.h ?? (baseH1 + 36) % 360,
    80,
    46
  );

  const contemporaneaPalette = buildBrandPalette({
    primaria: contempPrimary,
    secundaria: contempSecondary,
    papel: "#F6F5F2",
    tinta: hslToHex(contempH1, 32, 13),
  });

  return { classicaPalette, contemporaneaPalette };
}

/**
 * Converte as iniciais geométricas num conjunto de caminhos vectoriais <path> puros (via Satori)
 * para construir monogramas contemporâneos verdadeiros e escaláveis sem dependência de fontes do sistema.
 */
async function renderMonogramPathsInner(params: {
  firstInitial: string;
  secondInitial: string;
  colorA: string;
  colorB: string;
  accentColor: string;
  variant: "interlocking-portal" | "split-monolith" | "octagon-crest" | "diagonal-ribbon";
  isSingleColor: boolean;
}): Promise<string> {
  const {
    firstInitial,
    secondInitial,
    colorA,
    colorB,
    accentColor,
    variant,
    isSingleColor,
  } = params;

  const fonts = getGeometricSansStudioFonts();
  const cB = isSingleColor ? colorA : colorB;
  const cAcc = isSingleColor ? colorA : accentColor;

  if (variant === "split-monolith") {
    const el = h(
      "div",
      {
        style: {
          width: "320px",
          height: "320px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        },
      },
      h(
        "div",
        {
          style: {
            fontFamily: "Manrope",
            fontWeight: 800,
            fontSize: "136px",
            color: colorA,
            lineHeight: 0.9,
            marginRight: "14px",
          },
        },
        firstInitial
      ),
      h("div", {
        style: {
          width: "10px",
          height: "146px",
          backgroundColor: cAcc,
          borderRadius: "5px",
        },
      }),
      h(
        "div",
        {
          style: {
            fontFamily: "Manrope",
            fontWeight: 800,
            fontSize: "136px",
            color: cB,
            lineHeight: 0.9,
            marginLeft: "14px",
          },
        },
        secondInitial
      )
    );
    const svg = await satori(el, { width: 320, height: 320, fonts });
    return extractSvgInner(svg);
  }

  if (variant === "octagon-crest") {
    const el = h(
      "div",
      {
        style: {
          width: "320px",
          height: "320px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        },
      },
      h(
        "div",
        {
          style: {
            fontFamily: "Outfit",
            fontWeight: 800,
            fontSize: "118px",
            color: colorA,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          },
        },
        firstInitial
      ),
      h(
        "div",
        {
          style: {
            fontFamily: "Outfit",
            fontWeight: 700,
            fontSize: "118px",
            color: cB,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            marginLeft: "4px",
            marginTop: "22px",
          },
        },
        secondInitial
      )
    );
    const svg = await satori(el, { width: 320, height: 320, fonts });
    return extractSvgInner(svg);
  }

  // Default "interlocking-portal" / "diagonal-ribbon": crisp staggered heavy geometric initials
  const el = h(
    "div",
    {
      style: {
        width: "320px",
        height: "320px",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
      },
    },
    h(
      "div",
      {
        style: {
          fontFamily: "Outfit",
          fontWeight: 800,
          fontSize: "138px",
          color: colorA,
          lineHeight: 0.9,
          marginBottom: "18px",
          marginRight: "-8px",
        },
      },
      firstInitial
    ),
    h(
      "div",
      {
        style: {
          fontFamily: "Outfit",
          fontWeight: 800,
          fontSize: "138px",
          color: cB,
          lineHeight: 0.9,
          marginTop: "26px",
        },
      },
      secondInitial
    )
  );

  const svg = await satori(el, { width: 320, height: 320, fonts });
  return extractSvgInner(svg);
}

function extractSvgInner(svg: string): string {
  const start = svg.indexOf(">");
  const end = svg.lastIndexOf("</svg>");
  if (start === -1 || end === -1 || end <= start) return "";
  return svg.slice(start + 1, end);
}

/**
 * Desenha o símbolo vectorial de estúdio (viewBox 320×320):
 * - Espaço negativo limpo (ZERO círculos tracejados, ZERO caixas pesadas banais).
 * - Direção I (Clássica): emblemas arquitectónicos e botânicos com 6 proporções/pesos distintos.
 * - Direção II (Contemporânea): monogramas geométricos de linhas abertas e símbolos em linha contínua.
 * - Total suporte para renderização a cores, monocromática e negativa transparente sem fusão de manchas.
 */
export async function buildStudioSymbolSvg(params: {
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
  isNegativeOnDark?: boolean;
}): Promise<string> {
  const {
    sector,
    directionId,
    symbolStyleVariant,
    firstInitial,
    secondInitial,
    primaryHex,
    secondaryHex,
    inkHex,
    paperHex,
    monochromeHex,
    isNegativeOnDark = false,
  } = params;

  const isSingleInk = Boolean(monochromeHex);
  const cPrim = monochromeHex || primaryHex;
  const cSec = monochromeHex || secondaryHex;
  const cInk = monochromeHex || inkHex;
  const cPaper = monochromeHex ? "#FFFFFF" : paperHex;

  // -------------------------------------------------------------------------
  // DIREÇÃO II — CONTEMPORÂNEA (Monogramas Geométricos + Linha Contínua)
  // -------------------------------------------------------------------------
  if (directionId === "contemporanea") {
    const v = ((symbolStyleVariant - 1) % 6) + 1;

    // Variante 2 (Padrão Direção II Inicial): Monograma Geométrico entrelaçado + Arco/Portal aberto moderno
    if (v === 2) {
      const monogramInner = await renderMonogramPathsInner({
        firstInitial,
        secondInitial,
        colorA: cInk,
        colorB: cPrim,
        accentColor: cSec,
        variant: "interlocking-portal",
        isSingleColor: isSingleInk,
      });

      const sectorCrown =
        sector === "restauracao"
          ? `
            <!-- Recortes minimalistas de pão artesanal / chama geométrica no topo -->
            <line x1="142" y1="42" x2="154" y2="62" stroke="${cSec}" stroke-width="9" stroke-linecap="round" />
            <line x1="168" y1="36" x2="176" y2="58" stroke="${cSec}" stroke-width="9" stroke-linecap="round" />
          `
          : `
            <polygon points="160,24 176,40 160,56 144,40" fill="${cSec}" />
          `;

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
        <!-- Portal geométrico aberto moderno em linha limpa -->
        <path d="M 62 248 L 62 152 C 62 88, 104 48, 160 48 C 216 48, 258 88, 258 152" fill="none" stroke="${cPrim}" stroke-width="13" stroke-linecap="round" />
        <line x1="62" y1="268" x2="258" y2="268" stroke="${cSec}" stroke-width="11" stroke-linecap="round" />
        ${sectorCrown}
        <g transform="translate(0, 6)">
          ${monogramInner}
        </g>
      </svg>`;
    }

    // Variante 1 (Contemporânea R1.A): Símbolo puro em linha contínua (Pão / Espiga / Geometria contínua)
    if (v === 1) {
      if (sector === "restauracao") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
          <!-- Símbolo em linha contínua: base da côdea em arco que sobe em espiga geométrica minimalista -->
          <path d="M 48 228 L 272 228 C 266 154, 222 114, 160 114 C 102 114, 58 150, 50 218" fill="none" stroke="${cInk}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M 160 228 L 160 60 C 160 48, 172 42, 182 48" fill="none" stroke="${cPrim}" stroke-width="13" stroke-linecap="round" />
          <!-- Três traços oblíquos limpos de grão / corte de padeiro -->
          <line x1="126" y1="166" x2="150" y2="146" stroke="${cSec}" stroke-width="12" stroke-linecap="round" />
          <line x1="170" y1="138" x2="196" y2="118" stroke="${cSec}" stroke-width="12" stroke-linecap="round" />
          <line x1="128" y1="124" x2="150" y2="104" stroke="${cSec}" stroke-width="12" stroke-linecap="round" />
          <line x1="168" y1="96" x2="192" y2="76" stroke="${cPrim}" stroke-width="11" stroke-linecap="round" />
          <line x1="78" y1="254" x2="242" y2="254" stroke="${cPrim}" stroke-width="10" stroke-linecap="round" />
        </svg>`;
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
        <path d="M 66 218 L 66 112 L 160 58 L 254 112 L 254 208 L 160 262 L 106 231 L 106 135 L 160 104 L 214 135" fill="none" stroke="${cInk}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="160" cy="160" r="18" fill="${cSec}" />
      </svg>`;
    }

    // Variante 3 (Contemporânea R1.B): Monograma em Monólito Dividido com Cantoneiras Arquitectónicas
    if (v === 3) {
      const monogramInner = await renderMonogramPathsInner({
        firstInitial,
        secondInitial,
        colorA: cInk,
        colorB: cPrim,
        accentColor: cSec,
        variant: "split-monolith",
        isSingleColor: isSingleInk,
      });

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
        <!-- Cantoneiras minimalistas sem caixa fechada -->
        <path d="M 38 96 L 38 42 L 92 42" fill="none" stroke="${cSec}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M 282 224 L 282 278 L 228 278" fill="none" stroke="${cPrim}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
        ${monogramInner}
      </svg>`;
    }

    // Variante 4: Octógono linear geométrico com monograma centrado
    if (v === 4) {
      const monogramInner = await renderMonogramPathsInner({
        firstInitial,
        secondInitial,
        colorA: cInk,
        colorB: cPrim,
        accentColor: cSec,
        variant: "octagon-crest",
        isSingleColor: isSingleInk,
      });

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
        <polygon points="104,34 216,34 286,104 286,216 216,286 104,286 34,216 34,104" fill="none" stroke="${cPrim}" stroke-width="11" stroke-linejoin="round" />
        <g transform="scale(0.86) translate(26, 26)">
          ${monogramInner}
        </g>
      </svg>`;
    }

    // Variante 5: Emblema em linha dupla paralela / trigo moderno minimalista
    if (v === 5) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
        <path d="M 56 236 C 56 124, 102 68, 160 68 C 218 68, 264 124, 264 236" fill="none" stroke="${cInk}" stroke-width="15" stroke-linecap="round" />
        <path d="M 96 236 C 96 154, 124 110, 160 110 C 196 110, 224 154, 224 236" fill="none" stroke="${cPrim}" stroke-width="13" stroke-linecap="round" />
        <path d="M 160 236 L 160 144" fill="none" stroke="${cSec}" stroke-width="12" stroke-linecap="round" />
        <circle cx="160" cy="140" r="10" fill="${cSec}" />
        <line x1="48" y1="262" x2="272" y2="262" stroke="${cInk}" stroke-width="12" stroke-linecap="round" />
      </svg>`;
    }

    // Variante 6: Arco contínuo assimétrico com monograma integrado
    const monogramRibbon = await renderMonogramPathsInner({
      firstInitial,
      secondInitial,
      colorA: cInk,
      colorB: cPrim,
      accentColor: cSec,
      variant: "diagonal-ribbon",
      isSingleColor: isSingleInk,
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
      <path d="M 54 114 C 76 58, 138 34, 206 46 C 246 54, 270 78, 278 112" fill="none" stroke="${cSec}" stroke-width="11" stroke-linecap="round" />
      <g transform="scale(0.84) translate(30, 18)">
        ${monogramRibbon}
      </g>
      <line x1="68" y1="268" x2="252" y2="268" stroke="${cPrim}" stroke-width="12" stroke-linecap="round" />
    </svg>`;
  }

  // -------------------------------------------------------------------------
  // DIREÇÃO I — CLÁSSICA (Emblemas arquitectónicos e botânicos sem círculos tracejados)
  // -------------------------------------------------------------------------
  const cv = ((symbolStyleVariant - 1) % 6) + 1;

  if (sector === "restauracao") {
    // 1 (Direção I Inicial): Arco de forno tradicional em abóbada dupla limpa com espiga botânica (sem círculo tracejado!)
    if (cv === 1) {
      if (isSingleInk || isNegativeOnDark) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
          <!-- Versão monocromática/negativa com vazados transparentes nítidos em todos os grãos -->
          <path d="M 76 242 L 76 146 C 76 92, 114 56, 160 56 C 206 56, 244 92, 244 146 L 244 242" fill="none" stroke="${cPrim}" stroke-width="20" stroke-linecap="butt" />
          <path d="M 106 242 L 106 150 C 106 112, 128 88, 160 88 C 192 88, 214 112, 214 150 L 214 242" fill="none" stroke="${cInk}" stroke-width="10" />
          <path d="M 130 242 C 130 206, 144 188, 160 188 C 176 188, 190 206, 190 242" fill="none" stroke="${cSec}" stroke-width="7" />
          <line x1="160" y1="112" x2="160" y2="234" stroke="${cInk}" stroke-width="5.5" stroke-linecap="round" />
          <ellipse cx="144" cy="134" rx="11" ry="5" transform="rotate(-32 144 134)" fill="${cSec}" />
          <ellipse cx="176" cy="134" rx="11" ry="5" transform="rotate(32 176 134)" fill="${cSec}" />
          <ellipse cx="143" cy="154" rx="11" ry="5" transform="rotate(-32 143 154)" fill="${cSec}" />
          <ellipse cx="177" cy="154" rx="11" ry="5" transform="rotate(32 177 154)" fill="${cSec}" />
          <ellipse cx="144" cy="174" rx="10" ry="5" transform="rotate(-32 144 174)" fill="${cInk}" />
          <ellipse cx="176" cy="174" rx="10" ry="5" transform="rotate(32 176 174)" fill="${cInk}" />
          <ellipse cx="160" cy="108" rx="5.5" ry="11" fill="${cSec}" />
          <rect x="60" y="246" width="200" height="14" rx="7" fill="${cInk}" />
        </svg>`;
      }

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
        <path d="M 76 242 L 76 146 C 76 92, 114 56, 160 56 C 206 56, 244 92, 244 146 L 244 242" fill="none" stroke="${cPrim}" stroke-width="20" stroke-linecap="butt" />
        <path d="M 106 242 L 106 150 C 106 112, 128 88, 160 88 C 192 88, 214 112, 214 150 L 214 242 Z" fill="${cInk}" />
        <path d="M 126 242 C 126 202, 140 180, 160 180 C 180 180, 194 202, 194 242 Z" fill="${cSec}" />
        <rect x="157.5" y="112" width="5" height="120" rx="2.5" fill="${cPaper}" />
        <ellipse cx="144" cy="134" rx="10.5" ry="5" transform="rotate(-32 144 134)" fill="${cSec}" />
        <ellipse cx="176" cy="134" rx="10.5" ry="5" transform="rotate(32 176 134)" fill="${cSec}" />
        <ellipse cx="143" cy="154" rx="11" ry="5.5" transform="rotate(-32 143 154)" fill="${cSec}" />
        <ellipse cx="177" cy="154" rx="11" ry="5.5" transform="rotate(32 177 154)" fill="${cSec}" />
        <ellipse cx="144" cy="174" rx="10.5" ry="5" transform="rotate(-32 144 174)" fill="${cPaper}" />
        <ellipse cx="176" cy="174" rx="10.5" ry="5" transform="rotate(32 176 174)" fill="${cPaper}" />
        <ellipse cx="160" cy="108" rx="5" ry="11" fill="${cSec}" />
        <rect x="60" y="246" width="200" height="14" rx="7" fill="${cInk}" />
      </svg>`;
    }

    // 2 (Refinamento 1A): Portal Esguio Gravado em Traço Fino + Espiga Elegante Aberta (sem mancha pesada!)
    if (cv === 2) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
        <!-- Arco ogival esguio e leve em traço contínuo duplo -->
        <path d="M 92 252 L 92 134 C 92 74, 124 40, 160 40 C 196 40, 228 74, 228 134 L 228 252" fill="none" stroke="${cPrim}" stroke-width="11" stroke-linecap="round" />
        <path d="M 116 252 L 116 140 C 116 96, 134 68, 160 68 C 186 68, 204 96, 204 140 L 204 252" fill="none" stroke="${cInk}" stroke-width="6.5" stroke-linecap="round" />
        <!-- Chama / horizonte em arco delicado -->
        <path d="M 134 252 C 134 226, 145 214, 160 214 C 175 214, 186 226, 186 252" fill="none" stroke="${cSec}" stroke-width="7" stroke-linecap="round" />
        <!-- Espiga botânica esguia em espaço aberto -->
        <line x1="160" y1="92" x2="160" y2="236" stroke="${cInk}" stroke-width="5" stroke-linecap="round" />
        <ellipse cx="145" cy="118" rx="10" ry="4.5" transform="rotate(-38 145 118)" fill="${cSec}" />
        <ellipse cx="175" cy="118" rx="10" ry="4.5" transform="rotate(38 175 118)" fill="${cSec}" />
        <ellipse cx="144" cy="142" rx="10.5" ry="4.5" transform="rotate(-38 144 142)" fill="${cPrim}" />
        <ellipse cx="176" cy="142" rx="10.5" ry="4.5" transform="rotate(38 176 142)" fill="${cPrim}" />
        <ellipse cx="145" cy="166" rx="10" ry="4.5" transform="rotate(-38 145 166)" fill="${cSec}" />
        <ellipse cx="175" cy="166" rx="10" ry="4.5" transform="rotate(38 175 166)" fill="${cSec}" />
        <ellipse cx="160" cy="86" rx="4.5" ry="10" fill="${cSec}" />
        <!-- Soleira fina bipartida -->
        <line x1="72" y1="252" x2="248" y2="252" stroke="${cInk}" stroke-width="7" stroke-linecap="round" />
        <line x1="104" y1="268" x2="216" y2="268" stroke="${cSec}" stroke-width="5" stroke-linecap="round" />
      </svg>`;
    }

    // 3 (Refinamento 1B): Selo Romano Largo & Silhueta Forte de Alto Contraste (tipo xilogravura)
    if (cv === 3) {
      if (isSingleInk || isNegativeOnDark) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
          <path d="M 48 232 L 48 168 C 48 96, 96 64, 160 64 C 224 64, 272 96, 272 168 L 272 232" fill="none" stroke="${cPrim}" stroke-width="26" stroke-linecap="butt" />
          <path d="M 88 232 C 88 182, 118 156, 160 156 C 202 156, 232 182, 232 232" fill="none" stroke="${cSec}" stroke-width="14" stroke-linecap="round" />
          <circle cx="160" cy="120" r="14" fill="${cSec}" />
          <path d="M 132 104 L 160 144 L 188 104" fill="none" stroke="${cInk}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
          <rect x="44" y="246" width="232" height="18" rx="4" fill="${cInk}" />
        </svg>`;
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
        <!-- Cúpula larga de forno românico com base forte -->
        <path d="M 46 232 L 46 168 C 46 94, 96 64, 160 64 C 224 64, 274 94, 274 168 L 274 232 Z" fill="${cPrim}" />
        <!-- Curva solar / brasa em recorte largo -->
        <path d="M 94 232 C 94 176, 122 148, 160 148 C 198 148, 226 176, 226 232 Z" fill="${cInk}" />
        <path d="M 124 232 C 124 198, 138 182, 160 182 C 182 182, 196 198, 196 232 Z" fill="${cSec}" />
        <!-- Coroa de trigo de 3 folhas em espaço negativo largo -->
        <ellipse cx="160" cy="106" rx="10" ry="20" fill="${cPaper}" />
        <ellipse cx="132" cy="122" rx="18" ry="8.5" transform="rotate(-34 132 122)" fill="${cPaper}" />
        <ellipse cx="188" cy="122" rx="18" ry="8.5" transform="rotate(34 188 122)" fill="${cPaper}" />
        <rect x="40" y="242" width="240" height="16" rx="5" fill="${cInk}" />
        <rect x="74" y="264" width="172" height="8" rx="4" fill="${cSec}" />
      </svg>`;
    }

    // 4: Arco com chave arquitetónica superior dividida
    if (cv === 4) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
        <path d="M 66 244 L 66 146 C 66 96, 102 64, 146 58" fill="none" stroke="${cPrim}" stroke-width="18" stroke-linecap="round" />
        <path d="M 174 58 C 218 64, 254 96, 254 146 L 254 244" fill="none" stroke="${cPrim}" stroke-width="18" stroke-linecap="round" />
        <polygon points="160,34 174,56 160,78 146,56" fill="${cSec}" />
        <path d="M 110 244 L 110 154 C 110 120, 130 98, 160 98 C 190 98, 210 120, 210 154 L 210 244" fill="none" stroke="${cInk}" stroke-width="12" stroke-linecap="round" />
        <line x1="160" y1="126" x2="160" y2="232" stroke="${cSec}" stroke-width="8" stroke-linecap="round" />
        <circle cx="160" cy="204" r="22" fill="${cSec}" />
        <rect x="60" y="252" width="200" height="12" rx="6" fill="${cInk}" />
      </svg>`;
    }

    // 5: Escudo losango artesanal
    if (cv === 5) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
        <polygon points="160,28 282,160 160,292 38,160" fill="none" stroke="${cPrim}" stroke-width="14" stroke-linejoin="round" />
        <path d="M 112 204 L 112 146 C 112 114, 134 94, 160 94 C 186 94, 208 114, 208 146 L 208 204" fill="none" stroke="${cInk}" stroke-width="12" stroke-linecap="round" />
        <line x1="160" y1="118" x2="160" y2="204" stroke="${cSec}" stroke-width="7" stroke-linecap="round" />
        <ellipse cx="144" cy="146" rx="10" ry="5" transform="rotate(-32 144 146)" fill="${cSec}" />
        <ellipse cx="176" cy="146" rx="10" ry="5" transform="rotate(32 176 146)" fill="${cSec}" />
        <line x1="98" y1="212" x2="222" y2="212" stroke="${cInk}" stroke-width="10" stroke-linecap="round" />
      </svg>`;
    }

    // 6: Coroa dupla geométrica clássica
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
      <path d="M 68 238 L 68 146 C 68 90, 108 54, 160 54 C 212 54, 252 90, 252 146 L 252 238" fill="none" stroke="${cPrim}" stroke-width="16" stroke-linecap="round" />
      <path d="M 100 238 L 100 150 C 100 112, 126 88, 160 88 C 194 88, 220 112, 220 150 L 220 238" fill="none" stroke="${cSec}" stroke-width="10" stroke-linecap="round" />
      <path d="M 132 238 C 132 190, 144 168, 160 168 C 176 168, 188 190, 188 238 Z" fill="${cInk}" />
      <circle cx="160" cy="134" r="11" fill="${cSec}" />
      <rect x="60" y="246" width="200" height="14" rx="7" fill="${cInk}" />
    </svg>`;
  }

  // Outros sectores (Serviços, Construção, Tecnologia e Gerais — todos limpos sem círculos tracejados!)
  if (
    sector === "servicos" ||
    sector === "construcao" ||
    sector === "tecnologia"
  ) {
    if (cv === 1) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
        <polygon points="104,44 216,44 276,104 276,216 216,276 104,276 44,216 44,104" fill="none" stroke="${cInk}" stroke-width="16" stroke-linejoin="round" />
        <path d="M 160 88 L 220 202 L 192 202 L 160 138 L 128 202 L 100 202 Z" fill="${cPrim}" />
        <rect x="116" y="176" width="88" height="14" rx="7" fill="${cSec}" />
        <circle cx="160" cy="96" r="14" fill="${cSec}" />
      </svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
      <polygon points="160,36 272,100 272,220 160,284 48,220 48,100" fill="none" stroke="${cPrim}" stroke-width="14" stroke-linejoin="round" />
      <path d="M 104 214 L 160 96 L 216 214" fill="none" stroke="${cInk}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
      <line x1="122" y1="180" x2="198" y2="180" stroke="${cSec}" stroke-width="13" stroke-linecap="round" />
    </svg>`;
  }

  // Emblema heráldico / editorial limpo para restantes sectores
  if (cv === 1) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
      <path d="M 160 40 L 260 88 L 260 176 C 260 228, 218 264, 160 280 C 102 264, 60 228, 60 176 L 60 88 Z" fill="none" stroke="${cPrim}" stroke-width="16" stroke-linejoin="round" />
      <path d="M 160 86 L 198 158 L 160 230 L 122 158 Z" fill="${cSec}" />
      <circle cx="160" cy="158" r="16" fill="${cInk}" />
    </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="1024" height="1024">
    <path d="M 160 44 L 252 94 L 252 178 C 252 224, 214 258, 160 274 C 106 258, 68 224, 68 178 L 68 94 Z" fill="none" stroke="${cInk}" stroke-width="12" stroke-linejoin="round" />
    <path d="M 116 158 C 116 126, 136 106, 160 106 C 184 106, 204 126, 204 158 C 204 190, 184 210, 160 210" fill="none" stroke="${cPrim}" stroke-width="14" stroke-linecap="round" />
    <circle cx="160" cy="158" r="14" fill="${cSec}" />
  </svg>`;
}

/**
 * Compõe o logótipo completo (símbolo + tipografia vectorial convertida em curvas via Satori)
 * com múltiplos layouts e hierarquias tipográficas verdadeiramente distintas.
 */
export async function composeVectorLogoSvg(params: {
  nome: string;
  slogan?: string;
  sector: SectorId;
  fontPairId: FontPairId;
  paleta: BrandPalette;
  symbolSvg: string;
  layout: "horizontal" | "vertical" | "badge";
  mode?: "color" | "monochrome" | "negative" | "negative-transparent";
  wordmarkStyle?: WordmarkLockupStyle;
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
    wordmarkStyle = "classic-split",
  } = params;

  const { pair, fonts: pairFonts } = getSatoriFontsForPair(fontPairId);
  const sansFonts = getGeometricSansStudioFonts();
  const seenFontKeys = new Set(
    pairFonts.map((f) => `${f.name}:${f.weight}:${f.data.length}`)
  );
  const fonts = [
    ...pairFonts,
    ...sansFonts.filter(
      (f) => !seenFontKeys.has(`${f.name}:${f.weight}:${f.data.length}`)
    ),
  ];

  const { mainWord, restWords, fullUpper } = extractBrandTokens(nome);
  const symbolDataUrl = `data:image/svg+xml;base64,${Buffer.from(symbolSvg, "utf8").toString("base64")}`;

  const isLightOnDark = mode === "negative" || mode === "negative-transparent";
  const isMono = mode === "monochrome";
  const isPureNeg = mode === "negative-transparent";

  const titleColor = isPureNeg
    ? "#FAF8F5"
    : isLightOnDark
    ? "#FAF8F5"
    : isMono
    ? "#141413"
    : paleta.tinta.hex;

  const restColor = isPureNeg
    ? "#FAF8F5"
    : isLightOnDark
    ? paleta.secundaria.hex
    : isMono
    ? "#141413"
    : paleta.primaria.hex;

  const accentRuleColor = isPureNeg
    ? "#FAF8F5"
    : isLightOnDark
    ? paleta.primaria.hex
    : isMono
    ? "#141413"
    : paleta.secundaria.hex;

  const subtitleColor = isPureNeg
    ? "#FAF8F5"
    : isLightOnDark
    ? "#E5E0D8"
    : isMono
    ? "#334155"
    : paleta.neutro.hex;

  const bgStyle = mode === "negative" ? paleta.tinta.hex : "transparent";
  const subText = (slogan || SECTORS[sector]?.rotulo || "").toUpperCase().slice(0, 44);

  const isModernWordmark =
    wordmarkStyle === "modern-geometric" || wordmarkStyle === "modern-monolith";

  if (layout === "vertical") {
    const width = 1000;
    const height = 1000;
    const verticalTitleFamily = isModernWordmark ? "Manrope" : pair.tituloFamily;
    const verticalSubFamily = isModernWordmark ? "Outfit" : pair.textoFamily;
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
          padding: "56px",
        },
      },
      h("img", {
        src: symbolDataUrl,
        width: 390,
        height: 390,
        style: { objectFit: "contain" },
      }),
      wordmarkStyle === "editorial-serif"
        ? h(
            "div",
            {
              style: {
                fontFamily: "Fraunces",
                fontWeight: 700,
                fontSize: nome.length > 18 ? "66px" : "78px",
                color: titleColor,
                marginTop: "32px",
                lineHeight: 1.06,
                textAlign: "center",
              },
            },
            nome
          )
        : h(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              },
            },
            h(
              "div",
              {
                style: {
                  fontFamily: verticalTitleFamily,
                  fontWeight: isModernWordmark ? 800 : pair.tituloWeight,
                  fontSize: mainWord.length > 12 ? "74px" : "92px",
                  color: titleColor,
                  letterSpacing: isModernWordmark ? "-0.03em" : "0.04em",
                  marginTop: "30px",
                  lineHeight: 1.02,
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
                      fontFamily: verticalSubFamily,
                      fontWeight: isModernWordmark ? 600 : 400,
                      fontSize: isModernWordmark ? "42px" : "52px",
                      color: restColor,
                      letterSpacing: isModernWordmark ? "0.14em" : "0em",
                      marginTop: "8px",
                      textAlign: "center",
                    },
                  },
                  isModernWordmark ? restWords.toUpperCase() : restWords
                )
              : null
          ),
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
            fontFamily: isModernWordmark ? "Outfit" : pair.tituloFamily,
            fontWeight: isModernWordmark ? 500 : 400,
            fontSize: "21px",
            letterSpacing: "0.18em",
            color: subtitleColor,
            marginTop: "16px",
            textAlign: "center",
          },
        },
        subText
      )
    );

    return satori(el, { width, height, fonts });
  }

  // Horizontal studio lockup (1400 x 520) com 5 arquiteturas visuais distintas
  const width = 1400;
  const height = 520;

  let textBlock: React.ReactElement;
  let dividerNode: React.ReactElement | null = null;
  let gapPx = 46;

  if (wordmarkStyle === "modern-geometric") {
    // Direção II Contemporânea: 100% Sem-Serifa Geométrica forte (Manrope 800 + Outfit 600), ZERO serifas, barra vertical arquitectónica
    gapPx = 40;
    dividerNode = h("div", {
      style: {
        width: "5px",
        height: "236px",
        backgroundColor: accentRuleColor,
        borderRadius: "3px",
      },
    });
    textBlock = h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          maxWidth: "820px",
        },
      },
      h(
        "div",
        {
          style: {
            fontFamily: "Manrope",
            fontWeight: 800,
            fontSize: mainWord.length > 12 ? "82px" : "104px",
            color: titleColor,
            letterSpacing: "-0.03em",
            lineHeight: 0.96,
          },
        },
        mainWord.toUpperCase()
      ),
      restWords
        ? h(
            "div",
            {
              style: {
                fontFamily: "Outfit",
                fontWeight: 700,
                fontSize: "40px",
                color: restColor,
                letterSpacing: "0.16em",
                marginTop: "12px",
                lineHeight: 1.05,
              },
            },
            restWords.toUpperCase()
          )
        : null,
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "12px",
            marginTop: "22px",
          },
        },
        h("div", {
          style: {
            width: "28px",
            height: "4px",
            backgroundColor: accentRuleColor,
          },
        }),
        h(
          "div",
          {
            style: {
              fontFamily: "Outfit",
              fontWeight: 500,
              fontSize: "21px",
              letterSpacing: "0.14em",
              color: subtitleColor,
            },
          },
          subText
        )
      )
    );
  } else if (wordmarkStyle === "modern-monolith") {
    gapPx = 42;
    textBlock = h(
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
            fontFamily: "Outfit",
            fontWeight: 500,
            fontSize: "20px",
            letterSpacing: "0.24em",
            color: restColor,
            marginBottom: "8px",
          },
        },
        (SECTORS[sector]?.rotulo || "IDENTIDADE").toUpperCase()
      ),
      h(
        "div",
        {
          style: {
            fontFamily: "Manrope",
            fontWeight: 800,
            fontSize: fullUpper.length > 16 ? "68px" : "80px",
            color: titleColor,
            letterSpacing: "-0.025em",
            lineHeight: 1.02,
          },
        },
        fullUpper
      ),
      h("div", {
        style: {
          width: "160px",
          height: "6px",
          backgroundColor: accentRuleColor,
          marginTop: "18px",
        },
      }),
      h(
        "div",
        {
          style: {
            fontFamily: "Outfit",
            fontWeight: 400,
            fontSize: "24px",
            color: subtitleColor,
            marginTop: "14px",
          },
        },
        slogan || SECTORS[sector]?.rotulo || ""
      )
    );
  } else if (wordmarkStyle === "editorial-serif") {
    // Refinamento 1A Clássica: Separador vertical fino + Título serifado editorial majestoso (Fraunces 700)
    gapPx = 38;
    dividerNode = h("div", {
      style: {
        width: "2px",
        height: "230px",
        backgroundColor: accentRuleColor,
      },
    });
    textBlock = h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          maxWidth: "820px",
        },
      },
      h(
        "div",
        {
          style: {
            fontFamily: "Fraunces",
            fontWeight: 700,
            fontSize: nome.length > 16 ? "74px" : "88px",
            color: titleColor,
            letterSpacing: "-0.02em",
            lineHeight: 1.04,
          },
        },
        nome
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "14px",
            marginTop: "20px",
          },
        },
        h("div", {
          style: {
            width: "44px",
            height: "3px",
            backgroundColor: restColor,
          },
        }),
        h(
          "div",
          {
            style: {
              fontFamily: "Outfit",
              fontWeight: 500,
              fontSize: "21px",
              letterSpacing: "0.18em",
              color: subtitleColor,
            },
          },
          subText
        )
      )
    );
  } else if (wordmarkStyle === "crested-eyebrow") {
    // Refinamento 1B Clássica: Etiqueta superior do sector + Bloco clássico Baskerville + Barra estrutural
    gapPx = 44;
    textBlock = h(
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
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "12px",
            marginBottom: "10px",
          },
        },
        h(
          "div",
          {
            style: {
              fontFamily: "Source Sans 3",
              fontWeight: 700,
              fontSize: "19px",
              letterSpacing: "0.22em",
              color: restColor,
            },
          },
          (SECTORS[sector]?.rotulo || "MARCA").toUpperCase()
        ),
        h("div", {
          style: {
            width: "48px",
            height: "3px",
            backgroundColor: accentRuleColor,
          },
        })
      ),
      h(
        "div",
        {
          style: {
            fontFamily: "Libre Baskerville",
            fontWeight: 700,
            fontSize: mainWord.length > 12 ? "68px" : "82px",
            color: titleColor,
            letterSpacing: "0.02em",
            lineHeight: 1.05,
          },
        },
        mainWord.toUpperCase()
      ),
      restWords
        ? h(
            "div",
            {
              style: {
                fontFamily: "Source Sans 3",
                fontWeight: 600,
                fontSize: "42px",
                color: restColor,
                letterSpacing: "0.1em",
                marginTop: "6px",
              },
            },
            restWords.toUpperCase()
          )
        : null,
      h(
        "div",
        {
          style: {
            fontFamily: "Libre Baskerville",
            fontWeight: 400,
            fontSize: "21px",
            color: subtitleColor,
            marginTop: "14px",
          },
        },
        slogan || SECTORS[sector]?.rotulo || ""
      )
    );
  } else {
    // Classic split (Direção I Base)
    textBlock = h(
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
            fontSize: mainWord.length > 12 ? "82px" : "102px",
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
                fontSize: "60px",
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
          width: "210px",
          height: "6px",
          backgroundColor: accentRuleColor,
          borderRadius: "3px",
          marginTop: "20px",
        },
      }),
      h(
        "div",
        {
          style: {
            fontFamily: pair.tituloFamily,
            fontWeight: 400,
            fontSize: "23px",
            letterSpacing: "0.16em",
            color: subtitleColor,
            marginTop: "16px",
          },
        },
        subText
      )
    );
  }

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
        padding: "28px 52px",
        gap: `${gapPx}px`,
        borderRadius: mode === "negative" ? "24px" : "0px",
      },
    },
    h("img", {
      src: symbolDataUrl,
      width: 344,
      height: 344,
      style: { objectFit: "contain" },
    }),
    dividerNode,
    textBlock
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
  const fontContemp: FontPairId = "tecnica";

  // Direção I: Clássica & Arquitectónica
  const simbolo1 = await buildStudioSymbolSvg({
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
    wordmarkStyle: "classic-split",
  });

  const dirClassica: StudioLogoOption = {
    id: "dir_classica_0",
    directionId: "classica",
    round: 0,
    variantIndex: 1,
    titulo: "Direção I — Selo de Ofício & Tradição",
    subtitulo: `Composição clássica emblemática com ${FONT_PAIRS[fontClassica].nome}`,
    racional: `Emblema tradicional desenhado à medida do sector (${sectorSpec.rotulo}), sem molduras supérfluas, combinado com tipografia ${FONT_PAIRS[fontClassica].tituloFamily} + ${FONT_PAIRS[fontClassica].textoFamily}.`,
    fontPairId: fontClassica,
    paleta: classicaPalette,
    logoSvg: logoSvg1,
    simboloSvg: simbolo1,
    symbolStyleVariant: 1,
    lockupLayout: "left-emblem",
    wordmarkStyle: "classic-split",
  };

  // Direção II: Contemporânea Geométrica (Monograma das iniciais + portal aberto + sem-serifa forte)
  const simbolo2 = await buildStudioSymbolSvg({
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
    wordmarkStyle: "modern-geometric",
  });

  const dirContemporanea: StudioLogoOption = {
    id: "dir_contemporanea_0",
    directionId: "contemporanea",
    round: 0,
    variantIndex: 2,
    titulo: `Direção II — Monograma Geométrico ${firstInitial}${secondInitial}`,
    subtitulo: "Portal moderno e sem-serifa geométrica de alto peso (Manrope + Outfit)",
    racional: `Monograma arquitectónico ${firstInitial}${secondInitial} em espaço negativo limpo, divisor vertical e tipografia geométrica pesada sem serifas, criando uma alternativa nítida à Direção I.`,
    fontPairId: fontContemp,
    paleta: contemporaneaPalette,
    logoSvg: logoSvg2,
    simboloSvg: simbolo2,
    symbolStyleVariant: 2,
    lockupLayout: "editorial-split",
    wordmarkStyle: "modern-geometric",
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
  const safeRound = Math.max(1, Math.min(3, Math.round(round)));
  const { firstInitial, secondInitial } = extractBrandTokens(input.nome);
  const { classicaPalette, contemporaneaPalette } =
    derivePalettesForDirections(input);

  const basePalette =
    directionId === "classica" ? classicaPalette : contemporaneaPalette;

  const fontChoices: Record<DirectionId, [FontPairId, FontPairId][]> = {
    classica: [
      ["editorial", "confianca"],
      ["confianca", "clara"],
      ["clara", "editorial"],
    ],
    contemporanea: [
      ["moderna", "tecnica"],
      ["tecnica", "moderna"],
      ["moderna", "tecnica"],
    ],
  };

  const wordmarkChoices: Record<
    DirectionId,
    [WordmarkLockupStyle, WordmarkLockupStyle][]
  > = {
    classica: [
      ["editorial-serif", "crested-eyebrow"],
      ["crested-eyebrow", "classic-split"],
      ["editorial-serif", "classic-split"],
    ],
    contemporanea: [
      ["modern-monolith", "modern-geometric"],
      ["modern-geometric", "modern-monolith"],
      ["modern-monolith", "modern-geometric"],
    ],
  };

  // Variantes de símbolo próprias (nunca repetindo a variante base 1 da Clássica nem 2 da Contemporânea na Ronda 1)
  const symbolVariantMap: Record<DirectionId, [number, number][]> = {
    classica: [
      [2, 3],
      [4, 5],
      [6, 2],
    ],
    contemporanea: [
      [1, 3],
      [4, 5],
      [6, 1],
    ],
  };

  const [fontA, fontB] = fontChoices[directionId][safeRound - 1];
  const [wmA, wmB] = wordmarkChoices[directionId][safeRound - 1];
  const [variantNumA, variantNumB] = symbolVariantMap[directionId][safeRound - 1];

  const palA = buildBrandPalette({
    primaria: basePalette.primaria.hex,
    secundaria: basePalette.secundaria.hex,
    papel: basePalette.papel.hex,
    tinta: basePalette.tinta.hex,
  });

  const palB = buildBrandPalette({
    primaria: mixHex(basePalette.primaria.hex, basePalette.tinta.hex, 0.24),
    secundaria: mixHex(basePalette.secundaria.hex, "#D97706", 0.35),
    papel: basePalette.papel.hex,
    tinta: basePalette.tinta.hex,
  });

  const simboloA = await buildStudioSymbolSvg({
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
    wordmarkStyle: wmA,
  });

  const simboloB = await buildStudioSymbolSvg({
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
    wordmarkStyle: wmB,
  });

  const descA =
    directionId === "classica"
      ? `Afinação ${safeRound}.A — Traço Fino & Editorial Serif`
      : `Afinação ${safeRound}.A — Linha Contínua Minimalista`;
  const descB =
    directionId === "classica"
      ? `Afinação ${safeRound}.B — Selo Compacto & Eyebrow Clássico`
      : `Afinação ${safeRound}.B — Monograma Monólito Dividido`;

  const optA: StudioLogoOption = {
    id: `ref_${directionId}_r${safeRound}_a`,
    directionId,
    round: safeRound,
    variantIndex: 1,
    titulo: descA,
    subtitulo:
      directionId === "classica"
        ? `Proporção esguia gravada + título serifado contínuo em Fraunces 700`
        : `Símbolo contínuo em traço único + composição horizontal monolítica`,
    racional: `Ronda ${safeRound}/3: altera simultaneamente proporção, espessura de traço do símbolo, família tipográfica (${FONT_PAIRS[fontA].tituloFamily}) e disposição do bloco.`,
    fontPairId: fontA,
    paleta: palA,
    logoSvg: logoSvgA,
    simboloSvg: simboloA,
    symbolStyleVariant: variantNumA,
    lockupLayout: "editorial-split",
    wordmarkStyle: wmA,
  };

  const optB: StudioLogoOption = {
    id: `ref_${directionId}_r${safeRound}_b`,
    directionId,
    round: safeRound,
    variantIndex: 2,
    titulo: descB,
    subtitulo:
      directionId === "classica"
        ? `Silhueta compacta tipo carimbo + etiqueta superior com Libre Baskerville`
        : `Monograma com divisor vertical forte + bloco geométrico sem serifa`,
    racional: `Ronda ${safeRound}/3: apresenta silhueta de alto contraste para pequenos formatos combinada com disposição hierárquica alternativa.`,
    fontPairId: fontB,
    paleta: palB,
    logoSvg: logoSvgB,
    simboloSvg: simboloB,
    symbolStyleVariant: variantNumB,
    lockupLayout: "stacked-crest",
    wordmarkStyle: wmB,
  };

  return [optA, optB];
}

export async function generateFinalVariantsA(
  input: QuestionnaireInputA,
  chosen: StudioLogoOption
): Promise<FinalVariantsA> {
  const { firstInitial, secondInitial } = extractBrandTokens(input.nome);
  const wmStyle: WordmarkLockupStyle =
    chosen.wordmarkStyle ||
    (chosen.directionId === "contemporanea"
      ? "modern-geometric"
      : chosen.symbolStyleVariant === 2
      ? "editorial-serif"
      : chosen.symbolStyleVariant === 3
      ? "crested-eyebrow"
      : "classic-split");

  const simboloColor = chosen.simboloSvg;
  const simboloMono = await buildStudioSymbolSvg({
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

  const primHsl = rgbToHsl(hexToRgb(chosen.paleta.primaria.hex));
  const secHsl = rgbToHsl(hexToRgb(chosen.paleta.secundaria.hex));
  const negPrim =
    primHsl.l < 46
      ? mixHex(chosen.paleta.primaria.hex, "#FFFFFF", 0.24)
      : chosen.paleta.primaria.hex;
  const negSec =
    secHsl.l < 48
      ? mixHex(chosen.paleta.secundaria.hex, "#FFFFFF", 0.22)
      : chosen.paleta.secundaria.hex;

  const simboloNeg = await buildStudioSymbolSvg({
    sector: input.sector,
    directionId: chosen.directionId,
    symbolStyleVariant: chosen.symbolStyleVariant,
    firstInitial,
    secondInitial,
    primaryHex: negPrim,
    secondaryHex: negSec,
    inkHex: "#FAF8F5",
    paperHex: chosen.paleta.tinta.hex,
    isNegativeOnDark: true,
  });

  const simboloNegTransparente = await buildStudioSymbolSvg({
    sector: input.sector,
    directionId: chosen.directionId,
    symbolStyleVariant: chosen.symbolStyleVariant,
    firstInitial,
    secondInitial,
    primaryHex: chosen.paleta.primaria.hex,
    secondaryHex: chosen.paleta.secundaria.hex,
    inkHex: chosen.paleta.tinta.hex,
    paperHex: chosen.paleta.papel.hex,
    monochromeHex: "#FAF8F5",
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
    wordmarkStyle: wmStyle,
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
    wordmarkStyle: wmStyle,
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
    wordmarkStyle: wmStyle,
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
    wordmarkStyle: wmStyle,
  });

  const negativoTransparenteSvg = await composeVectorLogoSvg({
    nome: input.nome,
    slogan: input.slogan,
    sector: input.sector,
    fontPairId: chosen.fontPairId,
    paleta: chosen.paleta,
    symbolSvg: simboloNegTransparente,
    layout: "horizontal",
    mode: "negative-transparent",
    wordmarkStyle: wmStyle,
  });

  return {
    horizontalSvg,
    verticalSvg,
    simboloSvg: simboloColor,
    monocromaticoSvg,
    negativoSvg,
    negativoTransparenteSvg,
  };
}
