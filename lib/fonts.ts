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

export function getSatoriFontsForPair(pairId: FontPairId): {
  pair: FontPairSpec;
  fonts: SatoriFontEntry[];
} {
  const pair = FONT_PAIRS[pairId] || FONT_PAIRS.moderna;
  const entries: SatoriFontEntry[] = [
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

  // Also load weight 400 of title font if different from textoFamily for secondary labels
  if (pair.tituloFamily !== pair.textoFamily) {
    entries.push(
      {
        name: pair.tituloFamily,
        data: loadFontFile(pair.tituloPkg, "latin", 400),
        weight: 400,
        style: "normal",
      },
      {
        name: pair.tituloFamily,
        data: loadFontFile(pair.tituloPkg, "latin-ext", 400),
        weight: 400,
        style: "normal",
      }
    );
  }

  return { pair, fonts: entries };
}
