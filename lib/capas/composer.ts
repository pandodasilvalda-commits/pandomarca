import type { BrandData } from "../formats";
import { contrastRatio, getContrastingTextHex } from "../palette";
import type { CoverLayoutId, CoverLayoutSpec } from "./catalog";
export {
  cropResizeToRedeSpec,
  validarZonaSegura,
  type SafeZoneAuditResult,
} from "./safe-zone";

export interface CoverAuditInfo {
  layoutId: CoverLayoutId;
  categoria: CoverLayoutSpec["categoria"];
  textColorHex: string;
  surfaceHex: string;
  contrastRatio: number;
  wcagAaPassed: boolean;
  referenciaLogoUsada: boolean;
  formasDoLogotipo: string;
  estiloDoLogotipo: string;
  promptResumo: string;
  textosPedidos?: string[];
  precisaRegeneracao?: boolean;
  motivosSafeZone?: string[];
}

/**
 * Garante contraste WCAG AA (mínimo 4.5:1 para texto normal, 3.0:1 para títulos grandes).
 */
export function ensureWcagContrast(
  preferredHex: string,
  backgroundHex: string,
  minRatio = 4.5
): string {
  if (contrastRatio(preferredHex, backgroundHex) >= minRatio) {
    return preferredHex;
  }

  const candidates = [
    "#141210",
    "#1C1917",
    "#0F172A",
    "#000000",
    "#FAF8F5",
    "#FFFFFF",
  ];

  let best = getContrastingTextHex(backgroundHex, "#FAF8F5", "#141210");
  let bestRatio = contrastRatio(best, backgroundHex);

  for (const c of candidates) {
    const r = contrastRatio(c, backgroundHex);
    if (r >= minRatio && r > bestRatio) {
      best = c;
      bestRatio = r;
    }
  }

  if (bestRatio >= minRatio) return best;
  return contrastRatio("#FFFFFF", backgroundHex) >=
    contrastRatio("#000000", backgroundHex)
    ? "#FFFFFF"
    : "#000000";
}

/**
 * Extrai apenas os dados realmente preenchidos pelo cliente (nunca inventa contactos nem moradas).
 */
export function extractRealClientLines(dados: BrandData): {
  nome: string;
  slogan: string | null;
  servicos: string | null;
  localidade: string | null;
  telefone: string | null;
  website: string | null;
  email: string | null;
} {
  return {
    nome: (dados.nome || "").trim(),
    slogan: (dados.slogan || "").trim() || null,
    servicos: (dados.servicos || "").trim() || null,
    localidade: (dados.morada || "").trim() || null,
    telefone: (dados.telefone || "").trim() || null,
    website: (dados.website || "").trim().replace(/^https?:\/\//i, "") || null,
    email: (dados.email || "").trim() || null,
  };
}
