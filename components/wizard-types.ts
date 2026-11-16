import type {
  BrandData,
  BrandPalette,
  FontPairId,
  FormatCategory,
  StyleGroupOverrides,
  StyleId,
} from "@/lib/formats";
import type { SafeZoneAuditResult } from "@/lib/capas/safe-zone";
import type { RedeSocialId, TomDaMarca } from "@/lib/config/redes-sociais";
import type { PaletteAndTypeProposal } from "@/lib/palette";
import type { DraftMeta, KitMeta } from "@/lib/storage";
import type {
  LogoPropostaIA,
  OrcamentoKitEstado,
  PublicImagemConfig,
} from "@/lib/imagem";

export type WizardStepId =
  | "acesso"
  | "dados"
  | "logotipo"
  | "paleta"
  | "propostas"
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
  {
    id: "dados",
    numero: 2,
    rotuloCurto: "Dados & Tom",
    titulo: "Dados da marca e tom visual",
  },
  {
    id: "logotipo",
    numero: 3,
    rotuloCurto: "Logótipo",
    titulo: "Gerar ou carregar logótipo",
  },
  {
    id: "paleta",
    numero: 4,
    rotuloCurto: "Paleta",
    titulo: "Paleta e tipografia",
  },
  {
    id: "propostas",
    numero: 5,
    rotuloCurto: "Propostas",
    titulo: "Peças visuais da marca (Moderna + Clássica)",
  },
  {
    id: "previsualizacao",
    numero: 6,
    rotuloCurto: "Pré-visualizar",
    titulo: "Pré-visualização (38 peças)",
  },
  { id: "zip", numero: 7, rotuloCurto: "ZIP", titulo: "Descarregar ZIP" },
];

export interface PecaPropostaPreview {
  id: string;
  redeId: RedeSocialId;
  estiloVisual: "moderno" | "classico";
  tituloProposta: string;
  previewDataUrl: string;
  width: number;
  height: number;
  origem: string;
  fixtureNome?: string;
  aspectRatioGemini: string;
  referenciaLogoUsada: boolean;
  textosPedidos: string[];
  avisoTextos: string;
  audit: SafeZoneAuditResult;
}

export interface StudioSessionSnapshot {
  version: 3;
  step: WizardStepId;
  entradaEscolhida: "A" | "B";
  sessaoId: string;
  dados: BrandData;
  tom: TomDaMarca;
  usarVetorizacaoOpcional: boolean;
  estiloVisual: "moderno" | "classico";
  tresPalavras: string;
  coresPreferidas: string;
  coresEvitar: string;
  rondaAtual: number;
  ajustesUsados: number;
  draft: DraftMeta | null;
  propostas: PaletteAndTypeProposal[];
  selectedProposalId: string;
  showAllProposals: boolean;
  customPalette: BrandPalette;
  selectedFontPair: FontPairId;
  kitStyle: StyleId;
  styleOverrides: StyleGroupOverrides;
  generatedKit: KitMeta | null;
  activeResultCategory: FormatCategory | "todas";
  propostasIA?: [LogoPropostaIA, LogoPropostaIA] | null;
  chosenLogoOriginalDataUrl?: string;
  chosenLogoFixtureNome?: string;
  chosenLogoEstilo?: "classico" | "moderno";
  orcamento?: OrcamentoKitEstado | null;
  imagemConfig?: PublicImagemConfig | null;
}
