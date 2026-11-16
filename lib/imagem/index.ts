import crypto from "crypto";
import type { CoverLayoutSpec } from "../capas/catalog";
import {
  BrandPalette,
  FontPairId,
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
import { GeminiImagemProvider } from "./gemini";
import { carregarPrompt, listarPromptsDisponiveis } from "./prompts";
import { RecraftImagemProvider } from "./recraft";
import { buildLogoVisualDna } from "./referencia";
import {
  ImagemConfig,
  ImagemContexto,
  ImagemFornecedor,
  ImagemModo,
  ImagemProvider,
  ImagemProviderError,
  ImagemResultado,
  LogoVisualDna,
} from "./types";

export * from "./types";
export * from "./custo";
export * from "./prompts";
export * from "./referencia";
export { FalsoImagemProvider } from "./falso";
export { GeminiImagemProvider } from "./gemini";
export { RecraftImagemProvider } from "./recraft";

export interface PublicImagemConfig {
  modo: ImagemModo;
  fornecedor: ImagemFornecedor | "local";
  limitePorKitEur: number;
  maxRondas: number;
  maxAjustes: number;
  semCustosReais: boolean;
  etiquetaModo: string;
}

export interface LogoPropostaIA {
  id: string;
  estilo: "classico" | "moderno";
  titulo: string;
  subtitulo: string;
  racional: string;
  ronda: number;
  ajusteNumero?: number;
  origem: ImagemResultado["origem"];
  fixtureNome?: string;
  promptUsado: string;
  permiteTextoNoLogotipo: "apenas_nome_ou_sem_texto" | "sem_texto_nenhum";
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
    modelo: (process.env.IMAGEM_MODELO || "").trim(),
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
    limitePorKitEur: cfg.limitePorKitEur,
    maxRondas: cfg.maxRondas,
    maxAjustes: cfg.maxAjustes,
    semCustosReais: cfg.modo === "falso",
    etiquetaModo:
      cfg.modo === "falso"
        ? "Modo de demonstração sem custos (amostras locais)"
        : `Fornecedor configurado (${cfg.fornecedor || "por definir"})`,
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

function getDistinctPalettesForRound(ronda: number): {
  classica: BrandPalette;
  moderna: BrandPalette;
} {
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
      primaria: "#172E2C",
      secundaria: "#D9822B",
      papel: "#F5F3EE",
      tinta: "#132321",
    }),
  };
}

