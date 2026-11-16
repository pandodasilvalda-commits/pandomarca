import {
  ImagemContexto,
  ImagemFormato,
  ImagemProvider,
  ImagemProviderError,
  ImagemResultado,
  VetorResultado,
} from "./types";

/**
 * Adaptador vazio estruturado para Google Gemini (Imagen / Gemini Image).
 * Suporta envio do logótipo escolhido como referência visual multimodal
 * (`contexto?.logotipoReferencia` + `contexto?.logotipoDna`) para capas e publicações.
 * Nesta fase de desenvolvimento e testes sem custos não executa chamadas de rede.
 */
export class GeminiImagemProvider implements ImagemProvider {
  readonly nome = "gemini";
  readonly modo = "real" as const;
  private readonly modelo: string;

  constructor(options?: { modelo?: string }) {
    this.modelo = options?.modelo || process.env.IMAGEM_MODELO || "";
  }

  private assertNotLive(): never {
    if (!process.env.GEMINI_API_KEY?.trim()) {
      throw new ImagemProviderError(
        "missing_api_key",
        "Chave GEMINI_API_KEY não configurada no ambiente."
      );
    }
    throw new ImagemProviderError(
      "real_not_enabled",
      `Adaptador estrutural Gemini (${this.modelo || "sem modelo"}) pronto para ligação futura com referência visual de logótipo; chamadas pagas desativadas nesta versão.`
    );
  }

  async gerar(
    _prompt: string,
    _formato: ImagemFormato,
    _n: number,
    _contexto?: ImagemContexto
  ): Promise<ImagemResultado[]> {
    // Em ligação futura: anexar contexto?.logotipoReferencia (image/png) como parte multimodal de referência
    return this.assertNotLive();
  }

  async editar(
    _imagem: Buffer,
    _instrucao: string,
    _contexto?: ImagemContexto
  ): Promise<ImagemResultado> {
    return this.assertNotLive();
  }

  async removerFundo(_imagem: Buffer): Promise<ImagemResultado> {
    return this.assertNotLive();
  }

  async vetorizar(_imagem: Buffer): Promise<VetorResultado> {
    return this.assertNotLive();
  }
}
