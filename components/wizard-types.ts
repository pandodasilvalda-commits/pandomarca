import type {
  BrandData,
  BrandPalette,
  FontPairId,
  FormatCategory,
  StyleGroupOverrides,
  StyleId,
} from "@/lib/formats";
import type { PaletteAndTypeProposal } from "@/lib/palette";
import type { DraftMeta, KitMeta } from "@/lib/storage";
import type {
  LogoPropostaIA,
  OrcamentoKitEstado,
  PublicImagemConfig,
} from "@/lib/imagem";
import type { CoverLayoutId, CoverLayoutSpec } from "@/lib/capas/catalog";
import type { CoverAuditInfo } from "@/lib/capas/composer";
import type {
  FinalVariantsA,
  ReferenceItemInput,
  StudioLogoOption,
  DirectionId,
} from "@/lib/logo-generator/svg-studio";

export type WizardStepId =
  | "acesso"
  | "dados"
  | "logotipo"
  | "vetor"
  | "paleta"
  | "capas"
  | "previsualizacao"
  | "zip";

export interface WizardStepMeta {
  id: WizardStepId;
  numero: number;
  rotuloCurto: string;
  titulo: string;
}

export const WIZARD_STEPS: WizardStepMeta[] = [
  { id: "acesso", numero: 1, rotuloCurto: "Acesso", titulo: "Código de acesso" },
  { id: "dados", numero: 2, rotuloCurto: "Dados", titulo: "Dados do negócio" },
  { id: "logotipo", numero: 3, rotuloCurto: "Logótipo", titulo: "Criar ou carregar logótipo" },
  { id: "vetor", numero: 4, rotuloCurto: "Vetor", titulo: "Confirmar vetor" },
  { id: "paleta", numero: 5, rotuloCurto: "Paleta", titulo: "Paleta e tipos" },
  { id: "capas", numero: 6, rotuloCurto: "Capas", titulo: "Capas em camadas" },
  {
    id: "previsualizacao",
    numero: 7,
    rotuloCurto: "Pré-visualizar",
    titulo: "Pré-visualização (36 peças)",
  },
  { id: "zip", numero: 8, rotuloCurto: "ZIP", titulo: "Descarregar ZIP" },
];

export interface VetorClientState {
  colorSvg: string;
  simboloSvg: string;
  simboloNegativoSvg?: string;
  monocromaticoSvg: string;
  negativoSvg: string;
  negativoTransparenteSvg: string;
  previewDataUrl: string;
  preview32DataUrl: string;
  byteSize: number;
  maxBytes: number;
  under200Kb: boolean;
  colorsHex: string[];
  colorsCount: number;
  within8Colors: boolean;
  pathCount: number;
  width: number;
  height: number;
  backgroundRemoved: boolean;
  engine: "vtracer+potrace" | "svg-cleaned";
}

export interface CapaPreviewItem {
  spec: CoverLayoutSpec;
  previewDataUrl: string;
  audit: CoverAuditInfo;
}

export interface StudioSessionSnapshot {
  version: 2;
  step: WizardStepId;
  entradaEscolhida: "A" | "B";
  sessaoId: string;
  dados: BrandData;
  tresPalavras: string;
  coresPreferidas: string;
  coresEvitar: string;
  rondaAtual: number;
  ajustesUsados: number;
  draft: DraftMeta | null;
  variantesFinaisA: FinalVariantsA | null;
  propostas: PaletteAndTypeProposal[];
  selectedProposalId: string;
  showAllProposals: boolean;
  customPalette: BrandPalette;
  selectedFontPair: FontPairId;
  capaRound: number;
  showAllCapas: boolean;
  selectedCoverLayoutId: CoverLayoutId;
  kitStyle: StyleId;
  showKitCatalog: boolean;
  styleOverrides: StyleGroupOverrides;
  generatedKit: KitMeta | null;
  activeResultCategory: FormatCategory | "todas";
  // Campos opcionais ligeiros quando cabem na sessão
  propostasIA?: [LogoPropostaIA, LogoPropostaIA] | null;
  chosenLogoOriginalDataUrl?: string;
  chosenLogoFixtureNome?: string;
  chosenLogoEstilo?: "classico" | "moderno";
  vetorState?: VetorClientState | null;
  orcamento?: OrcamentoKitEstado | null;
  imagemConfig?: PublicImagemConfig | null;
  chosenDirectionId?: DirectionId;
  referenciasCount?: number;
}

export type ReserveStudioState = {
  direcoesA: [StudioLogoOption, StudioLogoOption] | null;
  chosenDirectionId: DirectionId;
  refinamentoRound: number;
  refinamentoOpcoes: [StudioLogoOption, StudioLogoOption] | null;
  chosenRefinedOption: StudioLogoOption | null;
  referencias: ReferenceItemInput[];
};