export async function gerarPropostasLogotipoRonda(params: {
  sessaoId: string;
  nome: string;
  slogan?: string;
  sector?: SectorId;
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
    coresPreferidas: params.coresPreferidas || "Terracota, ocre e creme",
    tresPalavras: params.tresPalavras || "Tradição, Ofício, Autenticidade",
    coresEvitar: params.coresEvitar || "Néons frios e efeitos 3D",
  });

  const promptModerno = carregarPrompt("logotipo-moderno", {
    nome: params.nome,
    sector: sectorLabel,
    coresPreferidas: params.coresPreferidas || "Verde pinheiro escuro, dourado e creme",
    tresPalavras: params.tresPalavras || "Geometria, Clareza, Rigor",
    coresEvitar: params.coresEvitar || "Clichés complexos e gradientes fotorealistas",
  });

  const provider = getImagemProvider();
  const ctxBase: ImagemContexto = {
    nome: params.nome,
    slogan: params.slogan,
    sector,
    ronda,
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
    detalhe: `Ronda ${ronda}: Clássica com símbolo + Moderna tipográfica`,
  });

  const palettes = getDistinctPalettesForRound(ronda);

  const propostaClassica: LogoPropostaIA = {
    id: `ia-classica-r${ronda}`,
    estilo: "classico",
    titulo: "Proposta A — Clássica com símbolo",
    subtitulo:
      ronda === 1
        ? "Emblema tradicional com símbolo e tipografia serifada"
        : ronda === 2
        ? "Selo clássico em traço gravado com composição compacta"
        : "Heráldica minimalista de ofício com leitura a 32 px",
    racional:
      "Composição com símbolo figurativo equilibrado, borda limpa sem texturas artificiais e contraste pensado para carimbo, fachada e redes.",
    ronda,
    origem: imgClassica.origem,
    fixtureNome: imgClassica.fixtureNome,
    promptUsado: promptClassico.promptFinal,
    permiteTextoNoLogotipo: promptClassico.permiteTextoNoLogotipo,
    imagemBase64: `data:${imgClassica.mimeType};base64,${imgClassica.buffer.toString("base64")}`,
    width: imgClassica.width,
    height: imgClassica.height,
    sugestaoPaleta: palettes.classica,
    sugestaoFontPairId: "clara",
  };

  const propostaModerna: LogoPropostaIA = {
    id: `ia-moderna-r${ronda}`,
    estilo: "moderno",
    titulo: "Proposta B — Moderna tipográfica",
    subtitulo:
      ronda === 1
        ? "Monograma geométrico forte e tipo sem serifa contemporâneo"
        : ronda === 2
        ? "Marca horizontal limpa com barra de proporção e letra marcante"
        : "Símbolo minimalista em linhas puras com tipografia contrastada",
    racional:
      "Direção geométrica claramente distinta da clássica: paleta própria fria/quente, ausência de ornamentos e excelente comportamento em favicon.",
    ronda,
    origem: imgModerna.origem,
    fixtureNome: imgModerna.fixtureNome,
    promptUsado: promptModerno.promptFinal,
    permiteTextoNoLogotipo: promptModerno.permiteTextoNoLogotipo,
    imagemBase64: `data:${imgModerna.mimeType};base64,${imgModerna.buffer.toString("base64")}`,
    width: imgModerna.width,
    height: imgModerna.height,
    sugestaoPaleta: palettes.moderna,
    sugestaoFontPairId: "moderna",
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
      "Escreva uma instrução de ajuste clara (ex.: «aumentar contraste e espessura do arco»)."
    );
  }

  const ajusteNumero = Number(params.ajusteNumero || 1);
  if (!Number.isInteger(ajusteNumero) || ajusteNumero < 1 || ajusteNumero > cfg.maxAjustes) {
    throw new ImagemProviderError(
      "max_adjustments",
      `Limite de ${cfg.maxAjustes} ajustes atingido. Clique em «Escolher» para avançar para a vetorização.`
    );
  }

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
    id: `${params.proposta.id}-aj${ajusteNumero}`,
    subtitulo: `Versão afinada (Ajuste ${ajusteNumero}/${cfg.maxAjustes})`,
    racional: `Aplicado pedido do cliente: «${instrucaoLimpa}». Pronto para vetorização local gratuita.`,
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

export interface ArteDaMarcaResult {
  buffer: Buffer;
  width: number;
  height: number;
  promptUsado: string;
  permiteTextoNoLogotipo: "apenas_nome_ou_sem_texto" | "sem_texto_nenhum";
  origem: ImagemResultado["origem"];
  fixtureNome?: string;
  dna: LogoVisualDna;
  referenciaLogoUsada: boolean;
}

const COVER_DIRECTION_MAP: Record<
  CoverLayoutSpec["id"],
  { direcaoVisual: string; zonaSegura: string }
> = {
  "moderno-texto-atras": {
    direcaoVisual:
      "fundo escuro rico e profundo da paleta com brilho quente à direita a envolver os motivos do logótipo (arco, espiga ou monograma geométrico), sem qualquer texto na imagem",
    zonaSegura:
      "toda a metade esquerda superior e centro-esquerdo serenos e escuros para sobrepor o logótipo claro e as linhas de contacto; área central horizontal segura no YouTube 1544x423",
  },
  "moderno-recorte": {
    direcaoVisual:
      "metade esquerda ampla em papel claro texturado com micro-padrão discreto, recortada à direita por um arco curvo envolvente com luz e motivos prolongados do logótipo",
    zonaSegura:
      "todo o lado esquerdo até 60% da largura mantido claro, calmo e uniforme para encaixar o logótipo a cores e os dados reais",
  },
  "moderno-monolito": {
    direcaoVisual:
      "superfície escura texturada com grelha geométrica subtil e plano circular ou monólito de grande escala à direita em tonalidade quente/dourada inspirada no logótipo",
    zonaSegura:
      "terço esquerdo limpo para o logótipo em negativo e faixa média-direita suave para leitura dos contactos sem sobrecarga",
  },
  "classico-moldura": {
    direcaoVisual:
      "papel algodão claro texturado com malha clássica delicada e dois motivos arquitetónicos simétricos do logótipo discretos nas margens laterais",
    zonaSegura:
      "centro horizontal amplamente desobstruído e claro para compor o logótipo ao alto e a faixa de texto centrada",
  },
  "classico-rotulo": {
    direcaoVisual:
      "base de papel artesanal quente com padrão em linha fina prolongando as curvas do logótipo e motivo ilustrativo rico ancorado no canto inferior direito",
    zonaSegura:
      "zona esquerda e centro limpas para o selo/rótulo de leitura e logótipo sem tapar elementos do fundo",
  },
  "classico-informativo": {
    direcaoVisual:
      "composição editorial limpa em papel claro com cantos e filete lateral inspirados no símbolo do logótipo, deixando áreas estruturadas muito legíveis",
    zonaSegura:
      "esquerda para logótipo e direita para bloco informativo de serviços, localidade e contactos com contraste alto",
  },
};

