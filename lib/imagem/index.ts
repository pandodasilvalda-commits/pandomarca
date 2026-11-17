import crypto from "crypto";
import {
  getRedeSocialConfig,
  resolverHierarquiaInformacaoConfig,
  TOM_DA_MARCA_SPECS,
  type RedeSocialId,
  type TomDaMarca,
} from "../config/redes-sociais";
import {
  cropResizeToRedeSpec,
  validarZonaSegura,
  type SafeZoneAuditResult,
} from "../capas/safe-zone";
import {
  BrandData,
  BrandPalette,
  FONT_PAIRS,
  FontPairId,
  resolverParTipograficoMarca,
  SECTORS,
  SectorId,
  StyleId,
} from "../formats";
import { buildBrandPalette } from "../palette";
import {
  CUSTO_UNITARIO_EUR,
  getLimitePorKitEurFromEnv,
  lerOrcamentoKit,
  limparOrcamentoKit,
  OrcamentoKitEstado,
  verificarERegistarCusto,
} from "./custo";
import { FalsoImagemProvider } from "./falso";
import { DEFAULT_GEMINI_MODEL, GeminiImagemProvider } from "./gemini";
import { carregarPrompt, listarPromptsDisponiveis } from "./prompts";
import { RecraftImagemProvider } from "./recraft";
import { buildLogoVisualDna } from "./referencia";
import {
  ImagemConfig,
  ImagemContexto,
  ImagemFormato,
  ImagemFornecedor,
  ImagemModo,
  ImagemProvider,
  ImagemProviderError,
  ImagemResultado,
  LogoVisualDna,
  PecaGeradaIA,
} from "./types";

export * from "./types";
export * from "./custo";
export * from "./prompts";
export * from "./referencia";
export { FalsoImagemProvider } from "./falso";
export {
  GeminiImagemProvider,
  DEFAULT_GEMINI_MODEL,
  buildNanoBananaRequest,
} from "./gemini";
export { RecraftImagemProvider } from "./recraft";

export const AVISO_VERIFIQUE_TEXTOS_PT =
  "Verifique os textos gerados na imagem face aos dados introduzidos; se alguma palavra precisar de correção, clique em «Regenerar».";

export interface PublicImagemConfig {
  modo: ImagemModo;
  fornecedor: ImagemFornecedor | "local";
  modelo: string;
  limitePorKitEur: number;
  maxRondas: number;
  maxAjustes: number;
  semCustosReais: boolean;
  etiquetaModo: string;
}

export interface LogoPropostaIA {
  id: string;
  estilo: "classico" | "moderno";
  tom: TomDaMarca;
  titulo: string;
  subtitulo: string;
  racional: string;
  ronda: number;
  ajusteNumero?: number;
  origem: ImagemResultado["origem"];
  fixtureNome?: string;
  promptUsado: string;
  permiteTextoNoLogotipo:
    | "apenas_nome_ou_sem_texto"
    | "sem_texto_nenhum"
    | "apenas_dados_reais_cliente";
  imagemBase64: string;
  width: number;
  height: number;
  sugestaoPaleta: BrandPalette;
  sugestaoFontPairId: FontPairId;
}

