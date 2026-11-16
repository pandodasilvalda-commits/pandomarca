/**
 * Configuração centralizada de redes sociais, proporções nativas para Gemini Nano Banana 2.1,
 * zonas seguras (computador e telemóvel) e definições de tom de marca do PandoMarca.
 *
 * Data de referência oficial das medidas: 15 de novembro de 2026.
 */

export const REFERENCE_DATE_REDES_PT = "15 de novembro de 2026";

export type TomDaMarca =
  | "tradicional"
  | "premium"
  | "jovem"
  | "tecnico"
  | "natural"
  | "divertido";

export interface TomDaMarcaSpec {
  id: TomDaMarca;
  nome: string;
  resumo: string;
  direcaoEstetica: string;
  tipografiaIndicacao: string;
  composicaoSugerida: string;
}

export const TOM_DA_MARCA_SPECS: Record<TomDaMarca, TomDaMarcaSpec> = {
  tradicional: {
    id: "tradicional",
    nome: "Tradicional",
    resumo: "Ofício português, herança sólida, confiança de décadas",
    direcaoEstetica:
      "Emblema estruturado e intemporal com traço equilibrado, molduras clássicas e inspiração no património de ofício.",
    tipografiaIndicacao: "Serifada editorial clássica com capitulares equilibradas",
    composicaoSugerida: "Simétrica e centrada ou escudo lateral clássico",
  },
  premium: {
    id: "premium",
    nome: "Premium",
    resumo: "Sofisticação discreta, acabamentos nobres e silêncio visual",
    direcaoEstetica:
      "Minimalismo de luxo com proporções áureas, espaços generosos, contraste refinado e selos de elegância serena.",
    tipografiaIndicacao: "Serifa de alto contraste ou sem-serifa esguia espaçada",
    composicaoSugerida: "Assimetria refinada com grandes margens respiratórias",
  },
  jovem: {
    id: "jovem",
    nome: "Jovem",
    resumo: "Energia urbana contemporânea, linhas ágeis e presença imediata",
    direcaoEstetica:
      "Geometria expressiva e dinâmica, formas modulares limpas e blocos cromáticos vivos com alto contraste.",
    tipografiaIndicacao: "Sem-serifa geométrica de peso forte e leitura instantânea",
    composicaoSugerida: "Blocos modulares modernos em camadas e diagonal leve",
  },
  tecnico: {
    id: "tecnico",
    nome: "Técnico",
    resumo: "Precisão, engenharia rigorosa, clareza estrutural",
    direcaoEstetica:
      "Grelha ortogonal exata, monogramas industriais ou signos de precisão com cantos bem resolvidos.",
    tipografiaIndicacao: "Sem-serifa humanista ou geométrica técnica tabular",
    composicaoSugerida: "Grelha estruturada limpa com eixos bem alinhados",
  },
  natural: {
    id: "natural",
    nome: "Natural",
    resumo: "Autenticidade orgânica, terra, sustentabilidade e proximidade",
    direcaoEstetica:
      "Traços orgânicos calmos, texturas táteis de papel ou pedra e símbolos inspirados na natureza e origem.",
    tipografiaIndicacao: "Humanista suave ou serifa orgânica acolhedora",
    composicaoSugerida: "Composição fluida em equilíbrio com luz natural",
  },
  divertido: {
    id: "divertido",
    nome: "Divertido",
    resumo: "Simpatia espontânea, personalidade calorosa e proximidade humana",
    direcaoEstetica:
      "Formas arredondadas amigáveis, ritmo rítmico e visual acolhedor de leitura rápida sem excesso de ruído.",
    tipografiaIndicacao: "Sem-serifa arredondada e expressiva com bom peso",
    composicaoSugerida: "Enquadramento aberto e expressivo sem sacrificar legibilidade",
  },
};

export const TONS_DA_MARCA_LIST: TomDaMarcaSpec[] = [
  TOM_DA_MARCA_SPECS.tradicional,
  TOM_DA_MARCA_SPECS.premium,
  TOM_DA_MARCA_SPECS.jovem,
  TOM_DA_MARCA_SPECS.tecnico,
  TOM_DA_MARCA_SPECS.natural,
  TOM_DA_MARCA_SPECS.divertido,
];

/** Proporções suportadas diretamente pelo endpoint de imagem Gemini Nano Banana 2.1 */
export type GeminiAspectRatio = "1:1" | "3:4" | "4:3" | "4:5" | "9:16" | "16:9" | "21:9";

export type RedeSocialPlataforma =
  | "Facebook"
  | "Instagram"
  | "LinkedIn"
  | "YouTube"
  | "X"
  | "Google Perfil de Empresa"
  | "WhatsApp Business"
  | "TikTok";

export type RedeSocialTipoPeca = "perfil" | "capa" | "publicacao" | "story";

export type LayoutDisposicaoId =
  | "emblema-circular"
  | "faixa-ultra-larga"
  | "horizontal-bipartida"
  | "imagem-destaque-min-texto"
  | "vertical-feed"
  | "vertical-story";

export type CampoInformacaoMarca = "logotipo" | "nome" | "slogan" | "contactos";

export const HIERARQUIA_INFORMACAO_PADRAO: readonly CampoInformacaoMarca[] = [
  "logotipo",
  "nome",
  "slogan",
  "contactos",
];

export interface ComposicaoFormatoConfig {
  disposicao: LayoutDisposicaoId;
  disposicaoRotulo: string;
  /** Ordem fixa ao cortar quando não cabe: 1.º logótipo, 2.º nome, 3.º slogan, 4.º contactos */
  hierarquiaInformacao: readonly CampoInformacaoMarca[];
  /** Elementos visuais/textuais efetivamente incluídos nesta proporção */
  elementosPermitidos: readonly CampoInformacaoMarca[];
  /** Comprimento máximo legível para o slogan antes de ser omitido (se permitido) */
  maxCharsSlogan?: number;
  /** Quantidade máxima de linhas de contacto antes de cortar por falta de espaço */
  maxLinhasContactos?: number;
  /** Permite também incluir serviços curtos quando houver área vertical ampla (ex.: Instagram 4:5) */
  incluirServicosSeCouber?: boolean;
  /** Regra das 3 camadas da peça */
  camadas: {
    fundo: string;
    informacao: string;
    uiPlataforma: string;
  };
  /** Verdadeiro quando texturas, padrões e fotografia de ambiente podem sangrar além da zona segura móvel */
  fundoPodeExtravasarMobile: boolean;
  /** Orientação explícita de composição para prompts e compositor raster */
  regraComposicaoPrompt: string;
}

