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
  Monitor,
  Palette,
  PenTool,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import {
  REDES_SOCIAIS_CONFIG,
  REDES_SOCIAIS_LIST,
  REFERENCE_DATE_REDES_PT,
  TOM_DA_MARCA_SPECS,
  TONS_DA_MARCA_LIST,
  type RedeSocialId,
  type TomDaMarca,
} from "@/lib/config/redes-sociais";
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
  StyleGroupOverrides,
  StyleId,
} from "@/lib/formats";
import { buildBrandPalette, PaletteAndTypeProposal } from "@/lib/palette";
import { SAMPLE_BRANDS } from "@/lib/samples";
import type { DraftMeta, KitMeta } from "@/lib/storage";
import type {
  LogoPropostaIA,
  OrcamentoKitEstado,
  PublicImagemConfig,
} from "@/lib/imagem";
import { Circle40pxTestPreview, SafeZoneSocialFrame } from "./safe-zone-preview";
import {
  PecaPropostaPreview,
  StudioSessionSnapshot,
  WIZARD_STEPS,
  WizardStepId,
} from "./wizard-types";

const SESSION_STORAGE_KEY = "pandomarca:studio:v3";

const DEFAULT_BRAND_DATA: BrandData = {
  nome: "",
  sector: "restauracao",
  tom: "tradicional",
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
  modelo: "gemini-nano-banana-2.1",
  limitePorKitEur: 1.5,
  maxRondas: 3,
  maxAjustes: 3,
  semCustosReais: true,
  etiquetaModo: "Modo de demonstração",
};

const PROPOSTA_FEATURED_REDES: { id: RedeSocialId; label: string }[] = [
  { id: "fb-capa", label: "Facebook Capa (1640×624)" },
  { id: "ig-publicacao-1080x1350", label: "IG Feed 4:5 (1080×1350)" },
  { id: "ig-publicacao", label: "IG Feed 1:1 (1080×1080)" },
  { id: "ig-story", label: "IG Story (1080×1920)" },
  { id: "yt-banner", label: "YouTube Banner (2560×1440)" },
  { id: "fb-perfil", label: "Avatar Circular (720×720)" },
  { id: "li-capa-empresa", label: "LinkedIn Página (1128×191)" },
];