function parsePositiveIntEnv(key: string, fallback: number): number {
  const raw = (process.env[key] || "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return n;
}

export function getImagemConfig(): ImagemConfig {
  const modoRaw = (process.env.IMAGEM_MODO || "falso").trim().toLowerCase();
  const modo: ImagemModo = modoRaw === "real" ? "real" : "falso";

  const fornRaw = (process.env.IMAGEM_FORNECEDOR || "").trim().toLowerCase();
  const fornecedor: ImagemFornecedor =
    fornRaw === "gemini" || fornRaw === "recraft" ? fornRaw : "";

  return {
    modo,
    fornecedor,
    modelo: (process.env.IMAGEM_MODELO || DEFAULT_GEMINI_MODEL).trim(),
    temChaveGemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
    temChaveRecraft: Boolean(process.env.RECRAFT_API_KEY?.trim()),
    limitePorKitEur: getLimitePorKitEurFromEnv(),
    maxRondas: parsePositiveIntEnv("IMAGEM_MAX_RONDAS", 3),
    maxAjustes: parsePositiveIntEnv("IMAGEM_MAX_AJUSTES", 3),
  };
}

export function getPublicImagemConfig(): PublicImagemConfig {
  const cfg = getImagemConfig();
  return {
    modo: cfg.modo,
    fornecedor: cfg.modo === "falso" ? "local" : cfg.fornecedor || "gemini",
    modelo: cfg.modelo || DEFAULT_GEMINI_MODEL,
    limitePorKitEur: cfg.limitePorKitEur,
    maxRondas: cfg.maxRondas,
    maxAjustes: cfg.maxAjustes,
    semCustosReais: cfg.modo === "falso",
    etiquetaModo:
      cfg.modo === "falso"
        ? "Modo de demonstração"
        : `Fornecedor configurado (${cfg.fornecedor || "gemini"} • ${cfg.modelo})`,
  };
}

export function getImagemProvider(): ImagemProvider {
  const cfg = getImagemConfig();
  if (cfg.modo === "real") {
    if (cfg.fornecedor === "recraft") {
      return new RecraftImagemProvider({ modelo: cfg.modelo });
    }
    return new GeminiImagemProvider({ modelo: cfg.modelo });
  }
  return new FalsoImagemProvider();
}

export function decodeBase64ImageInput(dataUrlOrB64: string): Buffer {
  const trimmed = (dataUrlOrB64 || "").trim();
  const commaIdx = trimmed.indexOf(",");
  const rawB64 = commaIdx >= 0 ? trimmed.slice(commaIdx + 1) : trimmed;
  return Buffer.from(rawB64, "base64");
}

function resolveTom(tom?: string): TomDaMarca {
  if (tom && tom in TOM_DA_MARCA_SPECS) {
    return tom as TomDaMarca;
  }
  return "tradicional";
}

function getDistinctPalettesForRound(
  ronda: number,
  tom: TomDaMarca = "tradicional",
  sector: SectorId = "restauracao"
): {
  classica: BrandPalette;
  moderna: BrandPalette;
} {
  const isWarmHeritage =
    tom === "tradicional" ||
    tom === "natural" ||
    (sector === "restauracao" && tom !== "tecnico" && tom !== "jovem");

  if (!isWarmHeritage) {
    if (tom === "tecnico") {
      if (ronda === 2) {
        return {
          classica: buildBrandPalette({
            primaria: "#1E3A5F",
            secundaria: "#0284C7",
            papel: "#F8FAFC",
            tinta: "#0F172A",
          }),
          moderna: buildBrandPalette({
            primaria: "#0F172A",
            secundaria: "#0EA5E9",
            papel: "#F1F5F9",
            tinta: "#090D16",
          }),
        };
      }
      if (ronda === 3) {
        return {
          classica: buildBrandPalette({
            primaria: "#1E40AF",
            secundaria: "#0D9488",
            papel: "#F8FAFC",
            tinta: "#0F172A",
          }),
          moderna: buildBrandPalette({
            primaria: "#111827",
            secundaria: "#2563EB",
            papel: "#F9FAFB",
            tinta: "#030712",
          }),
        };
      }
      return {
        classica: buildBrandPalette({
          primaria: "#1D4ED8",
          secundaria: "#0F766E",
          papel: "#F8FAFC",
          tinta: "#0F172A",
        }),
        moderna: buildBrandPalette({
          primaria: "#0F172A",
          secundaria: "#38BDF8",
          papel: "#F1F5F9",
          tinta: "#0B1120",
        }),
      };
    }

    if (tom === "premium") {
      if (ronda === 2) {
        return {
          classica: buildBrandPalette({
            primaria: "#312E81",
            secundaria: "#B45309",
            papel: "#FAF8F5",
            tinta: "#111827",
          }),
          moderna: buildBrandPalette({
            primaria: "#18181B",
            secundaria: "#C28E3A",
            papel: "#F8F7F4",
            tinta: "#09090B",
          }),
        };
      }
      return {
        classica: buildBrandPalette({
          primaria: "#1E293B",
          secundaria: "#A16207",
          papel: "#FAF8F4",
          tinta: "#141413",
        }),
        moderna: buildBrandPalette({
          primaria: "#141413",
          secundaria: "#CA8A04",
          papel: "#F7F5F0",
          tinta: "#0F0F0E",
        }),
      };
    }

    // Jovem / Divertido
    if (ronda === 2) {
      return {
        classica: buildBrandPalette({
          primaria: "#0F766E",
          secundaria: "#F59E0B",
          papel: "#F8FAFC",
          tinta: "#132122",
        }),
        moderna: buildBrandPalette({
          primaria: "#3730A3",
          secundaria: "#EC4899",
          papel: "#FAFAFA",
          tinta: "#111827",
        }),
      };
    }
    return {
      classica: buildBrandPalette({
        primaria: "#0D9488",
        secundaria: "#EA580C",
        papel: "#F9FAFB",
        tinta: "#1E293B",
      }),
      moderna: buildBrandPalette({
        primaria: "#1E1B4B",
        secundaria: "#22C55E",
        papel: "#F8FAFC",
        tinta: "#0F172A",
      }),
    };
  }

  if (ronda === 2) {
    return {
      classica: buildBrandPalette({
        primaria: "#9A3412",
        secundaria: "#B45309",
        papel: "#FBF7EF",
        tinta: "#241610",
      }),
      moderna: buildBrandPalette({
        primaria: "#0F3D3E",
        secundaria: "#C87D28",
        papel: "#F6F5F0",
        tinta: "#132122",
      }),
    };
  }
  if (ronda === 3) {
    return {
      classica: buildBrandPalette({
        primaria: "#7C2D12",
        secundaria: "#CA8A04",
        papel: "#F9F4EA",
        tinta: "#1F140E",
      }),
      moderna: buildBrandPalette({
        primaria: "#1E293B",
        secundaria: "#D97706",
        papel: "#F8FAFC",
        tinta: "#0F172A",
      }),
    };
  }
  return {
    classica: buildBrandPalette({
      primaria: "#B84A24",
      secundaria: "#D9822B",
      papel: "#FAF6F0",
      tinta: "#2A1810",
    }),
    moderna: buildBrandPalette({
      primaria: "#26150D",
      secundaria: "#D9822B",
      papel: "#FAF3E1",
      tinta: "#26150D",
    }),
  };
}

function getDefaultPromptHintsForTom(tom: TomDaMarca): {
  coresClassicas: string;
  palavrasClassicas: string;
  coresModernas: string;
  palavrasModernas: string;
} {
  switch (tom) {
    case "tecnico":
      return {
        coresClassicas: "Azul cobalto, cinzento ardósia e branco limpo",
        palavrasClassicas: "Precisão, Engenharia, Clareza",
        coresModernas: "Grafite escuro, azul elétrico e cinzento neutro",
        palavrasModernas: "Rigor, Sistema, Inovação",
      };
    case "premium":
      return {
        coresClassicas: "Azul noite, dourado acetinado e marfim",
        palavrasClassicas: "Elegância, Rigor, Distinção",
        coresModernas: "Carvão profundo, bronze suave e branco osso",
        palavrasModernas: "Minimalismo, Exclusividade, Harmonia",
      };
    case "jovem":
      return {
        coresClassicas: "Verde petróleo, âmbar vivo e branco suave",
        palavrasClassicas: "Energia, Ritmo, Proximidade",
        coresModernas: "Índigo intenso, coral luminoso e cinzento claro",
        palavrasModernas: "Dinamismo, Comunidade, Expressão",
      };
    case "divertido":
      return {
        coresClassicas: "Turquesa luminoso, laranja quente e creme claro",
        palavrasClassicas: "Simpatia, Acolhimento, Leveza",
        coresModernas: "Azul vivo, verde menta e branco puro",
        palavrasModernas: "Espontaneidade, Proximidade, Alegria",
      };
    case "natural":
      return {
        coresClassicas: "Terracota natural, verde sálvia e linho claro",
        palavrasClassicas: "Origem, Matéria, Autenticidade",
        coresModernas: "Verde floresta, ocre mineral e papel cru",
        palavrasModernas: "Equilíbrio, Terra, Sustentabilidade",
      };
    case "tradicional":
    default:
      return {
        coresClassicas: "Terracota, ocre e creme",
        palavrasClassicas: "Tradição, Ofício, Autenticidade",
        coresModernas: "Espresso escuro, dourado quente e creme",
        palavrasModernas: "Geometria, Clareza, Rigor",
      };
  }
}

function resolveContrastingSecondaryFontPair(
  basePair: FontPairId,
  tom: TomDaMarca
): FontPairId {
  const sameCategoryPreferred =
    tom === "tecnico" || tom === "jovem" || tom === "divertido";
  const baseCategory = FONT_PAIRS[basePair]?.categoria || "sans";
  const ordered: FontPairId[] = [
    "moderna",
    "tecnica",
    "clara",
    "editorial",
    "confianca",
    "classica",
  ];
  if (sameCategoryPreferred) {
    return (
      ordered.find(
        (id) => id !== basePair && FONT_PAIRS[id].categoria === "sans"
      ) || ordered.find((id) => id !== basePair) || "moderna"
    );
  }
  return (
    ordered.find(
      (id) => id !== basePair && FONT_PAIRS[id].categoria !== baseCategory
    ) ||
    ordered.find((id) => id !== basePair) ||
    "editorial"
  );
}

export async function gerarPropostasLogotipoRonda(params: {
  sessaoId: string;
  nome: string;
  slogan?: string;
  sector?: SectorId;
  tom?: TomDaMarca;
  tresPalavras?: string;
  coresPreferidas?: string;
  coresEvitar?: string;
  simbolo?: boolean;
  ronda?: number;
  limiteOverrideEur?: number;
}): Promise<{
  propostas: [LogoPropostaIA, LogoPropostaIA];
  orcamento: OrcamentoKitEstado;
  config: PublicImagemConfig;
}> {
  const cfg = getImagemConfig();
  const ronda = Number(params.ronda || 1);
  if (!Number.isInteger(ronda) || ronda < 1 || ronda > cfg.maxRondas) {
    throw new ImagemProviderError(
      "max_rounds",
      `Limite de ${cfg.maxRondas} rondas atingido. Escolha uma das propostas ou ajuste a escolhida.`
    );
  }

  const sector: SectorId =
    params.sector && params.sector in SECTORS ? params.sector : "restauracao";
  const sectorLabel = SECTORS[sector].rotulo;
  const tom = resolveTom(params.tom);
  const tomSpec = TOM_DA_MARCA_SPECS[tom];
  const promptHints = getDefaultPromptHintsForTom(tom);

  const orcamentoAtual = lerOrcamentoKit(params.sessaoId, params.limiteOverrideEur);
  const custoPrevisto = CUSTO_UNITARIO_EUR.gerar * 2;
  if (orcamentoAtual.gastoEur + custoPrevisto > orcamentoAtual.limiteEur + 0.0001) {
    throw new ImagemProviderError(
      "budget_exceeded",
      `Orçamento de imagem atingido (${orcamentoAtual.gastoEur.toFixed(2).replace(".", ",")} € / ${orcamentoAtual.limiteEur.toFixed(2).replace(".", ",")} €). Escolha uma das propostas apresentadas.`
    );
  }

  const promptClassico = carregarPrompt("logotipo-classico", {
    nome: params.nome,
    sector: sectorLabel,
    tom: tomSpec.nome,
    tomDescricao: tomSpec.direcaoEstetica,
    coresPreferidas: params.coresPreferidas || promptHints.coresClassicas,
    tresPalavras: params.tresPalavras || promptHints.palavrasClassicas,
    coresEvitar: params.coresEvitar || "Néons frios e efeitos 3D",
  });

  const promptModerno = carregarPrompt("logotipo-moderno", {
    nome: params.nome,
    sector: sectorLabel,
    tom: tomSpec.nome,
    tomDescricao: tomSpec.direcaoEstetica,
    coresPreferidas: params.coresPreferidas || promptHints.coresModernas,
    tresPalavras: params.tresPalavras || promptHints.palavrasModernas,
    coresEvitar: params.coresEvitar || "Clichés complexos e gradientes fotorealistas",
  });

  const provider = getImagemProvider();
  const ctxBase: ImagemContexto = {
    nome: params.nome,
    slogan: params.slogan,
    sector,
    tom,
    ronda,
    aspectRatioNativo: "1:1",
    tresPalavras: params.tresPalavras,
    coresPreferidas: params.coresPreferidas,
    coresEvitar: params.coresEvitar,
    simbolo: params.simbolo,
  };

  const [resClassicoList, resModernoList] = await Promise.all([
    provider.gerar(promptClassico.promptFinal, "logotipo-classico", 1, {
      ...ctxBase,
      estilo: "classico",
    }),
    provider.gerar(promptModerno.promptFinal, "logotipo-moderno", 1, {
      ...ctxBase,
      estilo: "moderno",
    }),
  ]);

  const imgClassica = resClassicoList[0];
  const imgModerna = resModernoList[0];

  const orcamentoDepois = verificarERegistarCusto({
    sessaoId: params.sessaoId,
    tipo: "gerar",
    quantidade: 2,
    limiteEur: params.limiteOverrideEur,
    contarRonda: true,
    detalhe: `Ronda ${ronda} (${tomSpec.nome}): Clássica + Moderna`,
  });

  const palettes = getDistinctPalettesForRound(ronda, tom, sector);
  const fontClassica = resolverParTipograficoMarca({
    tom,
    sector,
    estiloDirecao: "classico",
  });
  const rawFontModerna = resolverParTipograficoMarca({
    tom,
    sector,
    estiloDirecao: "moderno",
  });
  const fontModerna =
    rawFontModerna === fontClassica
      ? resolveContrastingSecondaryFontPair(fontClassica, tom)
      : rawFontModerna;

  const propostaClassica: LogoPropostaIA = {
    id: `ia-classica-r${ronda}`,
    estilo: "classico",
    tom,
    titulo: "Proposta A — Clássica com símbolo",
    subtitulo: `Tom ${tomSpec.nome}: composição estruturada (${FONT_PAIRS[fontClassica].nome})`,
    racional: `Composição com símbolo equilibrado para o setor de ${sectorLabel} (${tomSpec.resumo.toLowerCase()}) e ótimo contraste para avatares a 40 px.`,
    ronda,
    origem: imgClassica.origem,
    fixtureNome: imgClassica.fixtureNome,
    promptUsado: promptClassico.promptFinal,
    permiteTextoNoLogotipo: promptClassico.permiteTextoNoLogotipo,
    imagemBase64: `data:${imgClassica.mimeType};base64,${imgClassica.buffer.toString("base64")}`,
    width: imgClassica.width,
    height: imgClassica.height,
    sugestaoPaleta: palettes.classica,
    sugestaoFontPairId: fontClassica,
  };

  const propostaModerna: LogoPropostaIA = {
    id: `ia-moderna-r${ronda}`,
    estilo: "moderno",
    tom,
    titulo: "Proposta B — Moderna em bloco e contraste",
    subtitulo: `Tom ${tomSpec.nome}: emblema contemporâneo forte (${FONT_PAIRS[fontModerna].nome})`,
    racional: `Direção contemporânea contrastante para o setor de ${sectorLabel}, pensada para desdobrar capas e publicações modernas em camadas.`,
    ronda,
    origem: imgModerna.origem,
    fixtureNome: imgModerna.fixtureNome,
    promptUsado: promptModerno.promptFinal,
    permiteTextoNoLogotipo: promptModerno.permiteTextoNoLogotipo,
    imagemBase64: `data:${imgModerna.mimeType};base64,${imgModerna.buffer.toString("base64")}`,
    width: imgModerna.width,
    height: imgModerna.height,
    sugestaoPaleta: palettes.moderna,
    sugestaoFontPairId: fontModerna,
  };

  return {
    propostas: [propostaClassica, propostaModerna],
    orcamento: orcamentoDepois,
    config: getPublicImagemConfig(),
  };
}

export async function ajustarPropostaLogotipo(params: {
  sessaoId: string;
  nome: string;
  sector?: SectorId;
  tom?: TomDaMarca;
  proposta: LogoPropostaIA;
  instrucao: string;
  ajusteNumero: number;
  limiteOverrideEur?: number;
}): Promise<{
  propostaAjustada: LogoPropostaIA;
  orcamento: OrcamentoKitEstado;
  config: PublicImagemConfig;
}> {
  const cfg = getImagemConfig();
  const instrucaoLimpa = (params.instrucao || "").trim();
  if (!instrucaoLimpa) {
    throw new ImagemProviderError(
      "invalid_input",
      "Escreva uma instrução de ajuste clara (ex.: «aumentar contraste e espessura do emblema»)."
    );
  }

  const ajusteNumero = Number(params.ajusteNumero || 1);
  if (!Number.isInteger(ajusteNumero) || ajusteNumero < 1 || ajusteNumero > cfg.maxAjustes) {
    throw new ImagemProviderError(
      "max_adjustments",
      `Limite de ${cfg.maxAjustes} ajustes atingido. Clique em «Escolher» para avançar com o logótipo.`
    );
  }

  const tom = resolveTom(params.tom || params.proposta.tom);
  const promptAjuste = carregarPrompt("ajuste-logotipo", {
    nome: params.nome,
    instrucao: instrucaoLimpa,
  });

  const orcamentoAtual = lerOrcamentoKit(params.sessaoId, params.limiteOverrideEur);
  if (
    orcamentoAtual.gastoEur + CUSTO_UNITARIO_EUR.editar >
    orcamentoAtual.limiteEur + 0.0001
  ) {
    throw new ImagemProviderError(
      "budget_exceeded",
      `Limite de orçamento atingido (${orcamentoAtual.gastoEur.toFixed(2).replace(".", ",")} € / ${orcamentoAtual.limiteEur.toFixed(2).replace(".", ",")} €). Já não é possível executar novos ajustes neste kit.`
    );
  }

  const provider = getImagemProvider();
  const inputBuf = decodeBase64ImageInput(params.proposta.imagemBase64);
  const edited = await provider.editar(inputBuf, instrucaoLimpa, {
    nome: params.nome,
    sector: params.sector || "restauracao",
    tom,
    estilo: params.proposta.estilo,
  });

  const orcamentoDepois = verificarERegistarCusto({
    sessaoId: params.sessaoId,
    tipo: "editar",
    quantidade: 1,
    limiteEur: params.limiteOverrideEur,
    contarAjuste: true,
    detalhe: `Ajuste ${ajusteNumero}: ${instrucaoLimpa.slice(0, 60)}`,
  });

  const propostaAjustada: LogoPropostaIA = {
    ...params.proposta,
    tom,
    id: `${params.proposta.id}-aj${ajusteNumero}`,
    subtitulo: `Versão afinada (Ajuste ${ajusteNumero}/${cfg.maxAjustes})`,
    racional: `Aplicado pedido de ajuste: «${instrucaoLimpa}». Pronta a servir de referência para todo o kit.`,
    ajusteNumero,
    origem: edited.origem,
    fixtureNome: edited.fixtureNome,
    promptUsado: promptAjuste.promptFinal,
    imagemBase64: `data:${edited.mimeType};base64,${edited.buffer.toString("base64")}`,
    width: edited.width,
    height: edited.height,
  };

  return {
    propostaAjustada,
    orcamento: orcamentoDepois,
    config: getPublicImagemConfig(),
  };
}

/**
 * Extrai estritamente os textos realmente fornecidos pelo cliente para esta peça visual,
 * garantindo que nenhum dado fictício é inventado e devolvendo a lista exata para o ecrã
 * de verificação «Verifique os textos».
 */
export function buildTextosPedidosParaPeca(
  dados: BrandData,
  redeId: RedeSocialId
): string[] {
  const cfg = getRedeSocialConfig(redeId);
  return resolverHierarquiaInformacaoConfig(dados, cfg).textosOrdenados;
}

const brandPieceCache = new Map<string, PecaGeradaIA>();
const MAX_PIECE_CACHE = 160;

function setBrandPieceCache(key: string, val: PecaGeradaIA) {
  if (brandPieceCache.size >= MAX_PIECE_CACHE) {
    const firstKey = brandPieceCache.keys().next().value;
    if (firstKey) brandPieceCache.delete(firstKey);
  }
  brandPieceCache.set(key, val);
}

function digestBufferShort(buf?: Buffer): string {
  if (!buf || buf.length === 0) return "sem-ref";
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 14);
}

