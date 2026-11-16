import fs from "fs";
import path from "path";
import { FONT_PAIRS, FontPairId, FontPairSpec } from "./formats";

export interface SatoriFontEntry {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 700;
  style: "normal";
}

const fontBufferCache = new Map<string, Buffer>();

function loadFontFile(pkg: string, subset: "latin" | "latin-ext", weight: number): Buffer {
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
  const buf = fs.readFileSync(filePath);
  fontBufferCache.set(key, buf);
  return buf;
}

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

export function getSatoriFontsForPair(pairId: FontPairId): {
  pair: FontPairSpec;
  fonts: { name: string; data: Buffer; weight: 400 | 500 | 600 | 700 | 800; style: "normal" }[];
} {
  const pair = FONT_PAIRS[pairId] || FONT_PAIRS.moderna;
  const entries: {
    name: string;
    data: Buffer;
    weight: 400 | 500 | 600 | 700 | 800;
    style: "normal";
  }[] = [
    {
      name: pair.tituloFamily,
      data: loadFontFile(pair.tituloPkg, "latin", pair.tituloWeight),
      weight: pair.tituloWeight,
      style: "normal",
    },
    {
      name: pair.tituloFamily,
      data: loadFontFile(pair.tituloPkg, "latin-ext", pair.tituloWeight),
      weight: pair.tituloWeight,
      style: "normal",
    },
    {
      name: pair.textoFamily,
      data: loadFontFile(pair.textoPkg, "latin", pair.textoWeight),
      weight: pair.textoWeight,
      style: "normal",
    },
    {
      name: pair.textoFamily,
      data: loadFontFile(pair.textoPkg, "latin-ext", pair.textoWeight),
      weight: pair.textoWeight,
      style: "normal",
    },
  ];

  const loadedKeys = new Set<string>([
    `${pair.tituloFamily}:${pair.tituloWeight}`,
    `${pair.textoFamily}:${pair.textoWeight}`,
  ]);

  const extraWeights: (400 | 500 | 600 | 700 | 800)[] = [400, 500, 600, 700, 800];
  for (const [family, pkg] of [
    [pair.tituloFamily, pair.tituloPkg],
    [pair.textoFamily, pair.textoPkg],
  ] as const) {
    for (const w of extraWeights) {
      const k = `${family}:${w}`;
      if (loadedKeys.has(k)) continue;
      const latin = tryLoadFontFile(pkg, "latin", w);
      const latinExt = tryLoadFontFile(pkg, "latin-ext", w);
      if (latin) {
        entries.push({ name: family, data: latin, weight: w, style: "normal" });
        if (latinExt) {
          entries.push({ name: family, data: latinExt, weight: w, style: "normal" });
        }
        loadedKeys.add(k);
      }
    }
  }

  return { pair, fonts: entries };
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
