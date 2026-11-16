import fs from "fs";
import path from "path";
import type { SectorId, StyleId } from "../formats";

export type CoverLayoutCategoria = "moderno" | "classico";

export type CoverLayoutId =
  | "moderno-texto-atras"
  | "moderno-recorte"
  | "moderno-monolito"
  | "classico-moldura"
  | "classico-rotulo"
  | "classico-informativo";

export interface CoverLayoutSpec {
  id: CoverLayoutId;
  nome: string;
  categoria: CoverLayoutCategoria;
  descricao: string;
  estiloSugerido: StyleId;
  camadas: string[];
  fundo: {
    tipo: "solido_paleta" | "degrade_suave" | "degrade_primaria" | "textura_papel";
    baseCor: "primaria" | "secundaria" | "papel" | "tinta";
    acentoCor: "primaria" | "secundaria" | "papel" | "tinta";
    usaFotoDeFundo: boolean;
  };
  padrao: {
    motivo:
      | "linhas-obliquas"
      | "grelha-pontos"
      | "arcos-minimal"
      | "malha-classica"
      | "arco-linha-fina"
      | "linhas-editorial";
    opacidade: number;
    escala: number;
  };
  tipografiaGrande: {
    habilitada: boolean;
    origem: "primeira_palavra_marca" | "iniciais_ou_sector";
    alinhamento: "left" | "center" | "right";
    opacidade: number;
    escalaAltura: number;
    peso: number;
    cor: "primaria" | "secundaria" | "papel" | "tinta";
  };
  objetoRecortado: {
    habilitado: boolean;
    posicao: string;
    larguraRatio: number;
    alturaRatio: number;
    sobrepoeTipografiaGrande: boolean;
    nuncaSobrepoeLogo: boolean;
  };
  molduraRecorte: {
    tipo:
      | "faixa_inferior"
      | "recorte_arco_margem"
      | "circulo_corte"
      | "moldura_dupla_e_faixa_creme"
      | "emblema_rotulo_arco"
      | "barra_editorial_e_selo";
    lado?: string;
    larguraFotoRatio?: number;
    cor?: string;
    corBorda?: string;
    corFaixa?: string;
    corFundoCartao?: string;
    corRodape?: string;
    espessuraPx?: number;
  };
  logotipo: {
    posicao: string;
    alturaMinRatio: number;
    alturaAlvoRatio: number;
    larguraMaxRatio: number;
  };
  textosReais: {
    posicao: string;
    mostrarNomeSeLogoTemTexto: boolean;
    mostrarSlogan: boolean;
    mostrarServicos: boolean;
    mostrarLocalidade: boolean;
    mostrarContactos: boolean;
  };
}

const LAYOUTS_ORDER: CoverLayoutId[] = [
  "moderno-texto-atras",
  "moderno-recorte",
  "moderno-monolito",
  "classico-moldura",
  "classico-rotulo",
  "classico-informativo",
];

const LAYOUTS_DIR = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "lib",
  "capas",
  "layouts"
);

const FIXTURES_DIR = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "tests",
  "fixtures"
);

let cachedLayouts: CoverLayoutSpec[] | null = null;
const fixtureCache = new Map<string, Buffer>();

export function getAllCoverLayouts(): CoverLayoutSpec[] {
  if (cachedLayouts) return cachedLayouts;

  const loaded: CoverLayoutSpec[] = [];
  for (const id of LAYOUTS_ORDER) {
    const filePath = path.join(/*turbopackIgnore: true*/ LAYOUTS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as CoverLayoutSpec;
      loaded.push(parsed);
    }
  }

  // Também carrega quaisquer outros layouts JSON extras se existirem
  if (fs.existsSync(LAYOUTS_DIR)) {
    for (const file of fs.readdirSync(LAYOUTS_DIR)) {
      if (!file.endsWith(".json")) continue;
      const base = file.replace(/\.json$/, "") as CoverLayoutId;
      if (!LAYOUTS_ORDER.includes(base)) {
        const parsed = JSON.parse(
          fs.readFileSync(path.join(/*turbopackIgnore: true*/ LAYOUTS_DIR, file), "utf8")
        ) as CoverLayoutSpec;
        loaded.push(parsed);
      }
    }
  }

  cachedLayouts = loaded;
  return loaded;
}

export function getCoverLayoutById(id: string): CoverLayoutSpec | null {
  const all = getAllCoverLayouts();
  return all.find((l) => l.id === id) || null;
}

export function getDefaultCoverLayoutIdForStyle(style: StyleId): CoverLayoutId {
  switch (style) {
    case "fotografia":
      return "moderno-recorte";
    case "degrade":
      return "moderno-monolito";
    case "minimal":
      return "classico-moldura";
    case "padrao":
      return "classico-rotulo";
    case "informativo":
      return "classico-informativo";
    case "liso":
    default:
      return "moderno-texto-atras";
  }
}

/**
 * Regra obrigatória das capas em camadas:
 * Devolve SEMPRE 2 propostas onde 1 é Moderna e 1 é Clássica,
 * com layouts e imagens/fundos claramente distintos entre si.
 */
export function getCoverProposalsPair(params?: {
  round?: number;
  sector?: SectorId;
}): [CoverLayoutSpec, CoverLayoutSpec] {
  const all = getAllCoverLayouts();
  const modernos = all.filter((l) => l.categoria === "moderno");
  const classicos = all.filter((l) => l.categoria === "classico");

  if (modernos.length === 0 || classicos.length === 0) {
    throw new Error("Catálogo de capas incompleto: requer layouts modernos e clássicos.");
  }

  const r = Math.max(1, params?.round || 1);
  // Pares distintos garantidos: 1 moderno + 1 clássico
  const pairSchedule: [CoverLayoutId, CoverLayoutId][] = [
    ["moderno-texto-atras", "classico-moldura"],
    ["moderno-recorte", "classico-rotulo"],
    ["moderno-monolito", "classico-informativo"],
  ];

  // Se o sector favorece fotografia na primeira ronda, prioriza moderno-recorte vs classico-moldura
  const idx =
    r === 1 && params?.sector === "restauracao"
      ? 1
      : (r - 1) % pairSchedule.length;

  const [modId, clasId] =
    idx === 1 && r === 1 && params?.sector === "restauracao"
      ? (["moderno-recorte", "classico-moldura"] as [CoverLayoutId, CoverLayoutId])
      : pairSchedule[idx];

  const mod = getCoverLayoutById(modId) || modernos[0];
  const clas = getCoverLayoutById(clasId) || classicos[0];

  return [mod, clas];
}

export function loadCoverAssetBuffer(
  filename: "fundo-padaria-tradicional.png" | "fundo-papel-artesanal.png" | "objeto-pao-recortado.png"
): Buffer | undefined {
  const cached = fixtureCache.get(filename);
  if (cached) return cached;
  const fullPath = path.join(/*turbopackIgnore: true*/ FIXTURES_DIR, filename);
  if (!fs.existsSync(fullPath)) return undefined;
  const buf = fs.readFileSync(fullPath);
  fixtureCache.set(filename, buf);
  return buf;
}
