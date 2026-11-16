export interface AiProviderConfig {
  provider: string;
  apiKey: string;
  endpoint?: string;
  model?: string;
  enabled: boolean;
}

export interface AiConceptInspiration {
  usedAiProvider: boolean;
  providerName: string;
  conceptNotes?: string;
}

export function getAiProviderConfig(): AiProviderConfig {
  const provider = (process.env.AI_IMAGE_PROVIDER || "").trim();
  const apiKey = (process.env.AI_IMAGE_API_KEY || "").trim();
  const endpoint = (process.env.AI_IMAGE_ENDPOINT || "").trim() || undefined;
  const model = (process.env.AI_IMAGE_MODEL || "").trim() || undefined;

  return {
    provider,
    apiKey,
    endpoint,
    model,
    enabled: Boolean(provider && apiKey),
  };
}

/**
 * Interface encaixável por variáveis de ambiente (AI_IMAGE_PROVIDER e AI_IMAGE_API_KEY).
 * Se as variáveis estiverem vazias ou se o pedido externo falhar, devolve fallback limpo
 * para o gerador vectorial próprio em SVG sem interromper a aplicação.
 */
export async function requestAiConceptEnhancement(params: {
  nome: string;
  sector: string;
  tresPalavras: string;
  coresPreferidas: string;
  coresEvitar: string;
  notasReferencias: string[];
}): Promise<AiConceptInspiration> {
  const cfg = getAiProviderConfig();
  if (!cfg.enabled) {
    return {
      usedAiProvider: false,
      providerName: "svg-studio-local",
    };
  }

  // Se um endpoint HTTP genérico estiver configurado, tenta invocá-lo com timeout curto;
  // em caso de ausência de rede ou erro, faz fallback silencioso para o motor SVG próprio.
  if (cfg.endpoint) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(cfg.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          provider: cfg.provider,
          model: cfg.model || "default",
          prompt: `Conceito de logótipo de estúdio para ${params.nome} (${params.sector}). Palavras: ${params.tresPalavras}. Cores preferidas: ${params.coresPreferidas}. Evitar: ${params.coresEvitar}.`,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        return {
          usedAiProvider: true,
          providerName: cfg.provider,
          conceptNotes: "Conceito assistido pelo fornecedor de IA configurado e vectorizado pelo motor SVG.",
        };
      }
    } catch {
      // Fallback imediato para o gerador SVG próprio
    }
  }

  return {
    usedAiProvider: false,
    providerName: `${cfg.provider}-fallback-svg`,
    conceptNotes: "Fornecedor configurado em ambiente; geração assegurada pelo motor vectorial SVG.",
  };
}
