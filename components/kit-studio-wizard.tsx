"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  Eye,
  FileArchive,
  FileText,
  KeyRound,
  Layers,
  Loader2,
  Palette,
  PenTool,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import {
  BrandData,
  BrandPalette,
  CONTENT_STYLES,
  Entitlement,
  FONT_PAIRS,
  FontPairId,
  FORMAT_SPECS,
  FormatCategory,
  SECTORS,
  SectorId,
  STYLE_GROUPS,
  StyleId,
  StyleGroupOverrides,
} from "@/lib/formats";
import { buildBrandPalette, PaletteAndTypeProposal } from "@/lib/palette";
import { SAMPLE_BRANDS } from "@/lib/samples";
import type { DraftMeta, KitMeta } from "@/lib/storage";
import type {
  LogoPropostaIA,
  OrcamentoKitEstado,
  PublicImagemConfig,
} from "@/lib/imagem";
import type { CoverLayoutId } from "@/lib/capas/catalog";
import type {
  DirectionId,
  FinalVariantsA,
  ReferenceItemInput,
  StudioLogoOption,
} from "@/lib/logo-generator/svg-studio";
import {
  CapaPreviewItem,
  StudioSessionSnapshot,
  VetorClientState,
  WIZARD_STEPS,
  WizardStepId,
} from "./wizard-types";

const SESSION_STORAGE_KEY = "pandomarca:studio:v2";

const DEFAULT_BRAND_DATA: BrandData = {
  nome: "",
  sector: "restauracao",
  simbolo: false,
  slogan: "",
  pessoa: "",
  cargo: "",
  email: "",
  telefone: "",
  website: "",
  morada: "",
  nif: "",
  servicos: "",
};

const DEFAULT_PALETTE = buildBrandPalette({
  primaria: "#B84A24",
  secundaria: "#D9822B",
  papel: "#FAF6F0",
  tinta: "#2A1810",
});

const DEFAULT_STYLE_OVERRIDES: StyleGroupOverrides = {
  capas: "degrade",
  publicacao: "padrao",
  story: "degrade",
  cartao: "liso",
  papel: "informativo",
  assinatura: "informativo",
};

const DEFAULT_IMAGEM_CONFIG: PublicImagemConfig = {
  modo: "falso",
  fornecedor: "local",
  limitePorKitEur: 1.5,
  maxRondas: 3,
  maxAjustes: 3,
  semCustosReais: true,
  etiquetaModo: "Modo de demonstração",
};

const SAMPLE_BAKERY_PHOTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="warmOven" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B1D0E" />
      <stop offset="50%" stop-color="#8B3A1A" />
      <stop offset="100%" stop-color="#D9822B" />
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#warmOven)" />
  <circle cx="920" cy="240" r="280" fill="#F59E0B" fill-opacity="0.28" />
  <ellipse cx="420" cy="560" rx="340" ry="180" fill="#A14A20" fill-opacity="0.6" />
  <ellipse cx="780" cy="620" rx="280" ry="150" fill="#6E2C11" fill-opacity="0.65" />
</svg>`;

function svgToDataUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:image/svg+xml;base64,${btoa(bin)}`;
}