/**
 * Pipeline único puro de geração por imagem para as 18 peças sociais:
 * 1. Exige o logótipo escolhido como referência obrigatória (`logotipoReferencia`).
 * 2. Constrói o prompt a partir do tom da marca + sector + proporção nativa + disposição por proporção + zona segura + hierarquia de textos reais.
 * 3. Pede ao fornecedor (`provider.gerar`), corta/redimensiona às dimensões exactas e valida as zonas seguras.
 * 4. Guarda `textosPedidos`, aviso «Verifique os textos» e resultado de auditoria (`precisaRegeneracao`).
 */
export async function gerarPecaRedeSocialComAuditoria(params: {
  redeId: RedeSocialId;
  estiloVisual: "moderno" | "classico";
  dados: BrandData;
  paleta: BrandPalette;
  logotipoReferencia: Buffer;
  logotipoDna?: LogoVisualDna;
  fontPairId?: import("../formats").FontPairId;
  estiloPeca?: StyleId;
  sessaoId?: string;
  bypassCache?: boolean;
}): Promise<PecaGeradaIA> {
  if (!params.logotipoReferencia || params.logotipoReferencia.length === 0) {
    throw new ImagemProviderError(
      "invalid_input",
      "O logótipo escolhido é obrigatório como imagem de referência em todas as peças do kit."
    );
  }

  const rede = getRedeSocialConfig(params.redeId);
  const tom = resolveTom(params.dados.tom || params.logotipoDna?.tom);
  const tomSpec = TOM_DA_MARCA_SPECS[tom];
  const sector: SectorId =
    params.dados.sector && params.dados.sector in SECTORS
      ? params.dados.sector
      : "restauracao";
  const sectorLabel = SECTORS[sector].rotulo;
  const resolvedFontPairId =
    params.fontPairId ||
    resolverParTipograficoMarca({
      tom,
      sector,
      estiloDirecao: params.estiloVisual,
    });

  const dna =
    params.logotipoDna ||
    buildLogoVisualDna({
      nome: params.dados.nome,
      sector,
      tom,
      paleta: params.paleta,
      estiloDirecao: params.estiloVisual,
    });

  const textosPedidos = buildTextosPedidosParaPeca(params.dados, params.redeId);

  const cacheKey = [
    "comp-v3",
    params.redeId,
    rede.composicao.disposicao,
    params.estiloVisual,
    tom,
    sector,
    resolvedFontPairId,
    params.dados.simbolo ? "1" : "0",
    (params.dados.nome || "").trim().toLowerCase(),
    textosPedidos.join("|"),
    params.paleta.primaria.hex,
    params.paleta.secundaria.hex,
    digestBufferShort(params.logotipoReferencia),
  ].join("::");

  if (!params.bypassCache) {
    const cached = brandPieceCache.get(cacheKey);
    if (cached) return cached;
  }

  const layoutNome =
    params.estiloVisual === "moderno" ? "Moderna em camadas" : "Clássica editorial";
  const direcaoVisual =
    params.estiloVisual === "moderno"
      ? "composição moderna em camadas de alto contraste com painel limpo para o emblema e área fotográfica/arquitetónica em arco ligada ao sector"
      : "composição clássica em pergaminho ou papel claro com emblema centrado, filetes finos elegantes e leitura harmónica";

  const textosResumoPrompt =
    textosPedidos.length > 0
      ? textosPedidos.map((t) => `«${t}»`).join(" • ")
      : "Sem texto adicional (apenas emblema centrado)";

  let formatoProvider: ImagemFormato = "rede-capa";
  let promptLoaded;

  if (rede.tipoPeca === "perfil") {
    formatoProvider = "rede-avatar";
    promptLoaded = carregarPrompt("foto-perfil", {
      nome: params.dados.nome,
      sector: sectorLabel,
      tom: tomSpec.nome,
      tomDescricao: tomSpec.direcaoEstetica,
      plataforma: rede.plataforma,
      aspectRatio: rede.aspectRatioGemini,
      formasDoLogotipo: dna.formasPrincipais,
      paleta: dna.paletaDescricao,
    });
  } else if (rede.id === "ig-story") {
    formatoProvider = "story-instagram";
    promptLoaded = carregarPrompt("story-instagram", {
      nome: params.dados.nome,
      sector: sectorLabel,
      tom: tomSpec.nome,
      tomDescricao: tomSpec.direcaoEstetica,
      aspectRatio: rede.aspectRatioGemini,
      layoutNome,
      disposicaoLayout: rede.composicao.disposicaoRotulo,
      regraComposicao: rede.composicao.regraComposicaoPrompt,
      estiloPeca: direcaoVisual,
      formasDoLogotipo: dna.formasPrincipais,
      estiloDoLogotipo: dna.estiloEstetico,
      paleta: dna.paletaDescricao,
      zonaSegura: rede.instrucaoZonaSeguraPrompt,
      textosPedidos: textosResumoPrompt,
    });
  } else if (rede.id === "ig-publicacao" || rede.id === "ig-publicacao-1080x1350") {
    formatoProvider =
      rede.id === "ig-publicacao-1080x1350"
        ? "publicacao-instagram-4x5"
        : "publicacao-instagram";
    promptLoaded = carregarPrompt("publicacao-instagram", {
      nome: params.dados.nome,
      sector: sectorLabel,
      tom: tomSpec.nome,
      tomDescricao: tomSpec.direcaoEstetica,
      aspectRatio: rede.aspectRatioGemini,
      layoutNome,
      disposicaoLayout: rede.composicao.disposicaoRotulo,
      regraComposicao: rede.composicao.regraComposicaoPrompt,
      estiloPeca: direcaoVisual,
      formasDoLogotipo: dna.formasPrincipais,
      estiloDoLogotipo: dna.estiloEstetico,
      paleta: dna.paletaDescricao,
      zonaSegura: rede.instrucaoZonaSeguraPrompt,
      textosPedidos: textosResumoPrompt,
    });
  } else {
    formatoProvider = "rede-capa";
    promptLoaded = carregarPrompt("capa-fundo", {
      nome: params.dados.nome,
      sector: sectorLabel,
      tom: tomSpec.nome,
      tomDescricao: tomSpec.direcaoEstetica,
      plataforma: rede.nome,
      aspectRatio: rede.aspectRatioGemini,
      layoutNome,
      disposicaoLayout: rede.composicao.disposicaoRotulo,
      regraComposicao: rede.composicao.regraComposicaoPrompt,
      layoutDirecaoVisual: direcaoVisual,
      formasDoLogotipo: dna.formasPrincipais,
      estiloDoLogotipo: dna.estiloEstetico,
      paleta: dna.paletaDescricao,
      zonaSegura: rede.instrucaoZonaSeguraPrompt,
      textosPedidos: textosResumoPrompt,
    });
  }

  const cfg = getImagemConfig();
  if (cfg.modo === "real" && params.sessaoId) {
    verificarERegistarCusto({
      sessaoId: params.sessaoId,
      tipo: "gerar",
      quantidade: 1,
      detalhe: `Peça ${rede.id} (${params.estiloVisual}) com referência`,
    });
  }

  const provider = getImagemProvider();
  const resList = await provider.gerar(promptLoaded.promptFinal, formatoProvider, 1, {
    nome: params.dados.nome,
    slogan: params.dados.slogan,
    sector,
    tom,
    fontPairId: resolvedFontPairId,
    simbolo: params.dados.simbolo,
    estiloVisual: params.estiloVisual,
    estilo: params.estiloVisual === "moderno" ? "moderno" : "classico",
    paleta: params.paleta,
    logotipoReferencia: params.logotipoReferencia,
    logotipoReferenciaMime: "image/png",
    logotipoDna: dna,
    redeId: params.redeId,
    aspectRatioNativo: rede.aspectRatioGemini,
    textosPedidos,
    larguraAlvo: rede.widthPx,
    alturaAlvo: rede.heightPx,
  });

  const first = resList[0];
  const croppedBuf = await cropResizeToRedeSpec(first.buffer, rede);
  const audit: SafeZoneAuditResult = await validarZonaSegura(croppedBuf, rede);

  const peca: PecaGeradaIA = {
    redeId: rede.id,
    estiloVisual: params.estiloVisual,
    tituloProposta:
      params.estiloVisual === "moderno"
        ? "Proposta 1 — Moderna em camadas"
        : "Proposta 2 — Clássica editorial",
    buffer: croppedBuf,
    width: rede.widthPx,
    height: rede.heightPx,
    mimeType: "image/png",
    origem: first.origem,
    fixtureNome: first.fixtureNome,
    promptUsado: promptLoaded.promptFinal,
    aspectRatioGemini: rede.aspectRatioGemini,
    referenciaLogoUsada: true,
    textosPedidos,
    avisoTextos: AVISO_VERIFIQUE_TEXTOS_PT,
    audit,
  };

  setBrandPieceCache(cacheKey, peca);
  return peca;
}