export interface SafeZoneRect {
  x: number;
  y: number;
  width: number;
  height: number;
  nota?: string;
}

export type RedeSocialId =
  | "fb-perfil"
  | "fb-capa"
  | "ig-perfil"
  | "ig-publicacao-1080x1350"
  | "ig-publicacao"
  | "ig-story"
  | "li-perfil-pessoal"
  | "li-capa-pessoal"
  | "li-perfil-empresa"
  | "li-capa-empresa"
  | "yt-perfil"
  | "yt-banner"
  | "x-perfil"
  | "x-cabecalho"
  | "gb-logotipo"
  | "gb-capa"
  | "wa-perfil"
  | "tiktok-perfil";

export interface RedeSocialConfig {
  id: RedeSocialId;
  plataforma: RedeSocialPlataforma;
  tipoPeca: RedeSocialTipoPeca;
  nome: string;
  ficheiro: string;
  widthPx: number;
  heightPx: number;
  medidaLabel: string;
  /** Proporção alvo exata da peça (ex.: 4:5, 9:16, 16:9, 3:1, 4:1, 1:1) */
  proporcaoAlvo: string;
  /** Proporção nativa mais próxima aceite pelo Gemini Nano Banana 2.1 antes do corte exato */
  aspectRatioGemini: GeminiAspectRatio;
  /** true para avatares recortados em círculo pela plataforma */
  isCircle: boolean;
  /** true para avatares que exigem legibilidade a 40×40 px em círculo */
  test40px: boolean;
  /** Fundo obrigatoriamente opaco */
  opaque: boolean;
  /** Categoria de grupo de layout ("capas" | "publicacao" | "story") */
  styleGroup?: "capas" | "publicacao" | "story";
  /** Zona segura garantida no computador */
  safeZoneDesktop: SafeZoneRect;
  /** Zona segura garantida no telemóvel */
  safeZoneMobile: SafeZoneRect;
  /** Zona coberta pela foto de perfil no computador */
  avatarOverlapDesktop?: SafeZoneRect;
  /** Zona coberta pela foto de perfil / UI na vista móvel */
  avatarOverlapMobile?: SafeZoneRect;
  /** Margem superior reservada pela UI da plataforma (ex.: Story 250 px) */
  margemTopoPx?: number;
  /** Margem inferior reservada pela UI da plataforma (ex.: Story 250 px) */
  margemBasePx?: number;
  /** Regra centralizada de composição e hierarquia por formato */
  composicao: ComposicaoFormatoConfig;
  /** Instrução específica de enquadramento passada ao gerador de imagem */
  instrucaoZonaSeguraPrompt: string;
  displayDesktop?: string;
  displayMobile?: string;
  nota: string;
  fonteNome: string;
  fonteUrl: string;
}

function buildComposicaoPerfil(plataforma: string, detalheUi: string): ComposicaoFormatoConfig {
  return {
    disposicao: "emblema-circular",
    disposicaoRotulo: "Emblema centrado (círculo 40 px)",
    hierarquiaInformacao: HIERARQUIA_INFORMACAO_PADRAO,
    elementosPermitidos: ["logotipo"],
    camadas: {
      fundo: "Superfície sólida opaca de contraste limpo até às margens exteriores.",
      informacao: "1.º Logótipo/Emblema centrado (corta nome longo, slogan e contactos para ler bem a 40 px).",
      uiPlataforma: detalheUi,
    },
    fundoPodeExtravasarMobile: false,
    regraComposicaoPrompt: `Emblema isolado para ${plataforma} 1:1 centrado dentro do círculo seguro; cortar nome, slogan e contactos para garantir nitidez aos 40 px.`,
  };
}

