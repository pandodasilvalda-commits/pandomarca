import type {
  GeminiAspectRatio,
  RedeSocialId,
  TomDaMarca,
} from "../config/redes-sociais";
import type { SafeZoneAuditResult } from "../capas/safe-zone";
import type { BrandPalette, BrandPaletteHex, SectorId } from "../formats";

export type { TomDaMarca };

export type ImagemModo = "falso" | "real";
export type ImagemFornecedor = "gemini" | "recraft" | "";

export type ImagemFormato =
  | "logotipo-classico"
  | "logotipo-moderno"
  | "logotipo-editorial"
  | "rede-avatar"
  | "rede-capa"
  | "publicacao-instagram"
  | "publicacao-instagram-4x5"
  | "story-instagram"
  | "capa-fundo"
  | "capa"
  | "fundo-capa"
  | "fundo-textura"
  | "objeto-recorte";

export interface LogoVisualDna {
  estiloDirecao: "classico" | "moderno" | "editorial";
  tom: TomDaMarca;
  formasPrincipais: string;
  motivosGraficos: string[];
  estiloEstetico: string;
  paletaDescricao: string;
  paletaHex: BrandPaletteHex;
  fixtureLogoOrigem?: string;
}

export interface ImagemContexto {
  nome?: string;
  slogan?: string;
  sector?: SectorId;
  tom?: TomDaMarca;
  estilo?: "classico" | "moderno" | "editorial";
  estiloVisual?: "moderno" | "classico";
  ronda?: number;
  tresPalavras?: string;
  coresPreferidas?: string;
  coresEvitar?: string;
  paleta?: BrandPalette;
  simbolo?: boolean;
  referenciasNotas?: string[];
  logotipoReferencia?: Buffer;
  logotipoReferenciaMime?: "image/png" | "image/jpeg" | "image/svg+xml";
  logotipoDna?: LogoVisualDna;
  layoutId?: string;
  estiloPeca?: string;
  redeId?: RedeSocialId;
  aspectRatioNativo?: GeminiAspectRatio;
  textosPedidos?: string[];
  larguraAlvo?: number;
  alturaAlvo?: number;
}

export interface ImagemResultado {
  buffer: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/svg+xml";
  width: number;
  height: number;
  origem: "fixture" | "falso-adaptado" | "real";
  fixtureNome?: string;
  custoEur: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface VetorResultado {
  svg: string;
  simboloSvg: string;
  simboloNegativoSvg?: string;
  monocromaticoSvg: string;
  negativoSvg: string;
  byteSize: number;
  colorsHex: string[];
}

export interface PecaGeradaIA {
  redeId: RedeSocialId;
  estiloVisual: "moderno" | "classico";
  tituloProposta: string;
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: "image/png";
  origem: ImagemResultado["origem"];
  fixtureNome?: string;
  promptUsado: string;
  aspectRatioGemini: GeminiAspectRatio;
  referenciaLogoUsada: boolean;
  textosPedidos: string[];
  avisoTextos: string;
  audit: SafeZoneAuditResult;
}

export interface ImagemProvider {
  readonly nome: string;
  readonly modo: ImagemModo;
  gerar(
    prompt: string,
    formato: ImagemFormato,
    n: number,
    contexto?: ImagemContexto
  ): Promise<ImagemResultado[]>;
  editar(
    imagem: Buffer,
    instrucao: string,
    contexto?: ImagemContexto
  ): Promise<ImagemResultado>;
  removerFundo(imagem: Buffer): Promise<ImagemResultado>;
  vetorizar(
    imagem: Buffer,
    opcoes?: { maxColors?: number; inkHex?: string }
  ): Promise<VetorResultado>;
}

export interface ImagemConfig {
  modo: ImagemModo;
  fornecedor: ImagemFornecedor;
  modelo: string;
  temChaveGemini: boolean;
  temChaveRecraft: boolean;
  limitePorKitEur: number;
  maxRondas: number;
  maxAjustes: number;
}

export type ImagemErrorCode =
  | "budget_exceeded"
  | "real_not_enabled"
  | "missing_api_key"
  | "max_rounds"
  | "max_adjustments"
  | "invalid_input";

export class ImagemProviderError extends Error {
  code: ImagemErrorCode;
  detalhes?: Record<string, unknown>;

  constructor(
    code: ImagemErrorCode,
    message: string,
    detalhes?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ImagemProviderError";
    this.code = code;
    this.detalhes = detalhes;
  }
}
