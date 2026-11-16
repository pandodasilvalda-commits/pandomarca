import type { BrandPalette, BrandPaletteHex, SectorId } from "../formats";

export type ImagemModo = "falso" | "real";
export type ImagemFornecedor = "gemini" | "recraft" | "";
export type ImagemFormato =
  | "logotipo-classico"
  | "logotipo-moderno"
  | "logotipo-editorial"
  | "fundo-capa"
  | "fundo-textura"
  | "objeto-recorte"
  | "capa"
  | "capa-fundo"
  | "publicacao-instagram"
  | "story-instagram";

export interface LogoVisualDna {
  estiloDirecao: "classico" | "moderno" | "editorial";
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
  estilo?: "classico" | "moderno" | "editorial";
  ronda?: number;
  tresPalavras?: string;
  coresPreferidas?: string;
  coresEvitar?: string;
  paleta?: BrandPalette;
  simbolo?: boolean;
  referenciasNotas?: string[];
  logotipoReferencia?: Buffer;
  logotipoReferenciaMime?: "image/png" | "image/svg+xml";
  logotipoDna?: LogoVisualDna;
  layoutId?: string;
  estiloPeca?: string;
  larguraAlvo?: number;
  alturaAlvo?: number;
}

export interface ImagemResultado {
  buffer: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/svg+xml";
  width: number;
  height: number;
  origem: "fixture" | "falso-adaptado" | "real" | "reserva-svg";
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