export const REDES_SOCIAIS_CONFIG: Record<RedeSocialId, RedeSocialConfig> = {
  "fb-perfil": {
    id: "fb-perfil",
    plataforma: "Facebook",
    tipoPeca: "perfil",
    nome: "Facebook, foto de perfil",
    ficheiro: "facebook/foto-de-perfil.png",
    widthPx: 720,
    heightPx: 720,
    medidaLabel: "720×720 px",
    proporcaoAlvo: "1:1",
    aspectRatioGemini: "1:1",
    isCircle: true,
    test40px: true,
    opaque: true,
    displayDesktop: "176×176 px (círculo)",
    displayMobile: "196×196 px (círculo)",
    safeZoneDesktop: {
      x: 108,
      y: 108,
      width: 504,
      height: 504,
      nota: "Exibido em círculo a 176×176 px em computador.",
    },
    safeZoneMobile: {
      x: 108,
      y: 108,
      width: 504,
      height: 504,
      nota: "Exibido em círculo a 196×196 px em telemóvel.",
    },
    composicao: buildComposicaoPerfil(
      "Facebook",
      "Máscara circular de perfil (176 px desktop, 196 px telemóvel, 40 px comentários)."
    ),
    instrucaoZonaSeguraPrompt:
      "Avatar quadrado 1:1 com o emblema da marca centrado dentro de um círculo com pelo menos 18% de margem livre nos quatro cantos, legível quando reduzido a 40 px.",
    nota: "Gerado a 720×720 px a partir do emblema do logótipo para nitidez elevada; exibido em círculo (176×176 computador, 196×196 telemóvel).",
    fonteNome: "Facebook Help",
    fonteUrl: "https://www.facebook.com/help/125379114252045",
  },
  "fb-capa": {
    id: "fb-capa",
    plataforma: "Facebook",
    tipoPeca: "capa",
    nome: "Facebook, capa",
    ficheiro: "facebook/capa.png",
    widthPx: 1640,
    heightPx: 624,
    medidaLabel: "1640×624 px",
    proporcaoAlvo: "1640:624",
    aspectRatioGemini: "21:9",
    isCircle: false,
    test40px: false,
    opaque: true,
    styleGroup: "capas",
    safeZoneDesktop: {
      x: 260,
      y: 44,
      width: 1280,
      height: 500,
      nota: "Área visível em computador sem invadir a sobreposição inferior esquerda da foto de perfil.",
    },
    safeZoneMobile: {
      x: 280,
      y: 44,
      width: 1080,
      height: 536,
      nota: "Zona segura central visível no recorte de telemóvel (laterais de computador sangram para fora).",
    },
    avatarOverlapDesktop: {
      x: 40,
      y: 380,
      width: 280,
      height: 244,
      nota: "Zona inferior esquerda coberta pela foto de perfil no computador.",
    },
    avatarOverlapMobile: {
      x: 300,
      y: 420,
      width: 210,
      height: 204,
      nota: "Zona inferior esquerda da janela móvel próxima da foto de perfil.",
    },
    composicao: {
      disposicao: "horizontal-bipartida",
      disposicaoRotulo: "Horizontal bipartida (informação à esquerda + imagem à direita)",
      hierarquiaInformacao: HIERARQUIA_INFORMACAO_PADRAO,
      elementosPermitidos: ["logotipo", "nome", "slogan"],
      maxCharsSlogan: 56,
      maxLinhasContactos: 0,
      camadas: {
        fundo: "Fundo, texturas e fotografia editorial sangram do centro-direita até às bordas completas (1640×624).",
        informacao: "1.º Logótipo, 2.º Nome e 3.º Slogan concentrados na metade esquerda segura acima/à direita do avatar.",
        uiPlataforma: "Foto de perfil no canto inferior esquerdo (computador e telemóvel).",
      },
      fundoPodeExtravasarMobile: true,
      regraComposicaoPrompt:
        "Composição horizontal bipartida 1640×624: bloco com logótipo, nome e slogan na metade esquerda dentro da zona segura móvel (acima/à direita do canto inferior esquerdo da foto de perfil) e imagem/ambiente editorial rico do lado direito a sangrar até às bordas de computador (corta contactos longos).",
    },
    instrucaoZonaSeguraPrompt:
      "Banner horizontal panorâmico 1640×624 (composição bipartida). Colocar logótipo, nome e slogan no lado esquerdo-centro dentro da área segura 1080×536 e fotografia/ambiente no lado direito a sangrar até às bordas de computador, deixando o canto inferior esquerdo livre para o avatar.",
    nota: "Composição bipartida (1640×624 px): informação segura à esquerda, fotografia de ambiente a sangrar à direita e canto inferior esquerdo livre para a foto de perfil.",
    fonteNome: "Facebook Help",
    fonteUrl: "https://www.facebook.com/help/125379114252045",
  },
  "ig-perfil": {
    id: "ig-perfil",
    plataforma: "Instagram",
    tipoPeca: "perfil",
    nome: "Instagram, foto de perfil",
    ficheiro: "instagram/foto-de-perfil.png",
    widthPx: 320,
    heightPx: 320,
    medidaLabel: "320×320 px",
    proporcaoAlvo: "1:1",
    aspectRatioGemini: "1:1",
    isCircle: true,
    test40px: true,
    opaque: true,
    displayDesktop: "110×110 px (círculo)",
    displayMobile: "110×110 px (círculo)",
    safeZoneDesktop: { x: 48, y: 48, width: 224, height: 224 },
    safeZoneMobile: { x: 48, y: 48, width: 224, height: 224 },
    composicao: buildComposicaoPerfil(
      "Instagram",
      "Máscara circular de perfil (110 px e lista/comentários a 40 px)."
    ),
    instrucaoZonaSeguraPrompt:
      "Avatar circular 1:1 para Instagram: emblema centrado com margens limpas para não cortar nos cantos e legibilidade clara a 40 px.",
    nota: "Mínimo oficial preservado (320×320 px); composição centrada na máscara circular e testada a 40 px.",
    fonteNome: "Ajuda do Instagram",
    fonteUrl: "https://help.instagram.com/1631821640426723",
  },
  "ig-publicacao-1080x1350": {
    id: "ig-publicacao-1080x1350",
    plataforma: "Instagram",
    tipoPeca: "publicacao",
    nome: "Instagram, publicação vertical (4:5)",
    ficheiro: "instagram/publicacao-1080x1350.png",
    widthPx: 1080,
    heightPx: 1350,
    medidaLabel: "1080×1350 px",
    proporcaoAlvo: "4:5",
    aspectRatioGemini: "4:5",
    isCircle: false,
    test40px: false,
    opaque: true,
    styleGroup: "publicacao",
    safeZoneDesktop: {
      x: 96,
      y: 120,
      width: 888,
      height: 1110,
      nota: "Enquadramento vertical completo 4:5 no feed.",
    },
    safeZoneMobile: {
      x: 96,
      y: 150,
      width: 888,
      height: 1050,
      nota: "Área central segura compatível também com o recorte da grelha de perfil 3:4 / 1:1.",
    },
    composicao: {
      disposicao: "vertical-feed",
      disposicaoRotulo: "Vertical em camadas (4:5 com logótipo destacado)",
      hierarquiaInformacao: HIERARQUIA_INFORMACAO_PADRAO,
      elementosPermitidos: ["logotipo", "nome", "slogan", "contactos"],
      maxCharsSlogan: 72,
      maxLinhasContactos: 2,
      incluirServicosSeCouber: true,
      camadas: {
        fundo: "Fotografia de ambiente, texturas e moldura clássica sangram até às margens completas 1080×1350.",
        informacao: "Composição vertical com logótipo destacado + nome + slogan + contacto curto dentro de 888×1050.",
        uiPlataforma: "Compatibilidade vertical com o recorte 3:4/1:1 da grelha do perfil.",
      },
      fundoPodeExtravasarMobile: true,
      regraComposicaoPrompt:
        "Composição vertical 4:5 (1080×1350): imagem de ambiente no topo sangrando até às bordas completas e bloco destacado com logótipo principal grande, nome, slogan e website/contacto dentro da zona segura interior 888×1050.",
    },
    instrucaoZonaSeguraPrompt:
      "Publicação vertical 4:5 (1080×1350) para Instagram. Centrar o logótipo destacado e os textos reais dentro da área interior 888×1050 (funcionando no feed 4:5 e na grelha do perfil), deixando o fundo/fotografia sangrar até às bordas.",
    nota: "Formato vertical 4:5 para máximo alcance no feed com logótipo destacado, imagem a sangrar nas margens e informação dentro da zona compatível com a grelha.",
    fonteNome: "Ajuda do Instagram",
    fonteUrl: "https://help.instagram.com/1631821640426723",
  },
  "ig-publicacao": {
    id: "ig-publicacao",
    plataforma: "Instagram",
    tipoPeca: "publicacao",
    nome: "Instagram, publicação quadrada (1:1)",
    ficheiro: "instagram/publicacao-1080.png",
    widthPx: 1080,
    heightPx: 1080,
    medidaLabel: "1080×1080 px",
    proporcaoAlvo: "1:1",
    aspectRatioGemini: "1:1",
    isCircle: false,
    test40px: false,
    opaque: true,
    styleGroup: "publicacao",
    safeZoneDesktop: { x: 80, y: 80, width: 920, height: 920 },
    safeZoneMobile: { x: 96, y: 96, width: 888, height: 888 },
    composicao: {
      disposicao: "vertical-feed",
      disposicaoRotulo: "Vertical compacta (1:1 com logótipo destacado)",
      hierarquiaInformacao: HIERARQUIA_INFORMACAO_PADRAO,
      elementosPermitidos: ["logotipo", "nome", "slogan"],
      maxCharsSlogan: 58,
      maxLinhasContactos: 0,
      camadas: {
        fundo: "Fotografia de ambiente ou papel com ornamentos sangra até às bordas 1080×1080.",
        informacao: "1.º Logótipo destacado + 2.º Nome + 3.º Slogan dentro do quadrado seguro 888×888.",
        uiPlataforma: "Margem interior de 96 px livre de recorte nas bordas da grelha.",
      },
      fundoPodeExtravasarMobile: true,
      regraComposicaoPrompt:
        "Composição vertical equilibrada 1:1 (1080×1080): destaque para o logótipo acompanhado pelo nome e slogan na área segura 888×888; fundo/fotografia sangra até às margens exteriores.",
    },
    instrucaoZonaSeguraPrompt:
      "Publicação quadrada 1:1 (1080×1080) com logótipo destacado na zona interior 888×888 e margens exteriores apenas com fundo/fotografia.",
    nota: "Formato clássico quadrado 1:1 (1080×1080 px) com hierarquia focada em logótipo, nome e slogan.",
    fonteNome: "Ajuda do Instagram",
    fonteUrl: "https://help.instagram.com/1631821640426723",
  },
  "ig-story": {
    id: "ig-story",
    plataforma: "Instagram",
    tipoPeca: "story",
    nome: "Instagram, story (9:16)",
    ficheiro: "instagram/story-1080x1920.png",
    widthPx: 1080,
    heightPx: 1920,
    medidaLabel: "1080×1920 px",
    proporcaoAlvo: "9:16",
    aspectRatioGemini: "9:16",
    isCircle: false,
    test40px: false,
    opaque: true,
    styleGroup: "story",
    margemTopoPx: 250,
    margemBasePx: 250,
    safeZoneDesktop: {
      x: 80,
      y: 250,
      width: 920,
      height: 1420,
      nota: "Zona central entre 250 px do topo e 250 px da base.",
    },
    safeZoneMobile: {
      x: 90,
      y: 250,
      width: 900,
      height: 1420,
      nota: "Os 250 px superiores (barra/perfil) e 250 px inferiores (resposta/botões) ficam rigorosamente livres de logótipo e texto.",
    },
    composicao: {
      disposicao: "vertical-story",
      disposicaoRotulo: "Vertical Story 9:16 (250 px topo/base livres de texto)",
      hierarquiaInformacao: HIERARQUIA_INFORMACAO_PADRAO,
      elementosPermitidos: ["logotipo", "nome", "slogan", "contactos"],
      maxCharsSlogan: 72,
      maxLinhasContactos: 1,
      camadas: {
        fundo: "Fundo atmosférico contínuo ocupa os 1080×1920 incluindo faixas de topo e base para a UI.",
        informacao: "Composição vertical com fotografia de ambiente + logótipo destacado + nome + slogan dentro da janela 900×1420.",
        uiPlataforma: "250 px superiores (cabeçalho Story) e 250 px inferiores (campo de resposta/ações).",
      },
      fundoPodeExtravasarMobile: true,
      regraComposicaoPrompt:
        "Story vertical 9:16 (1080×1920): composição vertical com fotografia/ambiente em cima e bloco de logótipo destacado + nome + slogan ao centro-baixo dentro de y 260..1660; deixar os 250 px do topo e 250 px da base livres com fundo calmo.",
    },
    instrucaoZonaSeguraPrompt:
      "Story vertical 9:16 (1080×1920). Deixar obrigatoriamente os 250 px do topo e os 250 px da base livres de qualquer texto ou logótipo, mantendo fundo calmo nessas faixas.",
    nota: "Proporção 9:16 com 250 px no topo e 250 px na base livres para os controlos do Instagram Stories.",
    fonteNome: "Guia de anúncios da Meta para Stories",
    fonteUrl: "https://www.facebook.com/business/ads-guide/update/image/instagram-story",
  },
  "li-perfil-pessoal": {
    id: "li-perfil-pessoal",
    plataforma: "LinkedIn",
    tipoPeca: "perfil",
    nome: "LinkedIn, foto de perfil pessoal",
    ficheiro: "linkedin/perfil-pessoal.png",
    widthPx: 400,
    heightPx: 400,
    medidaLabel: "400×400 px",
    proporcaoAlvo: "1:1",
    aspectRatioGemini: "1:1",
    isCircle: true,
    test40px: true,
    opaque: true,
    safeZoneDesktop: { x: 60, y: 60, width: 280, height: 280 },
    safeZoneMobile: { x: 60, y: 60, width: 280, height: 280 },
    composicao: buildComposicaoPerfil(
      "LinkedIn Pessoal",
      "Máscara circular de perfil sobreposta sobre a capa e listagens a 40 px."
    ),
    instrucaoZonaSeguraPrompt:
      "Avatar quadrado 1:1 apresentado em círculo no LinkedIn; emblema centrado com folga de 15% na borda e legibilidade a 40 px.",
    nota: "Mínimo quadrado oficial (400×400 px), exibido em círculo.",
    fonteNome: "LinkedIn Help",
    fonteUrl: "https://www.linkedin.com/help/linkedin/answer/a549049",
  },
  "li-capa-pessoal": {
    id: "li-capa-pessoal",
    plataforma: "LinkedIn",
    tipoPeca: "capa",
    nome: "LinkedIn, capa pessoal",
    ficheiro: "linkedin/capa-pessoal.png",
    widthPx: 1584,
    heightPx: 396,
    medidaLabel: "1584×396 px",
    proporcaoAlvo: "4:1",
    aspectRatioGemini: "21:9",
    isCircle: false,
    test40px: false,
    opaque: true,
    styleGroup: "capas",
    safeZoneDesktop: {
      x: 340,
      y: 36,
      width: 1184,
      height: 324,
      nota: "Zona segura horizontal em computador à direita da foto de perfil.",
    },
    safeZoneMobile: {
      x: 420,
      y: 44,
      width: 1020,
      height: 308,
      nota: "Zona segura no telemóvel (canto esquerdo coberto pelo avatar, margem direita de computador pode sangrar fundo).",
    },
    avatarOverlapDesktop: {
      x: 36,
      y: 190,
      width: 270,
      height: 206,
      nota: "Canto inferior esquerdo reservado à fotografia circular no computador.",
    },
    avatarOverlapMobile: {
      x: 360,
      y: 230,
      width: 168,
      height: 166,
      nota: "Sobreposição da fotografia circular no telemóvel.",
    },
    composicao: {
      disposicao: "faixa-ultra-larga",
      disposicaoRotulo: "Faixa ultra-larga 4:1 (logótipo + nome em linha)",
      hierarquiaInformacao: HIERARQUIA_INFORMACAO_PADRAO,
      elementosPermitidos: ["logotipo", "nome"],
      maxCharsSlogan: 0,
      maxLinhasContactos: 0,
      camadas: {
        fundo: "Ambiente fotográfico/padrão sangra até às extremidades 1584×396 fora da zona segura móvel.",
        informacao: "1.º Logótipo + 2.º Nome dispostos EM LINHA HORIZONTAL à direita da foto de perfil (corta slogan e contactos).",
        uiPlataforma: "Canto inferior esquerdo reservado para a foto de perfil circular.",
      },
      fundoPodeExtravasarMobile: true,
      regraComposicaoPrompt:
        "Faixa ultra-larga 4:1 (1584×396): dispor emblema + nome da marca LADO A LADO EM LINHA HORIZONTAL dentro de x 530..1420 sem slogan longo nem contactos; estender o fundo/fotografia de ambiente às extremidades esquerda e direita.",
    },
    instrucaoZonaSeguraPrompt:
      "Capa ultra-larga LinkedIn 4:1 (1584×396). Compor emblema + nome em linha horizontal à direita do avatar (x 530 a 1420), sem slogan longo nem contactos, com fotografia/fundo a sangrar até às bordas.",
    nota: "Proporção ultra-larga 4:1 (1584×396 px): emblema e nome em linha horizontal longe da sobreposição da foto de perfil.",
    fonteNome: "LinkedIn Help",
    fonteUrl: "https://www.linkedin.com/help/linkedin/answer/a568217",
  },
  "li-perfil-empresa": {
    id: "li-perfil-empresa",
    plataforma: "LinkedIn",
    tipoPeca: "perfil",
    nome: "LinkedIn, logótipo da empresa",
    ficheiro: "linkedin/perfil-empresa.png",
    widthPx: 400,
    heightPx: 400,
    medidaLabel: "400×400 px",
    proporcaoAlvo: "1:1",
    aspectRatioGemini: "1:1",
    isCircle: false,
    test40px: true,
    opaque: true,
    safeZoneDesktop: { x: 52, y: 52, width: 296, height: 296 },
    safeZoneMobile: { x: 52, y: 52, width: 296, height: 296 },
    composicao: buildComposicaoPerfil(
      "LinkedIn Página",
      "Logótipo quadrado sobreposto na capa da Página de Empresa (também listado a 40 px)."
    ),
    instrucaoZonaSeguraPrompt:
      "Logótipo quadrado para Página LinkedIn (400×400 px) com margem segura uniforme e alto contraste mesmo a 40 px.",
    nota: "Recomendado 400×400 px para Página de Empresa LinkedIn (mínimo 268×268).",
    fonteNome: "LinkedIn Help, Páginas",
    fonteUrl: "https://www.linkedin.com/help/linkedin/answer/a563309",
  },
  "li-capa-empresa": {
    id: "li-capa-empresa",
    plataforma: "LinkedIn",
    tipoPeca: "capa",
    nome: "LinkedIn, capa da página",
    ficheiro: "linkedin/capa-empresa.png",
    widthPx: 1128,
    heightPx: 191,
    medidaLabel: "1128×191 px",
    proporcaoAlvo: "1128:191",
    aspectRatioGemini: "21:9",
    isCircle: false,
    test40px: false,
    opaque: true,
    styleGroup: "capas",
    safeZoneDesktop: {
      x: 180,
      y: 18,
      width: 900,
      height: 155,
      nota: "Faixa principal em computador à direita do logótipo da página.",
    },
    safeZoneMobile: {
      x: 240,
      y: 20,
      width: 660,
      height: 151,
      nota: "Centro seguro visível em ecrãs estreitos de telemóvel.",
    },
    avatarOverlapDesktop: {
      x: 24,
      y: 78,
      width: 136,
      height: 113,
      nota: "Área inferior esquerda junto ao logótipo quadrado da página.",
    },
    avatarOverlapMobile: {
      x: 224,
      y: 92,
      width: 108,
      height: 99,
      nota: "Área inferior esquerda junto ao logótipo na vista móvel.",
    },
    composicao: {
      disposicao: "faixa-ultra-larga",
      disposicaoRotulo: "Faixa ultra-larga 5,9:1 (logótipo + nome em linha)",
      hierarquiaInformacao: HIERARQUIA_INFORMACAO_PADRAO,
      elementosPermitidos: ["logotipo", "nome"],
      maxCharsSlogan: 0,
      maxLinhasContactos: 0,
      camadas: {
        fundo: "Fundo, filetes e textura editorial estendem-se aos 1128×191 completos fora da área central.",
        informacao: "1.º Emblema + 2.º Nome EM LINHA HORIZONTAL centrada na altura (sem slogan nem contactos para garantir leitura a 191 px).",
        uiPlataforma: "Canto inferior esquerdo junto ao logótipo da Página LinkedIn.",
      },
      fundoPodeExtravasarMobile: true,
      regraComposicaoPrompt:
        "Faixa panorâmica baixa (1128×191): colocar exclusivamente emblema + nome EM LINHA HORIZONTAL bem legível dentro de x 340..885; cortar slogan e contactos e deixar o fundo/ambiente sangrar até 1128 px.",
    },
    instrucaoZonaSeguraPrompt:
      "Banner ultra-largo (1128×191 px) para Página LinkedIn: apenas logótipo/emblema e nome em linha horizontal ao centro-direita dentro da zona móvel, com fundo contínuo nas margens.",
    nota: "Medida ultra-larga (1128×191 px): emblema e nome alinhados horizontalmente sem slogan nem contactos para leitura nítida.",
    fonteNome: "LinkedIn Help, Páginas",
    fonteUrl: "https://www.linkedin.com/help/linkedin/answer/a563309",
  },
  "yt-perfil": {
    id: "yt-perfil",
    plataforma: "YouTube",
    tipoPeca: "perfil",
    nome: "YouTube, avatar",
    ficheiro: "youtube/foto-de-perfil.png",
    widthPx: 800,
    heightPx: 800,
    medidaLabel: "800×800 px",
    proporcaoAlvo: "1:1",
    aspectRatioGemini: "1:1",
    isCircle: true,
    test40px: true,
    opaque: true,
    displayDesktop: "98×98 px (círculo)",
    displayMobile: "98×98 px (círculo)",
    safeZoneDesktop: { x: 120, y: 120, width: 560, height: 560 },
    safeZoneMobile: { x: 120, y: 120, width: 560, height: 560 },
    composicao: buildComposicaoPerfil(
      "YouTube",
      "Avatar circular do canal (98×98 px no canal e 40×40 px nos comentários)."
    ),
    instrucaoZonaSeguraPrompt:
      "Avatar quadrado 800×800 em círculo para YouTube: emblema forte e nítido mesmo a 98 px e 40 px, com cantos livres.",
    nota: "Ficheiro de origem a 800×800 px para apresentação em círculo (98×98 px e miniaturas de comentários).",
    fonteNome: "YouTube Help",
    fonteUrl: "https://support.google.com/youtube/answer/10456525",
  },
  "yt-banner": {
    id: "yt-banner",
    plataforma: "YouTube",
    tipoPeca: "capa",
    nome: "YouTube, banner",
    ficheiro: "youtube/banner.png",
    widthPx: 2560,
    heightPx: 1440,
    medidaLabel: "2560×1440 px",
    proporcaoAlvo: "16:9",
    aspectRatioGemini: "16:9",
    isCircle: false,
    test40px: false,
    opaque: true,
    styleGroup: "capas",
    safeZoneDesktop: {
      x: 0,
      y: 508,
      width: 2560,
      height: 423,
      nota: "Faixa horizontal visível em monitor de computador (2560×423 px).",
    },
    safeZoneMobile: {
      x: 507,
      y: 508,
      width: 1546,
      height: 423,
      nota: "Zona segura universal obrigatória (telemóvel e todos os ecrãs): 1546×423 px ao centro.",
    },
    composicao: {
      disposicao: "faixa-ultra-larga",
      disposicaoRotulo: "Faixa ultra-larga central 1546×423 (fundo TV 2560×1440)",
      hierarquiaInformacao: HIERARQUIA_INFORMACAO_PADRAO,
      elementosPermitidos: ["logotipo", "nome"],
      maxCharsSlogan: 0,
      maxLinhasContactos: 0,
      camadas: {
        fundo: "Fotografia de ambiente, padrões e textura de fundo sangram pelos 2560×1440 completos (TV e faixas laterais de monitor).",
        informacao: "1.º Emblema + 2.º Nome EM LINHA HORIZONTAL centrados estritamente dentro da zona universal 1546×423 (sem slogan longo nem contactos).",
        uiPlataforma: "Recortes de TV (16:9), computador (2560×423) e telemóvel (1546×423).",
      },
      fundoPodeExtravasarMobile: true,
      regraComposicaoPrompt:
        "Banner YouTube 2560×1440 (16:9): compor emblema + nome EM LINHA HORIZONTAL centrados dentro da faixa central segura 1546×423 (sem slogan nem contactos) enquanto o fundo/fotografia de ambiente sangra por toda a tela 2560×1440.",
    },
    instrucaoZonaSeguraPrompt:
      "Banner 16:9 de YouTube (2560×1440). Estender a fotografia/padrão de fundo a toda a tela (TV), mas manter TODO o logótipo e nome (em linha horizontal) obrigatoriamente dentro de 1546×423 px ao centro.",
    nota: "Tela 16:9 completa (2560×1440 px) com atmosfera a sangrar em TV/monitor e logótipo + nome em linha dentro da zona universal 1546×423 px.",
    fonteNome: "YouTube Help",
    fonteUrl: "https://support.google.com/youtube/answer/10456525",
  },
  "x-perfil": {
    id: "x-perfil",
    plataforma: "X",
    tipoPeca: "perfil",
    nome: "X, foto de perfil",
    ficheiro: "x/foto-de-perfil.png",
    widthPx: 400,
    heightPx: 400,
    medidaLabel: "400×400 px",
    proporcaoAlvo: "1:1",
    aspectRatioGemini: "1:1",
    isCircle: true,
    test40px: true,
    opaque: true,
    safeZoneDesktop: { x: 60, y: 60, width: 280, height: 280 },
    safeZoneMobile: { x: 60, y: 60, width: 280, height: 280 },
    composicao: buildComposicaoPerfil(
      "X (Twitter)",
      "Avatar circular em sobreposição no cabeçalho e na linha temporal a 40 px."
    ),
    instrucaoZonaSeguraPrompt:
      "Avatar quadrado 400×400 apresentado em círculo no X; emblema centrado e legível a 40 px.",
    nota: "Quadrado 400×400 px exibido em máscara circular.",
    fonteNome: "Ajuda do X",
    fonteUrl: "https://help.x.com/en/managing-your-account/how-to-customize-your-profile",
  },
  "x-cabecalho": {
    id: "x-cabecalho",
    plataforma: "X",
    tipoPeca: "capa",
    nome: "X, cabeçalho",
    ficheiro: "x/cabecalho.png",
    widthPx: 1500,
    heightPx: 500,
    medidaLabel: "1500×500 px",
    proporcaoAlvo: "3:1",
    aspectRatioGemini: "21:9",
    isCircle: false,
    test40px: false,
    opaque: true,
    styleGroup: "capas",
    safeZoneDesktop: {
      x: 310,
      y: 54,
      width: 1110,
      height: 392,
      nota: "Zona segura em computador acima e à direita do avatar.",
    },
    safeZoneMobile: {
      x: 320,
      y: 66,
      width: 960,
      height: 368,
      nota: "Enquadramento central seguro em telemóvel (bordas superiores/inferiores e laterais podem sangrar fundo).",
    },
    avatarOverlapDesktop: {
      x: 30,
      y: 270,
      width: 270,
      height: 230,
      nota: "Área inferior esquerda reservada ao avatar circular no computador.",
    },
    avatarOverlapMobile: {
      x: 320,
      y: 342,
      width: 170,
      height: 158,
      nota: "Área inferior esquerda da vista móvel junto à foto de perfil.",
    },
    composicao: {
      disposicao: "horizontal-bipartida",
      disposicaoRotulo: "Horizontal bipartida 3:1 (informação à esquerda + imagem à direita)",
      hierarquiaInformacao: HIERARQUIA_INFORMACAO_PADRAO,
      elementosPermitidos: ["logotipo", "nome", "slogan"],
      maxCharsSlogan: 44,
      maxLinhasContactos: 0,
      camadas: {
        fundo: "Imagem de ambiente e padrões sangram do centro-direita até às bordas 1500×500.",
        informacao: "1.º Logótipo + 2.º Nome + 3.º Slogan curto no bloco esquerdo-centro acima do avatar.",
        uiPlataforma: "Avatar circular no canto inferior esquerdo e margens superior/inferior em telemóvel.",
      },
      fundoPodeExtravasarMobile: true,
      regraComposicaoPrompt:
        "Cabeçalho bipartido 3:1 (1500×500) para X: informação (logótipo, nome e slogan curto, sem contactos) no bloco esquerdo dentro da zona segura móvel acima do avatar e fotografia/ambiente a sangrar pelo lado direito até às margens.",
    },
    instrucaoZonaSeguraPrompt:
      "Cabeçalho bipartido 3:1 para X (1500×500): logótipo, nome e slogan curto à esquerda na zona segura longe do canto inferior esquerdo do avatar; imagem de ambiente no lado direito a sangrar até às bordas.",
    nota: "Proporção 3:1 (1500×500 px): composição bipartida respeitando a foto de perfil inferior esquerda em computador e telemóvel.",
    fonteNome: "Ajuda do X",
    fonteUrl: "https://help.x.com/en/managing-your-account/how-to-customize-your-profile",
  },
  "gb-logotipo": {
    id: "gb-logotipo",
    plataforma: "Google Perfil de Empresa",
    tipoPeca: "perfil",
    nome: "Google Perfil de Empresa, logótipo",
    ficheiro: "google-business/logotipo.png",
    widthPx: 720,
    heightPx: 720,
    medidaLabel: "720×720 px",
    proporcaoAlvo: "1:1",
    aspectRatioGemini: "1:1",
    isCircle: false,
    test40px: true,
    opaque: true,
    safeZoneDesktop: { x: 92, y: 92, width: 536, height: 536 },
    safeZoneMobile: { x: 92, y: 92, width: 536, height: 536 },
    composicao: buildComposicaoPerfil(
      "Google Perfil de Empresa",
      "Miniatura quadrada nos resultados de Pesquisa e Google Maps a 40 px."
    ),
    instrucaoZonaSeguraPrompt:
      "Logótipo quadrado 720×720 para Google Perfil de Empresa: emblema centrado com margens amplas e legibilidade clara em miniaturas de mapas a 40 px.",
    nota: "Medida recomendada de 720×720 px (mínimo 250×250 px) para identificação na Pesquisa e Mapas.",
    fonteNome: "Google Business Profile Help",
    fonteUrl: "https://support.google.com/business/answer/6103862",
  },
  "gb-capa": {
    id: "gb-capa",
    plataforma: "Google Perfil de Empresa",
    tipoPeca: "capa",
    nome: "Google Perfil de Empresa, capa",
    ficheiro: "google-business/capa.png",
    widthPx: 1024,
    heightPx: 576,
    medidaLabel: "1024×576 px",
    proporcaoAlvo: "16:9",
    aspectRatioGemini: "16:9",
    isCircle: false,
    test40px: false,
    opaque: true,
    styleGroup: "capas",
    safeZoneDesktop: { x: 80, y: 64, width: 864, height: 448 },
    safeZoneMobile: { x: 112, y: 72, width: 800, height: 432 },
    composicao: {
      disposicao: "imagem-destaque-min-texto",
      disposicaoRotulo: "Google 16:9 (mais imagem em destaque, menos texto)",
      hierarquiaInformacao: HIERARQUIA_INFORMACAO_PADRAO,
      elementosPermitidos: ["logotipo", "nome"],
      maxCharsSlogan: 0,
      maxLinhasContactos: 0,
      camadas: {
        fundo: "Fotografia de produto/ambiente ocupa a largura total 1024×576 sangrando para todas as margens.",
        informacao: "1.º Emblema + 2.º Nome compactos à esquerda-centro dentro de 800×432, deixando >= 65% de fotografia protagonista.",
        uiPlataforma: "Recortes laterais ligeiros nos cartões móveis de Pesquisa e Google Maps.",
      },
      fundoPodeExtravasarMobile: true,
      regraComposicaoPrompt:
        "Capa Google Perfil de Empresa 16:9 (1024×576): privilegiar fotografia protagonista do setor/espaço a ocupar mais de dois terços da tela (sangrando até às bordas), com apenas logótipo + nome compactos na área segura esquerda (sem slogan nem contactos, que já aparecem na ficha Google).",
    },
    instrucaoZonaSeguraPrompt:
      "Capa 16:9 (1024×576 px) para Google Perfil de Empresa: fotografia dominante a sangrar nas margens e bloco compacto apenas com emblema + nome dentro da zona central 800×432.",
    nota: "Proporção 16:9 (1024×576 px) focada em fotografia protagonista com o mínimo de texto (apenas logótipo e nome).",
    fonteNome: "Google Business Profile Help",
    fonteUrl: "https://support.google.com/business/answer/6103862",
  },
  "wa-perfil": {
    id: "wa-perfil",
    plataforma: "WhatsApp Business",
    tipoPeca: "perfil",
    nome: "WhatsApp Business, foto de perfil",
    ficheiro: "whatsapp-business/foto-de-perfil.png",
    widthPx: 640,
    heightPx: 640,
    medidaLabel: "640×640 px",
    proporcaoAlvo: "1:1",
    aspectRatioGemini: "1:1",
    isCircle: true,
    test40px: true,
    opaque: true,
    safeZoneDesktop: { x: 96, y: 96, width: 448, height: 448 },
    safeZoneMobile: { x: 96, y: 96, width: 448, height: 448 },
    composicao: buildComposicaoPerfil(
      "WhatsApp Business",
      "Avatar circular com fundo obrigatoriamente opaco e leitura imediata a 40 px."
    ),
    instrucaoZonaSeguraPrompt:
      "Avatar quadrado 640×640 com fundo obrigatoriamente opaco e emblema centrado em círculo legível a 40 px.",
    nota: "640×640 px com fundo opaco obrigatório (evita fundo preto na máscara circular da aplicação).",
    fonteNome: "Documentação Meta WhatsApp Business",
    fonteUrl:
      "https://developers.facebook.com/docs/whatsapp/on-premises/reference/settings/profile/photo/",
  },
  "tiktok-perfil": {
    id: "tiktok-perfil",
    plataforma: "TikTok",
    tipoPeca: "perfil",
    nome: "TikTok, foto de perfil",
    ficheiro: "tiktok/foto-de-perfil.png",
    widthPx: 200,
    heightPx: 200,
    medidaLabel: "200×200 px",
    proporcaoAlvo: "1:1",
    aspectRatioGemini: "1:1",
    isCircle: true,
    test40px: true,
    opaque: true,
    safeZoneDesktop: { x: 30, y: 30, width: 140, height: 140 },
    safeZoneMobile: {
      x: 30,
      y: 30,
      width: 140,
      height: 140,
      nota: "Exibido em círculo; emblema compacto nítido em miniaturas de 40 px.",
    },
    composicao: buildComposicaoPerfil(
      "TikTok",
      "Máscara circular de perfil (200×200 px e miniatura circular lateral a 40 px)."
    ),
    instrucaoZonaSeguraPrompt:
      "Avatar circular 200×200 para TikTok com o emblema centrado e contraste limpo para leitura imediata a 40 px.",
    nota: "Medida recomendada oficial do TikTok (200×200 px) em máscara circular e validada a 40 px.",
    fonteNome: "TikTok Help Center",
    fonteUrl:
      "https://support.tiktok.com/en/using-tiktok/creating-your-account/setting-up-your-profile",
  },
};