const STYLE_DESC_MAP: Record<StyleId, string> = {
  liso: "composição limpa, elegante e direta sobre cor dominante da marca",
  degrade: "transição suave e luminosa entre as cores principais da marca",
  padrao: "repetição rítmica discreta nascida do símbolo do logótipo",
  informativo: "enquadramento claro e organizado para destacar oferta e contactos",
  fotografia: "cena de ambiente editorial real alinhada com o ofício e os tons da marca",
  minimal: "espaço respirado amplo com acentos puristas derivados do traço do logótipo",
};

const brandArtworkCache = new Map<string, ArteDaMarcaResult>();
const MAX_ARTWORK_CACHE = 96;

function setBrandArtworkCache(key: string, val: ArteDaMarcaResult) {
  if (brandArtworkCache.size >= MAX_ARTWORK_CACHE) {
    const firstKey = brandArtworkCache.keys().next().value;
    if (firstKey) brandArtworkCache.delete(firstKey);
  }
  brandArtworkCache.set(key, val);
}

function digestBufferShort(buf?: Buffer): string {
  if (!buf || buf.length === 0) return "sem-ref";
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 14);
}

/**
 * Gera (ou obtém de amostra coesa em modo falso) a arte de capa nascida do logótipo escolhido.
 * Passa sempre logotipoReferencia, formas, estilo e paleta para que cada capa pareça da mesma marca.
 */
export async function gerarArteCapaDaMarca(params: {
  layout: CoverLayoutSpec;
  nome: string;
  sector?: SectorId;
  paleta: BrandPalette;
  estiloPeca?: StyleId;
  logotipoReferencia?: Buffer;
  logotipoDna?: LogoVisualDna;
  sessaoId?: string;
}): Promise<ArteDaMarcaResult> {
  const dna =
    params.logotipoDna ||
    buildLogoVisualDna({
      nome: params.nome,
      sector: params.sector,
      paleta: params.paleta,
    });

  const sector: SectorId =
    params.sector && params.sector in SECTORS ? params.sector : "restauracao";
  const sectorLabel = SECTORS[sector].rotulo;
  const layoutDir =
    COVER_DIRECTION_MAP[params.layout.id] || COVER_DIRECTION_MAP["moderno-texto-atras"];

  const cacheKey = [
    "capa",
    params.layout.id,
    params.nome.trim().toLowerCase(),
    sector,
    dna.estiloDirecao,
    dna.fixtureLogoOrigem || "custom",
    params.paleta.primaria.hex,
    params.paleta.secundaria.hex,
    params.paleta.papel.hex,
    params.paleta.tinta.hex,
    params.estiloPeca || params.layout.estiloSugerido,
    digestBufferShort(params.logotipoReferencia),
  ].join("|");

  const cached = brandArtworkCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promptLoaded = carregarPrompt("capa-fundo", {
    nome: params.nome,
    sector: sectorLabel,
    formasDoLogotipo: dna.formasPrincipais,
    estiloDoLogotipo: dna.estiloEstetico,
    paleta: `${dna.paletaDescricao} (motivos: ${dna.motivosGraficos.slice(0, 4).join(", ")})`,
    layoutNome: `${params.layout.nome} (${params.layout.categoria})`,
    layoutDirecaoVisual: layoutDir.direcaoVisual,
    zonaSegura: layoutDir.zonaSegura,
  });

  const cfg = getImagemConfig();
  if (cfg.modo === "real" && params.sessaoId) {
    verificarERegistarCusto({
      sessaoId: params.sessaoId,
      tipo: "gerar",
      quantidade: 1,
      detalhe: `Arte de capa nascida do logótipo (${params.layout.id})`,
    });
  }

  const provider = getImagemProvider();
  const resList = await provider.gerar(promptLoaded.promptFinal, "capa-fundo", 1, {
    nome: params.nome,
    sector,
    estilo: dna.estiloDirecao,
    paleta: params.paleta,
    logotipoReferencia: params.logotipoReferencia,
    logotipoReferenciaMime: params.logotipoReferencia ? "image/png" : undefined,
    logotipoDna: dna,
    layoutId: params.layout.id,
    estiloPeca: params.estiloPeca || params.layout.estiloSugerido,
  });

  const first = resList[0];
  const out: ArteDaMarcaResult = {
    buffer: first.buffer,
    width: first.width,
    height: first.height,
    promptUsado: promptLoaded.promptFinal,
    permiteTextoNoLogotipo: promptLoaded.permiteTextoNoLogotipo,
    origem: first.origem,
    fixtureNome: first.fixtureNome,
    dna,
    referenciaLogoUsada: Boolean(
      params.logotipoReferencia && params.logotipoReferencia.length > 0
    ),
  };

  setBrandArtworkCache(cacheKey, out);
  return out;
}