const STATIONERY_GROUPS = [
  {
    key: "cartao" as const,
    rotulo: "Cartão de visita (PDF 91×61 mm)",
    descricao: "Frente e verso com sangria de 3 mm",
  },
  {
    key: "papel" as const,
    rotulo: "Papel de carta A4 (PDF)",
    descricao: "Cabeçalho estilizado, miolo limpo e rodapé",
  },
  {
    key: "assinatura" as const,
    rotulo: "Assinatura de email (HTML)",
    descricao: "Tabela HTML com CSS em linha",
  },
];

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
    try {
      const compact: StudioSessionSnapshot = {
        ...snapshot,
        propostasIA: null,
        chosenLogoOriginalDataUrl: undefined,
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
  const [imagemConfig, setImagemConfig] =
    useState<PublicImagemConfig>(DEFAULT_IMAGEM_CONFIG);
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

  // 3. Dados do negócio e Tom da marca
  const [dados, setDados] = useState<BrandData>(DEFAULT_BRAND_DATA);
  const [tom, setTom] = useState<TomDaMarca>("tradicional");
  const [usarVetorizacaoOpcional, setUsarVetorizacaoOpcional] = useState(false);
  const [tresPalavras, setTresPalavras] = useState("");
  const [coresPreferidas, setCoresPreferidas] = useState("");
  const [coresEvitar, setCoresEvitar] = useState("");

  // 4. Fluxo de logótipo por geração de imagem (Entrada A e Entrada B)
  const [rondaAtual, setRondaAtual] = useState<number>(1);
  const [ajustesUsados, setAjustesUsados] = useState<number>(0);
  const [orcamento, setOrcamento] = useState<OrcamentoKitEstado | null>(null);
  const [propostasIA, setPropostasIA] = useState<[LogoPropostaIA, LogoPropostaIA] | null>(
    null
  );
  const [ajustarAlvoId, setAjustarAlvoId] = useState<string | null>(null);
  const [ajusteInstrucao, setAjusteInstrucao] = useState("");
  const [chosenLogoOriginalDataUrl, setChosenLogoOriginalDataUrl] = useState<string>("");
  const [chosenLogoFixtureNome, setChosenLogoFixtureNome] = useState<string>("");
  const [chosenLogoEstilo, setChosenLogoEstilo] = useState<"classico" | "moderno">(
    "classico"
  );

  // Entrada B (ficheiro existente)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<DraftMeta | null>(null);

  // 5. Propostas de Paleta e Tipografia
  const [propostas, setPropostas] = useState<PaletteAndTypeProposal[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState<string>("direta");
  const [showAllProposals, setShowAllProposals] = useState(false);
  const [customPalette, setCustomPalette] = useState<BrandPalette>(DEFAULT_PALETTE);
  const [selectedFontPair, setSelectedFontPair] = useState<FontPairId>("clara");

  // Estacionário opcional (Cartão / Papel / Assinatura)
  const [kitStyle, setKitStyle] = useState<StyleId>("degrade");
  const [styleOverrides, setStyleOverrides] =
    useState<StyleGroupOverrides>(DEFAULT_STYLE_OVERRIDES);
  const [openGroupCatalog, setOpenGroupCatalog] = useState<Record<string, boolean>>({});
  const [showStationeryPanel, setShowStationeryPanel] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>("");
  const [photoFilename, setPhotoFilename] = useState<string>("");

  // 6. Passo 5 — Propostas visuais da marca (Moderna + Clássica) com referência obrigatória
  const [estiloVisual, setEstiloVisual] = useState<"moderno" | "classico">("moderno");
  const [activePropostaRedeId, setActivePropostaRedeId] =
    useState<RedeSocialId>("fb-capa");
  const [propostaViewport, setPropostaViewport] = useState<"desktop" | "mobile">(
    "desktop"
  );
  const [showSafeZonesOnPropostas, setShowSafeZonesOnPropostas] = useState(true);
  const [propostasPecas, setPropostasPecas] = useState<PecaPropostaPreview[]>([]);
  const [propostasAvisoTextos, setPropostasAvisoTextos] = useState<string>(
    "Verifique os textos gerados na imagem face aos dados introduzidos; se alguma palavra precisar de correção, clique em «Regenerar»."
  );
  const [propostasLoading, setPropostasLoading] = useState(false);
  const [regeneratingEstilo, setRegeneratingEstilo] = useState<
    "moderno" | "classico" | null
  >(null);
  const propostasAbortRef = useRef<AbortController | null>(null);
  const propostasReqSeqRef = useRef(0);

  // 7. Passo 6 & 7 — Pré-visualização (38 peças), zonas seguras, 40 px e regeneração
  const [generatedKit, setGeneratedKit] = useState<KitMeta | null>(null);
  const [activeResultCategory, setActiveResultCategory] =
    useState<FormatCategory | "todas">("todas");
  const [subFilterRedes, setSubFilterRedes] = useState<
    "todas" | "perfis" | "capas-posts"
  >("todas");
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">(
    "desktop"
  );
  const [showSafeZonesOnPreview, setShowSafeZonesOnPreview] = useState(true);
  const [regeneratingRedeId, setRegeneratingRedeId] = useState<RedeSocialId | null>(null);
  const [cacheBusters, setCacheBusters] = useState<Record<string, number>>({});

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

  // Hidratação inicial: valida cookie no servidor e restaura sessão
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
                if (snap?.version === 3) {
                  setSessaoId(snap.sessaoId || makeSessaoId());
                  setEntradaEscolhida(
                    paramEntrada === "A" || paramEntrada === "B"
                      ? paramEntrada
                      : snap.entradaEscolhida || "A"
                  );
                  if (snap.dados) setDados(snap.dados);
                  if (snap.tom && snap.tom in TOM_DA_MARCA_SPECS) setTom(snap.tom);
                  setUsarVetorizacaoOpcional(Boolean(snap.usarVetorizacaoOpcional));
                  if (snap.estiloVisual === "moderno" || snap.estiloVisual === "classico") {
                    setEstiloVisual(snap.estiloVisual);
                  }
                  if (typeof snap.tresPalavras === "string")
                    setTresPalavras(snap.tresPalavras);
                  if (typeof snap.coresPreferidas === "string")
                    setCoresPreferidas(snap.coresPreferidas);
                  if (typeof snap.coresEvitar === "string")
                    setCoresEvitar(snap.coresEvitar);
                  if (snap.rondaAtual) setRondaAtual(snap.rondaAtual);
                  if (typeof snap.ajustesUsados === "number")
                    setAjustesUsados(snap.ajustesUsados);
                  if (snap.draft) setDraft(snap.draft);
                  if (snap.propostas?.length) setPropostas(snap.propostas);
                  if (snap.selectedProposalId)
                    setSelectedProposalId(snap.selectedProposalId);
                  setShowAllProposals(Boolean(snap.showAllProposals));
                  if (snap.customPalette) setCustomPalette(snap.customPalette);
                  if (snap.selectedFontPair) setSelectedFontPair(snap.selectedFontPair);
                  if (snap.kitStyle) setKitStyle(snap.kitStyle);
                  if (snap.styleOverrides) setStyleOverrides(snap.styleOverrides);
                  if (snap.generatedKit) setGeneratedKit(snap.generatedKit);
                  if (snap.activeResultCategory)
                    setActiveResultCategory(snap.activeResultCategory);
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
                  if (snap.orcamento) setOrcamento(snap.orcamento);

                  const validSteps: WizardStepId[] = [
                    "dados",
                    "logotipo",
                    "paleta",
                    "propostas",
                    "previsualizacao",
                    "zip",
                  ];
                  if (snap.step && validSteps.includes(snap.step)) {
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

  // Guardar progresso automaticamente
  useEffect(() => {
    if (!hydratedRef.current || !entitlement) return;
    const snap: StudioSessionSnapshot = {
      version: 3,
      step,
      entradaEscolhida,
      sessaoId,
      dados: { ...dados, tom },
      tom,
      usarVetorizacaoOpcional,
      estiloVisual,
      tresPalavras,
      coresPreferidas,
      coresEvitar,
      rondaAtual,
      ajustesUsados,
      draft,
      propostas,
      selectedProposalId,
      showAllProposals,
      customPalette,
      selectedFontPair,
      kitStyle,
      styleOverrides,
      generatedKit,
      activeResultCategory,
      propostasIA,
      chosenLogoOriginalDataUrl,
      chosenLogoFixtureNome,
      chosenLogoEstilo,
      orcamento,
      imagemConfig,
    };
    persistSnapshotSafely(snap);
  }, [
    entitlement,
    step,
    entradaEscolhida,
    sessaoId,
    dados,
    tom,
    usarVetorizacaoOpcional,
    estiloVisual,
    tresPalavras,
    coresPreferidas,
    coresEvitar,
    rondaAtual,
    ajustesUsados,
    draft,
    propostas,
    selectedProposalId,
    showAllProposals,
    customPalette,
    selectedFontPair,
    kitStyle,
    styleOverrides,
    generatedKit,
    activeResultCategory,
    propostasIA,
    chosenLogoOriginalDataUrl,
    chosenLogoFixtureNome,
    chosenLogoEstilo,
    orcamento,
    imagemConfig,
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
    const presetTom: TomDaMarca =
      presetId === "oficina-do-sao" ? "tecnico" : "tradicional";
    setTom(presetTom);
    setDados({ ...sample.dados, tom: presetTom });
    setTresPalavras(sample.questionarioA.tresPalavras);
    setCoresPreferidas(sample.questionarioA.coresPreferidas);
    setCoresEvitar(sample.questionarioA.coresEvitar);
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
    setTom("tradicional");
    setUsarVetorizacaoOpcional(false);
    setEstiloVisual("moderno");
    setTresPalavras("");
    setCoresPreferidas("");
    setCoresEvitar("");
    setRondaAtual(1);
    setAjustesUsados(0);
    setOrcamento(null);
    setPropostasIA(null);
    setChosenLogoOriginalDataUrl("");
    setChosenLogoFixtureNome("");
    setChosenLogoEstilo("classico");
    setDraft(null);
    setPropostas([]);
    setPropostasPecas([]);
    setGeneratedKit(null);
    setCustomPalette(DEFAULT_PALETTE);
    setSelectedFontPair("clara");
    setCacheBusters({});
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

  // Entrada A: pedir ronda 1..3 (2 propostas de logótipo com o tom escolhido)
  const executeLogoRound = useCallback(
    async (roundNum: number, customSessId?: string) => {
      if (!dados.nome.trim()) {
        setFailure("Indique o nome da marca antes de avançar para o logótipo.");
        return;
      }

      const activeSessId = customSessId || sessaoId;
      clearError();
      setBusyDetail(
        `A gerar 2 propostas de logótipo no tom «${TOM_DA_MARCA_SPECS[tom].nome}» (Ronda ${roundNum} de ${imagemConfig.maxRondas})…`
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
              tom,
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
      tom,
      tresPalavras,
    ]
  );

  // Entrada A: ajustar uma proposta
  async function executeAdjustProposal(proposta: LogoPropostaIA, instrucao: string) {
    const cleanInstr = instrucao.trim();
    if (!cleanInstr) {
      setFailure(
        "Escreva uma instrução curta para ajustar a proposta (ex.: «aumentar contraste e espessura do emblema»)."
      );
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
            tom,
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

  // Entrada A: Escolher logótipo (passa diretamente a imagem de referência obrigatória, sem obrigar a vetorização)
  async function handleChooseIaProposal(proposta: LogoPropostaIA) {
    clearError();
    setBusyDetail(
      "A fixar o logótipo escolhido como imagem de referência para todas as peças seguintes…"
    );

    try {
      const res = await fetch("/api/logotipo-raiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "escolher",
          sessaoId,
          proposta,
          usarVetorizacaoOpcional,
          questionario: {
            nome: dados.nome,
            slogan: dados.slogan,
            sector: dados.sector,
            tom,
            tresPalavras,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFailure(
          data.error || "Não foi possível guardar o logótipo escolhido.",
          () => handleChooseIaProposal(proposta)
        );
        return;
      }

      setDraft(data.draft);
      setPropostas(data.propostas || []);
      setShowAllProposals(false);
      setCustomPalette(proposta.sugestaoPaleta);
      setSelectedFontPair(proposta.sugestaoFontPairId);
      setSelectedProposalId(data.propostas?.[0]?.id || "direta");
      setChosenLogoOriginalDataUrl(proposta.imagemBase64);
      setChosenLogoFixtureNome(proposta.fixtureNome || "");
      setChosenLogoEstilo(proposta.estilo);
      setEstiloVisual(proposta.estilo);
      applySectorDefaultStyles(dados.sector);
      setStep("paleta");
    } catch {
      setFailure(
        "Falha de comunicação ao registar o logótipo escolhido.",
        () => handleChooseIaProposal(proposta)
      );
    } finally {
      setBusyDetail(null);
    }
  }

  // Entrada B: Analisar ficheiro ou preset como imagem de referência
  async function handleAnalyzeEntradaB(
    presetId?: "forno-da-vilarica" | "oficina-do-sao"
  ) {
    clearError();
    let currentDados = { ...dados, tom };
    let currentTom = tom;
    if (presetId) {
      const sample = SAMPLE_BRANDS[presetId];
      currentTom = presetId === "oficina-do-sao" ? "tecnico" : "tradicional";
      currentDados = { ...sample.dados, tom: currentTom };
      setTom(currentTom);
      setDados(currentDados);
      setTresPalavras(sample.questionarioA.tresPalavras);
      setCoresPreferidas(sample.questionarioA.coresPreferidas);
      setCoresEvitar(sample.questionarioA.coresEvitar);
    }

    if (!currentDados.nome.trim()) {
      setFailure("Indique o nome da marca antes de analisar o logótipo.");
      return;
    }

    if (!presetId && !selectedFile) {
      setFailure(
        "Selecione um ficheiro PNG, JPG ou SVG (até 8 MB) ou utilize o ensaio incluído."
      );
      return;
    }

    setBusyDetail("A analisar margem, contraste e extrair a paleta do logótipo de referência…");
    try {
      let res: Response;
      if (presetId) {
        res = await fetch("/api/analisar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId,
            sector: currentDados.sector,
            tom: currentTom,
            nome: currentDados.nome,
            tresPalavras,
          }),
        });
      } else {
        const fd = new FormData();
        fd.append("ficheiro", selectedFile!);
        fd.append("sector", currentDados.sector);
        fd.append("tom", currentTom);
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

  // Carregar par de propostas (1 Moderna em camadas + 1 Clássica) no Passo 5
  const fetchPropostasVisuais = useCallback(
    async (opts?: { redeId?: RedeSocialId; regenerar?: boolean }) => {
      if (!draft?.id) return;
      const targetRede = opts?.redeId ?? activePropostaRedeId;

      if (propostasAbortRef.current) {
        propostasAbortRef.current.abort();
      }
      const controller = new AbortController();
      propostasAbortRef.current = controller;
      const reqSeq = ++propostasReqSeqRef.current;

      setPropostasLoading(true);
      clearError();

      try {
        const res = await fetch("/api/capas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            draftId: draft.id,
            dados: { ...dados, tom },
            paleta: {
              primaria: customPalette.primaria.hex,
              secundaria: customPalette.secundaria.hex,
              papel: customPalette.papel.hex,
              tinta: customPalette.tinta.hex,
            },
            redeId: targetRede,
            regenerar: Boolean(opts?.regenerar),
          }),
        });
        const data = await res.json();
        if (reqSeq !== propostasReqSeqRef.current) return;
        if (!res.ok || !data.ok) {
          setFailure(
            data.error ||
              "Não foi possível gerar as propostas visuais com o logótipo escolhido.",
            () => fetchPropostasVisuais(opts)
          );
          return;
        }
        setPropostasPecas(data.propostas || []);
        if (data.avisoTextos) setPropostasAvisoTextos(data.avisoTextos);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (reqSeq !== propostasReqSeqRef.current) return;
        setFailure("Falha de rede ao gerar as propostas visuais.", () =>
          fetchPropostasVisuais(opts)
        );
      } finally {
        if (reqSeq === propostasReqSeqRef.current) {
          setPropostasLoading(false);
        }
      }
    },
    [
      activePropostaRedeId,
      clearError,
      customPalette.papel.hex,
      customPalette.primaria.hex,
      customPalette.secundaria.hex,
      customPalette.tinta.hex,
      dados,
      draft?.id,
      setFailure,
      tom,
    ]
  );

  // Regenerar apenas uma das propostas no Passo 5 (Moderna OU Clássica)
  async function handleRegenerateSingleProposta(targetEstilo: "moderno" | "classico") {
    if (!draft?.id || propostasLoading) return;
    const requestedRede = activePropostaRedeId;
    const seqAtStart = propostasReqSeqRef.current;
    setRegeneratingEstilo(targetEstilo);
    clearError();

    try {
      const res = await fetch("/api/capas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          dados: { ...dados, tom },
          paleta: {
            primaria: customPalette.primaria.hex,
            secundaria: customPalette.secundaria.hex,
            papel: customPalette.papel.hex,
            tinta: customPalette.tinta.hex,
          },
          redeId: requestedRede,
          apenasUmEstilo: true,
          estiloVisual: targetEstilo,
          regenerar: true,
        }),
      });
      const data = await res.json();
      if (seqAtStart !== propostasReqSeqRef.current) return;
      if (!res.ok || !data.ok || !data.propostas?.[0]) {
        setFailure(data.error || "Não foi possível regenerar esta proposta.");
        return;
      }
      const nova = data.propostas[0] as PecaPropostaPreview;
      setPropostasPecas((prev) =>
        prev.map((item) => (item.estiloVisual === targetEstilo ? nova : item))
      );
    } catch {
      setFailure("Falha de comunicação ao regenerar a proposta.");
    } finally {
      setRegeneratingEstilo(null);
    }
  }

  // Carrega automaticamente quando entra no Passo 5 ou muda o formato social em pré-visualização
  useEffect(() => {
    if (step === "propostas" && draft?.id) {
      fetchPropostasVisuais({ redeId: activePropostaRedeId });
    }
  }, [step, draft?.id, activePropostaRedeId, fetchPropostasVisuais]);

  // Gerar os 38 ficheiros e o ZIP final
  async function handleGenerateFullKit() {
    if (!draft) {
      setFailure("Falta escolher ou analisar o logótipo antes de gerar os 38 ficheiros.");
      return;
    }

    clearError();
    setBusyDetail(
      "A gerar todas as 18 peças sociais com o logótipo como referência, a validar zonas seguras e a empacotar os 38 ficheiros no ZIP…"
    );
    try {
      const res = await fetch("/api/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          dados: { ...dados, tom },
          paleta: {
            primaria: customPalette.primaria.hex,
            secundaria: customPalette.secundaria.hex,
            papel: customPalette.papel.hex,
            tinta: customPalette.tinta.hex,
          },
          fontPairId: selectedFontPair,
          kitStyle,
          estiloVisual,
          usarVetorizacaoOpcional,
          styleOverrides,
          photoDataUrl: photoDataUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFailure(
          data.error || "Não foi possível gerar os 38 ficheiros do kit.",
          handleGenerateFullKit
        );
        if (data.code === "expired_draft") {
          setDraft(null);
        }
        return;
      }

      setGeneratedKit(data.kit);
      setCacheBusters({});
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

  // Regenerar uma peça social individual já dentro do kit gerado (Passo 6)
  async function handleRegenerateKitPiece(redeId: RedeSocialId) {
    if (!generatedKit) return;
    setRegeneratingRedeId(redeId);
    clearError();

    try {
      const res = await fetch(`/api/kits/${generatedKit.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "regenerar",
          redeId,
          estiloVisual,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFailure(data.error || "Não foi possível regenerar a peça selecionada.");
        return;
      }
      if (data.kit) {
        setGeneratedKit(data.kit);
      }
      const cfg = REDES_SOCIAIS_CONFIG[redeId];
      setCacheBusters((prev) => ({
        ...prev,
        [cfg.ficheiro]: Date.now(),
      }));
    } catch {
      setFailure("Erro de ligação ao regenerar a peça do kit.");
    } finally {
      setRegeneratingRedeId(null);
    }
  }

  const maxStepReachedIdx = useMemo(() => {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === step);
    let maxIdx = idx;
    if (generatedKit) maxIdx = Math.max(maxIdx, 6);
    else if (draft) maxIdx = Math.max(maxIdx, 4);
    else if (propostasIA) maxIdx = Math.max(maxIdx, 2);
    else if (entitlement) maxIdx = Math.max(maxIdx, 1);
    return maxIdx;
  }, [step, generatedKit, draft, propostasIA, entitlement]);

  const needsPhotoForStationery = (["cartao", "papel"] as const).some(
    (g) => styleOverrides[g] === "fotografia"
  );

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

  const activePropostaRede = REDES_SOCIAIS_CONFIG[activePropostaRedeId];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6 overflow-x-clip">
      {/* Barra superior: direito de acesso + modelo/modo de imagem + ações */}
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
              <span>
                {imagemConfig.etiquetaModo} • {imagemConfig.modelo}
              </span>
            </span>

            <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-800">
              Tom: {TOM_DA_MARCA_SPECS[tom].nome}
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

      {/* Barra passo a passo (7 passos) */}
      {entitlement && (
        <nav
          aria-label="Passos do assistente PandoMarca"
          className="rounded-2xl border border-stone-200 bg-white p-3 shadow-2xs"
        >
          <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
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

      {/* Banner de erro com «Tentar de novo» */}
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

      {/* Indicador de progresso */}
      {busyDetail && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3.5 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-xs"
        >
          <Loader2 className="h-5 w-5 animate-spin text-amber-800 shrink-0" />
          <div>
            <p className="text-sm font-bold">A preparar as peças por geração de imagem…</p>
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
                Passo 1 de 7 • Porta de Acesso
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
                  Aceita códigos <strong>Oferta Website PandoWeb</strong> ou{" "}
                  <strong>Produto Individual</strong> (preço a definir). Ambos entregam o mesmo kit de 38 ficheiros.
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
                      <span>A validar código…</span>
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
          PASSO 2: DADOS DO NEGÓCIO E TOM DA MARCA
      ===================================================================== */}
      {step === "dados" && (
        <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-10 shadow-xs space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-6">
            <div className="space-y-1 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Passo 2 de 7 • Dados e Tom da Marca
              </p>
              <h1 className="text-2xl font-bold text-stone-950 sm:text-3xl">
                Conte-nos sobre a sua marca e defina o tom visual
              </h1>
              <p className="text-sm text-stone-600">
                Os prompts de geração de imagem nascem do tom selecionado e do sector. Os textos pedidos nas peças sociais usam apenas os campos preenchidos (sem textos nem contactos inventados).
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

          {/* Escolha da entrada A ou B */}
          <div className="space-y-2.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-stone-700">
              Como prefere obter o logótipo de referência?
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
                  Entrada A — Criar logótipo de raiz por IA
                </span>
                <span className="text-base font-bold text-stone-950">
                  Comparar 2 propostas por ronda e escolher a referência oficial
                </span>
                <span className="text-xs text-stone-600 leading-relaxed">
                  Gera 2 propostas de logótipo com base no tom da marca ({imagemConfig.modelo}), permite afinar e define a escolhida como referência obrigatória de todas as peças.
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
                  Carregar PNG, JPG ou SVG como referência obrigatória
                </span>
                <span className="text-xs text-stone-600 leading-relaxed">
                  Limpa fundos lisos da margem, extrai a paleta cromática e usa o seu logótipo diretamente como imagem de referência para capas, avatares e publicações.
                </span>
              </button>
            </div>
          </div>

          {/* Seletor de Tom da Marca (6 tons oficiais) */}
          <div className="space-y-3">
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                Tom visual da marca * (guia os prompts de logótipo, avatares e capas)
              </span>
              <p className="mt-0.5 text-xs text-stone-600">
                {TOM_DA_MARCA_SPECS[tom].direcaoEstetica}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TONS_DA_MARCA_LIST.map((t) => {
                const isSelected = tom === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    id={`btn-tom-${t.id}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      setTom(t.id);
                      setDados((prev) => ({ ...prev, tom: t.id }));
                    }}
                    className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 p-4 text-left transition focus-visible:outline-2 focus-visible:outline-stone-900 ${
                      isSelected
                        ? "border-stone-950 bg-stone-900 text-stone-50 shadow-xs"
                        : "border-stone-200 bg-[#FAF7F2] text-stone-900 hover:border-stone-400"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-sm font-bold">{t.nome}</span>
                      {isSelected && <Check className="h-4 w-4 text-amber-300" />}
                    </div>
                    <span
                      className={`text-xs leading-snug ${
                        isSelected ? "text-stone-300" : "text-stone-600"
                      }`}
                    >
                      {t.resumo}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formulário principal */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label
                htmlFor="input-nome"
                className="block text-xs font-bold uppercase tracking-wider text-stone-700"
              >
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
              <label
                htmlFor="select-sector"
                className="block text-xs font-bold uppercase tracking-wider text-stone-700"
              >
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
              <label
                htmlFor="input-slogan"
                className="block text-xs font-bold uppercase tracking-wider text-stone-700"
              >
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
              <label
                htmlFor="input-servicos"
                className="block text-xs font-semibold text-stone-700"
              >
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
              <label
                htmlFor="input-morada"
                className="block text-xs font-semibold text-stone-700"
              >
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
              <label
                htmlFor="input-website"
                className="block text-xs font-semibold text-stone-700"
              >
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
              <label
                htmlFor="input-email"
                className="block text-xs font-semibold text-stone-700"
              >
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
              <label
                htmlFor="input-telefone"
                className="block text-xs font-semibold text-stone-700"
              >
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
              <label
                htmlFor="input-nif"
                className="block text-xs font-semibold text-stone-700"
              >
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
              <label
                htmlFor="input-pessoa"
                className="block text-xs font-semibold text-stone-700"
              >
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
              <label
                htmlFor="input-cargo"
                className="block text-xs font-semibold text-stone-700"
              >
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

          <div className="space-y-3">
            <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-[#FAF7F2] p-3.5 cursor-pointer">
              <input
                type="checkbox"
                checked={dados.simbolo}
                onChange={(e) => setDados({ ...dados, simbolo: e.target.checked })}
                className="h-4 w-4 rounded border-stone-300 text-stone-900"
              />
              <span className="text-xs font-medium text-stone-800">
                O logótipo principal é apenas um símbolo (sem o nome escrito) — compor o nome junto ao símbolo na variante horizontal
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-[#FAF7F2] p-3.5 cursor-pointer">
              <input
                type="checkbox"
                id="chk-vetorizacao-opcional"
                checked={usarVetorizacaoOpcional}
                onChange={(e) => setUsarVetorizacaoOpcional(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-stone-900"
              />
              <span className="text-xs text-stone-800">
                <strong className="block font-bold text-stone-950">
                  Ativar vetorização local opcional (apenas para favicon e PDFs de impressão)
                </strong>
                As 18 peças de redes sociais (perfis, capas, publicações e stories) são sempre geradas por imagem pura sem vetores por código. Se ativar esta opção, apenas o favicon e os PDFs de cartão/papel de carta utilizam traçado vetorial local.
              </span>
            </label>
          </div>

          {/* Campos criativos para Entrada A */}
          {entradaEscolhida === "A" && (
            <div className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800">
                  Direção para os prompts de logótipo (Entrada A)
                </h2>
                <p className="text-xs text-stone-600">
                  Usado em conjunto com o tom «{TOM_DA_MARCA_SPECS[tom].nome}» para gerar 2 propostas de logótipo por ronda.
                </p>
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
            </div>
          )}

          {/* Ações para avançar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-200 pt-6">
            <span className="text-xs text-stone-500">
              Progresso guardado automaticamente nesta sessão.
            </span>

            {entradaEscolhida === "A" ? (
              <button
                type="button"
                id="btn-avancar-logotipo-ia"
                disabled={Boolean(busyDetail)}
                onClick={() => executeLogoRound(1)}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-stone-900"
              >
                <Wand2 className="h-4 w-4 text-amber-300" />
                <span>
                  Gerar 2 Propostas de Logótipo (Ronda 1/{imagemConfig.maxRondas})
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
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
                <span>Avançar para Carregar Logótipo de Referência</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>
      )}

      {/* =====================================================================
          PASSO 3: LOGÓTIPO POR GERAÇÃO DE IMAGEM (ENTRADA A ou ENTRADA B)
      ===================================================================== */}
      {step === "logotipo" && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Passo 3 de 7 •{" "}
                {entradaEscolhida === "A"
                  ? "Logótipo de Raiz por Imagem"
                  : "Logótipo Existente (Referência Obrigatória)"}
              </p>
              <h1 className="text-2xl font-bold text-stone-950 sm:text-3xl">
                {entradaEscolhida === "A"
                  ? "Escolha o logótipo de referência da marca"
                  : "Carregue o seu logótipo para referência das peças visuais"}
              </h1>
              <p className="text-sm text-stone-600">
                {entradaEscolhida === "A"
                  ? `Gerado no tom «${TOM_DA_MARCA_SPECS[tom].nome}». O logótipo que escolher torna-se imagem de referência obrigatória em todas as capas, perfis, publicações e stories seguintes.`
                  : "O ficheiro carregado é limpo na margem exterior e usado diretamente como imagem de referência obrigatória em todas as peças de redes sociais."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStep("dados")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Dados e Tom</span>
              </button>

              {entradaEscolhida === "A" && (
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
              )}
            </div>
          </div>

          {entradaEscolhida === "A" && (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-3.5 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1 font-bold text-amber-300">
                  Ronda {rondaAtual} de {imagemConfig.maxRondas}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1 font-bold text-amber-950">
                  Ajustes: {ajustesUsados} / {imagemConfig.maxAjustes}
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-950">
                  Tom ativo: {TOM_DA_MARCA_SPECS[tom].nome}
                </span>
              </div>

              {!propostasIA ? (
                <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center space-y-4">
                  <p className="text-sm text-stone-700">
                    Clique abaixo para gerar as duas primeiras propostas de logótipo para{" "}
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
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span
                                className={`inline-block rounded-lg px-3 py-1 text-xs font-bold ${
                                  prop.estilo === "classico"
                                    ? "bg-amber-100 text-amber-950"
                                    : "bg-stone-900 text-amber-300"
                                }`}
                              >
                                {prop.titulo}
                              </span>
                              <h2 className="mt-2 text-base font-bold text-stone-950 sm:text-lg">
                                {prop.subtitulo}
                              </h2>
                            </div>
                            <span className="shrink-0 whitespace-nowrap rounded-md border border-stone-200 bg-[#FAF7F2] px-2.5 py-1 text-[11px] font-semibold text-stone-600">
                              Ronda {prop.ronda} • 1:1
                            </span>
                          </div>

                          <div className="flex h-64 items-center justify-center rounded-2xl border border-stone-200 bg-[#FAF6F0] p-4 overflow-hidden">
                            <img
                              src={prop.imagemBase64}
                              alt={prop.titulo}
                              className="max-h-full max-w-full object-contain rounded-lg"
                            />
                          </div>

                          <p className="text-xs text-stone-600 leading-relaxed">
                            {prop.racional}
                          </p>

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
                                placeholder="Ex.: reforçar contraste e tornar o emblema mais nítido"
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
                                  <span>
                                    Aplicar ajuste ({ajustesUsados + 1}/{imagemConfig.maxAjustes})
                                  </span>
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
                            onClick={() => handleChooseIaProposal(prop)}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-stone-900"
                          >
                            <Check className="h-4 w-4 text-amber-300" />
                            <span>Escolher como Referência</span>
                          </button>

                          <button
                            type="button"
                            id={`btn-abrir-ajuste-${idx}`}
                            disabled={adjBlocked || Boolean(busyDetail)}
                            onClick={() => {
                              setAjustarAlvoId(isEditingThis ? null : prop.id);
                              setAjusteInstrucao("Reforçar contraste do emblema e equilibrar margens");
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
                  Recorte e imagem de referência
                </h2>
                {draft ? (
                  <>
                    <div className="checkerboard-bg flex h-48 items-center justify-center rounded-2xl border border-stone-200 p-4">
                      <img
                        src={`/api/rascunhos/${draft.id}`}
                        alt="Logótipo analisado"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="text-xs text-stone-700 space-y-1">
                      <p className="font-semibold text-emerald-800">
                        ✓ {draft.width}×{draft.height} px ({draft.originalFormat.toUpperCase()}) • Pronto como referência visual
                      </p>
                      {draft.lowQuality && draft.qualityWarning && (
                        <p className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-950">
                          {draft.qualityWarning}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      id="btn-b-avancar-direto"
                      onClick={() => setStep("paleta")}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-stone-50 hover:bg-stone-800"
                    >
                      <span>Confirmar Referência e Avançar para Paleta</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-52 items-center justify-center rounded-2xl border border-stone-200 bg-[#FAF7F2] p-6 text-center text-xs text-stone-500">
                    Carregue o ficheiro ou clique em «Carregar ensaio: Forno da Vilariça» para preparar a referência.
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          PASSO 4: PALETA E TIPOGRAFIA
      ===================================================================== */}
      {step === "paleta" && (
        <section className="space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Passo 4 de 7 • Paleta e Tipografia
              </p>
              <h1 className="mt-1 text-2xl font-bold text-stone-950 sm:text-3xl">
                Paleta cromática e par de tipos do logótipo escolhido
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                Estas cores alimentam o Guia de Marca A4, o estacionário de impressão e a harmonização das peças visuais geradas por imagem.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setStep("logotipo")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar ao Logótipo</span>
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
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-stone-950 flex items-center gap-2">
                <Palette className="h-5 w-5 text-amber-800" />
                <span>Afinação manual de cores e tipos</span>
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

            {/* Opção recolhível para estacionário de impressão/email */}
            <div className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-stone-900">
                    Estacionário opcional (Cartão de visita, Papel de carta A4 e Assinatura)
                  </p>
                  <p className="text-[11px] text-stone-600">
                    Não afeta as peças sociais (sempre geradas por imagem a partir do logótipo).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStationeryPanel((v) => !v)}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-900 hover:bg-stone-100"
                >
                  {showStationeryPanel ? "Ocultar estacionário" : "Configurar estacionário"}
                </button>
              </div>

              {showStationeryPanel && (
                <div className="divide-y divide-stone-200 border-t border-stone-200 pt-3">
                  {STATIONERY_GROUPS.map((grp) => {
                    const recPair = SECTORS[dados.sector].recomendacoes[grp.key];
                    const currentStyle = styleOverrides[grp.key];
                    const isCatalogOpen = Boolean(openGroupCatalog[grp.key]);
                    const visibleStyles: StyleId[] = isCatalogOpen
                      ? (Object.keys(CONTENT_STYLES) as StyleId[])
                      : Array.from(new Set([...recPair, currentStyle]));

                    return (
                      <div
                        key={grp.key}
                        className="py-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"
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
                                className={`rounded-xl border px-3 py-1 text-xs font-semibold transition ${
                                  isSelected
                                    ? "border-stone-900 bg-stone-900 text-stone-50"
                                    : "border-stone-300 bg-white text-stone-800"
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
                            className="rounded-xl border border-stone-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-900"
                          >
                            {isCatalogOpen ? "Fechar" : "Ver todos"}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {needsPhotoForStationery && (
                    <div className="pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-amber-950">
                        Selecionou «Fotografia» no estacionário:{" "}
                        {photoFilename ? `(${photoFilename})` : "carregue uma fotografia."}
                      </span>
                      <label className="cursor-pointer rounded-xl bg-stone-900 px-3 py-1.5 font-semibold text-white">
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
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-stone-200 pt-6">
              <button
                type="button"
                id="btn-avancar-propostas"
                onClick={() => setStep("propostas")}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-stone-900"
              >
                <span>Ver Propostas Visuais da Marca (Moderna + Clássica)</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          PASSO 5: PROPOSTAS VISUAIS SÓ-IMAGEM (MODERNA + CLÁSSICA + ZONAS SEGURAS)
      ===================================================================== */}
      {step === "propostas" && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1 max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Passo 5 de 7 • Geração por Imagem com Referência Obrigatória
              </p>
              <h1 className="text-2xl font-bold text-stone-950 sm:text-3xl">
                Compare 1 proposta Moderna em camadas e 1 Clássica
              </h1>
              <p className="text-sm text-stone-600">
                Todas as peças nascem diretamente da imagem do logótipo escolhido como referência, no tom{" "}
                <strong>{TOM_DA_MARCA_SPECS[tom].nome}</strong>, cortadas às medidas exatas ({REFERENCE_DATE_REDES_PT}) e validadas nas zonas seguras para computador e telemóvel.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStep("paleta")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar à Paleta</span>
              </button>

              <button
                type="button"
                id="btn-regenerar-par-propostas"
                disabled={propostasLoading}
                onClick={() =>
                  fetchPropostasVisuais({ redeId: activePropostaRedeId, regenerar: true })
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-[#FAF7F2] px-4 py-2.5 text-xs font-bold text-stone-900 hover:bg-stone-200 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${propostasLoading ? "animate-spin" : ""}`} />
                <span>Regenerar ambas</span>
              </button>
            </div>
          </div>

          {/* Cartão do logótipo referência obrigatória + barra de formato e viewport */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                {(chosenLogoOriginalDataUrl || draft?.id) && (
                  <div className="h-12 w-12 shrink-0 rounded-xl border border-stone-200 bg-[#FAF7F2] p-1 flex items-center justify-center overflow-hidden">
                    <img
                      src={
                        chosenLogoOriginalDataUrl || `/api/rascunhos/${draft?.id}`
                      }
                      alt="Logótipo referência ativa"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}
                <div className="text-xs">
                  <p className="font-bold text-stone-950">
                    Imagem de referência obrigatória ativa • {dados.nome}
                  </p>
                  <p className="text-stone-600">
                    Motor: <strong>{imagemConfig.modelo}</strong> • Proporção nativa atual:{" "}
                    <strong>{activePropostaRede.aspectRatioGemini}</strong> →{" "}
                    <strong>{activePropostaRede.medidaLabel}</strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="inline-flex rounded-xl border border-stone-300 bg-[#FAF7F2] p-0.5">
                  <button
                    type="button"
                    id="btn-proposta-desktop"
                    aria-pressed={propostaViewport === "desktop"}
                    onClick={() => setPropostaViewport("desktop")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition ${
                      propostaViewport === "desktop"
                        ? "bg-stone-900 text-amber-300"
                        : "text-stone-700 hover:text-stone-950"
                    }`}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    <span>Computador</span>
                  </button>
                  <button
                    type="button"
                    id="btn-proposta-mobile"
                    aria-pressed={propostaViewport === "mobile"}
                    onClick={() => setPropostaViewport("mobile")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition ${
                      propostaViewport === "mobile"
                        ? "bg-stone-900 text-amber-300"
                        : "text-stone-700 hover:text-stone-950"
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>Telemóvel</span>
                  </button>
                </div>

                <button
                  type="button"
                  id="btn-proposta-toggle-zonas"
                  aria-pressed={showSafeZonesOnPropostas}
                  onClick={() => setShowSafeZonesOnPropostas((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 font-bold transition ${
                    showSafeZonesOnPropostas
                      ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                      : "border-stone-300 bg-white text-stone-700"
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Mostrar zonas seguras</span>
                </button>
              </div>
            </div>

            {/* Seletor rápido dos principais formatos + todas as 18 peças */}
            <div className="flex flex-wrap items-center gap-2">
              {PROPOSTA_FEATURED_REDES.map((item) => {
                const active = activePropostaRedeId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    id={`btn-rede-tab-${item.id}`}
                    aria-pressed={active}
                    onClick={() => setActivePropostaRedeId(item.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? "bg-stone-900 text-amber-300"
                        : "border border-stone-200 bg-[#FAF7F2] text-stone-800 hover:border-stone-400"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}

              <select
                id="select-rede-proposta"
                aria-label="Escolher outra peça social das 18 medidas"
                value={activePropostaRedeId}
                onChange={(e) => setActivePropostaRedeId(e.target.value as RedeSocialId)}
                className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800"
              >
                {REDES_SOCIAIS_LIST.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome} ({r.medidaLabel})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Aviso obrigatório sobre textos gerados pela IA */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3.5 text-xs text-amber-950">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-800 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Verifique os textos</p>
                <p className="mt-0.5 text-amber-900">{propostasAvisoTextos}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(propostasPecas[0]?.textosPedidos?.length || 0) > 0 ? (
                propostasPecas[0].textosPedidos.map((txt, i) => (
                  <span
                    key={i}
                    className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold text-stone-900"
                  >
                    «{txt}»
                  </span>
                ))
              ) : (
                <span className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 font-semibold text-stone-700">
                  Apenas emblema (sem texto extra)
                </span>
              )}
            </div>
          </div>

          {propostasLoading && (
            <div
              role="status"
              className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-950"
            >
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>
                A gerar as propostas Moderna em camadas e Clássica com o logótipo como referência…
              </span>
            </div>
          )}

          {/* Grelha Lado a Lado: Moderna vs Clássica */}
          <div className="grid gap-6 lg:grid-cols-2">
            {propostasPecas.map((prop) => {
              const isSelected = estiloVisual === prop.estiloVisual;
              const isRegenThis = regeneratingEstilo === prop.estiloVisual;

              return (
                <article
                  key={prop.id}
                  id={`card-proposta-visual-${prop.estiloVisual}`}
                  className={`flex flex-col justify-between rounded-3xl border-2 p-5 sm:p-6 transition space-y-4 ${
                    isSelected
                      ? "border-stone-950 bg-white ring-2 ring-stone-900/15 shadow-sm"
                      : "border-stone-200 bg-white/95 hover:border-stone-400"
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                            prop.estiloVisual === "moderno"
                              ? "bg-stone-900 text-amber-300"
                              : "bg-amber-100 text-amber-950"
                          }`}
                        >
                          {prop.estiloVisual === "moderno"
                            ? "Moderna em camadas"
                            : "Clássica"}
                        </span>
                        <h2 className="text-base font-bold text-stone-950">
                          {activePropostaRede.nome}
                        </h2>
                      </div>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-950">
                          <Check className="h-3 w-3" />
                          Direção escolhida
                        </span>
                      )}
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-3">
                      <SafeZoneSocialFrame
                        rede={activePropostaRede}
                        imageUrl={prop.previewDataUrl}
                        alt={`${prop.tituloProposta} — ${activePropostaRede.nome}`}
                        viewport={propostaViewport}
                        showSafeZones={showSafeZonesOnPropostas}
                        maxHeightPx={240}
                      />
                    </div>

                    {(activePropostaRede.isCircle || activePropostaRede.test40px) && (
                      <Circle40pxTestPreview
                        imageUrl={prop.previewDataUrl}
                        nome={dados.nome || "Marca"}
                        contraste={prop.audit.contraste40px}
                        legivel={prop.audit.circulo40pxLegivel}
                      />
                    )}

                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-950">
                        {prop.referenciaLogoUsada
                          ? "Referência do logótipo ✓"
                          : "Sem referência"}
                      </span>
                      <span className="rounded-md bg-stone-100 px-2 py-0.5 font-semibold text-stone-800">
                        Gemini {prop.aspectRatioGemini} → {prop.width}×{prop.height} px
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 font-semibold ${
                          prop.audit.precisaRegeneracao
                            ? "bg-red-100 text-red-900"
                            : "bg-emerald-100 text-emerald-950"
                        }`}
                      >
                        {prop.audit.precisaRegeneracao
                          ? "Fora da zona segura — Regenerar"
                          : "Zonas seguras validadas ✓"}
                      </span>
                    </div>

                    {prop.audit.motivos.length > 0 && (
                      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-900">
                        {prop.audit.motivos.join(" ")}
                      </p>
                    )}

                    <div className="rounded-xl border border-stone-200 bg-[#FAF7F2] px-3 py-2 text-[11px] text-stone-700">
                      <span className="font-bold text-stone-900">
                        Verifique os textos:{" "}
                      </span>
                      {prop.textosPedidos.length > 0
                        ? prop.textosPedidos.map((t) => `«${t}»`).join(" • ")
                        : "Avatar apenas com o emblema (legibilidade 40 px)."}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-2">
                    <button
                      type="button"
                      id={`btn-selecionar-estilo-${prop.estiloVisual}`}
                      onClick={() => setEstiloVisual(prop.estiloVisual)}
                      className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                        isSelected
                          ? "bg-stone-900 text-amber-300"
                          : "border border-stone-900 bg-white text-stone-950 hover:bg-stone-900 hover:text-stone-50"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>
                        {isSelected ? "Selecionada para o Kit" : "Escolher esta direção"}
                      </span>
                    </button>

                    <button
                      type="button"
                      id={`btn-regenerar-proposta-${prop.estiloVisual}`}
                      disabled={isRegenThis || propostasLoading}
                      onClick={() => handleRegenerateSingleProposta(prop.estiloVisual)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-[#FAF7F2] px-4 py-2.5 text-xs font-bold text-stone-900 hover:bg-stone-200 disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${isRegenThis ? "animate-spin" : ""}`}
                      />
                      <span>Regenerar</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Barra final do Passo 5 -> Gerar os 38 ficheiros */}
          <div className="rounded-3xl border border-stone-200 bg-white p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-stone-700 space-y-1">
              <p>
                Direção escolhida para todo o kit:{" "}
                <strong className="text-stone-950">
                  {estiloVisual === "moderno" ? "Moderna em camadas" : "Clássica"}
                </strong>{" "}
                • Tom: <strong className="text-stone-950">{TOM_DA_MARCA_SPECS[tom].nome}</strong>
              </p>
              <p className="text-stone-500">
                Vetorização opcional:{" "}
                {usarVetorizacaoOpcional
                  ? "Ativa (apenas favicon e PDFs de impressão)"
                  : "Desativada (fluxo só imagem)"}
              </p>
            </div>

            <button
              type="button"
              id="btn-gerar-kit-final"
              disabled={Boolean(busyDetail)}
              onClick={handleGenerateFullKit}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-bold text-stone-50 shadow-sm transition hover:bg-stone-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-stone-900"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>Gerar os 38 Ficheiros e Pré-visualizar</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* =====================================================================
          PASSO 6: PRÉ-VISUALIZAÇÃO COMPLETA (38 PEÇAS + ZONAS + 40px + REGENERAR)
      ===================================================================== */}
      {step === "previsualizacao" && generatedKit && (
        <section className="space-y-6">
          <div className="rounded-3xl border border-stone-900 bg-stone-900 p-6 sm:p-8 text-stone-50 shadow-sm">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Passo 6 de 7 • 38 ficheiros gerados e verificados</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Pré-visualização do Kit — {generatedKit.dados.nome}
                </h1>
                <p className="text-xs text-stone-300">
                  Tom:{" "}
                  <strong>
                    {TOM_DA_MARCA_SPECS[generatedKit.tom || tom]?.nome}
                  </strong>{" "}
                  • Direção:{" "}
                  <strong>
                    {generatedKit.estiloVisual === "moderno"
                      ? "Moderna em camadas"
                      : "Clássica"}
                  </strong>{" "}
                  • Par: <strong>{FONT_PAIRS[generatedKit.fontPairId]?.nome}</strong> • Validade local: 6 horas.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep("propostas")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-800 px-4 py-2.5 text-xs font-semibold text-stone-200 hover:bg-stone-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Voltar às Propostas</span>
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

          {/* Aviso global + Controlos de vista Computador/Telemóvel e Zonas Seguras */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-4">
            <div className="flex items-start gap-2.5 text-xs text-amber-950">
              <AlertCircle className="h-4 w-4 text-amber-800 shrink-0 mt-0.5" />
              <p>
                <strong>Verifique os textos</strong> e as zonas seguras abaixo em vista Computador e Telemóvel. Se precisar de nova versão numa rede específica, clique em <strong>«Regenerar»</strong> na respetiva peça.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="inline-flex rounded-xl border border-stone-300 bg-[#FAF7F2] p-0.5">
                <button
                  type="button"
                  id="btn-viewport-desktop"
                  aria-pressed={previewViewport === "desktop"}
                  onClick={() => setPreviewViewport("desktop")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition ${
                    previewViewport === "desktop"
                      ? "bg-stone-900 text-amber-300"
                      : "text-stone-700 hover:text-stone-950"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  <span>Computador</span>
                </button>
                <button
                  type="button"
                  id="btn-viewport-mobile"
                  aria-pressed={previewViewport === "mobile"}
                  onClick={() => setPreviewViewport("mobile")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition ${
                    previewViewport === "mobile"
                      ? "bg-stone-900 text-amber-300"
                      : "text-stone-700 hover:text-stone-950"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Telemóvel</span>
                </button>
              </div>

              <button
                type="button"
                id="btn-toggle-zonas-seguras"
                aria-pressed={showSafeZonesOnPreview}
                onClick={() => setShowSafeZonesOnPreview((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 font-bold transition ${
                  showSafeZonesOnPreview
                    ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                    : "border-stone-300 bg-white text-stone-700"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Mostrar zonas seguras</span>
              </button>
            </div>
          </div>

          {/* Separadores por categoria (total 38 ficheiros) */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { key: "todas", label: "Todas (38)" },
                  { key: "variantes", label: "Variantes (5)" },
                  { key: "redes", label: "Redes e Perfis (18)" },
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
                  id={`tab-categoria-${tab.key}`}
                  onClick={() => {
                    setActiveResultCategory(tab.key);
                    if (tab.key !== "redes") setSubFilterRedes("todas");
                  }}
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

            {activeResultCategory === "redes" && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-stone-600">Filtrar redes:</span>
                {(
                  [
                    { key: "todas", label: "Todas as 18 peças" },
                    { key: "perfis", label: "Perfis e Teste 40 px (9)" },
                    { key: "capas-posts", label: "Capas, Posts e Stories (9)" },
                  ] as const
                ).map((sub) => (
                  <button
                    key={sub.key}
                    type="button"
                    id={`subtab-redes-${sub.key}`}
                    onClick={() => setSubFilterRedes(sub.key)}
                    className={`rounded-lg px-3 py-1.5 font-bold transition ${
                      subFilterRedes === sub.key
                        ? "bg-amber-900 text-amber-50"
                        : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FORMAT_SPECS.filter((s) => {
              if (
                activeResultCategory !== "todas" &&
                s.categoria !== activeResultCategory
              ) {
                return false;
              }
              if (
                activeResultCategory === "redes" &&
                subFilterRedes !== "todas"
              ) {
                const cfg = REDES_SOCIAIS_CONFIG[s.id as RedeSocialId];
                if (subFilterRedes === "perfis") return cfg?.tipoPeca === "perfil";
                return cfg?.tipoPeca !== "perfil";
              }
              return true;
            }).map((spec) => {
              const bust = cacheBusters[spec.ficheiro];
              const fileUrl = `/api/kits/${generatedKit.id}?ficheiro=${encodeURIComponent(
                spec.ficheiro
              )}${bust ? `&t=${bust}` : ""}`;

              if (spec.categoria === "redes") {
                const rede = REDES_SOCIAIS_CONFIG[spec.id as RedeSocialId];
                const pecaMeta = generatedKit.pecasMetadata?.[spec.id];
                const textosPedidos =
                  pecaMeta?.textosPedidos ||
                  generatedKit.textosPedidosPorPeca?.[spec.id] ||
                  [];
                const audit =
                  pecaMeta?.audit || generatedKit.safeZoneAudits?.[spec.id];
                const isRegen = regeneratingRedeId === rede.id;

                return (
                  <div
                    key={spec.id}
                    id={`card-kit-peca-${spec.id}`}
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

                      <div className="rounded-xl border border-stone-200 bg-[#FAF7F2] p-2.5">
                        <SafeZoneSocialFrame
                          rede={rede}
                          imageUrl={fileUrl}
                          alt={spec.nome}
                          viewport={previewViewport}
                          showSafeZones={showSafeZonesOnPreview}
                          maxHeightPx={176}
                        />
                      </div>

                      {(rede.isCircle || rede.test40px) && (
                        <Circle40pxTestPreview
                          imageUrl={fileUrl}
                          nome={generatedKit.dados.nome}
                          contraste={audit?.contraste40px}
                          legivel={audit?.circulo40pxLegivel}
                        />
                      )}

                      <div className="flex flex-wrap gap-1 text-[10px]">
                        <span className="rounded bg-stone-100 px-2 py-0.5 font-semibold text-stone-800">
                          Gemini {rede.aspectRatioGemini}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 font-semibold ${
                            audit?.precisaRegeneracao
                              ? "bg-red-100 text-red-900"
                              : "bg-emerald-100 text-emerald-950"
                          }`}
                        >
                          {audit?.precisaRegeneracao
                            ? "Rever zona segura"
                            : "Zona segura ✓"}
                        </span>
                      </div>

                      <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-2.5 py-1.5 text-[11px] text-amber-950">
                        <span className="font-bold">Verifique os textos: </span>
                        {textosPedidos.length > 0
                          ? textosPedidos.map((t) => `«${t}»`).join(" • ")
                          : "Sem texto adicional (apenas emblema)."}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-stone-100 pt-2.5 text-xs">
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-stone-800 hover:text-amber-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Abrir</span>
                      </a>

                      <button
                        type="button"
                        id={`btn-regenerar-peca-${spec.id}`}
                        disabled={isRegen}
                        onClick={() => handleRegenerateKitPiece(rede.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-[#FAF7F2] px-2.5 py-1 font-bold text-stone-900 hover:bg-stone-200 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${isRegen ? "animate-spin" : ""}`}
                        />
                        <span>Regenerar</span>
                      </button>
                    </div>
                  </div>
                );
              }

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
          PASSO 7: ECRÃ FINAL DE DESCARREGAMENTO DO ZIP (38 FICHEIROS)
      ===================================================================== */}
      {step === "zip" && generatedKit && (
        <section className="mx-auto max-w-3xl rounded-3xl border border-stone-200 bg-white p-6 sm:p-10 shadow-xs space-y-8">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-900 text-amber-300">
              <FileArchive className="h-8 w-8" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
              Passo 7 de 7 • Entrega Final
            </p>
            <h1 className="text-2xl font-bold text-stone-950 sm:text-3xl">
              O seu kit PandoMarca está pronto
            </h1>
            <p className="text-sm text-stone-600 max-w-xl mx-auto">
              Arquivo determinístico com exatamente <strong>38 ficheiros</strong> nas medidas oficiais de {REFERENCE_DATE_REDES_PT}, pronto para redes sociais, website, email e gráfica.
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
                Tom & Direção visual
              </span>
              <p className="mt-1 font-semibold text-stone-800">
                Tom {TOM_DA_MARCA_SPECS[generatedKit.tom || tom]?.nome} •{" "}
                {generatedKit.estiloVisual === "moderno"
                  ? "Moderna em camadas"
                  : "Clássica"}
              </p>
            </div>
            <div>
              <span className="font-bold uppercase tracking-wider text-stone-500">
                Vetorização opcional
              </span>
              <p className="mt-1 font-semibold text-stone-800">
                {generatedKit.usarVetorizacaoOpcional
                  ? "Opcional ativa (apenas favicon e impressão PDF)"
                  : "Desativada (fluxo só imagem)"}
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
              <span>Descarregar ZIP (38 ficheiros)</span>
            </a>

            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStep("previsualizacao")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-stone-700 hover:bg-stone-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Rever todas as 38 pré-visualizações</span>
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
