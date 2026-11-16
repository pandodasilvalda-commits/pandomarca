export type EntitlementKind = "website_bonus" | "standalone";
export type EntitlementStatus = "active" | "revoked" | "expired";

export interface Entitlement {
  id: string;
  kind: EntitlementKind;
  status: EntitlementStatus;
  clientId?: string;
  code: string;
  websiteSubscriptionId?: string;
  purchaseId?: string;
  expiresAt: string;
}

export type SectorId =
  | "restauracao"
  | "saude"
  | "servicos"
  | "comercio"
  | "tecnologia"
  | "beleza"
  | "construcao"
  | "educacao"
  | "outro";

export type FontPairId =
  | "moderna"
  | "confianca"
  | "editorial"
  | "clara"
  | "tecnica";

export type StyleId =
  | "liso"
  | "degrade"
  | "padrao"
  | "informativo"
  | "fotografia"
  | "minimal";

export type StyleGroupKey =
  | "capas"
  | "publicacao"
  | "story"
  | "cartao"
  | "papel"
  | "assinatura";

export interface StyleGroupOverrides {
  capas: StyleId;
  publicacao: StyleId;
  story: StyleId;
  cartao: StyleId;
  papel: StyleId;
  assinatura: StyleId;
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface ColorEntry {
  hex: string;
  rgb: RGBColor;
}

export interface BrandPalette {
  primaria: ColorEntry;
  secundaria: ColorEntry;
  papel: ColorEntry;
  tinta: ColorEntry;
  neutro: ColorEntry;
}

export interface BrandPaletteHex {
  primaria: string;
  secundaria: string;
  papel: string;
  tinta: string;
  neutro?: string;
}

export interface BrandData {
  nome: string;
  sector: SectorId;
  simbolo: boolean;
  slogan: string;
  pessoa: string;
  cargo: string;
  email: string;
  telefone: string;
  website: string;
  morada: string;
  nif: string;
  servicos: string;
}

export interface FontPairSpec {
  id: FontPairId;
  nome: string;
  tituloFamily: string;
  tituloPkg: string;
  tituloWeight: 600 | 700;
  textoFamily: string;
  textoPkg: string;
  textoWeight: 400;
  serveSobretudo: string;
  googleFontsUrl: string;
}

export const FONT_PAIRS: Record<FontPairId, FontPairSpec> = {
  moderna: {
    id: "moderna",
    nome: "Moderna",
    tituloFamily: "Outfit",
    tituloPkg: "outfit",
    tituloWeight: 600,
    textoFamily: "Source Serif 4",
    textoPkg: "source-serif-4",
    textoWeight: 400,
    serveSobretudo: "Comércio e marcas novas",
    googleFontsUrl:
      "https://fonts.google.com/share?selection.family=Outfit:wght@600|Source+Serif+4:wght@400",
  },
  confianca: {
    id: "confianca",
    nome: "Confiança",
    tituloFamily: "Source Sans 3",
    tituloPkg: "source-sans-3",
    tituloWeight: 600,
    textoFamily: "Libre Baskerville",
    textoPkg: "libre-baskerville",
    textoWeight: 400,
    serveSobretudo: "Serviços e saúde",
    googleFontsUrl:
      "https://fonts.google.com/share?selection.family=Libre+Baskerville:wght@400|Source+Sans+3:wght@600",
  },
  editorial: {
    id: "editorial",
    nome: "Editorial",
    tituloFamily: "Fraunces",
    tituloPkg: "fraunces",
    tituloWeight: 600,
    textoFamily: "Outfit",
    textoPkg: "outfit",
    textoWeight: 400,
    serveSobretudo: "Beleza e educação",
    googleFontsUrl:
      "https://fonts.google.com/share?selection.family=Fraunces:wght@600|Outfit:wght@400",
  },
  clara: {
    id: "clara",
    nome: "Clara",
    tituloFamily: "Nunito",
    tituloPkg: "nunito",
    tituloWeight: 700,
    textoFamily: "Lora",
    textoPkg: "lora",
    textoWeight: 400,
    serveSobretudo: "Restauração e marcas próximas",
    googleFontsUrl:
      "https://fonts.google.com/share?selection.family=Lora:wght@400|Nunito:wght@700",
  },
  tecnica: {
    id: "tecnica",
    nome: "Técnica",
    tituloFamily: "Manrope",
    tituloPkg: "manrope",
    tituloWeight: 600,
    textoFamily: "Source Serif 4",
    textoPkg: "source-serif-4",
    textoWeight: 400,
    serveSobretudo: "Tecnologia e construção",
    googleFontsUrl:
      "https://fonts.google.com/share?selection.family=Manrope:wght@600|Source+Serif+4:wght@400",
  },
};

export interface SectorSpec {
  id: SectorId;
  rotulo: string;
  parSugerido: FontPairId;
  recomendacoes: Record<StyleGroupKey, [StyleId, StyleId]>;
}

export const SECTORS: Record<SectorId, SectorSpec> = {
  restauracao: {
    id: "restauracao",
    rotulo: "Restauração",
    parSugerido: "clara",
    recomendacoes: {
      capas: ["fotografia", "degrade"],
      publicacao: ["fotografia", "padrao"],
      story: ["degrade", "fotografia"],
      cartao: ["liso", "minimal"],
      papel: ["liso", "informativo"],
      assinatura: ["informativo", "minimal"],
    },
  },
  saude: {
    id: "saude",
    rotulo: "Saúde e bem-estar",
    parSugerido: "confianca",
    recomendacoes: {
      capas: ["liso", "minimal"],
      publicacao: ["minimal", "liso"],
      story: ["liso", "degrade"],
      cartao: ["minimal", "liso"],
      papel: ["informativo", "liso"],
      assinatura: ["minimal", "informativo"],
    },
  },
  servicos: {
    id: "servicos",
    rotulo: "Serviços profissionais",
    parSugerido: "confianca",
    recomendacoes: {
      capas: ["informativo", "liso"],
      publicacao: ["informativo", "minimal"],
      story: ["liso", "degrade"],
      cartao: ["minimal", "liso"],
      papel: ["informativo", "liso"],
      assinatura: ["informativo", "minimal"],
    },
  },
  comercio: {
    id: "comercio",
    rotulo: "Comércio",
    parSugerido: "moderna",
    recomendacoes: {
      capas: ["liso", "padrao"],
      publicacao: ["padrao", "degrade"],
      story: ["degrade", "padrao"],
      cartao: ["liso", "minimal"],
      papel: ["liso", "informativo"],
      assinatura: ["liso", "informativo"],
    },
  },
  tecnologia: {
    id: "tecnologia",
    rotulo: "Tecnologia",
    parSugerido: "tecnica",
    recomendacoes: {
      capas: ["minimal", "degrade"],
      publicacao: ["minimal", "liso"],
      story: ["degrade", "minimal"],
      cartao: ["minimal", "liso"],
      papel: ["minimal", "informativo"],
      assinatura: ["minimal", "liso"],
    },
  },
  beleza: {
    id: "beleza",
    rotulo: "Beleza",
    parSugerido: "editorial",
    recomendacoes: {
      capas: ["degrade", "fotografia"],
      publicacao: ["degrade", "fotografia"],
      story: ["fotografia", "degrade"],
      cartao: ["minimal", "liso"],
      papel: ["liso", "minimal"],
      assinatura: ["minimal", "liso"],
    },
  },
  construcao: {
    id: "construcao",
    rotulo: "Construção",
    parSugerido: "tecnica",
    recomendacoes: {
      capas: ["liso", "informativo"],
      publicacao: ["informativo", "liso"],
      story: ["liso", "padrao"],
      cartao: ["liso", "informativo"],
      papel: ["informativo", "liso"],
      assinatura: ["informativo", "liso"],
    },
  },
  educacao: {
    id: "educacao",
    rotulo: "Educação",
    parSugerido: "editorial",
    recomendacoes: {
      capas: ["informativo", "minimal"],
      publicacao: ["informativo", "liso"],
      story: ["liso", "degrade"],
      cartao: ["minimal", "informativo"],
      papel: ["informativo", "liso"],
      assinatura: ["informativo", "minimal"],
    },
  },
  outro: {
    id: "outro",
    rotulo: "Outro",
    parSugerido: "moderna",
    recomendacoes: {
      capas: ["liso", "minimal"],
      publicacao: ["liso", "degrade"],
      story: ["degrade", "liso"],
      cartao: ["liso", "minimal"],
      papel: ["liso", "informativo"],
      assinatura: ["minimal", "liso"],
    },
  },
};

export interface ContentStyleSpec {
  id: StyleId;
  nome: string;
  descricao: string;
  detalhe: string;
}

export const CONTENT_STYLES: Record<StyleId, ContentStyleSpec> = {
  liso: {
    id: "liso",
    nome: "Liso",
    descricao: "Fundo de uma cor da paleta.",
    detalhe: "Superfície cromática limpa e direta, dando máximo destaque ao logótipo e ao nome.",
  },
  degrade: {
    id: "degrade",
    nome: "Degradê",
    descricao:
      "Passagem entre a primária e um tom mais escuro (ou a secundária), com o texto numa cor que contraste.",
    detalhe: "Transição suave de cor com profundidade luminosa e contraste garantido na camada de texto.",
  },
  padrao: {
    id: "padrao",
    nome: "Padrão",
    descricao:
      "Repete, com pouca opacidade, uma forma tirada do logótipo, sobre um fundo claro.",
    detalhe: "Motivo geométrico subtil extraído da marca sobre papel claro, mantendo o logótipo em primeiro plano.",
  },
  informativo: {
    id: "informativo",
    nome: "Informativo",
    descricao: "Dá prioridade a serviços e contactos.",
    detalhe: "Estrutura editorial que organiza serviços, contactos diretos, localização e especialidades.",
  },
  fotografia: {
    id: "fotografia",
    nome: "Fotografia",
    descricao:
      "Usa uma imagem carregada pela pessoa, com véu escuro para o texto e o logótipo se lerem.",
    detalhe: "Fundo fotográfico personalizado com véu escuro calibrado para leitura nítida da marca.",
  },
  minimal: {
    id: "minimal",
    nome: "Minimal tipográfico",
    descricao: "Quase só o nome, com muito branco.",
    detalhe: "Composição arejada sobre fundo papel com foco na tipografia e espaço negativo generoso.",
  },
};

export const STYLE_GROUPS: {
  key: StyleGroupKey;
  rotulo: string;
  descricao: string;
}[] = [
  {
    key: "capas",
    rotulo: "Capas de redes e perfis",
    descricao: "Facebook, X, YouTube, LinkedIn (pessoal e empresa) e Google Business",
  },
  {
    key: "publicacao",
    rotulo: "Publicação de Instagram",
    descricao: "Formato quadrado 1080×1080 px para o feed",
  },
  {
    key: "story",
    rotulo: "Story de Instagram",
    descricao: "Formato vertical 1080×1920 px (9:16) com zonas seguras de interface",
  },
  {
    key: "cartao",
    rotulo: "Cartão de visita",
    descricao: "Frente e verso em PDF 91×61 mm (corte 85×55 mm, sangria 3 mm)",
  },
  {
    key: "papel",
    rotulo: "Papel de carta A4",
    descricao: "Cabeçalho estilizado, miolo branco para escrita e rodapé com contactos e NIF",
  },
  {
    key: "assinatura",
    rotulo: "Assinatura de email",
    descricao: "Tabela HTML com CSS em linha e cores do estilo (sem imagem de fundo)",
  },
];

export type FormatCategory =
  | "variantes"
  | "redes"
  | "favicon"
  | "email"
  | "impressao"
  | "guia"
  | "metadados";

export interface FormatSpec {
  id: string;
  categoria: FormatCategory;
  styleGroup?: StyleGroupKey;
  nome: string;
  ficheiro: string;
  tipo: "PNG" | "ICO" | "JSON" | "HTML" | "PDF" | "SVG" | "TXT";
  medidaLabel: string;
  widthPx?: number;
  heightPx?: number;
  maxWidthPx?: number;
  widthMm?: number;
  heightMm?: number;
  trimWidthMm?: number;
  trimHeightMm?: number;
  bleedMm?: number;
  pages?: number;
  icoSizes?: number[];
  opaque?: boolean;
  circularSafeZone?: boolean;
  nota: string;
  fonteNome?: string;
  fonteUrl?: string;
}

export const REFERENCE_DATE_PT = "15 de novembro de 2026";

export const FORMAT_SPECS: FormatSpec[] = [
  // 1. Variantes do logótipo (5)
  {
    id: "var-principal",
    categoria: "variantes",
    nome: "Logótipo principal",
    ficheiro: "variantes/logotipo-principal.png",
    tipo: "PNG",
    medidaLabel: "Medida do original processado",
    nota: "Variante principal com fundo transparente.",
  },
  {
    id: "var-icone",
    categoria: "variantes",
    nome: "Ícone / Símbolo",
    ficheiro: "variantes/icone.png",
    tipo: "PNG",
    medidaLabel: "1024×1024 px",
    widthPx: 1024,
    heightPx: 1024,
    nota: "Símbolo ou ícone isolado com transparência.",
  },
  {
    id: "var-horizontal",
    categoria: "variantes",
    nome: "Logótipo horizontal",
    ficheiro: "variantes/logotipo-horizontal.png",
    tipo: "PNG",
    medidaLabel: "1800×560 px",
    widthPx: 1800,
    heightPx: 560,
    nota: "Versão horizontal. Se o ficheiro original for só um símbolo, compõe o nome no tipo de título.",
  },
  {
    id: "var-fundo-claro",
    categoria: "variantes",
    nome: "Variante sobre fundo claro",
    ficheiro: "variantes/fundo-claro.png",
    tipo: "PNG",
    medidaLabel: "1200×1200 px",
    widthPx: 1200,
    heightPx: 1200,
    opaque: true,
    nota: "Logótipo centrado sobre fundo claro da paleta.",
  },
  {
    id: "var-fundo-escuro",
    categoria: "variantes",
    nome: "Variante sobre fundo escuro",
    ficheiro: "variantes/fundo-escuro.png",
    tipo: "PNG",
    medidaLabel: "1200×1200 px",
    widthPx: 1200,
    heightPx: 1200,
    opaque: true,
    nota: "Sobre fundo escuro. Se o logótipo for escuro e quase sem cor, usa o desenho a branco; um logótipo colorido mantém as cores.",
  },

  // 2. Redes e perfis (16)
  {
    id: "fb-perfil",
    categoria: "redes",
    nome: "Facebook, foto de perfil",
    ficheiro: "facebook/foto-de-perfil.png",
    tipo: "PNG",
    medidaLabel: "320×320 px",
    widthPx: 320,
    heightPx: 320,
    circularSafeZone: true,
    opaque: true,
    nota: "A Página mostra 176×176 no computador e 196×196 no telemóvel, em círculo. O ficheiro recomendado é 320×320. O desenho fica na zona circular.",
    fonteNome: "Facebook Help",
    fonteUrl: "https://www.facebook.com/help/125379114252045",
  },
  {
    id: "fb-capa",
    categoria: "redes",
    styleGroup: "capas",
    nome: "Facebook, capa",
    ficheiro: "facebook/capa.png",
    tipo: "PNG",
    medidaLabel: "851×315 px",
    widthPx: 851,
    heightPx: 315,
    opaque: true,
    nota: "Mínimo 400×150. A foto de perfil tapa a zona inferior esquerda: o nome não encosta aí. PNG, porque o Facebook recomenda PNG quando há logótipo ou texto.",
    fonteNome: "Facebook Help",
    fonteUrl: "https://www.facebook.com/help/125379114252045",
  },
  {
    id: "ig-perfil",
    categoria: "redes",
    nome: "Instagram, foto de perfil",
    ficheiro: "instagram/foto-de-perfil.png",
    tipo: "PNG",
    medidaLabel: "320×320 px",
    widthPx: 320,
    heightPx: 320,
    circularSafeZone: true,
    opaque: true,
    nota: "O Instagram não publica píxeis para a foto de perfil. 320 px é a largura mínima que a ajuda do Instagram preserva numa fotografia. Quadrado, desenho dentro do círculo.",
    fonteNome: "Ajuda do Instagram",
    fonteUrl: "https://help.instagram.com/1631821640426723",
  },
  {
    id: "ig-publicacao",
    categoria: "redes",
    styleGroup: "publicacao",
    nome: "Instagram, publicação",
    ficheiro: "instagram/publicacao-1080.png",
    tipo: "PNG",
    medidaLabel: "1080×1080 px",
    widthPx: 1080,
    heightPx: 1080,
    opaque: true,
    nota: "Largura máxima preservada 1080 px.",
    fonteNome: "Ajuda do Instagram",
    fonteUrl: "https://help.instagram.com/1631821640426723",
  },
  {
    id: "ig-story",
    categoria: "redes",
    styleGroup: "story",
    nome: "Instagram, story",
    ficheiro: "instagram/story-1080x1920.png",
    tipo: "PNG",
    medidaLabel: "1080×1920 px",
    widthPx: 1080,
    heightPx: 1920,
    opaque: true,
    nota: "9:16. O texto fica fora das faixas de cima e de baixo. O guia de anúncios da Meta para Stories recomenda 1440×2560 para anúncios; esse ficheiro extra está em aberto e não se inclui agora.",
    fonteNome: "Guia de anúncios da Meta para Stories",
    fonteUrl: "https://www.facebook.com/business/ads-guide/update/image/instagram-story",
  },
  {
    id: "x-perfil",
    categoria: "redes",
    nome: "X, foto de perfil",
    ficheiro: "x/foto-de-perfil.png",
    tipo: "PNG",
    medidaLabel: "400×400 px",
    widthPx: 400,
    heightPx: 400,
    circularSafeZone: true,
    opaque: true,
    nota: "Quadrado, mostrado em círculo.",
    fonteNome: "Ajuda do X, personalizar o perfil",
    fonteUrl: "https://help.x.com/en/managing-your-account/how-to-customize-your-profile",
  },
  {
    id: "x-cabecalho",
    categoria: "redes",
    styleGroup: "capas",
    nome: "X, cabeçalho",
    ficheiro: "x/cabecalho.png",
    tipo: "PNG",
    medidaLabel: "1500×500 px",
    widthPx: 1500,
    heightPx: 500,
    opaque: true,
    nota: "Proporção 3:1. A foto de perfil cobre o canto inferior esquerdo.",
    fonteNome: "Ajuda do X, personalizar o perfil",
    fonteUrl: "https://help.x.com/en/managing-your-account/how-to-customize-your-profile",
  },
  {
    id: "yt-perfil",
    categoria: "redes",
    nome: "YouTube, foto de perfil",
    ficheiro: "youtube/foto-de-perfil.png",
    tipo: "PNG",
    medidaLabel: "800×800 px",
    widthPx: 800,
    heightPx: 800,
    circularSafeZone: true,
    opaque: true,
    nota: "A plataforma publica 98×98 px de apresentação; 800×800 é o ficheiro de origem, para essa apresentação continuar nítida.",
    fonteNome: "YouTube Help",
    fonteUrl: "https://support.google.com/youtube/answer/10456525",
  },
  {
    id: "yt-banner",
    categoria: "redes",
    styleGroup: "capas",
    nome: "YouTube, banner",
    ficheiro: "youtube/banner.png",
    tipo: "PNG",
    medidaLabel: "2560×1440 px",
    widthPx: 2560,
    heightPx: 1440,
    opaque: true,
    nota: "Recomendado, sobretudo para televisão. Mínimo 2048×1152, com zona segura de texto e logótipo de 1235×338. Neste ficheiro a zona é escalada por 2560/2048 = 1,25 e fica centrada: cerca de 1544×423 px. Sem moldura. O fundo estende-se à tela toda.",
    fonteNome: "YouTube Help",
    fonteUrl: "https://support.google.com/youtube/answer/10456525",
  },
  {
    id: "li-perfil-pessoal",
    categoria: "redes",
    nome: "LinkedIn, perfil pessoal",
    ficheiro: "linkedin/perfil-pessoal.png",
    tipo: "PNG",
    medidaLabel: "400×400 px",
    widthPx: 400,
    heightPx: 400,
    circularSafeZone: true,
    opaque: true,
    nota: "Aceita de 400×400 a 7680×4320. Exportamos o mínimo quadrado.",
    fonteNome: "LinkedIn Help",
    fonteUrl: "https://www.linkedin.com/help/linkedin/answer/a549049",
  },
  {
    id: "li-capa-pessoal",
    categoria: "redes",
    styleGroup: "capas",
    nome: "LinkedIn, capa pessoal",
    ficheiro: "linkedin/capa-pessoal.png",
    tipo: "PNG",
    medidaLabel: "1584×396 px",
    widthPx: 1584,
    heightPx: 396,
    opaque: true,
    nota: "Capa de perfil pessoal do LinkedIn (proporção 4:1).",
    fonteNome: "LinkedIn Help",
    fonteUrl: "https://www.linkedin.com/help/linkedin/answer/a568217",
  },
  {
    id: "li-perfil-empresa",
    categoria: "redes",
    nome: "LinkedIn, logótipo da empresa",
    ficheiro: "linkedin/perfil-empresa.png",
    tipo: "PNG",
    medidaLabel: "400×400 px",
    widthPx: 400,
    heightPx: 400,
    opaque: true,
    nota: "Recomendado 400×400, mínimo 268×268.",
    fonteNome: "LinkedIn Help, Páginas",
    fonteUrl: "https://www.linkedin.com/help/linkedin/answer/a563309",
  },
  {
    id: "li-capa-empresa",
    categoria: "redes",
    styleGroup: "capas",
    nome: "LinkedIn, capa da empresa",
    ficheiro: "linkedin/capa-empresa.png",
    tipo: "PNG",
    medidaLabel: "1512×256 px",
    widthPx: 1512,
    heightPx: 256,
    opaque: true,
    nota: "Mínimo e recomendado 1512×256 (já não é o antigo 1128×191).",
    fonteNome: "LinkedIn Help, Páginas",
    fonteUrl: "https://www.linkedin.com/help/linkedin/answer/a563309",
  },
  {
    id: "wa-perfil",
    categoria: "redes",
    nome: "WhatsApp Business, foto de perfil",
    ficheiro: "whatsapp-business/foto-de-perfil.png",
    tipo: "PNG",
    medidaLabel: "640×640 px",
    widthPx: 640,
    heightPx: 640,
    circularSafeZone: true,
    opaque: true,
    nota: "A documentação On-Premises recomenda 640×640 e avisa abaixo de 192 px. A Cloud API já não publica píxeis; mantemos 640×640, o último número que a Meta publicou. Fundo opaco: a transparência fica preta no WhatsApp.",
    fonteNome: "Documentação On-Premises",
    fonteUrl:
      "https://developers.facebook.com/docs/whatsapp/on-premises/reference/settings/profile/photo/",
  },
  {
    id: "gb-logotipo",
    categoria: "redes",
    nome: "Google Business, logótipo",
    ficheiro: "google-business/logotipo.png",
    tipo: "PNG",
    medidaLabel: "720×720 px",
    widthPx: 720,
    heightPx: 720,
    opaque: true,
    nota: "Recomendado 720×720, mínimo 250×250. JPG ou PNG, 10 KB a 5 MB.",
    fonteNome: "Google Business Profile Help",
    fonteUrl: "https://support.google.com/business/answer/6103862",
  },
  {
    id: "gb-capa",
    categoria: "redes",
    styleGroup: "capas",
    nome: "Google Business, capa",
    ficheiro: "google-business/capa.png",
    tipo: "PNG",
    medidaLabel: "1024×576 px",
    widthPx: 1024,
    heightPx: 576,
    opaque: true,
    nota: "A ajuda não publica uma medida só para a capa. 1024×576 é 16:9, decisão de produção, dentro do intervalo usado na sincronização de fichas.",
    fonteNome: "Google Business Profile Help",
    fonteUrl: "https://support.google.com/business/answer/6103862",
  },

  // 3. Favicon (6)
  {
    id: "fav-ico",
    categoria: "favicon",
    nome: "Favicon multi-resolução (.ico)",
    ficheiro: "favicon/favicon.ico",
    tipo: "ICO",
    medidaLabel: "16, 32 e 48 px no mesmo ficheiro",
    icoSizes: [16, 32, 48],
    nota: "Quadrado com 16×16, 32×32 e 48×48 px combinados no mesmo ficheiro ICO.",
    fonteNome: "Google Search Central",
    fonteUrl: "https://developers.google.com/search/docs/appearance/favicon",
  },
  {
    id: "fav-32",
    categoria: "favicon",
    nome: "Favicon 32×32",
    ficheiro: "favicon/favicon-32x32.png",
    tipo: "PNG",
    medidaLabel: "32×32 px",
    widthPx: 32,
    heightPx: 32,
    nota: "Separador em ecrãs nítidos.",
    fonteNome: "Google Search Central",
    fonteUrl: "https://developers.google.com/search/docs/appearance/favicon",
  },
  {
    id: "fav-apple",
    categoria: "favicon",
    nome: "Apple Touch Icon",
    ficheiro: "favicon/apple-touch-icon.png",
    tipo: "PNG",
    medidaLabel: "180×180 px",
    widthPx: 180,
    heightPx: 180,
    opaque: true,
    nota: "Fundo opaco (o iOS enche a transparência de preto e arredonda os cantos).",
    fonteNome: "Apple HIG",
    fonteUrl: "https://developer.apple.com/design/human-interface-guidelines/app-icons",
  },
  {
    id: "fav-192",
    categoria: "favicon",
    nome: "Ícone Web App 192×192",
    ficheiro: "favicon/icon-192.png",
    tipo: "PNG",
    medidaLabel: "192×192 px",
    widthPx: 192,
    heightPx: 192,
    nota: "Ícone para Web App Manifest (Android e Chrome).",
    fonteNome: "web.dev, manifesto",
    fonteUrl: "https://web.dev/articles/add-manifest",
  },
  {
    id: "fav-512",
    categoria: "favicon",
    nome: "Ícone Web App 512×512",
    ficheiro: "favicon/icon-512.png",
    tipo: "PNG",
    medidaLabel: "512×512 px",
    widthPx: 512,
    heightPx: 512,
    nota: "Ícone de alta definição para ecrã de arranque PWA.",
    fonteNome: "web.dev, manifesto",
    fonteUrl: "https://web.dev/articles/add-manifest",
  },
  {
    id: "fav-manifest",
    categoria: "favicon",
    nome: "Web App Manifest",
    ficheiro: "favicon/site.webmanifest",
    tipo: "JSON",
    medidaLabel: "—",
    nota: "Aponta para 192 e 512 e leva as cores do kit.",
    fonteNome: "web.dev, manifesto",
    fonteUrl: "https://web.dev/articles/add-manifest",
  },

  // 4. Email, impressão, guia e metadados (9)
  {
    id: "email-html",
    categoria: "email",
    styleGroup: "assinatura",
    nome: "Assinatura de email (HTML)",
    ficheiro: "email/assinatura.html",
    tipo: "HTML",
    medidaLabel: "—",
    nota: "Tabela com CSS em linha (o que os clientes de email ainda respeitam). O NIF entra quando está preenchido. Não usa imagens de fundo no HTML; o estilo traduz-se em cores de tabela.",
  },
  {
    id: "email-logo",
    categoria: "email",
    nome: "Logótipo da assinatura de email",
    ficheiro: "email/logotipo-assinatura.png",
    tipo: "PNG",
    medidaLabel: "Altura 128 px (máx. largura 480 px)",
    heightPx: 128,
    maxWidthPx: 480,
    nota: "Altura 128 px (largura máxima sugerida 480 px), mostrado no HTML a 64 px de altura.",
  },
  {
    id: "imp-cartao",
    categoria: "impressao",
    styleGroup: "cartao",
    nome: "Cartão de visita (PDF)",
    ficheiro: "impressao/cartao-de-visita.pdf",
    tipo: "PDF",
    medidaLabel: "Página 91×61 mm; corte 85×55 mm; sangria 3 mm (2 páginas)",
    widthMm: 91,
    heightMm: 61,
    trimWidthMm: 85,
    trimHeightMm: 55,
    bleedMm: 3,
    pages: 2,
    nota: "Cartão habitual na Europa, distinto do ISO/IEC 7810 ID-1. Duas páginas (frente e verso). O PDF marca a caixa de corte e a caixa de sangria.",
  },
  {
    id: "imp-papel",
    categoria: "impressao",
    styleGroup: "papel",
    nome: "Papel de carta A4 (PDF)",
    ficheiro: "impressao/papel-de-carta.pdf",
    tipo: "PDF",
    medidaLabel: "210×297 mm (A4)",
    widthMm: 210,
    heightMm: 297,
    pages: 1,
    nota: "Cabeçalho com estilo, miolo branco para se escrever, rodapé com contactos e o campo NIF. Se o NIF vier vazio, o campo fica para preencher.",
    fonteNome: "ISO 216",
    fonteUrl: "https://www.iso.org/obp/ui#iso:std:iso:216:ed-2:en",
  },
  {
    id: "guia-pdf",
    categoria: "guia",
    nome: "Guia de marca de uma página (PDF)",
    ficheiro: "guia-de-marca/guia-de-marca.pdf",
    tipo: "PDF",
    medidaLabel: "210×297 mm (A4, 1 página)",
    widthMm: 210,
    heightMm: 297,
    pages: 1,
    nota: "Variantes, cinco cores com HEX e RGB, e o par de tipos.",
    fonteNome: "ISO 216",
    fonteUrl: "https://www.iso.org/obp/ui#iso:std:iso:216:ed-2:en",
  },
  {
    id: "meta-paleta-json",
    categoria: "metadados",
    nome: "Paleta de cores (JSON)",
    ficheiro: "paleta/paleta.json",
    tipo: "JSON",
    medidaLabel: "—",
    nota: "Cores do kit em HEX e RGB.",
  },
  {
    id: "meta-paleta-svg",
    categoria: "metadados",
    nome: "Amostra visual da paleta (SVG)",
    ficheiro: "paleta/amostra.svg",
    tipo: "SVG",
    medidaLabel: "—",
    nota: "Amostra visual da paleta em formato vectorial.",
  },
  {
    id: "meta-tipos-txt",
    categoria: "metadados",
    nome: "Informação tipográfica (TXT)",
    ficheiro: "tipografia/tipos.txt",
    tipo: "TXT",
    medidaLabel: "—",
    nota: "Nomes das famílias, pesos e ligação para o par no Google Fonts.",
  },
  {
    id: "meta-leiame",
    categoria: "metadados",
    nome: "Guia de utilização do kit (LEIA-ME)",
    ficheiro: "LEIA-ME.txt",
    tipo: "TXT",
    medidaLabel: "—",
    nota: "Explica o conteúdo do ZIP, em pt-PT.",
  },
];

export function slugifyBrandName(nome: string): string {
  const clean = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "marca";
}
