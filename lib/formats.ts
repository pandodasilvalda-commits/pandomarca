import {
  REDES_SOCIAIS_LIST,
  REFERENCE_DATE_REDES_PT,
  TomDaMarca,
} from "./config/redes-sociais";

export type { TomDaMarca };

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
  tom?: TomDaMarca;
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
    descricao:
      "Facebook (1640×624), X (1500×500), YouTube (2560×1440 zona segura 1546×423), LinkedIn e Google Perfil de Empresa",
  },
  {
    key: "publicacao",
    rotulo: "Publicações de Instagram",
    descricao: "Formatos vertical 1080×1350 (4:5) e quadrado 1080×1080 (1:1) para o feed",
  },
  {
    key: "story",
    rotulo: "Story de Instagram",
    descricao: "Formato vertical 1080×1920 px (9:16) com margens de 250 px livres no topo e na base",
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

export const REFERENCE_DATE_PT = REFERENCE_DATE_REDES_PT;

const REDES_FORMAT_SPECS: FormatSpec[] = REDES_SOCIAIS_LIST.map((r) => ({
  id: r.id,
  categoria: "redes",
  styleGroup: r.styleGroup,
  nome: r.nome,
  ficheiro: r.ficheiro,
  tipo: "PNG",
  medidaLabel: r.medidaLabel,
  widthPx: r.widthPx,
  heightPx: r.heightPx,
  opaque: r.opaque,
  circularSafeZone: r.isCircle || undefined,
  nota: r.nota,
  fonteNome: r.fonteNome,
  fonteUrl: r.fonteUrl,
}));

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
    nota: "Símbolo ou ícone isolado a partir da imagem gerada ou carregada.",
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
    nota: "Versão horizontal de apresentação derivada do logótipo aprovado.",
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

  // 2. Redes e perfis (18 — fonte única em lib/config/redes-sociais.ts)
  ...REDES_FORMAT_SPECS,

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