/**
 * Gera (ou obtém de amostra coesa em modo falso) a arte de publicação ou story de Instagram
 * nascida diretamente do logótipo escolhido, da sua paleta, formas e estilo visual.
 */
export async function gerarArtePublicacaoDaMarca(params: {
  tipo: "publicacao-instagram" | "story-instagram";
  nome: string;
  sector?: SectorId;
  paleta: BrandPalette;
  estiloPeca: StyleId;
  logotipoReferencia?: Buffer;
  logotipoDna?: LogoVisualDna;
  sessaoId?: string;
}): Promise<ArteDaMarcaResult> {
  const dna =
    params.logotipoDna ||
    buildLogoVisualDna({
      nome: params.nome,
      sector: params.sector,
      paleta: params.paleta,
    });

  const sector: SectorId =
    params.sector && params.sector in SECTORS ? params.sector : "restauracao";
  const sectorLabel = SECTORS[sector].rotulo;
  const isStory = params.tipo === "story-instagram";

  const cacheKey = [
    params.tipo,
    params.nome.trim().toLowerCase(),
    sector,
    dna.estiloDirecao,
    dna.fixtureLogoOrigem || "custom",
    params.paleta.primaria.hex,
    params.paleta.secundaria.hex,
    params.paleta.papel.hex,
    params.paleta.tinta.hex,
    params.estiloPeca,
    digestBufferShort(params.logotipoReferencia),
  ].join("|");

  const cached = brandArtworkCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promptLoaded = carregarPrompt(params.tipo, {
    nome: params.nome,
    sector: sectorLabel,
    formasDoLogotipo: dna.formasPrincipais,
    estiloDoLogotipo: dna.estiloEstetico,
    paleta: dna.paletaDescricao,
    estiloPeca: `${params.estiloPeca} — ${STYLE_DESC_MAP[params.estiloPeca] || ""}`,
    zonaSegura: isStory
      ? "faixa central 1080x1300 livre entre os 300 px de topo e os 320 px de base"
      : "margem interior de 84 px com zona superior-central limpa para logótipo e título real",
  });

  const cfg = getImagemConfig();
  if (cfg.modo === "real" && params.sessaoId) {
    verificarERegistarCusto({
      sessaoId: params.sessaoId,
      tipo: "gerar",
      quantidade: 1,
      detalhe: `Arte ${params.tipo} nascida do logótipo`,
    });
  }

  const provider = getImagemProvider();
  const resList = await provider.gerar(promptLoaded.promptFinal, params.tipo, 1, {
    nome: params.nome,
    sector,
    estilo: dna.estiloDirecao,
    paleta: params.paleta,
    logotipoReferencia: params.logotipoReferencia,
    logotipoReferenciaMime: params.logotipoReferencia ? "image/png" : undefined,
    logotipoDna: dna,
    estiloPeca: params.estiloPeca,
    larguraAlvo: 1080,
    alturaAlvo: isStory ? 1920 : 1080,
  });

  const first = resList[0];
  const out: ArteDaMarcaResult = {
    buffer: first.buffer,
    width: first.width,
    height: first.height,
    promptUsado: promptLoaded.promptFinal,
    permiteTextoNoLogotipo: promptLoaded.permiteTextoNoLogotipo,
    origem: first.origem,
    fixtureNome: first.fixtureNome,
    dna,
    referenciaLogoUsada: Boolean(
      params.logotipoReferencia && params.logotipoReferencia.length > 0
    ),
  };

  setBrandArtworkCache(cacheKey, out);
  return out;
}

export { listarPromptsDisponiveis, lerOrcamentoKit, limparOrcamentoKit };

