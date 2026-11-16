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
  /** Proporção alvo exacta da peça (ex.: 4:5, 9:16, 16:9, 3:1, 4:1, 1:1) */
  proporcaoAlvo: string;
  /** Proporção nativa mais próxima aceite pelo Gemini Nano Banana 2.1 antes do corte exato */
  aspectRatioGemini: GeminiAspectRatio;
  /** true para avatares recortados em círculo pela plataforma */
  isCircle: boolean;
  /** true para avatares que exigem legibilidade a 40×40 px em círculo */
  test40px: boolean;
  /** Fundo obrigatoriamente opaco */
  opaque: boolean;
  /** Categoria de grupo de layout ("moderno" vs "classico") */
  styleGroup?: "capas" | "publicacao" | "story";
  /** Zona segura garantida no computador */
  safeZoneDesktop: SafeZoneRect;
  /** Zona segura garantida no telemóvel */
  safeZoneMobile: SafeZoneRect;
  /** Zona inferior/lateral coberta pela foto de perfil no computador */
  avatarOverlapDesktop?: SafeZoneRect;
  /** Margem superior reservada pela UI da plataforma (ex.: Story 250 px) */
  margemTopoPx?: number;
  /** Margem inferior reservada pela UI da plataforma (ex.: Story 250 px) */
  margemBasePx?: number;
  /** Instrução específica de enquadramento passada ao gerador de imagem */
  instrucaoZonaSeguraPrompt: string;
  displayDesktop?: string;
  displayMobile?: string;
  nota: string;
  fonteNome: string;
  fonteUrl: string;
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
      y: 60,
      width: 1260,
      height: 440,
      nota: "Área visível em computador sem invadir a sobreposição inferior esquerda da foto de perfil.",
    },
    safeZoneMobile: {
      x: 280,
      y: 44,
      width: 1080,
      height: 536,
      nota: "Zona segura central visível no recorte de telemóvel (laterais podem ser cortadas).",
    },
    avatarOverlapDesktop: {
      x: 40,
      y: 380,
      width: 280,
      height: 244,
      nota: "Zona inferior esquerda coberta pela foto de perfil no computador.",
    },
    instrucaoZonaSeguraPrompt:
      "Banner horizontal panorâmico 1640×624. Manter todo o conteúdo importante e o logótipo dentro da zona central 1080×440 (visível em telemóvel e computador), deixando as margens laterais e o canto inferior esquerdo livres de texto ou elementos críticos.",
    nota: "Alta resolução recomendada (1640×624 px) com zona segura móvel centrada e canto inferior esquerdo livre para o avatar.",
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
      nota: "Enquadramento vertical 4:5 para maior destaque no feed.",
    },
    safeZoneMobile: {
      x: 96,
      y: 150,
      width: 888,
      height: 1050,
      nota: "Área central segura visível também na grelha de perfil 3:4 / 1:1.",
    },
    instrucaoZonaSeguraPrompt:
      "Publicação vertical 4:5 (1080×1350) para Instagram. Centrar o logótipo, cena e eventuais textos reais dentro da área interior 888×1050 para funcionar quer no feed completo 4:5 quer na grelha do perfil.",
    nota: "Formato vertical 4:5 recomendado para máximo alcance no feed do Instagram, com zona central compatível com a grelha do perfil.",
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
    safeZoneDesktop: { x: 96, y: 96, width: 888, height: 888 },
    safeZoneMobile: { x: 96, y: 96, width: 888, height: 888 },
    instrucaoZonaSeguraPrompt:
      "Publicação quadrada 1:1 (1080×1080) com margens laterais e superior/inferior de 96 px livres de elementos essenciais.",
    nota: "Formato clássico quadrado 1:1 na resolução máxima recomendada de 1080×1080 px.",
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
      x: 90,
      y: 250,
      width: 900,
      height: 1420,
      nota: "Zona central segura entre 250 px do topo e 250 px da base.",
    },
    safeZoneMobile: {
      x: 90,
      y: 250,
      width: 900,
      height: 1420,
      nota: "Os 250 px superiores e 250 px inferiores ficam livres para a interface de Stories.",
    },
    instrucaoZonaSeguraPrompt:
      "Story vertical 9:16 (1080×1920). Deixar obrigatoriamente os 250 px do topo e os 250 px da base em fundo calmo sem qualquer texto nem logótipo.",
    nota: "Proporção 9:16; os 250 px no topo e 250 px na base ficam livres dos elementos de interface do Instagram.",
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
      y: 44,
      width: 1180,
      height: 308,
      nota: "Zona segura à direita do avatar de perfil pessoal.",
    },
    safeZoneMobile: {
      x: 360,
      y: 48,
      width: 1100,
      height: 300,
      nota: "Em telemóvel o avatar centra-se ligeiramente sobre o canto esquerdo inferior.",
    },
    avatarOverlapDesktop: {
      x: 36,
      y: 190,
      width: 270,
      height: 206,
      nota: "Canto inferior esquerdo reservado à fotografia circular.",
    },
    instrucaoZonaSeguraPrompt:
      "Capa horizontal LinkedIn 4:1 (1584×396). Manter conteúdo crítico na faixa central-direita (x 340 a 1460) evitando o canto inferior esquerdo coberto pelo avatar.",
    nota: "Proporção 4:1 oficial (1584×396 px) com reserva inferior esquerda para a sobreposição da foto de perfil.",
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
      y: 20,
      width: 880,
      height: 151,
      nota: "Faixa principal da capa de página empresarial (1128×191 px).",
    },
    safeZoneMobile: {
      x: 220,
      y: 22,
      width: 688,
      height: 147,
      nota: "Centro seguro visível em ecrãs estreitos de telemóvel.",
    },
    avatarOverlapDesktop: {
      x: 24,
      y: 80,
      width: 136,
      height: 111,
      nota: "Área inferior esquerda junto ao logótipo da página.",
    },
    instrucaoZonaSeguraPrompt:
      "Banner muito panorâmico (1128×191 px) para Página LinkedIn. Concentrar o logótipo e slogan numa faixa horizontal central compacta sem elementos cortados em cima ou em baixo.",
    nota: "Medida padrão para capa de Página LinkedIn (1128×191 px) com proteção central para computador e telemóvel.",
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
      nota: "Faixa visível em monitor de computador (2560×423 px).",
    },
    safeZoneMobile: {
      x: 507,
      y: 508,
      width: 1546,
      height: 423,
      nota: "Zona segura universal obrigatória (telemóvel + computador): 1546×423 px centrada.",
    },
    instrucaoZonaSeguraPrompt:
      "Banner 16:9 de YouTube (2560×1440). Estender a atmosfera de fundo a toda a tela (TV), mas manter TODO o logótipo e texto obrigatoriamente dentro da faixa central segura 1546×423 px.",
    nota: "Fundo em 16:9 completo para TV (2560×1440 px) com zona segura universal de 1546×423 px ao centro para telemóvel e computador.",
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
      x: 320,
      y: 60,
      width: 1080,
      height: 380,
      nota: "Zona segura evitando canto inferior esquerdo coberto pelo avatar e bordas.",
    },
    safeZoneMobile: {
      x: 340,
      y: 72,
      width: 960,
      height: 356,
      nota: "Enquadramento móvel sem cortar texto importante nas margens.",
    },
    avatarOverlapDesktop: {
      x: 30,
      y: 270,
      width: 270,
      height: 230,
      nota: "Área inferior esquerda reservada ao avatar no perfil.",
    },
    instrucaoZonaSeguraPrompt:
      "Cabeçalho 3:1 para X (1500×500). Deixar o canto inferior esquerdo (300×230 px) e as margens de topo/base livres de texto ou logótipo.",
    nota: "Proporção 3:1 (1500×500 px); o canto inferior esquerdo fica reservado para a foto de perfil.",
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
    instrucaoZonaSeguraPrompt:
      "Capa 16:9 (1024×576 px) para ficha Google Perfil de Empresa, mantendo o foco da marca e texto na zona central 800×432.",
    nota: "Proporção panorâmica 16:9 a 1024×576 px com zona central segura para telemóvel e computador.",
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