export const REDES_SOCIAIS_LIST: RedeSocialConfig[] = Object.values(REDES_SOCIAIS_CONFIG);

export function getRedeSocialConfig(id: RedeSocialId): RedeSocialConfig {
  return REDES_SOCIAIS_CONFIG[id];
}

export function isRedeSocialId(value: string): value is RedeSocialId {
  return value in REDES_SOCIAIS_CONFIG;
}

/** Calcula a interseção comum entre a zona segura do computador e a do telemóvel */
export function getZonaSeguraComum(spec: RedeSocialConfig): SafeZoneRect {
  const x1 = Math.max(spec.safeZoneDesktop.x, spec.safeZoneMobile.x);
  const y1 = Math.max(spec.safeZoneDesktop.y, spec.safeZoneMobile.y);
  const x2 = Math.min(
    spec.safeZoneDesktop.x + spec.safeZoneDesktop.width,
    spec.safeZoneMobile.x + spec.safeZoneMobile.width
  );
  const y2 = Math.min(
    spec.safeZoneDesktop.y + spec.safeZoneDesktop.height,
    spec.safeZoneMobile.y + spec.safeZoneMobile.height
  );

  return {
    x: x1,
    y: y1,
    width: Math.max(40, x2 - x1),
    height: Math.max(40, y2 - y1),
  };
}

