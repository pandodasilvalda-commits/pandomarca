import {
  BrandPalette,
  BrandPaletteHex,
  SECTORS,
  SectorId,
} from "../formats";
import type { LogoVisualDna } from "./types";

function formatPaletteDescription(paletaHex: BrandPaletteHex): string {
  return [
    `primária ${paletaHex.primaria}`,
    `secundária ${paletaHex.secundaria}`,
    `papel ${paletaHex.papel}`,
    `tinta ${paletaHex.tinta}`,
  ].join(", ");
}

function isBrandPalette(paleta: BrandPalette | BrandPaletteHex): paleta is BrandPalette {
  return (
    "primaria" in paleta &&
    typeof paleta.primaria === "object" &&
    paleta.primaria !== null &&
    "hex" in paleta.primaria
  );
}

/**
 * Extrai e normaliza o ADN visual do logótipo escolhido (formas, estilo e paleta)
 * para ser passado como referência direta nos prompts e geradores de capas e publicações.
 */
export function buildLogoVisualDna(params: {
  nome?: string;
  sector?: SectorId;
  paleta: BrandPalette | BrandPaletteHex;
  estiloDirecao?: "classico" | "moderno" | "editorial";
  fixtureLogoOrigem?: string;
  tresPalavras?: string;
  aspectRatio?: number;
  isDarkMonochrome?: boolean;
}): LogoVisualDna {
  const paletaHex: BrandPaletteHex = isBrandPalette(params.paleta)
    ? {
        primaria: params.paleta.primaria.hex,
        secundaria: params.paleta.secundaria.hex,
        papel: params.paleta.papel.hex,
        tinta: params.paleta.tinta.hex,
      }
    : params.paleta;

  const fixture = (params.fixtureLogoOrigem || "").toLowerCase();
  const isModernFixture =
    params.estiloDirecao === "moderno" ||
    fixture.includes("moderno") ||
    paletaHex.primaria.toUpperCase() === "#172E2C" ||
    paletaHex.primaria.toUpperCase() === "#0F3D3E" ||
    paletaHex.primaria.toUpperCase() === "#1E293B";

  const sector: SectorId =
    params.sector && params.sector in SECTORS ? params.sector : "restauracao";
  const sectorLabel = SECTORS[sector].rotulo;
  const keywords = (params.tresPalavras || "").trim();

  if (
    fixture.includes("logo-classico") ||
    fixture.includes("logo-ajuste") ||
    (!isModernFixture &&
      (fixture ||
        (params.nome || "").toLowerCase().includes("vilariça") ||
        (params.nome || "").toLowerCase().includes("vilarica") ||
        sector === "restauracao"))
  ) {
    const isClassicForno =
      !fixture ||
      fixture.includes("classico") ||
      fixture.includes("ajuste") ||
      (params.nome || "").toLowerCase().includes("vilari");

    if (isClassicForno && !isModernFixture) {
      return {
        estiloDirecao: "classico",
        formasPrincipais:
          "arco de forno abobadado tradicional, espiga de trigo central erguida, base horizontal de tijolo refratário, silhueta limpa em três massas",
        motivosGraficos: [
          "arco de forno",
          "espiga de trigo",
          "terracota",
          "ocre dourado",
          "pão artesanal em forno a lenha",
        ],
        estiloEstetico:
          "ofício tradicional português com calor artesanal, gravura geométrica limpa em terracota e ocre sobre papel creme",
        paletaDescricao: formatPaletteDescription(paletaHex),
        paletaHex,
        fixtureLogoOrigem: params.fixtureLogoOrigem || "logo-classico-amostra.png",
      };
    }
  }

  if (isModernFixture) {
    return {
      estiloDirecao: "moderno",
      formasPrincipais:
        "monograma geométrico inserido em bloco quadrado de cantos arredondados, filete vertical preciso e barra horizontal dourada",
      motivosGraficos: [
        "monograma geométrico",
        "bloco quadrado suave",
        "filete dourado",
        "linhas arquitetónicas contemporâneas",
      ],
      estiloEstetico:
        "design contemporâneo limpo e arquitetónico de alto contraste em verde pinheiro e dourado sobre pedra clara",
      paletaDescricao: formatPaletteDescription(paletaHex),
      paletaHex,
      fixtureLogoOrigem: params.fixtureLogoOrigem || "logo-moderno-amostra.png",
    };
  }

  // Qualquer outro logótipo carregado ou personalizado (Entrada B / outros setores)
  const proporcaoNota =
    params.aspectRatio && params.aspectRatio > 1.4
      ? "símbolo emblemático equilibrado à esquerda com silhueta limpa"
      : "marca centrada compacta de formas fechadas";

  const sectorFormasMap: Record<SectorId, string[]> = {
    restauracao: ["forma orgânica de mesa e forno", "textura artesanal quente", "detalhe botânico simples"],
    saude: ["arco suave contínuo", "folha ou escudo orgânico limpo", "luz serena equilibrada"],
    servicos: ["formas modulares de precisão", "filetes paralelos estruturados", "equilíbrio tipográfico limpo"],
    comercio: ["selos limpos", "etiqueta dobrada geométrica", "contorno nítido de montra"],
    tecnologia: ["grelha geométrica nítida", "módulos conectados de precisão", "traço limpo contemporâneo"],
    beleza: ["arco botânico fluido", "curva contínua orgânica", "pétala minimalista"],
    construcao: ["geometria estrutural angular", "linhas de prumo e esquadria", "bloco arquitetónico sólido"],
    educacao: ["livro ou pórtico estilizado", "geometria clara e acessível", "traço aberto estruturado"],
    outro: ["formas geométricas da silhueta do logótipo", "enquadramento limpo de alto contraste"],
  };

  const motivos = [
    ...(sectorFormasMap[sector] || sectorFormasMap.outro),
    ...(keywords ? [keywords] : []),
    params.isDarkMonochrome ? "gravura monocromática nítida" : "harmonia cromática fiel ao símbolo",
  ];

  return {
    estiloDirecao: params.estiloDirecao || "editorial",
    formasPrincipais: `${proporcaoNota}, derivada diretamente do símbolo e traço do logótipo de ${params.nome || sectorLabel}${keywords ? ` (${keywords})` : ""}`,
    motivosGraficos: motivos,
    estiloEstetico: `identidade visual coesa para ${sectorLabel} com linguagem plástica idêntica à do logótipo carregado`,
    paletaDescricao: formatPaletteDescription(paletaHex),
    paletaHex,
    fixtureLogoOrigem: params.fixtureLogoOrigem,
  };
}
