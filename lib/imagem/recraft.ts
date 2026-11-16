import {
  ImagemContexto,
  ImagemFormato,
  ImagemProvider,
  ImagemProviderError,
  ImagemResultado,
  VetorResultado,
} from "./types";

/**
 * Adaptador vazio estruturado para Recraft (geração vectorial, cenas em estilo da marca e remoção de fundo).
 * Suporta envio de `contexto?.logotipoReferencia` + `contexto?.logotipoDna` para coerência entre logótipo e capas.
 * Nesta fase de desenvolvimento e testes sem custos não executa chamadas de rede.
 */
export class RecraftImagemProvider implements ImagemProvider {
  readonly nome = "recraft";
  readonly modo = "real" as const;
  private readonly modelo: string;

  constructor(options?: { modelo?: string }) {
    this.modelo = options?.modelo || process.env.IMAGEM_MODELO || "";
  }

  private assertNotLive(): never {
    if (!process.env.RECRAFT_API_KEY?.trim()) {
      throw new ImagemProviderError(
        "missing_api_key",
        "Chave RECRAFT_API_KEY não configurada no ambiente."
      );
    }
    throw new ImagemProviderError(
      "real_not_enabled",
      `Adaptador estrutural Recraft (${this.modelo || "sem modelo"}) pronto para ligação futura com referência visual de logótipo; chamadas pagas desativadas nesta versão.`
    );
  }

  async gerar(
    _prompt: string,
    _formato: ImagemFormato,
    _n: number,
    _contexto?: ImagemContexto
  ): Promise<ImagemResultado[]> {
    // Em ligação futura: enviar contexto?.logotipoReferencia como style/image reference junto com a paleta HEX
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