export interface HierarquiaInformacaoResolvida {
  disposicao: LayoutDisposicaoId;
  incluirLogotipo: boolean;
  incluirNome: boolean;
  incluirSlogan: boolean;
  incluirContactos: boolean;
  textosOrdenados: string[];
}

/**
 * Resolve estritamente a hierarquia de informação (1.º logótipo, 2.º nome, 3.º slogan, 4.º contactos)
 * a partir da configuração central do formato em `lib/config/redes-sociais.ts`,
 * cortando automaticamente o que não cabe na proporção sem inventar dados.
 */
export function resolverHierarquiaInformacaoConfig(
  dados: {
    nome?: string;
    slogan?: string;
    servicos?: string;
    website?: string;
    telefone?: string;
    morada?: string;
  },
  spec: RedeSocialConfig
): HierarquiaInformacaoResolvida {
  const cfg = spec.composicao;
  const permitidos = new Set<CampoInformacaoMarca>(cfg.elementosPermitidos);

  const nome = (dados.nome || "").trim();
  const sloganRaw = (dados.slogan || "").trim();
  const servicos = (dados.servicos || "").trim();
  const website = (dados.website || "").trim().replace(/^https?:\/\//i, "");
  const telefone = (dados.telefone || "").trim();
  const morada = (dados.morada || "").trim();

  const maxSlogan = cfg.maxCharsSlogan ?? 0;
  const sloganCabe =
    permitidos.has("slogan") &&
    Boolean(sloganRaw) &&
    (maxSlogan <= 0 ? false : sloganRaw.length <= maxSlogan);

  const maxContactos = cfg.maxLinhasContactos ?? 0;
  const contactosCandidatos: string[] = [];
  if (permitidos.has("contactos") && maxContactos > 0) {
    if (cfg.incluirServicosSeCouber && servicos) contactosCandidatos.push(servicos);
    if (website) contactosCandidatos.push(website);
    if (telefone) contactosCandidatos.push(telefone);
    if (morada) contactosCandidatos.push(morada);
  }
  const contactosFinal = contactosCandidatos.slice(0, maxContactos);

  const textosOrdenados: string[] = [];
  for (const campo of cfg.hierarquiaInformacao) {
    if (campo === "nome" && permitidos.has("nome") && nome) {
      textosOrdenados.push(nome);
    } else if (campo === "slogan" && sloganCabe) {
      textosOrdenados.push(sloganRaw);
    } else if (campo === "contactos" && contactosFinal.length > 0) {
      textosOrdenados.push(...contactosFinal);
    }
  }

  return {
    disposicao: cfg.disposicao,
    incluirLogotipo: permitidos.has("logotipo"),
    incluirNome: permitidos.has("nome") && Boolean(nome),
    incluirSlogan: sloganCabe,
    incluirContactos: contactosFinal.length > 0,
    textosOrdenados,
  };
}
