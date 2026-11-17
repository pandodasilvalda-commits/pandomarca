import {
  TOM_DA_MARCA_SPECS,
  type TomDaMarca,
} from "../config/redes-sociais";
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

function isBrandPalette(
  paleta: BrandPalette | BrandPaletteHex
): paleta is BrandPalette {
  return (
    "primaria" in paleta &&
    typeof paleta.primaria === "object" &&
    paleta.primaria !== null &&
    "hex" in paleta.primaria
  );
}

/**
 * Extrai e normaliza o ADN visual do logótipo escolhido (formas, tom da marca, estilo e paleta)
 * para ser passado como referência obrigatória nos pedidos de geração de imagem seguintes.
 */
export function buildLogoVisualDna(params: {
  nome?: string;
  sector?: SectorId;
  tom?: TomDaMarca;
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

  const tom: TomDaMarca =
    params.tom && params.tom in TOM_DA_MARCA_SPECS ? params.tom : "tradicional";
  const tomSpec = TOM_DA_MARCA_SPECS[tom];

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
    fixture.includes("logo") &&
    !isModernFixture &&
    ((params.nome || "").toLowerCase().includes("vilari") ||
      !params.nome ||
      sector === "restauracao")
  ) {
    return {
      estiloDirecao: "classico",
      tom,
      formasPrincipais:
        "emblema abobadado de forno tradicional com espiga de trigo dourada central e tipografia serifada editorial clássica",
      motivosGraficos: [
        "arco de forno",
        "espiga de trigo",
        "terracota",
        "ocre dourado",
        `tom ${tomSpec.nome.toLowerCase()}`,
      ],
      estiloEstetico: `${tomSpec.direcaoEstetica} Aplicado com calor artesanal em terracota e ocre sobre creme.`,
      paletaDescricao: formatPaletteDescription(paletaHex),
      paletaHex,
      fixtureLogoOrigem: params.fixtureLogoOrigem || "docs/referencias/ia-aprovada/logo.jpg",
      isDarkMonochrome: Boolean(params.isDarkMonochrome),
    };
  }

  if (isModernFixture) {
    return {
      estiloDirecao: "moderno",
      tom,
      formasPrincipais:
        "bloco escuro espresso contrastado com fotografia editorial em arco dourado e emblema minimalista luminoso",
      motivosGraficos: [
        "arco contemporâneo em camadas",
        "contraste espresso e dourado",
        `tom ${tomSpec.nome.toLowerCase()}`,
      ],
      estiloEstetico: `${tomSpec.direcaoEstetica} Composição moderna em camadas com tipografia firme e área fotográfica limpa.`,
      paletaDescricao: formatPaletteDescription(paletaHex),
      paletaHex,
      fixtureLogoOrigem: params.fixtureLogoOrigem || "docs/referencias/ia-aprovada/capa-moderna.jpg",
      isDarkMonochrome: Boolean(params.isDarkMonochrome),
    };
  }

  const proporcaoNota =
    params.aspectRatio && params.aspectRatio > 1.4
      ? "símbolo emblemático equilibrado com silhueta limpa"
      : "marca compacta centrada com emblema legível a 40 px";

  const sectorFormasMap: Record<SectorId, string[]> = {
    restauracao: ["arco quente e mesa artesanal", "luz acolhedora de ofício"],
    saude: ["arco orgânico limpo", "equilíbrio sereno"],
    servicos: ["geometria estruturada", "eixos tipográficos nítidos"],
    comercio: ["selo editorial limpo", "montra equilibrada"],
    tecnologia: ["grelha geométrica precisa", "contraste contemporâneo"],
    beleza: ["curva fluida orgânica", "moldura suave"],
    construcao: ["geometria angular sólida", "proporção arquitetónica"],
    educacao: ["pórtico claro estruturado", "contraste legível"],
    outro: ["formas emblemáticas limpas do logótipo", "enquadramento de alto contraste"],
  };

  return {
    estiloDirecao: params.estiloDirecao || (tom === "jovem" || tom === "tecnico" ? "moderno" : "classico"),
    tom,
    formasPrincipais: `${proporcaoNota} para ${params.nome || sectorLabel}${keywords ? ` (${keywords})` : ""}`,
    motivosGraficos: [
      ...(sectorFormasMap[sector] || sectorFormasMap.outro),
      `tom ${tomSpec.nome.toLowerCase()}`,
      params.isDarkMonochrome ? "contraste monocromático nítido" : "paleta fiel ao logótipo",
    ],
    estiloEstetico: `${tomSpec.direcaoEstetica} Identidade visual para ${sectorLabel} fiel ao logótipo de referência.`,
    paletaDescricao: formatPaletteDescription(paletaHex),
    paletaHex,
    fixtureLogoOrigem: params.fixtureLogoOrigem,
    isDarkMonochrome: Boolean(params.isDarkMonochrome),
  };
}
