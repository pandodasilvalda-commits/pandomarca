import {
  BrandPalette,
  BrandPaletteHex,
  ColorEntry,
  FONT_PAIRS,
  FontPairId,
  resolverParTipograficoMarca,
  RGBColor,
  SectorId,
  TomDaMarca,
} from "./formats";

export function normalizeHex(hex: string, fallback = "#1E293B"): string {
  const cleaned = (hex || "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = cleaned[0] + cleaned[0];
    const g = cleaned[1] + cleaned[1];
    const b = cleaned[2] + cleaned[2];
    return `#${(r + g + b).toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  return fallback.toUpperCase();
}

export function hexToRgb(hex: string): RGBColor {
  const norm = normalizeHex(hex).slice(1);
  return {
    r: parseInt(norm.slice(0, 2), 16),
    g: parseInt(norm.slice(2, 4), 16),
    b: parseInt(norm.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGBColor): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

export function makeColorEntry(hex: string): ColorEntry {
  const norm = normalizeHex(hex);
  return {
    hex: norm,
    rgb: hexToRgb(norm),
  };
}

export function mixHex(hexA: string, hexB: string, weightB = 0.5): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const wA = 1 - weightB;
  return rgbToHex({
    r: a.r * wA + b.r * weightB,
    g: a.g * wA + b.g * weightB,
    b: a.b * wA + b.b * weightB,
  });
}

export function computeNeutralHex(papelHex: string, tintaHex: string): string {
  // Neutro equilibrado entre papel e tinta (46% tinta sobre papel)
  return mixHex(papelHex, tintaHex, 0.46);
}

export function buildBrandPalette(input: BrandPaletteHex): BrandPalette {
  const primaria = normalizeHex(input.primaria, "#B45309");
  const secundaria = normalizeHex(input.secundaria, "#78350F");
  const papel = normalizeHex(input.papel, "#FAF6F0");
  const tinta = normalizeHex(input.tinta, "#1C1917");
  const neutro = computeNeutralHex(papel, tinta);

  return {
    primaria: makeColorEntry(primaria),
    secundaria: makeColorEntry(secundaria),
    papel: makeColorEntry(papel),
    tinta: makeColorEntry(tinta),
    neutro: makeColorEntry(neutro),
  };
}

export function rgbToHsl({ r, g, b }: RGBColor): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  let r1 = 0,
    g1 = 0,
    b1 = 0;

  if (hn < 60) {
    r1 = c;
    g1 = x;
  } else if (hn < 120) {
    r1 = x;
    g1 = c;
  } else if (hn < 180) {
    g1 = c;
    b1 = x;
  } else if (hn < 240) {
    g1 = x;
    b1 = c;
  } else if (hn < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return rgbToHex({
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  });
}

export function rotateHue(hex: string, deg: number, satDelta = 0, lightDelta = 0): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  const nextS = Math.max(18, Math.min(92, hsl.s + satDelta));
  const nextL = Math.max(15, Math.min(85, hsl.l + lightDelta));
  return hslToHex(hsl.h + deg, nextS, nextL);
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const transform = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getContrastingTextHex(bgHex: string, lightChoice = "#FAF8F5", darkChoice = "#141413"): string {
  const cLight = contrastRatio(bgHex, lightChoice);
  const cDark = contrastRatio(bgHex, darkChoice);
  return cLight >= cDark ? lightChoice : darkChoice;
}

export interface PaletteAndTypeProposal {
  id: "direta" | "contrastada" | "clara" | "afinada";
  titulo: string;
  subtitulo: string;
  descricao: string;
  paleta: BrandPalette;
  fontPairId: FontPairId;
}

const ALL_FONT_ORDER: FontPairId[] = [
  "tecnica",
  "moderna",
  "clara",
  "editorial",
  "confianca",
  "classica",
];

function getDistinctFontPairs(
  basePair: FontPairId,
  tom?: TomDaMarca
): [FontPairId, FontPairId, FontPairId, FontPairId] {
  const others = ALL_FONT_ORDER.filter((f) => f !== basePair);
  const baseCategory = FONT_PAIRS[basePair]?.categoria || "sans";

  let second: FontPairId;
  if (tom === "tecnico" || tom === "jovem" || tom === "divertido") {
    // Para tons modernos/técnicos/jovens, ambas as propostas iniciais ficam sem serifas;
    // os pares mistos ou serifados permanecem disponíveis nas restantes opções / afinamento manual.
    second =
      others.find((f) => FONT_PAIRS[f].categoria === "sans") || others[0];
  } else if (baseCategory === "sans") {
    second =
      others.find((f) => FONT_PAIRS[f].categoria === "misto") || others[0];
  } else if (baseCategory === "serif") {
    second =
      others.find((f) => f === "editorial") ||
      others.find((f) => FONT_PAIRS[f].categoria === "sans") ||
      others[0];
  } else {
    second =
      others.find((f) => FONT_PAIRS[f].categoria === "serif") ||
      others.find((f) => FONT_PAIRS[f].categoria === "sans") ||
      others[0];
  }

  const remaining = others.filter((f) => f !== second);
  return [
    basePair,
    second,
    remaining[0] || "moderna",
    remaining[1] || "editorial",
  ];
}

export function generateFourProposals(
  basePalette: BrandPalette,
  sector: SectorId,
  opts?: { tom?: TomDaMarca; estiloDirecao?: "classico" | "moderno" }
): PaletteAndTypeProposal[] {
  const basePair = resolverParTipograficoMarca({
    tom: opts?.tom,
    sector,
    estiloDirecao: opts?.estiloDirecao,
  });
  const [font1, font2, font3, font4] = getDistinctFontPairs(basePair, opts?.tom);

  const pHex = basePalette.primaria.hex;
  const sHex = basePalette.secundaria.hex;
  const pHsl = rgbToHsl(basePalette.primaria.rgb);

  // 1. Direta — Fiel às cores lidas no logótipo com o par tipográfico adaptado ao tom e sector
  const propDireta: PaletteAndTypeProposal = {
    id: "direta",
    titulo: "Direta",
    subtitulo: "Fiel ao logótipo, ao tom e ao sector",
    descricao: `Mantém as cores extraídas do logótipo combinadas com o par tipográfico ${FONT_PAIRS[font1].nome} (${FONT_PAIRS[font1].tituloFamily} + ${FONT_PAIRS[font1].textoFamily}).`,
    paleta: basePalette,
    fontPairId: font1,
  };

  // 2. Contrastada — Claramente distinta (não apenas troca de primária/secundária!):
  // Novo matiz expressivo, acento complementar rico, equilíbrio distinto de papel/tinta e outro par tipográfico
  const contrastPrimary = hslToHex((pHsl.h + 145) % 360, Math.max(52, Math.min(82, pHsl.s + 14)), Math.min(42, Math.max(26, pHsl.l - 6)));
  const contrastSecondary = hslToHex((pHsl.h + 25) % 360, Math.max(60, Math.min(88, pHsl.s + 18)), 48);
  const contrastPapel = hslToHex((pHsl.h + 40) % 360, 28, 94);
  const contrastTinta = hslToHex((pHsl.h + 190) % 360, 34, 13);

  const propContrastada: PaletteAndTypeProposal = {
    id: "contrastada",
    titulo: "Contrastada",
    subtitulo: "Direção editorial ousada",
    descricao: `Contraste vincado com acento cromático renovado, papel quente e o par ${FONT_PAIRS[font2].nome} (${FONT_PAIRS[font2].tituloFamily} + ${FONT_PAIRS[font2].textoFamily}).`,
    paleta: buildBrandPalette({
      primaria: contrastPrimary,
      secundaria: contrastSecondary,
      papel: contrastPapel,
      tinta: contrastTinta,
    }),
    fontPairId: font2,
  };

  // 3. Clara — Mais papel luminoso, primária mais suave, terceiro par de tipos
  const claraPrimary = hslToHex(pHsl.h, Math.max(32, pHsl.s * 0.78), Math.min(58, Math.max(38, pHsl.l + 10)));
  const claraSecondary = rotateHue(sHex, 28, -8, 12);
  const claraPapel = hslToHex(pHsl.h, 16, 98);
  const claraTinta = hslToHex(pHsl.h, 18, 18);

  const propClara: PaletteAndTypeProposal = {
    id: "clara",
    titulo: "Clara",
    subtitulo: "Luminosa e serena",
    descricao: `Superfícies claras e respiráveis, primária suavizada e tipografia ${FONT_PAIRS[font3].nome} (${FONT_PAIRS[font3].tituloFamily} + ${FONT_PAIRS[font3].textoFamily}).`,
    paleta: buildBrandPalette({
      primaria: claraPrimary,
      secundaria: claraSecondary,
      papel: claraPapel,
      tinta: claraTinta,
    }),
    fontPairId: font3,
  };

  // 4. Afinada — A primária do logótipo com um acento novo (rotação de matiz bem visível) e quarto par de tipos
  const afinadaSecondary = hslToHex((pHsl.h + 95) % 360, Math.max(55, pHsl.s), 38);
  const afinadaPapel = hslToHex((pHsl.h + 15) % 360, 22, 96);
  const afinadaTinta = hslToHex((pHsl.h + 95) % 360, 25, 14);

  const propAfinada: PaletteAndTypeProposal = {
    id: "afinada",
    titulo: "Afinada",
    subtitulo: "Primária original com novo acento",
    descricao: `Preserva a cor principal do logótipo (${pHex}) e introduz um acento complementar com o par ${FONT_PAIRS[font4].nome} (${FONT_PAIRS[font4].tituloFamily} + ${FONT_PAIRS[font4].textoFamily}).`,
    paleta: buildBrandPalette({
      primaria: pHex,
      secundaria: afinadaSecondary,
      papel: afinadaPapel,
      tinta: afinadaTinta,
    }),
    fontPairId: font4,
  };

  return [propDireta, propContrastada, propClara, propAfinada];
}