/**
 * Gera sempre 2 propostas distintas a partir do logótipo escolhido como referência:
 * - Proposta 1: Moderna em camadas
 * - Proposta 2: Clássica editorial
 */
export async function gerarDuasPropostasVisualMarca(params: {
  redeId: RedeSocialId;
  dados: BrandData;
  paleta: BrandPalette;
  logotipoReferencia: Buffer;
  logotipoDna?: LogoVisualDna;
  fontPairId?: import("../formats").FontPairId;
  sessaoId?: string;
  bypassCache?: boolean;
}): Promise<[PecaGeradaIA, PecaGeradaIA]> {
  const [moderna, classica] = await Promise.all([
    gerarPecaRedeSocialComAuditoria({
      redeId: params.redeId,
      estiloVisual: "moderno",
      dados: params.dados,
      paleta: params.paleta,
      logotipoReferencia: params.logotipoReferencia,
      logotipoDna: params.logotipoDna,
      fontPairId: params.fontPairId,
      sessaoId: params.sessaoId,
      bypassCache: params.bypassCache,
    }),
    gerarPecaRedeSocialComAuditoria({
      redeId: params.redeId,
      estiloVisual: "classico",
      dados: params.dados,
      paleta: params.paleta,
      logotipoReferencia: params.logotipoReferencia,
      logotipoDna: params.logotipoDna,
      fontPairId: params.fontPairId,
      sessaoId: params.sessaoId,
      bypassCache: params.bypassCache,
    }),
  ]);

  return [moderna, classica];
}

export { listarPromptsDisponiveis, lerOrcamentoKit, limparOrcamentoKit };
