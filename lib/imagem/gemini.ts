import type { GeminiAspectRatio } from "../config/redes-sociais";
import {
  ImagemContexto,
  ImagemFormato,
  ImagemProvider,
  ImagemProviderError,
  ImagemResultado,
  VetorResultado,
} from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-nano-banana-2.1";

export interface NanoBananaGeneratePayload {
  model: string;
  endpointPath: string;
  contents: {
    role: "user";
    parts: Array<
      | { text: string }
      | {
          inlineData: {
            mimeType: string;
            data: string;
          };
        }
    >;
  }[];
  generationConfig: {
    responseModalities: ["IMAGE"];
    imageConfig: {
      aspectRatio: GeminiAspectRatio;
    };
  };
  temReferenciaObrigatoria: boolean;
}

function isLogoGenerationFormat(formato: ImagemFormato): boolean {
  return (
    formato === "logotipo-classico" ||
    formato === "logotipo-moderno" ||
    formato === "logotipo-editorial"
  );
}

/**
 * Constrói o pedido estruturado para o endpoint Gemini Nano Banana 2.1,
 * garantindo a inclusão multimodal de `logotipoReferencia` nas peças seguintes
 * (perfis, capas, publicações e stories) e a proporção nativa configurada.
 */
export function buildNanoBananaRequest(
  prompt: string,
  formato: ImagemFormato,
  contexto?: ImagemContexto,
  modeloOverride?: string
): NanoBananaGeneratePayload {
  const model =
    (modeloOverride || process.env.IMAGEM_MODELO || DEFAULT_GEMINI_MODEL).trim() ||
    DEFAULT_GEMINI_MODEL;

  const precisaLogoRef = !isLogoGenerationFormat(formato);
  const temRef = Boolean(
    contexto?.logotipoReferencia && contexto.logotipoReferencia.length > 0
  );

  if (precisaLogoRef && !temRef) {
    throw new ImagemProviderError(
      "invalid_input",
      `O logótipo escolhido é obrigatório como imagem de referência para gerar "${formato}".`
    );
  }

  const parts: NanoBananaGeneratePayload["contents"][0]["parts"] = [{ text: prompt }];
  if (contexto?.logotipoReferencia && contexto.logotipoReferencia.length > 0) {
    parts.push({
      inlineData: {
        mimeType: contexto.logotipoReferenciaMime || "image/png",
        data: contexto.logotipoReferencia.toString("base64"),
      },
    });
  }

  const aspectRatio: GeminiAspectRatio =
    contexto?.aspectRatioNativo ||
    (formato === "story-instagram"
      ? "9:16"
      : formato === "publicacao-instagram-4x5"
      ? "4:5"
      : formato === "capa" || formato === "capa-fundo" || formato === "rede-capa"
      ? "21:9"
      : "1:1");

  return {
    model,
    endpointPath: `/v1beta/models/${model}:generateContent`,
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio,
      },
    },
    temReferenciaObrigatoria: temRef,
  };
}

/**
 * Adaptador estruturado para Google Gemini Nano Banana 2.1.
 * Envia o logótipo escolhido como referência multimodal (`inlineData`)
 * e solicita a proporção nativa mais próxima com zonas seguras livres.
 * Nesta fase de desenvolvimento e testes sem custos nunca executa chamadas HTTP.
 */
export class GeminiImagemProvider implements ImagemProvider {
  readonly nome = "gemini";
  readonly modo = "real" as const;
  private readonly modelo: string;

  constructor(options?: { modelo?: string }) {
    this.modelo =
      (options?.modelo || process.env.IMAGEM_MODELO || DEFAULT_GEMINI_MODEL).trim() ||
      DEFAULT_GEMINI_MODEL;
  }

  getModeloConfigurado(): string {
    return this.modelo;
  }

  private assertNotLive(payload?: NanoBananaGeneratePayload): never {
    if (!process.env.GEMINI_API_KEY?.trim()) {
      throw new ImagemProviderError(
        "missing_api_key",
        "Chave GEMINI_API_KEY não configurada no ambiente."
      );
    }
    throw new ImagemProviderError(
      "real_not_enabled",
      `Adaptador Gemini (${this.modelo}) estruturado com suporte multimodal${payload ? ` (${payload.generationConfig.imageConfig.aspectRatio})` : ""}; chamadas pagas desativadas em desenvolvimento.`,
      payload
        ? {
            modelo: payload.model,
            aspectRatio: payload.generationConfig.imageConfig.aspectRatio,
            temReferenciaObrigatoria: payload.temReferenciaObrigatoria,
          }
        : undefined
    );
  }

  async gerar(
    prompt: string,
    formato: ImagemFormato,
    _n: number,
    contexto?: ImagemContexto
  ): Promise<ImagemResultado[]> {
    const payload = buildNanoBananaRequest(prompt, formato, contexto, this.modelo);
    return this.assertNotLive(payload);
  }

  async editar(
    imagem: Buffer,
    instrucao: string,
    contexto?: ImagemContexto
  ): Promise<ImagemResultado> {
    const payload = buildNanoBananaRequest(instrucao, "logotipo-classico", {
      ...contexto,
      logotipoReferencia: imagem,
    }, this.modelo);
    return this.assertNotLive(payload);
  }

  async removerFundo(_imagem: Buffer): Promise<ImagemResultado> {
    return this.assertNotLive();
  }

  async vetorizar(_imagem: Buffer): Promise<VetorResultado> {
    return this.assertNotLive();
  }
}