function makeSessaoId(): string {
  return `pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function persistSnapshotSafely(snapshot: StudioSessionSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Se imagens base64 excederem a quota do sessionStorage, guarda o estado leve essencial sem falhar
    try {
      const compact: StudioSessionSnapshot = {
        ...snapshot,
        propostasIA: null,
        chosenLogoOriginalDataUrl: undefined,
        vetorState: snapshot.vetorState
          ? {
              ...snapshot.vetorState,
              previewDataUrl: "",
            }
          : null,
      };
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // Ignora silenciosamente se storage estiver indisponível
    }
  }
}

export function KitStudioWizard() {
  const searchParams = useSearchParams();

  // 1. Estado de acesso e configuração pública
  const [authChecking, setAuthChecking] = useState(true);
  const [envConfigured, setEnvConfigured] = useState(true);
  const [missingVars, setMissingVars] = useState<string[]>([]);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [imagemConfig, setImagemConfig] = useState<PublicImagemConfig>(DEFAULT_IMAGEM_CONFIG);
  const [codigoInput, setCodigoInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // 2. Navegação, espera e recuperação de erro
  const [step, setStep] = useState<WizardStepId>("acesso");
  const [entradaEscolhida, setEntradaEscolhida] = useState<"A" | "B">(() =>
    searchParams?.get("entrada") === "B" ? "B" : "A"
  );
  const [sessaoId, setSessaoId] = useState<string>(makeSessaoId);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [busyDetail, setBusyDetail] = useState<string | null>(null);
  const retryActionRef = useRef<(() => Promise<void>) | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const hydratedRef = useRef(false);

  // 3. Dados do negócio
  const [dados, setDados] = useState<BrandData>(DEFAULT_BRAND_DATA);
  const [tresPalavras, setTresPalavras] = useState("");
  const [coresPreferidas, setCoresPreferidas] = useState("");
  const [coresEvitar, setCoresEvitar] = useState("");
  const [referencias, setReferencias] = useState<ReferenceItemInput[]>([]);

  // 4. Fluxo de logótipo com IA (e reserva SVG)
  const [rondaAtual, setRondaAtual] = useState<number>(1);
  const [ajustesUsados, setAjustesUsados] = useState<number>(0);
  const [orcamento, setOrcamento] = useState<OrcamentoKitEstado | null>(null);
  const [propostasIA, setPropostasIA] = useState<[LogoPropostaIA, LogoPropostaIA] | null>(null);
  const [ajustarAlvoId, setAjustarAlvoId] = useState<string | null>(null);
  const [ajusteInstrucao, setAjusteInstrucao] = useState("");
  const [chosenLogoOriginalDataUrl, setChosenLogoOriginalDataUrl] = useState<string>("");
  const [chosenLogoFixtureNome, setChosenLogoFixtureNome] = useState<string>("");
  const [chosenLogoEstilo, setChosenLogoEstilo] = useState<"classico" | "moderno">("classico");

  // Reserva SVG por regras (caso o utilizador opte explicitamente pela reserva)
  const [usarReservaSvg, setUsarReservaSvg] = useState(false);
  const [direcoesReserva, setDirecoesReserva] = useState<[StudioLogoOption, StudioLogoOption] | null>(null);
  const [chosenDirectionId, setChosenDirectionId] = useState<DirectionId>("classica");
  const [refinamentoRound, setRefinamentoRound] = useState<number>(1);
  const [refinamentoOpcoes, setRefinamentoOpcoes] = useState<[StudioLogoOption, StudioLogoOption] | null>(null);

  // Entrada B (ficheiro existente)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<DraftMeta | null>(null);

  // 5. Ecrã Confirmar Vetor (vtracer + potrace)
  const [vetorState, setVetorState] = useState<VetorClientState | null>(null);
  const [activeVectorTab, setActiveVectorTab] = useState<"color" | "simbolo" | "mono" | "negativo">("color");
  const [variantesFinaisA, setVariantesFinaisA] = useState<FinalVariantsA | null>(null);

  // 6. Propostas de Paleta e Tipografia
  const [propostas, setPropostas] = useState<PaletteAndTypeProposal[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState<string>("direta");
  const [showAllProposals, setShowAllProposals] = useState(false);
  const [customPalette, setCustomPalette] = useState<BrandPalette>(DEFAULT_PALETTE);
  const [selectedFontPair, setSelectedFontPair] = useState<FontPairId>("clara");

  // 7. Capas em Camadas (1 Moderna + 1 Clássica) & Estilos de Grupo
  const [capaRound, setCapaRound] = useState<number>(1);
  const [showAllCapas, setShowAllCapas] = useState(false);
  const [capasPreviews, setCapasPreviews] = useState<CapaPreviewItem[]>([]);
  const [capasLoading, setCapasLoading] = useState(false);
  const [selectedCoverLayoutId, setSelectedCoverLayoutId] =
    useState<CoverLayoutId>("moderno-recorte");
  const selectedCoverLayoutRef = useRef<CoverLayoutId>("moderno-recorte");
  useEffect(() => {
    selectedCoverLayoutRef.current = selectedCoverLayoutId;
  }, [selectedCoverLayoutId]);
  const [kitStyle, setKitStyle] = useState<StyleId>("degrade");
  const [showKitCatalog, setShowKitCatalog] = useState(false);
  const [styleOverrides, setStyleOverrides] =
    useState<StyleGroupOverrides>(DEFAULT_STYLE_OVERRIDES);
  const [openGroupCatalog, setOpenGroupCatalog] = useState<Record<string, boolean>>({});
  const [showGroupOverridesPanel, setShowGroupOverridesPanel] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>("");
  const [photoFilename, setPhotoFilename] = useState<string>("");

  // 8. Kit gerado, Pré-visualização e ZIP
  const [generatedKit, setGeneratedKit] = useState<KitMeta | null>(null);
  const [activeResultCategory, setActiveResultCategory] =
    useState<FormatCategory | "todas">("todas");

  const setFailure = useCallback(
    (msg: string, retryFn?: () => Promise<void>) => {
      setGlobalError(msg);
      retryActionRef.current = retryFn || null;
      setCanRetry(Boolean(retryFn));
    },
    []
  );

  const clearError = useCallback(() => {
    setGlobalError(null);
    retryActionRef.current = null;
    setCanRetry(false);
  }, []);

  async function handleRetry() {
    const fn = retryActionRef.current;
    clearError();
    if (fn) {
      await fn();
    }
  }

  // Hidratação inicial: valida cookie no servidor e restaura sessão de progresso
  useEffect(() => {
    const paramEntrada = searchParams?.get("entrada");

    fetch("/api/acesso")
      .then((r) => r.json())
      .then((data) => {
        setEnvConfigured(Boolean(data.configured));
        setMissingVars(data.missingVars || []);
        if (data.imagemConfig) {
          setImagemConfig(data.imagemConfig);
        }
        if (paramEntrada === "A" || paramEntrada === "B") {
          setEntradaEscolhida(paramEntrada);
        }
        if (data.authenticated && data.entitlement) {
          setEntitlement(data.entitlement);

          let restoredStep: WizardStepId = "dados";
          if (typeof window !== "undefined") {
            const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (raw) {
              try {
                const snap = JSON.parse(raw) as StudioSessionSnapshot;
                if (snap?.version === 2) {
                  setSessaoId(snap.sessaoId || makeSessaoId());
                  setEntradaEscolhida(
                    paramEntrada === "A" || paramEntrada === "B"
                      ? paramEntrada
                      : snap.entradaEscolhida || "A"
                  );
                  if (snap.dados) setDados(snap.dados);
                  if (typeof snap.tresPalavras === "string") setTresPalavras(snap.tresPalavras);
                  if (typeof snap.coresPreferidas === "string") setCoresPreferidas(snap.coresPreferidas);
                  if (typeof snap.coresEvitar === "string") setCoresEvitar(snap.coresEvitar);
                  if (snap.rondaAtual) setRondaAtual(snap.rondaAtual);
                  if (typeof snap.ajustesUsados === "number") setAjustesUsados(snap.ajustesUsados);
                  if (snap.draft) setDraft(snap.draft);
                  if (snap.variantesFinaisA) setVariantesFinaisA(snap.variantesFinaisA);
                  if (snap.propostas?.length) setPropostas(snap.propostas);
                  if (snap.selectedProposalId) setSelectedProposalId(snap.selectedProposalId);
                  setShowAllProposals(Boolean(snap.showAllProposals));
                  if (snap.customPalette) setCustomPalette(snap.customPalette);
                  if (snap.selectedFontPair) setSelectedFontPair(snap.selectedFontPair);
                  if (snap.capaRound) setCapaRound(snap.capaRound);
                  setShowAllCapas(Boolean(snap.showAllCapas));
                  if (snap.selectedCoverLayoutId) setSelectedCoverLayoutId(snap.selectedCoverLayoutId);
                  if (snap.kitStyle) setKitStyle(snap.kitStyle);
                  setShowKitCatalog(Boolean(snap.showKitCatalog));
                  if (snap.styleOverrides) setStyleOverrides(snap.styleOverrides);
                  if (snap.generatedKit) setGeneratedKit(snap.generatedKit);
                  if (snap.activeResultCategory) setActiveResultCategory(snap.activeResultCategory);
                  if (snap.propostasIA) setPropostasIA(snap.propostasIA);
                  if (snap.chosenLogoOriginalDataUrl) {
                    setChosenLogoOriginalDataUrl(snap.chosenLogoOriginalDataUrl);
                  }
                  if (snap.chosenLogoFixtureNome) {
                    setChosenLogoFixtureNome(snap.chosenLogoFixtureNome);
                  }
                  if (snap.chosenLogoEstilo) {
                    setChosenLogoEstilo(snap.chosenLogoEstilo);
                  }
                  if (snap.vetorState) setVetorState(snap.vetorState);
                  if (snap.orcamento) setOrcamento(snap.orcamento);

                  if (snap.step && snap.step !== "acesso") {
                    restoredStep = snap.step;
                  }
                }
              } catch {
                // sessão corrompida ignorada
              }
            }
          }

          setStep(restoredStep);
        }
      })
      .catch(() => {})
      .finally(() => {
        hydratedRef.current = true;
        setAuthChecking(false);
      });
  }, [searchParams]);

  // Guardar progresso por sessão automaticamente
  useEffect(() => {
    if (!hydratedRef.current || !entitlement) return;
    const snap: StudioSessionSnapshot = {
      version: 2,
      step,
      entradaEscolhida,
      sessaoId,
      dados,
      tresPalavras,
      coresPreferidas,
      coresEvitar,
      rondaAtual,
      ajustesUsados,
      draft,
      variantesFinaisA,
      propostas,
      selectedProposalId,
      showAllProposals,
      customPalette,
      selectedFontPair,
      capaRound,
      showAllCapas,
      selectedCoverLayoutId,
      kitStyle,
      showKitCatalog,
      styleOverrides,
      generatedKit,
      activeResultCategory,
      propostasIA,
      chosenLogoOriginalDataUrl,
      chosenLogoFixtureNome,
      chosenLogoEstilo,
      vetorState,
      orcamento,
      imagemConfig,
      chosenDirectionId,
      referenciasCount: referencias.length,
    };
    persistSnapshotSafely(snap);
  }, [
    entitlement,
    step,
    entradaEscolhida,
    sessaoId,
    dados,
    tresPalavras,
    coresPreferidas,
    coresEvitar,
    rondaAtual,
    ajustesUsados,
    draft,
    variantesFinaisA,
    propostas,
    selectedProposalId,
    showAllProposals,
    customPalette,
    selectedFontPair,
    capaRound,
    showAllCapas,
    selectedCoverLayoutId,
    kitStyle,
    showKitCatalog,
    styleOverrides,
    generatedKit,
    activeResultCategory,
    propostasIA,
    chosenLogoOriginalDataUrl,
    chosenLogoFixtureNome,
    chosenLogoEstilo,
    vetorState,
    orcamento,
    imagemConfig,
    chosenDirectionId,
    referencias.length,
  ]);

  function applySectorDefaultStyles(sector: SectorId, hasPhoto = Boolean(photoDataUrl)) {
    const rec = SECTORS[sector]?.recomendacoes || SECTORS.outro.recomendacoes;
    const pickSafeStyle = (pair: [StyleId, StyleId]): StyleId => {
      if (pair[0] !== "fotografia" || hasPhoto) return pair[0];
      return pair[1] !== "fotografia" ? pair[1] : "degrade";
    };
    const baseStyle = rec.capas[0];
    setKitStyle(baseStyle);
    setStyleOverrides({
      capas: rec.capas[0],
      publicacao: pickSafeStyle(rec.publicacao),
      story: pickSafeStyle(rec.story),
      cartao: pickSafeStyle(rec.cartao),
      papel: pickSafeStyle(rec.papel),
      assinatura: pickSafeStyle(rec.assinatura),
    });
  }

  function applyPresetData(presetId: "forno-da-vilarica" | "oficina-do-sao") {
    const sample = SAMPLE_BRANDS[presetId];
    setDados({ ...sample.dados });
    setTresPalavras(sample.questionarioA.tresPalavras);
    setCoresPreferidas(sample.questionarioA.coresPreferidas);
    setCoresEvitar(sample.questionarioA.coresEvitar);
    setReferencias(
      sample.questionarioA.referencias.map((r) => ({
        nomeFicheiro: r.titulo,
        nota: r.nota,
        dataUrl: svgToDataUrl(r.svg),
      }))
    );
    applySectorDefaultStyles(sample.dados.sector, Boolean(photoDataUrl));
    clearError();
  }

  async function handleAccessSubmit(e?: React.FormEvent, codeOverride?: string) {
    if (e) e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const codigo = codeOverride ?? codigoInput;
      const res = await fetch("/api/acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAuthError(data.error || "Código de acesso inválido.");
        return;
      }
      setEntitlement(data.entitlement);
      setStep("dados");
    } catch {
      setAuthError("Erro de comunicação ao validar o código. Tente novamente.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogoutCode() {
    await fetch("/api/acesso", { method: "DELETE" });
    setEntitlement(null);
    setStep("acesso");
  }

  function handleResetSession() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    setSessaoId(makeSessaoId());
    setDados(DEFAULT_BRAND_DATA);
    setTresPalavras("");
    setCoresPreferidas("");
    setCoresEvitar("");
    setReferencias([]);
    setRondaAtual(1);
    setAjustesUsados(0);
    setOrcamento(null);
    setPropostasIA(null);
    setChosenLogoOriginalDataUrl("");
    setChosenLogoFixtureNome("");
    setChosenLogoEstilo("classico");
    setDraft(null);
    setVetorState(null);
    setVariantesFinaisA(null);
    setPropostas([]);
    setCapasPreviews([]);
    setGeneratedKit(null);
    setCustomPalette(DEFAULT_PALETTE);
    setSelectedFontPair("clara");
    setSelectedCoverLayoutId("moderno-recorte");
    clearError();
    setStep("dados");
  }

  function handleSelectProposal(prop: PaletteAndTypeProposal) {
    setSelectedProposalId(prop.id);
    setCustomPalette(prop.paleta);
    setSelectedFontPair(prop.fontPairId);
  }

  function handleCustomColorChange(
    key: "primaria" | "secundaria" | "papel" | "tinta",
    hexValue: string
  ) {
    const next = buildBrandPalette({
      primaria: key === "primaria" ? hexValue : customPalette.primaria.hex,
      secundaria: key === "secundaria" ? hexValue : customPalette.secundaria.hex,
      papel: key === "papel" ? hexValue : customPalette.papel.hex,
      tinta: key === "tinta" ? hexValue : customPalette.tinta.hex,
    });
    setCustomPalette(next);
  }

  function handleAddReferenceFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remainingSlots = 5 - referencias.length;
    if (remainingSlots <= 0) {
      setFailure("Já atingiu o limite máximo de 5 imagens de referência.");
      return;
    }

    const toProcess = Array.from(files).slice(0, remainingSlots);
    toProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setReferencias((prev) => {
          if (prev.length >= 5) return prev;
          return [
            ...prev,
            {
              nomeFicheiro: file.name,
              nota: "Gosto do equilíbrio visual e clareza da forma.",
              dataUrl: typeof reader.result === "string" ? reader.result : undefined,
            },
          ];
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Entrada A (IA): pedir ronda 1..3 (2 propostas claramente distintas)
  const executeLogoRound = useCallback(
    async (roundNum: number, customSessId?: string) => {
      if (!dados.nome.trim()) {
        setFailure("Indique o nome da marca antes de avançar para o logótipo.");
        return;
      }

      const activeSessId = customSessId || sessaoId;
      clearError();
      setUsarReservaSvg(false);
      setBusyDetail(
        `A gerar 2 propostas distintas de logótipo (Ronda ${roundNum} de ${imagemConfig.maxRondas})…`
      );

      try {
        const res = await fetch("/api/logotipo-raiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acao: "ronda",
            sessaoId: activeSessId,
            ronda: roundNum,
            questionario: {
              nome: dados.nome,
              slogan: dados.slogan,
              sector: dados.sector,
              tresPalavras,
              coresPreferidas,
              coresEvitar,
              simbolo: dados.simbolo,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setFailure(
            data.error || "Não foi possível criar a ronda de logótipos.",
            () => executeLogoRound(roundNum, activeSessId)
          );
          return;
        }

        setPropostasIA(data.propostas);
        setRondaAtual(data.ronda || roundNum);
        if (data.orcamento) setOrcamento(data.orcamento);
        if (data.config) setImagemConfig(data.config);
        setAjustarAlvoId(null);
        setStep("logotipo");
      } catch {
        setFailure(
          "Falha de comunicação ao gerar as propostas de logótipo.",
          () => executeLogoRound(roundNum, activeSessId)
        );
      } finally {
        setBusyDetail(null);
      }
    },
    [
      clearError,
      coresEvitar,
      coresPreferidas,
      dados.nome,
      dados.sector,
      dados.simbolo,
      dados.slogan,
      imagemConfig.maxRondas,
      sessaoId,
      setFailure,
      tresPalavras,
    ]
  );

  // Entrada A (IA): ajustar uma proposta com instrução do cliente
  async function executeAdjustProposal(proposta: LogoPropostaIA, instrucao: string) {
    const cleanInstr = instrucao.trim();
    if (!cleanInstr) {
      setFailure("Escreva uma instrução curta para ajustar a proposta (ex.: «traço mais forte»).");
      return;
    }

    const nextAdj = ajustesUsados + 1;
    clearError();
    setBusyDetail(`A aplicar o ajuste ${nextAdj} de ${imagemConfig.maxAjustes}…`);

    try {
      const res = await fetch("/api/logotipo-raiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "ajustar",
          sessaoId,
          ajusteNumero: nextAdj,
          instrucao: cleanInstr,
          proposta,
          questionario: {
            nome: dados.nome,
            slogan: dados.slogan,
            sector: dados.sector,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFailure(
          data.error || "Não foi possível ajustar esta proposta.",
          () => executeAdjustProposal(proposta, cleanInstr)
        );
        return;
      }

      setPropostasIA((prev) => {
        if (!prev) return prev;
        return prev[0].id === proposta.id
          ? [data.propostaAjustada, prev[1]]
          : [prev[0], data.propostaAjustada];
      });
      setAjustesUsados(nextAdj);
      if (data.orcamento) setOrcamento(data.orcamento);
      setAjustarAlvoId(null);
      setAjusteInstrucao("");
    } catch {
      setFailure(
        "Erro de ligação ao aplicar o ajuste na proposta.",
        () => executeAdjustProposal(proposta, cleanInstr)
      );
    } finally {
      setBusyDetail(null);
    }
  }

  // Vetorizar localmente (gratuito) uma proposta IA ou o ficheiro carregado na Entrada B
  async function executeLocalVectorize(opts: {
    imagemBase64?: string;
    draftId?: string;
    suggestedPaleta?: BrandPalette;
    suggestedFont?: FontPairId;
    titleLabel?: string;
    fixtureNome?: string;
    estiloDirecao?: "classico" | "moderno";
  }) {
    clearError();
    setBusyDetail(
      "A converter o logótipo em vetor limpo (≤ 8 cores) e verificar legibilidade a 32 px…"
    );
    if (opts.suggestedPaleta) {
      setCustomPalette(opts.suggestedPaleta);
    }
    if (opts.suggestedFont) {
      setSelectedFontPair(opts.suggestedFont);
    }
    setChosenLogoFixtureNome(opts.fixtureNome || "");
    if (opts.estiloDirecao) {
      setChosenLogoEstilo(opts.estiloDirecao);
    }

    try {
      const pal = opts.suggestedPaleta || customPalette;
      const res = await fetch("/api/vetorizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "preview",
          sessaoId,
          imagemBase64: opts.imagemBase64,
          draftId: opts.draftId,
          inkHex: pal.tinta.hex,
          maxColors: 8,
          simboloApenas: dados.simbolo,
          paletteHints: [
            pal.primaria.hex,
            pal.secundaria.hex,
            pal.tinta.hex,
            pal.papel.hex,
          ],
          paleta: opts.suggestedPaleta
            ? {
                primaria: opts.suggestedPaleta.primaria.hex,
                secundaria: opts.suggestedPaleta.secundaria.hex,
                papel: opts.suggestedPaleta.papel.hex,
                tinta: opts.suggestedPaleta.tinta.hex,
              }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFailure(
          data.error || "Não foi possível vetorizar o logótipo.",
          () => executeLocalVectorize(opts)
        );
        return;
      }

      if (opts.imagemBase64) {
        setChosenLogoOriginalDataUrl(opts.imagemBase64);
      } else if (opts.draftId) {
        setChosenLogoOriginalDataUrl(`/api/rascunhos/${opts.draftId}`);
      }

      setVetorState(data.vetor);
      if (data.paletaSugerida && !opts.suggestedPaleta) {
        setCustomPalette(data.paletaSugerida);
      }
      if (data.orcamento) setOrcamento(data.orcamento);
      setActiveVectorTab("color");
      setStep("vetor");
    } catch {
      setFailure(
        "Erro de comunicação durante a vetorização do logótipo.",
        () => executeLocalVectorize(opts)
      );
    } finally {
      setBusyDetail(null);
    }
  }

  // Confirmar vetor e produzir as 5 variantes oficiais + 4 propostas de paleta
  async function executeConfirmVectorAndVariants() {
    if (!vetorState) {
      setFailure("Ainda não existe um vetor gerado para confirmar.");
      return;
    }

    clearError();
    setBusyDetail("A confirmar o vetor e a gerar as 5 variantes oficiais do logótipo…");

    try {
      const res = await fetch("/api/vetorizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "confirmar",
          sessaoId,
          entrada: entradaEscolhida,
          dados,
          tresPalavras,
          fixtureNome: chosenLogoFixtureNome || undefined,
          estiloDirecao: chosenLogoEstilo,
          fontPairId: selectedFontPair,
          paleta: {
            primaria: customPalette.primaria.hex,
            secundaria: customPalette.secundaria.hex,
            papel: customPalette.papel.hex,
            tinta: customPalette.tinta.hex,
          },
          vetor: {
            colorSvg: vetorState.colorSvg,
            simboloSvg: vetorState.simboloSvg,
            simboloNegativoSvg: vetorState.simboloNegativoSvg,
            monocromaticoSvg: vetorState.monocromaticoSvg,
            negativoSvg: vetorState.negativoSvg,
            negativoTransparenteSvg: vetorState.negativoTransparenteSvg,
            colorsHex: vetorState.colorsHex,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFailure(
          data.error || "Não foi possível confirmar o vetor.",
          executeConfirmVectorAndVariants
        );
        return;
      }

      setDraft(data.draft);
      setVariantesFinaisA(data.variantes);
      setPropostas(data.propostas || []);
      setShowAllProposals(false);
      if (data.propostas?.length > 0) {
        handleSelectProposal(data.propostas[0]);
      }
      applySectorDefaultStyles(dados.sector);
      setStep("paleta");
    } catch {
      setFailure(
        "Erro de ligação ao gerar as 5 variantes a partir do vetor.",
        executeConfirmVectorAndVariants
      );
    } finally {
      setBusyDetail(null);
    }
  }

  // Entrada B: Analisar ficheiro ou preset
  async function handleAnalyzeEntradaB(
    presetId?: "forno-da-vilarica" | "oficina-do-sao"
  ) {
    clearError();
    let currentDados = dados;
    if (presetId) {
      const sample = SAMPLE_BRANDS[presetId];
      currentDados = { ...sample.dados };
      setDados(currentDados);
    }

    if (!currentDados.nome.trim()) {
      setFailure("Indique o nome da marca antes de analisar o logótipo.");
      return;
    }

    if (!presetId && !selectedFile) {
      setFailure(
        "Selecione um ficheiro PNG, JPG ou SVG (até 8 MB) ou utilize um dos exemplos incluídos."
      );
      return;
    }

    setBusyDetail("A analisar transparência da margem, nitidez e paleta cromática…");
    try {
      let res: Response;
      if (presetId) {
        res = await fetch("/api/analisar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId,
            sector: currentDados.sector,
            nome: currentDados.nome,
            tresPalavras,
          }),
        });
      } else {
        const fd = new FormData();
        fd.append("ficheiro", selectedFile!);
        fd.append("sector", currentDados.sector);
        fd.append("nome", currentDados.nome);
        fd.append("tresPalavras", tresPalavras);
        res = await fetch("/api/analisar", {
          method: "POST",
          body: fd,
        });
      }

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFailure(data.error || "Não foi possível analisar o ficheiro.", () =>
          handleAnalyzeEntradaB(presetId)
        );
        return;
      }

      setDraft(data.draft);
      setPropostas(data.propostas || []);
      setShowAllProposals(false);
      if (data.propostas?.length > 0) {
        handleSelectProposal(data.propostas[0]);
      }
      const willHavePhoto =
        Boolean(photoDataUrl) || presetId === "forno-da-vilarica";
      applySectorDefaultStyles(currentDados.sector, willHavePhoto);
      setChosenLogoOriginalDataUrl(`/api/rascunhos/${data.draft.id}`);

      if (presetId === "forno-da-vilarica" && !photoDataUrl) {
        setPhotoDataUrl(svgToDataUrl(SAMPLE_BAKERY_PHOTO_SVG));
        setPhotoFilename("forno-tradicional-ensaio.svg");
      }
      setStep("logotipo");
    } catch {
      setFailure("Erro ao comunicar com o servidor durante a análise.", () =>
        handleAnalyzeEntradaB(presetId)
      );
    } finally {
      setBusyDetail(null);
    }
  }

  // Reserva SVG (gerador geométrico sem IA)
  async function handleGenerateDirectionsReserve() {
    clearError();
    if (!dados.nome.trim()) {
      setFailure("Indique o nome da marca.");
      return;
    }
    const refsToUse =
      referencias.length >= 1
        ? referencias
        : [
            {
              nomeFicheiro: "referencia-estudio.svg",
              nota: "Equilíbrio entre símbolo clássico e tipografia limpa.",
            },
          ];

    setBusyDetail("A preparar as 2 direções no gerador SVG de reserva…");
    try {
      const res = await fetch("/api/logotipo-raiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "direcoes",
          questionario: {
            nome: dados.nome,
            slogan: dados.slogan,
            sector: dados.sector,
            tresPalavras,
            coresPreferidas,
            coresEvitar,
            referencias: refsToUse,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFailure(
          data.error || "Erro ao gerar direções SVG.",
          handleGenerateDirectionsReserve
        );
        return;
      }
      setDirecoesReserva(data.directions);
      setRefinamentoOpcoes(null);
      setUsarReservaSvg(true);
      setStep("logotipo");
    } catch {
      setFailure(
        "Falha ao contactar o gerador SVG de reserva.",
        handleGenerateDirectionsReserve
      );
    } finally {
      setBusyDetail(null);
    }
  }

  async function handleRequestRefinementReserve(directionId: DirectionId, round: number) {
    clearError();
    const refsToUse =
      referencias.length >= 1
        ? referencias
        : [{ nomeFicheiro: "ref.svg", nota: "Composição limpa e equilibrada." }];
    setBusyDetail(`A gerar 2 versões afinadas de reserva (Ronda ${round} de 3)…`);
    try {
      const res = await fetch("/api/logotipo-raiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "refinar",
          directionId,
          round,
          questionario: {
            nome: dados.nome,
            slogan: dados.slogan,
            sector: dados.sector,
            tresPalavras,
            coresPreferidas,
            coresEvitar,
            referencias: refsToUse,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFailure(data.error || "Erro ao afinar versão SVG.");
        return;
      }
      setChosenDirectionId(directionId);
      setRefinamentoRound(round);
      setRefinamentoOpcoes(data.options);
    } catch {
      setFailure("Erro ao afinar versão SVG.");
    } finally {
      setBusyDetail(null);
    }
  }

  async function handleFinalizeReserveSvg(option: StudioLogoOption) {
    clearError();
    setBusyDetail("A gerar as 5 variantes vectoriais de reserva…");
    try {
      const res = await fetch("/api/logotipo-raiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "finalizar",
          chosenOption: option,
          questionario: {
            nome: dados.nome,
            slogan: dados.slogan,
            sector: dados.sector,
            tresPalavras,
            coresPreferidas,
            coresEvitar,
            referencias,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFailure(data.error || "Não foi possível finalizar o vetor SVG.");
        return;
      }
      setVariantesFinaisA(data.variantes);
      setDraft(data.draft);
      setPropostas(data.propostas || []);
      if (data.propostas?.length > 0) handleSelectProposal(data.propostas[0]);
      applySectorDefaultStyles(dados.sector);
      setStep("paleta");
    } catch {
      setFailure("Erro ao produzir variantes SVG.");
    } finally {
      setBusyDetail(null);
    }
  }

  // Carregar pré-visualizações das capas em camadas (1 Moderna + 1 Clássica ou catálogo 6)
  const fetchCoverPreviews = useCallback(
    async (opts?: { round?: number; listAll?: boolean }) => {
      if (!draft?.id) return;
      const roundTarget = opts?.round ?? capaRound;
      const listAllTarget = opts?.listAll ?? showAllCapas;
      setCapasLoading(true);
      clearError();

      try {
        const res = await fetch("/api/capas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: draft.id,
            dados,
            paleta: {
              primaria: customPalette.primaria.hex,
              secundaria: customPalette.secundaria.hex,
              papel: customPalette.papel.hex,
              tinta: customPalette.tinta.hex,
            },
            fontPairId: selectedFontPair,
            round: roundTarget,
            listAll: listAllTarget,
            photoDataUrl: photoDataUrl || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setFailure(
            data.error || "Não foi possível compor as capas em camadas.",
            () => fetchCoverPreviews(opts)
          );
          return;
        }
        setCapasPreviews(data.layouts || []);
        if (
          data.layouts?.length > 0 &&
          !data.layouts.some(
            (item: CapaPreviewItem) => item.spec.id === selectedCoverLayoutRef.current
          )
        ) {
          const firstSpec = data.layouts[0].spec;
          setSelectedCoverLayoutId(firstSpec.id);
          setKitStyle(firstSpec.estiloSugerido);
          setStyleOverrides((stPrev) => ({
            ...stPrev,
            capas: firstSpec.estiloSugerido,
          }));
        }
      } catch {
        setFailure("Falha de rede ao renderizar as pré-visualizações de capas.", () =>
          fetchCoverPreviews(opts)
        );
      } finally {
        setCapasLoading(false);
      }
    },
    [
      capaRound,
      clearError,
      customPalette.papel.hex,
      customPalette.primaria.hex,
      customPalette.secundaria.hex,
      customPalette.tinta.hex,
      dados,
      draft?.id,
      photoDataUrl,
      selectedFontPair,
      setFailure,
      showAllCapas,
    ]
  );

  // Sempre que entra no passo `capas`, carrega automaticamente as 2 propostas (1 moderna + 1 clássica)
  useEffect(() => {
    if (step === "capas" && draft?.id) {
      fetchCoverPreviews({ round: capaRound, listAll: showAllCapas });
    }
  }, [step, draft?.id, capaRound, showAllCapas, fetchCoverPreviews]);

  // Gerar os 36 ficheiros e o ZIP final
  async function handleGenerateFullKit() {
    if (!draft) {
      setFailure("Falta confirmar o logótipo antes de gerar o kit final.");
      return;
    }

    clearError();
    setBusyDetail(
      "A compor os 36 formatos oficiais (PNG, ICO, HTML, SVG, PDF) e a empacotar o arquivo ZIP…"
    );
    try {
      const res = await fetch("/api/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          dados,
          paleta: {
            primaria: customPalette.primaria.hex,
            secundaria: customPalette.secundaria.hex,
            papel: customPalette.papel.hex,
            tinta: customPalette.tinta.hex,
          },
          fontPairId: selectedFontPair,
          kitStyle,
          coverLayoutId: selectedCoverLayoutId,
          styleOverrides,
          photoDataUrl: photoDataUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFailure(
          data.error || "Não foi possível gerar os 36 ficheiros do kit.",
          handleGenerateFullKit
        );
        if (data.code === "expired_draft") {
          setDraft(null);
        }
        return;
      }

      setGeneratedKit(data.kit);
      setStep("previsualizacao");
    } catch {
      setFailure(
        "Erro de comunicação durante a geração do arquivo ZIP.",
        handleGenerateFullKit
      );
    } finally {
      setBusyDetail(null);
    }
  }

  const maxStepReachedIdx = useMemo(() => {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === step);
    let maxIdx = idx;
    if (generatedKit) maxIdx = Math.max(maxIdx, 7);
    else if (draft) maxIdx = Math.max(maxIdx, 5);
    else if (vetorState) maxIdx = Math.max(maxIdx, 3);
    else if (propostasIA || draft) maxIdx = Math.max(maxIdx, 2);
    else if (entitlement) maxIdx = Math.max(maxIdx, 1);
    return maxIdx;
  }, [step, generatedKit, draft, vetorState, propostasIA, entitlement]);

  const needsPhotoForNonCover = (
    ["publicacao", "story", "cartao", "papel"] as const
  ).some((g) => styleOverrides[g] === "fotografia");

  if (authChecking) {
    return (
      <div className="mx-auto flex max-w-4xl items-center justify-center px-4 py-24">
        <div role="status" className="flex items-center gap-3 text-stone-700">
          <Loader2 className="h-5 w-5 animate-spin text-amber-800" />
          <span className="text-sm font-medium">A verificar sessão no PandoMarca…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6 overflow-x-clip">
      {/* Barra superior: direito de acesso + modo de imagem + ações */}
      {entitlement && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-2xs sm:px-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                entitlement.kind === "website_bonus"
                  ? "bg-emerald-100 text-emerald-950"
                  : "bg-amber-100 text-amber-950"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>
                {entitlement.kind === "website_bonus"
                  ? "Oferta Website PandoWeb"
                  : "Produto Individual • Preço a definir"}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-[#FAF7F2] px-3 py-1 text-xs font-semibold text-stone-700">
              <Sparkles className="h-3.5 w-3.5 text-amber-800 shrink-0" />
              <span>{imagemConfig.etiquetaModo}</span>
            </span>

            {dados.nome && (
              <span className="text-xs font-semibold text-stone-600">
                Marca: <strong className="text-stone-950">{dados.nome}</strong>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <button
              type="button"
              onClick={handleResetSession}
              className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-stone-900 rounded"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Novo kit</span>
            </button>
            <span className="text-stone-300">|</span>
            <button
              type="button"
              onClick={handleLogoutCode}
              className="text-stone-600 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-stone-900 rounded"
            >
              Trocar código
            </button>
          </div>
        </div>
      )}

      {/* Barra passo a passo (Stepper acessível responsivo) */}
      {entitlement && (
        <nav aria-label="Passos do assistente PandoMarca" className="rounded-2xl border border-stone-200 bg-white p-3 shadow-2xs">
          <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8">
            {WIZARD_STEPS.map((stMeta, idx) => {
              const isCurrent = step === stMeta.id;
              const isDone = idx < WIZARD_STEPS.findIndex((s) => s.id === step);
              const isUnlocked = idx >= 1 && idx <= maxStepReachedIdx;

              return (
                <li key={stMeta.id} className="min-w-0">
                  <button
                    type="button"
                    disabled={!isUnlocked && !isCurrent}
                    aria-current={isCurrent ? "step" : undefined}
                    onClick={() => {
                      if (isUnlocked && stMeta.id !== "acesso") {
                        clearError();
                        setStep(stMeta.id);
                      }
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
                      isCurrent
                        ? "bg-stone-900 text-stone-50 shadow-xs"
                        : isDone
                        ? "bg-emerald-50 text-emerald-950 hover:bg-emerald-100"
                        : isUnlocked
                        ? "bg-[#FAF7F2] text-stone-800 hover:bg-stone-200/70"
                        : "bg-stone-50 text-stone-400 cursor-not-allowed"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        isCurrent
                          ? "bg-amber-400 text-stone-950"
                          : isDone
                          ? "bg-emerald-700 text-white"
                          : "bg-stone-200 text-stone-700"
                      }`}
                    >
                      {isDone ? <Check className="h-3 w-3" /> : stMeta.numero}
                    </span>
                    <span className="truncate">{stMeta.rotuloCurto}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Banner de erro com «Tentar de novo» sem perder progresso */}
      {globalError && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-4 rounded-2xl border border-red-300 bg-red-50/95 p-5 text-sm text-red-950 shadow-xs sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-3 min-w-0">
            <AlertCircle className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-bold">Aconteceu um imprevisto</p>
              <p className="mt-0.5 text-red-900 wrap-break-word">{globalError}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canRetry && (
              <button
                type="button"
                id="btn-tentar-de-novo"
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-800 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-stone-900"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Tentar de novo</span>
              </button>
            )}
            <button
              type="button"
              onClick={clearError}
              className="rounded-xl border border-red-300 bg-white px-3.5 py-2 text-xs font-bold text-red-900 hover:bg-red-100"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Indicador explícito de espera sem perder contexto */}
      {busyDetail && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3.5 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-xs"
        >
          <Loader2 className="h-5 w-5 animate-spin text-amber-800 shrink-0" />
          <div>
            <p className="text-sm font-bold">A criar as tuas propostas…</p>
            <p className="text-xs text-amber-900 mt-0.5">{busyDetail}</p>
          </div>
        </div>
      )}

      {/* =====================================================================
          PASSO 1: CÓDIGO DE ACESSO
      ===================================================================== */}
      {step === "acesso" && (
        <section className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:p-10 space-y-6">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-stone-900 text-amber-300">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Passo 1 de 8 • Porta de Acesso
              </span>
              <h1 className="text-2xl font-bold text-stone-950">
                Introduza o seu código PandoMarca
              </h1>
            </div>
          </div>

          {!envConfigured ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 space-y-2">
              <p className="font-bold">Ambiente sem códigos configurados</p>
              <p>
                Faltam variáveis em <code>.env.local</code>:{" "}
                <strong>{missingVars.join(", ")}</strong>.
              </p>
              <p className="text-xs">
                Copie <code>.env.example</code> para <code>.env.local</code> conforme as instruções do README.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-4 text-xs text-stone-700 leading-relaxed flex flex-wrap items-center justify-between gap-2">
                <p>
                  Aceita códigos <strong>Oferta Website PandoWeb</strong> ou <strong>Produto Individual</strong> (preço a definir). Ambos produzem exatamente o mesmo kit de 36 ficheiros.
                </p>
                <span className="inline-flex items-center rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-stone-600 shrink-0">
                  {imagemConfig.etiquetaModo}
                </span>
              </div>

              <form onSubmit={handleAccessSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="input-codigo-acesso"
                    className="block text-xs font-bold uppercase tracking-wider text-stone-700"
                  >
                    Código de acesso
                  </label>
                  <input
                    id="input-codigo-acesso"
                    type="text"
                    value={codigoInput}
                    onChange={(e) => setCodigoInput(e.target.value)}
                    placeholder="Ex.: kit-website-demo"
                    className="mt-2 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-4 py-3 text-base font-mono text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                  />
                </div>

                {authError && (
                  <p role="alert" className="text-sm font-semibold text-red-700">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  id="btn-validar-codigo"
                  disabled={authLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>A criar as tuas propostas…</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar no Estúdio PandoMarca</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="border-t border-stone-200 pt-5 space-y-2.5">
                <p className="text-xs font-semibold text-stone-600">
                  Atalhos de demonstração:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    id="btn-demo-website"
                    onClick={() => {
                      setCodigoInput("kit-website-demo");
                      handleAccessSubmit(undefined, "kit-website-demo");
                    }}
                    className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-200/70"
                  >
                    Oferta Website (kit-website-demo)
                  </button>
                  <button
                    type="button"
                    id="btn-demo-standalone"
                    onClick={() => {
                      setCodigoInput("kit-individual-demo");
                      handleAccessSubmit(undefined, "kit-individual-demo");
                    }}
                    className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-200/70"
                  >
                    Produto Individual (kit-individual-demo)
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* =====================================================================
          PASSO 2: DADOS DO NEGÓCIO E PONTO DE PARTIDA (ENTRADA A ou B)
      ===================================================================== */}
      {step === "dados" && (
        <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-10 shadow-xs space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-6">
            <div className="space-y-1 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Passo 2 de 8 • Dados do Negócio
              </p>
              <h1 className="text-2xl font-bold text-stone-950 sm:text-3xl">
                Conte-nos sobre a sua marca
              </h1>
              <p className="text-sm text-stone-600">
                Todos os campos são usados apenas se preenchidos — campos vazios são omitidos automaticamente nas capas, cartões e papel de carta (sem textos nem números inventados).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="btn-preset-forno"
                onClick={() => applyPresetData("forno-da-vilarica")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-950 transition hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-stone-900"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Preencher ensaio: Forno da Vilariça</span>
              </button>
              <button
                type="button"
                id="btn-preset-oficina"
                onClick={() => applyPresetData("oficina-do-sao")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-800 transition hover:bg-stone-200/70"
              >
                <span>Oficina do São</span>
              </button>
            </div>
          </div>

          {/* Escolha da entrada (A ou B) com botões acessíveis */}
          <div className="space-y-2.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-stone-700">
              Como prefere começar o logótipo?
            </span>
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                id="btn-choose-entrada-a"
                aria-pressed={entradaEscolhida === "A"}
                onClick={() => setEntradaEscolhida("A")}
                className={`flex flex-col items-start gap-2 rounded-2xl border-2 p-5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
                  entradaEscolhida === "A"
                    ? "border-stone-900 bg-[#FAF7F2] ring-2 ring-stone-900/10"
                    : "border-stone-200 bg-white hover:border-stone-400"
                }`}
              >
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-950">
                  <PenTool className="h-3.5 w-3.5" />
                  Entrada A — Criar logótipo de raiz
                </span>
                <span className="text-base font-bold text-stone-950">
                  Comparar 2 propostas distintas e afinar o desenho
                </span>
                <span className="text-xs text-stone-600 leading-relaxed">
                  Gera 2 propostas diferentes por ronda (clássica com símbolo vs moderna tipográfica), permite ajustar e vetoriza em SVG limpo até 8 cores.
                </span>
              </button>

              <button
                type="button"
                id="btn-choose-entrada-b"
                aria-pressed={entradaEscolhida === "B"}
                onClick={() => setEntradaEscolhida("B")}
                className={`flex flex-col items-start gap-2 rounded-2xl border-2 p-5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
                  entradaEscolhida === "B"
                    ? "border-stone-900 bg-[#FAF7F2] ring-2 ring-stone-900/10"
                    : "border-stone-200 bg-white hover:border-stone-400"
                }`}
              >
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-stone-200 px-2.5 py-1 text-xs font-bold text-stone-900">
                  <Upload className="h-3.5 w-3.5" />
                  Entrada B — Usar logótipo já existente
                </span>
                <span className="text-base font-bold text-stone-950">
                  Carregar PNG, JPG ou SVG e limpar fundo / vetorizar
                </span>
                <span className="text-xs text-stone-600 leading-relaxed">
                  Analisa o ficheiro carregado, remove margens lisas automaticamente, permite vetorizar ou extrair paleta e avança para o mesmo kit.
                </span>
              </button>
            </div>
          </div>

          {/* Formulário principal */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="input-nome" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                Nome da marca *
              </label>
              <input
                id="input-nome"
                type="text"
                required
                value={dados.nome}
                onChange={(e) => setDados({ ...dados, nome: e.target.value })}
                placeholder="Ex.: Forno da Vilariça"
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-950 focus:border-stone-900 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="select-sector" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                Sector de atividade *
              </label>
              <select
                id="select-sector"
                value={dados.sector}
                onChange={(e) => {
                  const nextSec = e.target.value as SectorId;
                  setDados({ ...dados, sector: nextSec });
                  applySectorDefaultStyles(nextSec);
                }}
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-950 focus:border-stone-900 focus:bg-white focus:outline-none"
              >
                {Object.values(SECTORS).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.rotulo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="input-slogan" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                Slogan (opcional)
              </label>
              <input
                id="input-slogan"
                type="text"
                value={dados.slogan}
                onChange={(e) => setDados({ ...dados, slogan: e.target.value })}
                placeholder="Ex.: Pão de trigo ao nascer do dia"
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-950 focus:border-stone-900 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="input-servicos" className="block text-xs font-semibold text-stone-700">
                Serviços / Descrição curta
              </label>
              <input
                id="input-servicos"
                type="text"
                value={dados.servicos}
                onChange={(e) => setDados({ ...dados, servicos: e.target.value })}
                placeholder="Ex.: Padaria tradicional • Pão em forno a lenha e broa"
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-950"
              />
            </div>

            <div>
              <label htmlFor="input-morada" className="block text-xs font-semibold text-stone-700">
                Morada / Localidade
              </label>
              <input
                id="input-morada"
                type="text"
                value={dados.morada}
                onChange={(e) => setDados({ ...dados, morada: e.target.value })}
                placeholder="Ex.: Torre de Moncorvo"
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-950"
              />
            </div>

            <div>
              <label htmlFor="input-website" className="block text-xs font-semibold text-stone-700">
                Website
              </label>
              <input
                id="input-website"
                type="text"
                value={dados.website}
                onChange={(e) => setDados({ ...dados, website: e.target.value })}
                placeholder="Ex.: https://fornodavilarica.pt"
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-950"
              />
            </div>

            <div>
              <label htmlFor="input-email" className="block text-xs font-semibold text-stone-700">
                Email
              </label>
              <input
                id="input-email"
                type="email"
                value={dados.email}
                onChange={(e) => setDados({ ...dados, email: e.target.value })}
                placeholder="Ex.: marta@fornodavilarica.pt"
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-950"
              />
            </div>

            <div>
              <label htmlFor="input-telefone" className="block text-xs font-semibold text-stone-700">
                Telefone
              </label>
              <input
                id="input-telefone"
                type="text"
                value={dados.telefone}
                onChange={(e) => setDados({ ...dados, telefone: e.target.value })}
                placeholder="Ex.: +351 279 452 180"
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-950"
              />
            </div>

            <div>
              <label htmlFor="input-nif" className="block text-xs font-semibold text-stone-700">
                NIF (mostrado se preenchido)
              </label>
              <input
                id="input-nif"
                type="text"
                value={dados.nif}
                onChange={(e) => setDados({ ...dados, nif: e.target.value })}
                placeholder="Ex.: 514 892 307"
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-950"
              />
            </div>

            <div>
              <label htmlFor="input-pessoa" className="block text-xs font-semibold text-stone-700">
                Pessoa de contacto
              </label>
              <input
                id="input-pessoa"
                type="text"
                value={dados.pessoa}
                onChange={(e) => setDados({ ...dados, pessoa: e.target.value })}
                placeholder="Ex.: Marta Queirós"
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-950"
              />
            </div>

            <div>
              <label htmlFor="input-cargo" className="block text-xs font-semibold text-stone-700">
                Cargo
              </label>
              <input
                id="input-cargo"
                type="text"
                value={dados.cargo}
                onChange={(e) => setDados({ ...dados, cargo: e.target.value })}
                placeholder="Ex.: Mestra Padeira"
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-950"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-[#FAF7F2] p-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={dados.simbolo}
              onChange={(e) => setDados({ ...dados, simbolo: e.target.checked })}
              className="h-4 w-4 rounded border-stone-300 text-stone-900"
            />
            <span className="text-xs font-medium text-stone-800">
              O logótipo principal é apenas um símbolo (sem o nome escrito) — mostrar o nome da marca nas capas e na variante horizontal
            </span>
          </label>

          {/* Campos criativos adicionais para Entrada A */}
          {entradaEscolhida === "A" && (
            <div className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800">
                    Direção criativa e referências (Entrada A)
                  </h2>
                  <p className="text-xs text-stone-600">
                    O estúdio cria um logótipo limpo apenas com o nome da marca ou símbolo puro (nunca slogans nem fundos cheios de texto).
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Três palavras da marca
                  </label>
                  <input
                    type="text"
                    value={tresPalavras}
                    onChange={(e) => setTresPalavras(e.target.value)}
                    placeholder="Ex.: Tradição, Forno a lenha, Trigo"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Cores preferidas
                  </label>
                  <input
                    type="text"
                    value={coresPreferidas}
                    onChange={(e) => setCoresPreferidas(e.target.value)}
                    placeholder="Ex.: Terracota, ocre e creme"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Cores a evitar
                  </label>
                  <input
                    type="text"
                    value={coresEvitar}
                    onChange={(e) => setCoresEvitar(e.target.value)}
                    placeholder="Ex.: Néons frios"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-stone-700">
                    Imagens de referência opcionais ({referencias.length} / 5)
                  </span>
                  {referencias.length < 5 && (
                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-900 hover:bg-stone-100">
                      <Plus className="h-3.5 w-3.5" />
                      <span>Adicionar imagem</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleAddReferenceFiles(e.target.files)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {referencias.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {referencias.map((ref, idx) => (
                      <div
                        key={idx}
                        className="flex gap-3 rounded-xl border border-stone-200 bg-white p-3"
                      >
                        {ref.dataUrl && (
                          <img
                            src={ref.dataUrl}
                            alt={ref.nomeFicheiro || `Referência ${idx + 1}`}
                            className="h-14 w-14 rounded-lg border border-stone-200 object-contain shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-bold text-stone-800">
                              {ref.nomeFicheiro}
                            </span>
                            <button
                              type="button"
                              aria-label="Remover referência"
                              onClick={() =>
                                setReferencias(referencias.filter((_, i) => i !== idx))
                              }
                              className="text-stone-400 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={ref.nota}
                            onChange={(e) => {
                              const next = [...referencias];
                              next[idx] = { ...next[idx], nota: e.target.value };
                              setReferencias(next);
                            }}
                            className="w-full rounded-lg border border-stone-200 bg-[#FAF7F2] px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ações para avançar ao Passo 3 */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-200 pt-6">
            <span className="text-xs text-stone-500">
              Progresso guardado automaticamente nesta sessão.
            </span>

            {entradaEscolhida === "A" ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  id="btn-avancar-logotipo-ia"
                  disabled={Boolean(busyDetail)}
                  onClick={() => executeLogoRound(1)}
                  className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-stone-900"
                >
                  <Wand2 className="h-4 w-4 text-amber-300" />
                  <span>Gerar 2 Propostas de Logótipo (Ronda 1/{imagemConfig.maxRondas})</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                id="btn-avancar-logotipo-b"
                onClick={() => {
                  if (!dados.nome.trim()) {
                    setFailure("Indique o nome da marca antes de carregar o logótipo.");
                    return;
                  }
                  clearError();
                  setStep("logotipo");
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-stone-900"
              >
                <span>Avançar para Carregar Logótipo Existente</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>
      )}

      {/* =====================================================================
          PASSO 3: LOGÓTIPO (ENTRADA A COM IA + CONTADORES, OU ENTRADA B UPLOAD)
      ===================================================================== */}
      {step === "logotipo" && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Passo 3 de 8 • {entradaEscolhida === "A" ? "Propostas de Logótipo" : "Carregar Logótipo Existente"}
              </p>
              <h1 className="text-2xl font-bold text-stone-950 sm:text-3xl">
                {entradaEscolhida === "A"
                  ? "Duas propostas distintas de logótipo"
                  : "Carregue ou analise o seu logótipo existente"}
              </h1>
              <p className="text-sm text-stone-600">
                {entradaEscolhida === "A"
                  ? "Compare uma proposta clássica com símbolo contra uma moderna tipográfica. Pode escolher já para vetorizar, pedir ajuste ou pedir outra ronda."
                  : "Carregue PNG, JPG ou SVG até 8 MB. Pode vetorizar e confirmar o desenho vetorial ou avançar diretamente."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStep("dados")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Dados do negócio</span>
              </button>

              {entradaEscolhida === "A" && !usarReservaSvg && (
                <>
                  <button
                    type="button"
                    id="btn-outra-ronda"
                    disabled={
                      Boolean(busyDetail) ||
                      rondaAtual >= imagemConfig.maxRondas ||
                      Boolean(orcamento?.bloqueado)
                    }
                    onClick={() => executeLogoRound(rondaAtual + 1)}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-stone-900 bg-[#FAF7F2] px-4 py-2.5 text-xs font-bold text-stone-950 transition hover:bg-stone-900 hover:text-stone-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>
                      {rondaAtual >= imagemConfig.maxRondas
                        ? `Limite de rondas (${rondaAtual}/${imagemConfig.maxRondas})`
                        : `Outra ronda (${rondaAtual + 1}/${imagemConfig.maxRondas})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    id="btn-abrir-reserva-svg"
                    onClick={handleGenerateDirectionsReserve}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Compositor vetorial clássico</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Contadores visíveis de rondas e ajustes */}
          {entradaEscolhida === "A" && !usarReservaSvg && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-3.5 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1 font-bold text-amber-300">
                Ronda {rondaAtual} de {imagemConfig.maxRondas}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1 font-bold text-amber-950">
                Ajustes: {ajustesUsados} / {imagemConfig.maxAjustes}
              </span>
              {imagemConfig.semCustosReais && (
                <span className="inline-flex items-center rounded-full border border-stone-200 bg-[#FAF7F2] px-2.5 py-0.5 font-semibold text-stone-600">
                  {imagemConfig.etiquetaModo}
                </span>
              )}
            </div>
          )}

          {/* MODO PRINCIPAL ENTRADA A: 2 Propostas IA Lado a Lado */}
          {entradaEscolhida === "A" && !usarReservaSvg && (
            <>
              {!propostasIA ? (
                <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center space-y-4">
                  <p className="text-sm text-stone-700">
                    Clique abaixo para gerar as duas primeiras propostas distintas para{" "}
                    <strong>{dados.nome || "a sua marca"}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => executeLogoRound(1)}
                    className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3 text-sm font-semibold text-stone-50"
                  >
                    <Wand2 className="h-4 w-4 text-amber-300" />
                    <span>Gerar 2 propostas (Ronda 1/{imagemConfig.maxRondas})</span>
                  </button>
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  {propostasIA.map((prop, idx) => {
                    const isEditingThis = ajustarAlvoId === prop.id;
                    const adjBlocked =
                      ajustesUsados >= imagemConfig.maxAjustes ||
                      Boolean(orcamento?.bloqueado);

                    return (
                      <article
                        key={prop.id}
                        id={`card-ia-proposta-${prop.estilo}`}
                        className="flex flex-col justify-between rounded-3xl border-2 border-stone-200 bg-white p-6 shadow-xs transition hover:border-stone-400 space-y-5"
                      >
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <span
                                className={`inline-block rounded-lg px-3 py-1 text-xs font-bold ${
                                  prop.estilo === "classico"
                                    ? "bg-amber-100 text-amber-950"
                                    : "bg-stone-900 text-amber-300"
                                }`}
                              >
                                {prop.titulo}
                              </span>
                              <h2 className="mt-2 text-lg font-bold text-stone-950">
                                {prop.subtitulo}
                              </h2>
                            </div>
                            <span className="rounded-md border border-stone-200 bg-[#FAF7F2] px-2.5 py-1 text-[11px] font-semibold text-stone-600">
                              Ronda {prop.ronda}
                            </span>
                          </div>

                          {/* Pré-visualização nítida sobre papel quente */}
                          <div className="flex h-60 items-center justify-center rounded-2xl border border-stone-200 bg-[#FAF6F0] p-4 overflow-hidden">
                            <img
                              src={prop.imagemBase64}
                              alt={prop.titulo}
                              className="max-h-full max-w-full object-contain rounded-lg"
                            />
                          </div>

                          <p className="text-xs text-stone-600 leading-relaxed">
                            {prop.racional}
                          </p>

                          {/* Paleta e tipo associados */}
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-[#FAF7F2] px-3.5 py-2.5 text-xs">
                            <div className="flex items-center gap-1.5">
                              {[
                                prop.sugestaoPaleta.primaria,
                                prop.sugestaoPaleta.secundaria,
                                prop.sugestaoPaleta.papel,
                                prop.sugestaoPaleta.tinta,
                              ].map((sw, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="h-5 w-5 rounded-full border border-stone-300"
                                  style={{ backgroundColor: sw.hex }}
                                  title={sw.hex}
                                />
                              ))}
                            </div>
                            <span className="font-semibold text-stone-800">
                              Par: {FONT_PAIRS[prop.sugestaoFontPairId].nome}
                            </span>
                          </div>

                          {/* Caixa inline de ajuste */}
                          {isEditingThis && (
                            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-3">
                              <label
                                htmlFor={`input-ajuste-${idx}`}
                                className="block text-xs font-bold text-amber-950"
                              >
                                O que pretende ajustar nesta proposta?
                              </label>
                              <input
                                id={`input-ajuste-${idx}`}
                                type="text"
                                value={ajusteInstrucao}
                                onChange={(e) => setAjusteInstrucao(e.target.value)}
                                placeholder="Ex.: aumentar contraste e reforçar contorno do arco"
                                className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs text-stone-950"
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  id={`btn-confirmar-ajuste-${idx}`}
                                  disabled={Boolean(busyDetail)}
                                  onClick={() => executeAdjustProposal(prop, ajusteInstrucao)}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white hover:bg-amber-950"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Aplicar ajuste ({ajustesUsados + 1}/{imagemConfig.maxAjustes})</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAjustarAlvoId(null);
                                    setAjusteInstrucao("");
                                  }}
                                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 pt-2">
                          <button
                            type="button"
                            id={`btn-escolher-ia-${idx}`}
                            disabled={Boolean(busyDetail)}
                            onClick={() =>
                              executeLocalVectorize({
                                imagemBase64: prop.imagemBase64,
                                suggestedPaleta: prop.sugestaoPaleta,
                                suggestedFont: prop.sugestaoFontPairId,
                                titleLabel: prop.titulo,
                                fixtureNome: prop.fixtureNome,
                                estiloDirecao: prop.estilo,
                              })
                            }
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-stone-900"
                          >
                            <Check className="h-4 w-4 text-amber-300" />
                            <span>Escolher</span>
                          </button>

                          <button
                            type="button"
                            id={`btn-abrir-ajuste-${idx}`}
                            disabled={adjBlocked || Boolean(busyDetail)}
                            onClick={() => {
                              setAjustarAlvoId(isEditingThis ? null : prop.id);
                              setAjusteInstrucao("Reforçar contraste do símbolo e equilibrar margens");
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-[#FAF7F2] px-4 py-3 text-xs font-bold text-stone-900 transition hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            <span>Ajustar</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* COMPOSITOR VETORIAL ALTERNATIVO (se acionado manualmente) */}
          {entradaEscolhida === "A" && usarReservaSvg && (
            <div className="rounded-3xl border border-stone-200 bg-white p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Compositor vetorial alternativo
                  </span>
                  <h2 className="text-xl font-bold text-stone-950">
                    {refinamentoOpcoes
                      ? `2 Versões afinadas (Ronda ${refinamentoRound}/3)`
                      : "2 Direções vetoriais"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setUsarReservaSvg(false)}
                  className="rounded-xl border border-stone-300 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                >
                  Voltar às propostas de imagem
                </button>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {(refinamentoOpcoes || direcoesReserva || []).map((opt, idx) => (
                  <div
                    key={opt.id}
                    className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-[#FAF7F2] p-5 space-y-4"
                  >
                    <div className="space-y-3">
                      <span className="inline-block rounded-md bg-stone-900 px-2.5 py-1 text-xs font-bold text-amber-300">
                        {opt.titulo}
                      </span>
                      <div
                        className="flex h-48 items-center justify-center rounded-xl border border-stone-200 p-4"
                        style={{ backgroundColor: opt.paleta.papel.hex }}
                      >
                        <img
                          src={svgToDataUrl(opt.logoSvg)}
                          alt={opt.titulo}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <p className="text-xs text-stone-600">{opt.racional}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!refinamentoOpcoes ? (
                        <button
                          type="button"
                          onClick={() => handleRequestRefinementReserve(opt.directionId, 1)}
                          className="w-full rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white"
                        >
                          Afinar esta direção (2 versões)
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleFinalizeReserveSvg(opt)}
                            className="flex-1 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white"
                          >
                            Aprovar SVG #{idx + 1}
                          </button>
                          {refinamentoRound < 3 && idx === 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRequestRefinementReserve(
                                  chosenDirectionId,
                                  refinamentoRound + 1
                                )
                              }
                              className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-xs font-bold"
                            >
                              Mostrar outras 2
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ENTRADA B: Carregamento e Diagnóstico */}
          {entradaEscolhida === "B" && (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-6 rounded-3xl border border-stone-200 bg-white p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-stone-950">
                    Carregar ficheiro do logótipo
                  </h2>
                  <button
                    type="button"
                    id="btn-preset-b-forno"
                    onClick={() => handleAnalyzeEntradaB("forno-da-vilarica")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-200"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Carregar ensaio: Forno da Vilariça</span>
                  </button>
                </div>

                <div className="rounded-2xl border-2 border-dashed border-stone-300 bg-[#FAF7F2] p-6 text-center space-y-3">
                  <Upload className="mx-auto h-8 w-8 text-amber-800" />
                  <p className="text-sm font-bold text-stone-900">
                    PNG, JPG ou SVG • máx. 8 MB
                  </p>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-stone-50 hover:bg-stone-800">
                    <span>Escolher ficheiro</span>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  {selectedFile && (
                    <div className="pt-2 space-y-2">
                      <p className="text-xs font-semibold text-emerald-800">
                        {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAnalyzeEntradaB()}
                        className="rounded-xl bg-amber-800 px-4 py-2 text-xs font-bold text-white hover:bg-amber-900"
                      >
                        Analisar ficheiro selecionado
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-6 rounded-3xl border border-stone-200 bg-white p-6 space-y-4">
                <h2 className="text-lg font-bold text-stone-950">
                  Recorte e limpeza automática
                </h2>
                {draft ? (
                  <>
                    <div className="checkerboard-bg flex h-44 items-center justify-center rounded-2xl border border-stone-200 p-4">
                      <img
                        src={`/api/rascunhos/${draft.id}`}
                        alt="Logótipo analisado"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="text-xs text-stone-700 space-y-1">
                      <p className="font-semibold text-emerald-800">
                        ✓ {draft.width}×{draft.height} px ({draft.originalFormat.toUpperCase()}) • Fundo tratado
                      </p>
                      {draft.lowQuality && draft.qualityWarning && (
                        <p className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-950">
                          {draft.qualityWarning}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2.5 pt-2">
                      <button
                        type="button"
                        id="btn-b-vetorizar"
                        onClick={() =>
                          executeLocalVectorize({
                            draftId: draft.id,
                            suggestedPaleta: draft.paletaExtraida,
                            fixtureNome: draft.logoDna?.fixtureLogoOrigem,
                          })
                        }
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-xs font-bold text-stone-50 hover:bg-stone-800"
                      >
                        <Wand2 className="h-4 w-4 text-amber-300" />
                        <span>Vetorizar e Confirmar Vetor</span>
                      </button>
                      <button
                        type="button"
                        id="btn-b-avancar-direto"
                        onClick={() => setStep("paleta")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-[#FAF7F2] px-4 py-3 text-xs font-bold text-stone-900 hover:bg-stone-200"
                      >
                        <span>Ir direto para Paleta</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex h-52 items-center justify-center rounded-2xl border border-stone-200 bg-[#FAF7F2] p-6 text-center text-xs text-stone-500">
                    Carregue o ficheiro ou clique em «Carregar ensaio: Forno da Vilariça» para inspecionar o recorte.
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          PASSO 4: CONFIRMAR VETOR (ORIGINAL vs VETOR SVG + PRÉ-VISUALIZAÇÃO 32 px)
      ===================================================================== */}
      {step === "vetor" && vetorState && (
        <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-10 shadow-xs space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Passo 4 de 8 • Confirmação Vetorial
              </p>
              <h1 className="mt-1 text-2xl font-bold text-stone-950 sm:text-3xl">
                Confirmar vetor
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                Verifique o resultado vetorial frente ao original e confira a nitidez do símbolo reduzido a <strong>32 px</strong> (tamanho de separador/favicon) antes de gerar as 5 variantes.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStep("logotipo")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar às propostas</span>
            </button>
          </div>

          {/* Métricas de qualidade e limpeza do SVG */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span
              className={`rounded-full px-3 py-1 font-bold ${
                vetorState.under200Kb
                  ? "bg-emerald-100 text-emerald-950"
                  : "bg-red-100 text-red-900"
              }`}
            >
              Tamanho SVG: {(vetorState.byteSize / 1024).toFixed(1)} KB / 200 KB
            </span>
            <span
              className={`rounded-full px-3 py-1 font-bold ${
                vetorState.within8Colors
                  ? "bg-emerald-100 text-emerald-950"
                  : "bg-amber-100 text-amber-950"
              }`}
            >
              Paleta reduzida: {vetorState.colorsCount} / 8 cores
            </span>
            <span className="rounded-full border border-stone-200 bg-[#FAF7F2] px-3 py-1 font-semibold text-stone-800">
              Formato: SVG vetorial limpo
            </span>
            {vetorState.backgroundRemoved && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-950">
                ✓ Margem lisa removida
              </span>
            )}
          </div>

          {/* Comparação Original vs Vetor + Pré-visualização 32 px */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5 rounded-2xl border border-stone-200 bg-[#FAF7F2] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Original
                </span>
                <span className="text-[11px] text-stone-500">Imagem de partida</span>
              </div>
              <div className="flex h-56 items-center justify-center rounded-xl border border-stone-200 bg-[#FAF6F0] p-4 overflow-hidden">
                {chosenLogoOriginalDataUrl ? (
                  <img
                    src={chosenLogoOriginalDataUrl}
                    alt="Original selecionado"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-stone-500">Original</span>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl border-2 border-stone-900 bg-[#FAF7F2] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-950">
                  Vetor SVG limpo
                </span>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { key: "color", label: "Cor" },
                      { key: "simbolo", label: "Símbolo" },
                      { key: "mono", label: "Mono" },
                      { key: "negativo", label: "Negativo" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveVectorTab(t.key)}
                      className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                        activeVectorTab === t.key
                          ? "bg-stone-900 text-amber-300"
                          : "bg-white text-stone-700 hover:bg-stone-200"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className={`flex h-56 items-center justify-center rounded-xl border border-stone-200 p-4 overflow-hidden ${
                  activeVectorTab === "negativo"
                    ? "bg-stone-900"
                    : "checkerboard-bg"
                }`}
              >
                <img
                  src={svgToDataUrl(
                    activeVectorTab === "simbolo"
                      ? vetorState.simboloSvg
                      : activeVectorTab === "mono"
                      ? vetorState.monocromaticoSvg
                      : activeVectorTab === "negativo"
                      ? vetorState.negativoSvg
                      : vetorState.colorSvg
                  )}
                  alt={`Vetor ${activeVectorTab}`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              {/* Cores da paleta extraída do vetor */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold text-stone-600">Cores no SVG:</span>
                {vetorState.colorsHex.map((hex) => (
                  <span
                    key={hex}
                    className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-stone-800"
                  >
                    <span
                      className="h-3 w-3 rounded-xs border border-stone-300"
                      style={{ backgroundColor: hex }}
                    />
                    {hex}
                  </span>
                ))}
              </div>
            </div>

            {/* Pré-visualização a 32 px dedicada */}
            <div className="lg:col-span-2 rounded-2xl border border-stone-200 bg-[#FAF7F2] p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-800">
                  Escala 32 px
                </span>
                <p className="mt-1 text-[11px] text-stone-600">
                  Leitura real de favicon e perfil miniatura.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white p-4">
                  <img
                    src={vetorState.preview32DataUrl}
                    alt="Pré-visualização a 32 px sobre fundo claro"
                    width={32}
                    height={32}
                    className="h-8 w-8 object-contain"
                  />
                  <span className="font-mono text-[10px] text-stone-500">32×32 claro</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-stone-800 bg-stone-900 p-4">
                  <img
                    src={svgToDataUrl(vetorState.simboloNegativoSvg || vetorState.simboloSvg)}
                    alt="Pré-visualização a 32 px sobre fundo escuro"
                    width={32}
                    height={32}
                    className="h-8 w-8 object-contain"
                  />
                  <span className="font-mono text-[10px] text-stone-300">32×32 escuro</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-200 pt-6">
            <p className="text-xs text-stone-600">
              Ao confirmar, as <strong>5 variantes</strong> (Principal, Ícone, Horizontal, Fundo claro e Fundo escuro) serão geradas diretamente a partir deste vetor.
            </p>
            <button
              type="button"
              id="btn-confirmar-vetor"
              disabled={Boolean(busyDetail)}
              onClick={executeConfirmVectorAndVariants}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-stone-900"
            >
              <CheckCircle2 className="h-4 w-4 text-amber-300" />
              <span>Confirmar vetor e avançar para Paleta</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* =====================================================================
          PASSO 5: PALETA E TIPOGRAFIA (2 PROPOSTAS + VER MAIS)
      ===================================================================== */}
      {step === "paleta" && (
        <section className="space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Passo 5 de 8 • Paleta e Tipografia • Regra das 2 Escolhas
              </p>
              <h1 className="mt-1 text-2xl font-bold text-stone-950 sm:text-3xl">
                Duas propostas distintas de paleta e par de tipos
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                Nunca apenas as mesmas cores trocadas de ordem: cada proposta tem personalidade tipográfica e hierarquia cromática própria.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(vetorState ? "vetor" : "logotipo")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar</span>
              </button>

              {!showAllProposals && propostas.length > 2 && (
                <button
                  type="button"
                  id="btn-ver-mais-propostas"
                  onClick={() => setShowAllProposals(true)}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-stone-900 bg-[#FAF7F2] px-4 py-2.5 text-xs font-bold text-stone-900 transition hover:bg-stone-900 hover:text-stone-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>Ver mais propostas (+2)</span>
                </button>
              )}
            </div>
          </div>

          {/* Grelha de propostas com botões nativos acessíveis */}
          <div className="grid gap-6 md:grid-cols-2">
            {(showAllProposals ? propostas : propostas.slice(0, 2)).map((prop) => {
              const isSelected = selectedProposalId === prop.id;
              const fp = FONT_PAIRS[prop.fontPairId];

              return (
                <button
                  key={prop.id}
                  type="button"
                  id={`card-proposta-${prop.id}`}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectProposal(prop)}
                  className={`flex flex-col justify-between rounded-3xl border-2 p-6 text-left transition space-y-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
                    isSelected
                      ? "border-stone-950 bg-white ring-2 ring-stone-900/15 shadow-sm"
                      : "border-stone-200 bg-white/95 hover:border-stone-400"
                  }`}
                >
                  <div className="w-full space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold ${
                            isSelected
                              ? "bg-stone-900 text-amber-300"
                              : "bg-stone-100 text-stone-800"
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                          Proposta {prop.titulo}
                        </span>
                        <h2 className="mt-2 text-lg font-bold text-stone-950">
                          {prop.subtitulo}
                        </h2>
                      </div>
                      <span className="rounded-lg border border-stone-200 bg-[#FAF7F2] px-2.5 py-1 text-xs font-bold text-stone-800">
                        Par: {fp.nome}
                      </span>
                    </div>

                    <div
                      className="rounded-2xl border border-stone-200 p-5 space-y-1.5"
                      style={{
                        backgroundColor: prop.paleta.papel.hex,
                        borderLeft: `8px solid ${prop.paleta.primaria.hex}`,
                      }}
                    >
                      <p
                        style={{
                          fontFamily: fp.tituloFamily,
                          fontWeight: fp.tituloWeight,
                          color: prop.paleta.tinta.hex,
                        }}
                        className="text-xl leading-tight"
                      >
                        {dados.nome || "Forno da Vilariça"}
                      </p>
                      <p
                        style={{
                          fontFamily: fp.textoFamily,
                          fontWeight: fp.textoWeight,
                          color: prop.paleta.primaria.hex,
                        }}
                        className="text-sm"
                      >
                        {dados.slogan || dados.servicos || fp.serveSobretudo}
                      </p>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { label: "Primária", c: prop.paleta.primaria },
                        { label: "Secund.", c: prop.paleta.secundaria },
                        { label: "Papel", c: prop.paleta.papel },
                        { label: "Tinta", c: prop.paleta.tinta },
                        { label: "Neutro", c: prop.paleta.neutro },
                      ].map((sw) => (
                        <div key={sw.label} className="min-w-0 space-y-1">
                          <div
                            className="h-10 w-full rounded-xl border border-stone-300"
                            style={{ backgroundColor: sw.c.hex }}
                          />
                          <p className="truncate text-[11px] font-bold text-stone-800">
                            {sw.label}
                          </p>
                          <p className="truncate font-mono text-[10px] text-stone-500">
                            {sw.c.hex}
                          </p>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-stone-600 leading-relaxed">
                      {prop.descricao}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Afinação manual das 4 cores + Par Tipográfico */}
          <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-stone-950 flex items-center gap-2">
                <Palette className="h-5 w-5 text-amber-800" />
                <span>Afinação manual de cores e tipos (opcional)</span>
              </h2>
              <p className="text-xs text-stone-600 mt-1">
                O neutro (<strong>{customPalette.neutro.hex}</strong>) é calculado automaticamente entre Papel e Tinta.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {(
                [
                  { key: "primaria", label: "1. Primária", entry: customPalette.primaria },
                  { key: "secundaria", label: "2. Secundária", entry: customPalette.secundaria },
                  { key: "papel", label: "3. Papel", entry: customPalette.papel },
                  { key: "tinta", label: "4. Tinta", entry: customPalette.tinta },
                ] as const
              ).map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-3.5 space-y-2"
                >
                  <label className="block text-xs font-bold text-stone-800">
                    {item.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={item.label}
                      value={item.entry.hex}
                      onChange={(e) => handleCustomColorChange(item.key, e.target.value)}
                      className="h-9 w-11 cursor-pointer rounded-lg border border-stone-300 bg-white p-0.5"
                    />
                    <input
                      type="text"
                      aria-label={`Hexadecimal ${item.label}`}
                      value={item.entry.hex}
                      onChange={(e) => handleCustomColorChange(item.key, e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 font-mono text-xs text-stone-950"
                    />
                  </div>
                </div>
              ))}

              <div className="rounded-2xl border border-stone-200 bg-stone-100 p-3.5 space-y-2">
                <span className="block text-xs font-bold text-stone-700">
                  5. Neutro (Automático)
                </span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-9 w-11 rounded-lg border border-stone-300 shrink-0"
                    style={{ backgroundColor: customPalette.neutro.hex }}
                  />
                  <span className="font-mono text-xs font-bold text-stone-900">
                    {customPalette.neutro.hex}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                Par tipográfico ativo
              </span>
              <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                {Object.values(FONT_PAIRS).map((fp) => (
                  <button
                    key={fp.id}
                    type="button"
                    aria-pressed={selectedFontPair === fp.id}
                    onClick={() => setSelectedFontPair(fp.id)}
                    className={`rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-stone-900 ${
                      selectedFontPair === fp.id
                        ? "border-stone-900 bg-stone-900 text-stone-50"
                        : "border-stone-200 bg-[#FAF7F2] text-stone-800 hover:border-stone-400"
                    }`}
                  >
                    <p className="text-xs font-bold">{fp.nome}</p>
                    <p className="text-[11px] opacity-85 mt-0.5 truncate">
                      {fp.tituloFamily} + {fp.textoFamily}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t border-stone-200 pt-6">
              <button
                type="button"
                id="btn-avancar-capas"
                onClick={() => setStep("capas")}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-stone-900"
              >
                <span>Aprovar Paleta e Escolher Capa em Camadas</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          PASSO 6: CAPAS EM CAMADAS (SEMPRE 1 MODERNA + 1 CLÁSSICA + CATÁLOGO 6)
      ===================================================================== */}
      {step === "capas" && (
        <section className="space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Passo 6 de 8 • Capas Nascidas do Logótipo • 1 Moderna + 1 Clássica
              </p>
              <h1 className="mt-1 text-2xl font-bold text-stone-950 sm:text-3xl">
                Escolha o layout da sua capa (nascido do logótipo e com os seus dados reais)
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                As capas e publicações nascem do logótipo escolhido (referência, paleta, formas e estilo), compondo por cima apenas o logótipo vetorizado e os seus dados reais com contraste WCAG AA.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStep("paleta")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar à Paleta</span>
              </button>

              {!showAllCapas && (
                <button
                  type="button"
                  id="btn-outras-2-capas"
                  disabled={capasLoading}
                  onClick={() => setCapaRound((r) => (r >= 3 ? 1 : r + 1))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-[#FAF7F2] px-4 py-2.5 text-xs font-bold text-stone-900 hover:bg-stone-200"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Ver outras 2 ({capaRound}/3)</span>
                </button>
              )}

              <button
                type="button"
                id="btn-toggle-capas-catalogo"
                disabled={capasLoading}
                onClick={() => setShowAllCapas((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-stone-900 bg-white px-4 py-2.5 text-xs font-bold text-stone-950 hover:bg-stone-900 hover:text-stone-50"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>
                  {showAllCapas ? "Mostrar par (1 Moderna + 1 Clássica)" : "Ver catálogo (6 layouts)"}
                </span>
              </button>
            </div>
          </div>

          {capasLoading && (
            <div role="status" className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-950">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>A criar as tuas propostas… a compor as camadas de capa com o seu logótipo…</span>
            </div>
          )}

          {/* Grelha de capas pré-visualizadas */}
          <div className="grid gap-6 md:grid-cols-2">
            {capasPreviews.map(({ spec, previewDataUrl, audit }) => {
              const isSelected = selectedCoverLayoutId === spec.id;

              return (
                <button
                  key={spec.id}
                  type="button"
                  id={`card-capa-${spec.id}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedCoverLayoutId(spec.id);
                    setKitStyle(spec.estiloSugerido);
                    setStyleOverrides((prev) => ({
                      ...prev,
                      capas: spec.estiloSugerido,
                    }));
                  }}
                  className={`flex flex-col justify-between rounded-3xl border-2 p-5 text-left transition space-y-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
                    isSelected
                      ? "border-stone-950 bg-white ring-2 ring-stone-900/15 shadow-sm"
                      : "border-stone-200 bg-white/95 hover:border-stone-400"
                  }`}
                >
                  <div className="w-full space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                            spec.categoria === "moderno"
                              ? "bg-stone-900 text-amber-300"
                              : "bg-amber-100 text-amber-950"
                          }`}
                        >
                          {spec.categoria === "moderno" ? "Moderno" : "Clássico"}
                        </span>
                        <h2 className="text-base font-bold text-stone-950">
                          {spec.nome}
                        </h2>
                      </div>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-950">
                          <Check className="h-3 w-3" />
                          Selecionada
                        </span>
                      )}
                    </div>

                    <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
                      <img
                        src={previewDataUrl}
                        alt={`Pré-visualização capa ${spec.nome}`}
                        className="w-full h-auto object-cover"
                      />
                    </div>

                    <p className="text-xs text-stone-600 leading-relaxed">
                      {spec.descricao}
                    </p>

                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span
                        title={audit.promptResumo}
                        className="rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-950"
                      >
                        {audit.referenciaLogoUsada
                          ? `Nascida do logótipo (${audit.estiloDoLogotipo}) ✓`
                          : `ADN do logótipo (${audit.estiloDoLogotipo}) ✓`}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 font-semibold ${
                          audit.wcagAaPassed
                            ? "bg-emerald-100 text-emerald-950"
                            : "bg-amber-100 text-amber-950"
                        }`}
                      >
                        WCAG AA {audit.contrastRatio}:1
                      </span>
                      <span className="rounded-md bg-stone-100 px-2 py-0.5 font-semibold text-stone-800">
                        Logo {Math.round(audit.logoHeightRatio * 100)}% altura
                      </span>
                      <span className="rounded-md bg-stone-100 px-2 py-0.5 font-semibold text-stone-800">
                        {audit.safeZoneRespectsAvatar ? "Zona segura avatar ✓" : "Zona ajustada"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Painel colapsável para estilos por grupo e fotografia opcional */}
          <div className="rounded-3xl border border-stone-200 bg-white p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-stone-950">
                  Estilo das restantes peças e fotografia de fundo (opcional)
                </h2>
                <p className="text-xs text-stone-600">
                  Por omissão os outros formatos seguem as recomendações para{" "}
                  <strong>{SECTORS[dados.sector]?.rotulo}</strong>. Pode ajustar grupo a grupo se desejar.
                </p>
              </div>
              <button
                type="button"
                id="btn-toggle-estilos-avancados"
                onClick={() => setShowGroupOverridesPanel((v) => !v)}
                className="rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2 text-xs font-bold text-stone-900 hover:bg-stone-200"
              >
                {showGroupOverridesPanel ? "Ocultar ajustes por grupo" : "Ajustar estilos por grupo"}
              </button>
            </div>

            {/* Upload de foto opcional para capas/peças fotográficas */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-[#FAF7F2] p-4">
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-stone-900">
                  Fotografia personalizada para o recorte / fundos fotográficos
                </p>
                <p className="text-stone-600">
                  {photoFilename
                    ? `Fotografia carregada: ${photoFilename}`
                    : "Sem foto carregada, utiliza a fotografia de demonstração da padaria."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-stone-800">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Carregar foto</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === "string") {
                          setPhotoDataUrl(reader.result);
                          setPhotoFilename(f.name);
                        }
                      };
                      reader.readAsDataURL(f);
                    }}
                    className="hidden"
                  />
                </label>
                {photoDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoDataUrl("");
                      setPhotoFilename("");
                    }}
                    className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-red-700"
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>

            {needsPhotoForNonCover && !photoDataUrl && (
              <p className="text-xs font-bold text-red-700">
                Selecionou «Fotografia» para publicação/story/estacionário — carregue uma foto ou escolha outro estilo abaixo.
              </p>
            )}

            {showGroupOverridesPanel && (
              <div className="divide-y divide-stone-200 pt-2">
                {STYLE_GROUPS.map((grp) => {
                  const recPair = SECTORS[dados.sector].recomendacoes[grp.key];
                  const currentStyle = styleOverrides[grp.key];
                  const isCatalogOpen = Boolean(openGroupCatalog[grp.key]);
                  const visibleStyles: StyleId[] = isCatalogOpen
                    ? (Object.keys(CONTENT_STYLES) as StyleId[])
                    : Array.from(new Set([...recPair, currentStyle]));

                  return (
                    <div
                      key={grp.key}
                      className="py-4 first:pt-0 last:pb-0 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="text-xs">
                        <p className="font-bold text-stone-900">{grp.rotulo}</p>
                        <p className="text-stone-600">{grp.descricao}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {visibleStyles.map((stId) => {
                          const st = CONTENT_STYLES[stId];
                          const isSelected = currentStyle === stId;
                          return (
                            <button
                              key={stId}
                              type="button"
                              onClick={() =>
                                setStyleOverrides((prev) => ({
                                  ...prev,
                                  [grp.key]: stId,
                                }))
                              }
                              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                                isSelected
                                  ? "border-stone-900 bg-stone-900 text-stone-50"
                                  : "border-stone-300 bg-[#FAF7F2] text-stone-800 hover:border-stone-500"
                              }`}
                            >
                              {st.nome}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() =>
                            setOpenGroupCatalog((prev) => ({
                              ...prev,
                              [grp.key]: !prev[grp.key],
                            }))
                          }
                          className="rounded-xl border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-stone-100"
                        >
                          {isCatalogOpen ? "Fechar" : "Ver catálogo"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-200 pt-5">
              <span className="text-xs text-stone-600">
                Capa ativa: <strong>{selectedCoverLayoutId}</strong>
              </span>
              <button
                type="button"
                id="btn-gerar-kit-final"
                disabled={Boolean(busyDetail)}
                onClick={handleGenerateFullKit}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-bold text-stone-50 shadow-sm transition hover:bg-stone-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-stone-900"
              >
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>Gerar os 36 Ficheiros e Pré-visualizar</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          PASSO 7: PRÉ-VISUALIZAÇÃO COMPLETA DAS 36 PEÇAS
      ===================================================================== */}
      {step === "previsualizacao" && generatedKit && (
        <section className="space-y-6">
          <div className="rounded-3xl border border-stone-900 bg-stone-900 p-6 sm:p-8 text-stone-50 shadow-sm">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Passo 7 de 8 • 36 ficheiros gerados e verificados</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Pré-visualização do Kit — {generatedKit.dados.nome}
                </h1>
                <p className="text-xs text-stone-300">
                  Layout de capa: <strong>{generatedKit.coverLayoutId || selectedCoverLayoutId}</strong> • Par:{" "}
                  <strong>{FONT_PAIRS[generatedKit.fontPairId]?.nome}</strong> • Validade local: 6 horas.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep("capas")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-800 px-4 py-2.5 text-xs font-semibold text-stone-200 hover:bg-stone-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Trocar capa</span>
                </button>
                <button
                  type="button"
                  id="btn-avancar-zip"
                  onClick={() => setStep("zip")}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-stone-950 transition hover:bg-amber-300"
                >
                  <FileArchive className="h-4 w-4" />
                  <span>Avançar para Transferência ZIP</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: "todas", label: "Todas (36)" },
                { key: "variantes", label: "Variantes (5)" },
                { key: "redes", label: "Redes e Perfis (16)" },
                { key: "favicon", label: "Favicon (6)" },
                { key: "email", label: "Email (2)" },
                { key: "impressao", label: "Impressão PDF (2)" },
                { key: "guia", label: "Guia A4 (1)" },
                { key: "metadados", label: "Paleta & LEIA-ME (4)" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveResultCategory(tab.key)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  activeResultCategory === tab.key
                    ? "bg-stone-900 text-stone-50"
                    : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FORMAT_SPECS.filter(
              (s) =>
                activeResultCategory === "todas" ||
                s.categoria === activeResultCategory
            ).map((spec) => {
              const fileUrl = `/api/kits/${generatedKit.id}?ficheiro=${encodeURIComponent(
                spec.ficheiro
              )}`;

              let previewImgUrl: string | null = null;
              if (spec.tipo === "PNG" || spec.tipo === "SVG" || spec.tipo === "ICO") {
                previewImgUrl = fileUrl;
              } else if (spec.ficheiro === "impressao/cartao-de-visita.pdf") {
                previewImgUrl = `/api/kits/${generatedKit.id}?ficheiro=_previews/cartao.png`;
              } else if (spec.ficheiro === "impressao/papel-de-carta.pdf") {
                previewImgUrl = `/api/kits/${generatedKit.id}?ficheiro=_previews/papel.png`;
              } else if (spec.ficheiro === "guia-de-marca/guia-de-marca.pdf") {
                previewImgUrl = `/api/kits/${generatedKit.id}?ficheiro=_previews/guia.png`;
              }

              return (
                <div
                  key={spec.id}
                  className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs space-y-3"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-stone-950">
                          {spec.nome}
                        </h3>
                        <p className="truncate font-mono text-[11px] text-amber-900">
                          {spec.ficheiro}
                        </p>
                      </div>
                      <span className="rounded-md border border-stone-200 bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-800 shrink-0">
                        {spec.medidaLabel}
                      </span>
                    </div>

                    {previewImgUrl ? (
                      <div
                        className={`flex h-44 items-center justify-center rounded-xl border border-stone-200 p-3 overflow-hidden ${
                          spec.opaque ? "bg-stone-100" : "checkerboard-bg"
                        }`}
                      >
                        <img
                          src={previewImgUrl}
                          alt={spec.nome}
                          className="max-h-full max-w-full object-contain rounded-sm"
                        />
                      </div>
                    ) : spec.ficheiro === "email/assinatura.html" ? (
                      <div className="h-44 overflow-hidden rounded-xl border border-stone-200 bg-white">
                        <iframe
                          title="Assinatura HTML"
                          src={`${fileUrl}&preview=1`}
                          className="h-full w-full border-0"
                        />
                      </div>
                    ) : (
                      <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-stone-200 bg-[#FAF7F2] p-4 text-center space-y-1.5">
                        <FileText className="h-7 w-7 text-stone-500" />
                        <span className="text-xs font-semibold text-stone-700">
                          Ficheiro {spec.tipo} pronto no ZIP
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-stone-100 pt-2.5 text-xs">
                    <span className="text-stone-500">{spec.tipo}</span>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-stone-800 hover:text-amber-800"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Abrir</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =====================================================================
          PASSO 8: ECRÃ FINAL DE DESCARREGAMENTO DO ZIP (36 FICHEIROS)
      ===================================================================== */}
      {step === "zip" && generatedKit && (
        <section className="mx-auto max-w-3xl rounded-3xl border border-stone-200 bg-white p-6 sm:p-10 shadow-xs space-y-8">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-900 text-amber-300">
              <FileArchive className="h-8 w-8" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
              Passo 8 de 8 • Entrega Final
            </p>
            <h1 className="text-2xl font-bold text-stone-950 sm:text-3xl">
              O seu kit PandoMarca está pronto
            </h1>
            <p className="text-sm text-stone-600 max-w-xl mx-auto">
              Arquivo determinístico com exatamente <strong>36 ficheiros</strong> nas medidas oficiais de 15 de novembro de 2026, pronto para redes sociais, website, email e gráfica.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-5 grid gap-4 sm:grid-cols-2 text-xs">
            <div>
              <span className="font-bold uppercase tracking-wider text-stone-500">
                Ficheiro ZIP
              </span>
              <p className="mt-1 font-mono font-bold text-stone-950 break-all">
                {generatedKit.zipFilename}
              </p>
            </div>
            <div>
              <span className="font-bold uppercase tracking-wider text-stone-500">
                Marca & Acesso
              </span>
              <p className="mt-1 font-bold text-stone-950">
                {generatedKit.dados.nome} (
                {entitlement?.kind === "website_bonus"
                  ? "Oferta Website PandoWeb"
                  : entitlement?.kind === "standalone"
                  ? "Produto Individual • Preço a definir"
                  : "Validado"}
                )
              </p>
            </div>
            <div>
              <span className="font-bold uppercase tracking-wider text-stone-500">
                Capa selecionada
              </span>
              <p className="mt-1 font-semibold text-stone-800">
                {generatedKit.coverLayoutId || selectedCoverLayoutId}
              </p>
            </div>
            <div>
              <span className="font-bold uppercase tracking-wider text-stone-500">
                Tipografia
              </span>
              <p className="mt-1 font-semibold text-stone-800">
                {FONT_PAIRS[generatedKit.fontPairId]?.nome}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <a
              href={`/api/kits/${generatedKit.id}?download=1`}
              id="btn-download-zip"
              download={generatedKit.zipFilename}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-2xl bg-stone-900 px-8 py-4 text-base font-bold text-amber-300 shadow-sm transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
            >
              <Download className="h-5 w-5" />
              <span>Descarregar ZIP (36 ficheiros)</span>
            </a>

            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStep("previsualizacao")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-stone-700 hover:bg-stone-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Rever todas as 36 pré-visualizações</span>
              </button>

              <a
                href={`/api/kits/${generatedKit.id}?ficheiro=${encodeURIComponent(
                  "guia-de-marca/guia-de-marca.pdf"
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-stone-700 hover:bg-stone-100"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Abrir Guia de Marca A4 (PDF)</span>
              </a>

              <button
                type="button"
                onClick={handleResetSession}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-stone-700 hover:bg-stone-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Criar novo kit</span>
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
