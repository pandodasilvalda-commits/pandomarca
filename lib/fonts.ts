import fs from "fs";
import path from "path";
import { FONT_PAIRS, FontPairId, FontPairSpec } from "./formats";

type SatoriWeight = 400 | 500 | 600 | 700 | 800;

export interface SatoriFontEntry {
  name: string;
  data: Buffer;
  weight: SatoriWeight;
  style: "normal";
}

const fontBufferCache = new Map<string, Buffer>();

const WEIGHT_FALLBACK_ORDER: Record<SatoriWeight, SatoriWeight[]> = {
  400: [400, 500, 600, 700, 800],
  500: [500, 400, 600, 700, 800],
  600: [600, 700, 500, 400, 800],
  700: [700, 600, 800, 500, 400],
  800: [800, 700, 600, 500, 400],
};

function tryLoadFontFile(
  pkg: string,
  subset: "latin" | "latin-ext",
  weight: number
): Buffer | null {
  const key = `${pkg}:${subset}:${weight}`;
  const cached = fontBufferCache.get(key);
  if (cached) return cached;

  const filePath = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "node_modules",
    "@fontsource",
    pkg,
    "files",
    `${pkg}-${subset}-${weight}-normal.woff`
  );
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  fontBufferCache.set(key, buf);
  return buf;
}

function loadFontWeightWithSameFamilyFallback(
  pkg: string,
  subset: "latin" | "latin-ext",
  targetWeight: SatoriWeight
): Buffer {
  for (const w of WEIGHT_FALLBACK_ORDER[targetWeight]) {
    const buf = tryLoadFontFile(pkg, subset, w);
    if (buf) return buf;
  }
  throw new Error(
    `Ficheiro tipográfico embebido em falta para @fontsource/${pkg} (${subset}, peso ${targetWeight}).`
  );
}

export function getSatoriFontsForPair(pairId: FontPairId): {
  pair: FontPairSpec;
  fonts: SatoriFontEntry[];
} {
  const pair = FONT_PAIRS[pairId] || FONT_PAIRS.moderna;
  const entries: SatoriFontEntry[] = [];
  const allWeights: SatoriWeight[] = [400, 500, 600, 700, 800];

  const families: readonly [string, string][] =
    pair.tituloPkg === pair.textoPkg && pair.tituloFamily === pair.textoFamily
      ? [[pair.tituloFamily, pair.tituloPkg]]
      : [
          [pair.tituloFamily, pair.tituloPkg],
          [pair.textoFamily, pair.textoPkg],
        ];

  for (const [family, pkg] of families) {
    for (const w of allWeights) {
      const latin = loadFontWeightWithSameFamilyFallback(pkg, "latin", w);
      entries.push({ name: family, data: latin, weight: w, style: "normal" });
      const latinExt = loadFontWeightWithSameFamilyFallback(pkg, "latin-ext", w);
      entries.push({ name: family, data: latinExt, weight: w, style: "normal" });
    }
  }

  return { pair, fonts: entries };
}

export function verifyAllFontPairAssets(): {
  ok: boolean;
  pairsChecked: FontPairId[];
  missing: string[];
} {
  const pairsChecked: FontPairId[] = [];
  const missing: string[] = [];

  for (const pair of Object.values(FONT_PAIRS)) {
    pairsChecked.push(pair.id);
    for (const [label, pkg, w] of [
      ["titulo", pair.tituloPkg, pair.tituloWeight],
      ["texto", pair.textoPkg, pair.textoWeight],
    ] as const) {
      for (const subset of ["latin", "latin-ext"] as const) {
        const direct = tryLoadFontFile(pkg, subset, w);
        if (!direct || direct.length === 0) {
          missing.push(`${pair.id}:${label}:${pkg}-${subset}-${w}`);
        }
      }
    }
  }

  return { ok: missing.length === 0, pairsChecked, missing };
}

export function getGeometricSansStudioFonts(): {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 600 | 700 | 800;
  style: "normal";
}[] {
  const targets: { family: string; pkg: string; weights: (400 | 500 | 600 | 700 | 800)[] }[] = [
    { family: "Manrope", pkg: "manrope", weights: [400, 500, 600, 700, 800] },
    { family: "Outfit", pkg: "outfit", weights: [400, 500, 600, 700, 800] },
  ];
  const out: {
    name: string;
    data: Buffer;
    weight: 400 | 500 | 600 | 700 | 800;
    style: "normal";
  }[] = [];
  for (const t of targets) {
    for (const w of t.weights) {
      const latin = tryLoadFontFile(t.pkg, "latin", w);
      const latinExt = tryLoadFontFile(t.pkg, "latin-ext", w);
      if (latin) out.push({ name: t.family, data: latin, weight: w, style: "normal" });
      if (latinExt) out.push({ name: t.family, data: latinExt, weight: w, style: "normal" });
    }
  }
  return out;
}
