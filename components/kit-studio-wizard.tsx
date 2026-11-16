"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Loader2,
  Palette,
  PenTool,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
  Upload,
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
  StyleGroupKey,
  StyleGroupOverrides,
  StyleId,
} from "@/lib/formats";
import {
  buildBrandPalette,
  computeNeutralHex,
  PaletteAndTypeProposal,
} from "@/lib/palette";
import { SAMPLE_BRANDS } from "@/lib/samples";
import type { DraftMeta, KitMeta } from "@/lib/storage";
import type {
  DirectionId,
  FinalVariantsA,
  ReferenceItemInput,
  StudioLogoOption,
} from "@/lib/logo-generator/svg-studio";

type WizardStep =
  | "acesso"
  | "entrada"
  | "a-questionario"
  | "a-direcoes"
  | "a-refinamento"
  | "a-variantes"
  | "b-dados"
  | "propostas"
  | "estilos"
  | "resultado";

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

export function KitStudioWizard() {
  const searchParams = useSearchParams();

  // 1. Estado de acesso
  const [authChecking, setAuthChecking] = useState(true);
  const [envConfigured, setEnvConfigured] = useState(true);
  const [missingVars, setMissingVars] = useState<string[]>([]);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [codigoInput, setCodigoInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // 2. Navegação de passos e mensagens de erro
  const [step, setStep] = useState<WizardStep>("acesso");
  const [entradaEscolhida, setEntradaEscolhida] = useState<"A" | "B">("B");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);

  // 3. Dados comuns da marca
  const [dados, setDados] = useState<BrandData>(DEFAULT_BRAND_DATA);

  // 4. Estado da Entrada A (logótipo de raiz)
  const [tresPalavras, setTresPalavras] = useState("");
  const [coresPreferidas, setCoresPreferidas] = useState("");
  const [coresEvitar, setCoresEvitar] = useState("");
  const [referencias, setReferencias] = useState<ReferenceItemInput[]>([]);
  const [direcoesA, setDirecoesA] = useState<[StudioLogoOption, StudioLogoOption] | null>(null);
  const [chosenDirectionId, setChosenDirectionId] = useState<DirectionId>("classica");
  const [refinamentoRound, setRefinamentoRound] = useState<number>(1);
  const [refinamentoOpcoes, setRefinamentoOpcoes] = useState<[StudioLogoOption, StudioLogoOption] | null>(null);
  const [chosenRefinedOption, setChosenRefinedOption] = useState<StudioLogoOption | null>(null);
  const [variantesFinaisA, setVariantesFinaisA] = useState<FinalVariantsA | null>(null);

  // 5. Estado da Entrada B (logótipo existente) e rascunho comum
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<DraftMeta | null>(null);

  // 6. Propostas de Paleta e Tipos (Regra das 2 escolhas + Ver mais propostas)
  const [propostas, setPropostas] = useState<PaletteAndTypeProposal[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState<string>("direta");
  const [showAllProposals, setShowAllProposals] = useState(false);
  const [customPalette, setCustomPalette] = useState<BrandPalette>(() =>
    buildBrandPalette({
      primaria: "#B84A24",
      secundaria: "#D9822B",
      papel: "#FAF6F0",
      tinta: "#2A1810",
    })
  );
  const [selectedFontPair, setSelectedFontPair] = useState<FontPairId>("clara");

  // 7. Estilos (Regra das 2 recomendações + Ver catálogo para o kit e por grupo)
  const [kitStyle, setKitStyle] = useState<StyleId>("degrade");
  const [showKitCatalog, setShowKitCatalog] = useState(false);
  const [styleOverrides, setStyleOverrides] = useState<StyleGroupOverrides>({
    capas: "degrade",
    publicacao: "padrao",
    story: "degrade",
    cartao: "liso",
    papel: "informativo",
    assinatura: "informativo",
  });
  const [openGroupCatalog, setOpenGroupCatalog] = useState<Record<string, boolean>>({});
  const [photoDataUrl, setPhotoDataUrl] = useState<string>("");
  const [photoFilename, setPhotoFilename] = useState<string>("");

  // 8. Kit gerado
  const [generatedKit, setGeneratedKit] = useState<KitMeta | null>(null);
  const [activeResultCategory, setActiveResultCategory] = useState<FormatCategory | "todas">("todas");

  // Verificar sessão de acesso ao iniciar
  useEffect(() => {
    const paramEntrada = searchParams?.get("entrada");
    if (paramEntrada === "A" || paramEntrada === "B") {
      setEntradaEscolhida(paramEntrada);
    }

    fetch("/api/acesso")
      .then((r) => r.json())
      .then((data) => {
        setEnvConfigured(Boolean(data.configured));
        setMissingVars(data.missingVars || []);
        if (data.authenticated && data.entitlement) {
          setEntitlement(data.entitlement);
          if (paramEntrada === "A") {
            setStep("a-questionario");
          } else if (paramEntrada === "B") {
            setStep("b-dados");
          } else {
            setStep("entrada");
          }
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecking(false));
  }, [searchParams]);

  // Submeter código de acesso
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
      const paramEntrada = searchParams?.get("entrada");
      if (paramEntrada === "A") {
        setEntradaEscolhida("A");
        setStep("a-questionario");
      } else if (paramEntrada === "B") {
        setEntradaEscolhida("B");
        setStep("b-dados");
      } else {
        setStep("entrada");
      }
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

  // Preencher dados com o ensaio obrigatório Forno da Vilariça ou Oficina do São
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
        dataUrl: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(r.svg)))}`,
      }))
    );
    setGlobalError(null);
  }

  // Aplicar recomendações de estilo por defeito do sector
  function applySectorDefaultStyles(sector: SectorId) {
    const rec = SECTORS[sector]?.recomendacoes || SECTORS.outro.recomendacoes;
    const baseStyle = rec.capas[0];
    setKitStyle(baseStyle);
    setStyleOverrides({
      capas: rec.capas[0],
      publicacao: rec.publicacao[0],
      story: rec.story[0],
      cartao: rec.cartao[0],
      papel: rec.papel[0],
      assinatura: rec.assinatura[0],
    });
  }

  // Quando muda o estilo global do kit, aplica-se a todos os grupos (podendo depois afinar cada grupo)
  function handleSelectKitStyle(st: StyleId) {
    setKitStyle(st);
    setStyleOverrides({
      capas: st,
      publicacao: st,
      story: st,
      cartao: st,
      papel: st,
      assinatura: st,
    });
  }

  // Seleccionar uma das 4 propostas de paleta e tipos
  function handleSelectProposal(prop: PaletteAndTypeProposal) {
    setSelectedProposalId(prop.id);
    setCustomPalette(prop.paleta);
    setSelectedFontPair(prop.fontPairId);
  }

  // Alterar manualmente uma das 4 cores base (recalcula o neutro automaticamente!)
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

  // Entrada B: Analisar ficheiro ou preset
  async function handleAnalyzeEntradaB(presetId?: "forno-da-vilarica" | "oficina-do-sao") {
    setGlobalError(null);
    let currentDados = dados;

    if (presetId) {
      const sample = SAMPLE_BRANDS[presetId];
      currentDados = { ...sample.dados };
      setDados(currentDados);
    }

    if (!currentDados.nome.trim()) {
      setGlobalError("Indique o nome da marca antes de analisar o logótipo.");
      return;
    }

    if (!presetId && !selectedFile) {
      setGlobalError("Selecione um ficheiro PNG, JPG ou SVG (até 8 MB) ou escolha um dos exemplos de ensaio.");
      return;
    }

    setBusyMessage("A analisar o logótipo, transparência da margem e paleta cromática...");
    try {
      let res: Response;
      if (presetId) {
        res = await fetch("/api/analisar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId,
            sector: currentDados.sector,
          }),
        });
      } else {
        const fd = new FormData();
        fd.append("ficheiro", selectedFile!);
        fd.append("sector", currentDados.sector);
        res = await fetch("/api/analisar", {
          method: "POST",
          body: fd,
        });
      }

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setGlobalError(data.error || "Não foi possível analisar o ficheiro.");
        return;
      }

      setDraft(data.draft);
      setPropostas(data.propostas || []);
      setShowAllProposals(false);
      if (data.propostas?.length > 0) {
        handleSelectProposal(data.propostas[0]);
      }
      applySectorDefaultStyles(currentDados.sector);

      // Se para Forno da Vilariça o sector é restauração (que sugere fotografia/degradê),
      // pré-carregar fotografia de ensaio para conveniência imediata
      if (presetId === "forno-da-vilarica" && !photoDataUrl) {
        setPhotoDataUrl(
          `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(SAMPLE_BAKERY_PHOTO_SVG)))}`
        );
        setPhotoFilename("forno-tradicional-ensaio.svg");
      }
    } catch {
      setGlobalError("Erro ao comunicar com o servidor durante a análise do logótipo.");
    } finally {
      setBusyMessage(null);
    }
  }

  // Entrada A: Carregar imagem de referência (1 a 5)
  function handleAddReferenceFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remainingSlots = 5 - referencias.length;
    if (remainingSlots <= 0) {
      setGlobalError("Já atingiu o limite máximo de 5 imagens de referência.");
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
              nota: "Gosto do equilíbrio entre o símbolo e a tipografia.",
              dataUrl: typeof reader.result === "string" ? reader.result : undefined,
            },
          ];
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Entrada A: Gerar as 2 direções iniciais
  async function handleGenerateDirectionsA(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);

    if (!dados.nome.trim()) {
      setGlobalError("Indique o nome da marca.");
      return;
    }
    if (referencias.length < 1 || referencias.length > 5) {
      setGlobalError("Adicione entre 1 e 5 imagens de referência (ou clique em «Carregar ensaio: Forno da Vilariça»).");
      return;
    }
    if (referencias.some((r) => !r.nota.trim())) {
      setGlobalError("Escreva uma breve nota em cada imagem de referência explicando o que lhe agrada ali.");
      return;
    }

    setBusyMessage("A desenhar 2 direções distintas de logótipo em estúdio SVG...");
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
            referencias,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setGlobalError(data.error || "Não foi possível gerar as direções de logótipo.");
        return;
      }
      setDirecoesA(data.directions);
      setStep("a-direcoes");
    } catch {
      setGlobalError("Erro ao gerar as direções iniciais.");
    } finally {
      setBusyMessage(null);
    }
  }

  // Entrada A: Escolher uma direção e pedir a ronda de refinamento (1..3)
  async function handleRequestRefinementA(directionId: DirectionId, round: number) {
    setGlobalError(null);
    setBusyMessage(`A afinar 2 versões da direção escolhida (Ronda ${round} de 3)...`);
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
            referencias,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setGlobalError(data.error || "Não foi possível gerar o refinamento.");
        return;
      }
      setChosenDirectionId(directionId);
      setRefinamentoRound(round);
      setRefinamentoOpcoes(data.options);
      setStep("a-refinamento");
    } catch {
      setGlobalError("Erro ao gerar versões afinadas.");
    } finally {
      setBusyMessage(null);
    }
  }

  // Entrada A: Finalizar logótipo escolhido e gerar as 5 variantes (horizontal, vertical, símbolo, monocromático, negativo)
  async function handleFinalizeLogoA(option: StudioLogoOption) {
    setGlobalError(null);
    setBusyMessage("A gerar as 5 variantes finais (horizontal, vertical, símbolo, monocromático e negativo)...");
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
        setGlobalError(data.error || "Não foi possível finalizar as variantes do logótipo.");
        return;
      }

      setChosenRefinedOption(option);
      setVariantesFinaisA(data.variantes);
      setDraft(data.draft);
      setPropostas(data.propostas || []);
      setShowAllProposals(false);
      if (data.propostas?.length > 0) {
        handleSelectProposal(data.propostas[0]);
      }
      applySectorDefaultStyles(dados.sector);
      setStep("a-variantes");
    } catch {
      setGlobalError("Erro ao produzir as variantes finais.");
    } finally {
      setBusyMessage(null);
    }
  }

  // Gerar os 36 ficheiros e o ZIP
  async function handleGenerateFullKit() {
    if (!draft) {
      setGlobalError("Rascunho de logótipo em falta. Volte ao passo anterior.");
      return;
    }

    setGlobalError(null);
    setBusyMessage("A desenhar os 36 formatos oficiais (PNG, ICO, HTML, SVG, PDF) e a empacotar o arquivo ZIP...");
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
          styleOverrides,
          photoDataUrl: photoDataUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setGlobalError(data.error || "Não foi possível gerar o kit.");
        if (data.code === "expired_draft") {
          setDraft(null);
        }
        return;
      }

      setGeneratedKit(data.kit);
      setStep("resultado");
    } catch {
      setGlobalError("Ocorreu um erro durante a geração das 36 peças do kit.");
    } finally {
      setBusyMessage(null);
    }
  }

  // Verificar se algum grupo visual usa o estilo "fotografia"
  const needsPhoto = (["capas", "publicacao", "story", "cartao", "papel"] as const).some(
    (g) => styleOverrides[g] === "fotografia"
  );

  if (authChecking) {
    return (
      <div className="mx-auto flex max-w-4xl items-center justify-center px-4 py-24">
        <div className="flex items-center gap-3 text-stone-600">
          <Loader2 className="h-5 w-5 animate-spin text-amber-800" />
          <span className="text-sm font-medium">A verificar configuração de acesso...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Barra de estado do direito de acesso e progresso */}
      {entitlement && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-3.5 shadow-2xs">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                entitlement.kind === "website_bonus"
                  ? "bg-emerald-100 text-emerald-950"
                  : "bg-amber-100 text-amber-950"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {entitlement.kind === "website_bonus"
                ? "Acesso: Oferta do Website PandoWeb (website_bonus)"
                : "Acesso: Kit Individual (standalone)"}
            </span>
            {dados.nome && (
              <span className="text-xs font-semibold text-stone-600">
                Marca: <strong className="text-stone-900">{dados.nome}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStep("entrada")}
              className="text-stone-600 hover:text-stone-950 underline underline-offset-2"
            >
              Mudar de entrada (A/B)
            </button>
            <span className="text-stone-300">|</span>
            <button
              type="button"
              onClick={handleLogoutCode}
              className="text-stone-500 hover:text-red-700"
            >
              Trocar código
            </button>
          </div>
        </div>
      )}

      {/* Notificação de erro global */}
      {globalError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 rounded-2xl border border-red-300 bg-red-50/90 p-5 text-sm text-red-950 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Atenção</p>
              <p className="mt-0.5 text-red-900">{globalError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            className="text-xs font-bold uppercase tracking-wider text-red-800 hover:text-red-950"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Indicador de geração a decorrer */}
      {busyMessage && (
        <div className="flex items-center gap-3.5 rounded-2xl border border-amber-300 bg-amber-50/90 p-5 text-sm font-medium text-amber-950 shadow-xs">
          <Loader2 className="h-5 w-5 animate-spin text-amber-800 shrink-0" />
          <span>{busyMessage}</span>
        </div>
      )}

      {/* =====================================================================
          ECRÃ 1: ACESSO POR CÓDIGO
      ===================================================================== */}
      {step === "acesso" && (
        <section className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-8 shadow-xs sm:p-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900 text-amber-300">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Porta de Acesso
              </span>
              <h1 className="text-2xl font-bold text-stone-900">
                Introduza o seu código PandoMarca
              </h1>
            </div>
          </div>

          {!envConfigured ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 space-y-2">
              <p className="font-bold">O acesso ainda não está preparado neste ambiente</p>
              <p>
                Faltam as seguintes variáveis no ficheiro <code>.env.local</code>:{" "}
                <strong>{missingVars.join(", ")}</strong>.
              </p>
              <p className="text-xs text-amber-900">
                Copie <code>.env.example</code> para <code>.env.local</code> e defina os códigos de desenvolvimento conforme indicado no README.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-stone-600 leading-relaxed">
                Um código valida o seu direito de acesso: <strong>Oferta do website PandoWeb</strong> (<code>website_bonus</code>) ou <strong>Kit individual</strong> (<code>standalone</code>). A sessão fica guardada num cookie seguro durante 12 horas.
              </p>

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
                  <p className="text-sm font-medium text-red-700">{authError}</p>
                )}

                <button
                  type="submit"
                  id="btn-validar-codigo"
                  disabled={authLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800 disabled:opacity-50"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>A validar código...</span>
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
                <p className="text-xs font-semibold text-stone-500">
                  Atalhos de desenvolvimento local (.env.local):
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
                    Usar código Oferta Website (kit-website-demo)
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
                    Usar código Kit Individual (kit-individual-demo)
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* =====================================================================
          ECRÃ 2: ESCOLHA DA ENTRADA (A ou B)
      ===================================================================== */}
      {step === "entrada" && (
        <section className="space-y-6">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
              Passo 1 • Ponto de Partida
            </p>
            <h1 className="text-3xl font-bold text-stone-900">
              Como pretende começar o seu kit de marca?
            </h1>
            <p className="text-sm text-stone-600">
              As duas entradas desembocam exactamente no mesmo kit e nos mesmos 36 ficheiros. Escolha uma das duas opções abaixo:
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Opção 1: Entrada A */}
            <div className="flex flex-col justify-between rounded-3xl border-2 border-stone-200 bg-white p-8 shadow-xs transition hover:border-stone-900">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-3.5 py-1.5 text-xs font-bold text-amber-950">
                  <PenTool className="h-4 w-4" />
                  Entrada A — Criar logótipo de raiz
                </span>
                <h2 className="text-2xl font-bold text-stone-900">
                  Não tenho logótipo (ou quero redesenhar do zero)
                </h2>
                <p className="text-sm text-stone-600 leading-relaxed">
                  Responda a um questionário rápido, indique três palavras da marca, cores preferidas/a evitar e carregue 1 a 5 imagens de referência com nota. Compare sempre 2 direções de estúdio lado a lado, refine até 3 rondas e obtenha as variantes vectoriais finais.
                </p>
              </div>
              <button
                type="button"
                id="btn-choose-entrada-a"
                onClick={() => {
                  setEntradaEscolhida("A");
                  setStep("a-questionario");
                }}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3.5 text-sm font-semibold text-stone-50 transition hover:bg-stone-800"
              >
                <span>Escolher Entrada A (Logótipo de raiz)</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Opção 2: Entrada B */}
            <div className="flex flex-col justify-between rounded-3xl border-2 border-stone-200 bg-white p-8 shadow-xs transition hover:border-stone-900">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-2 rounded-xl bg-stone-200 px-3.5 py-1.5 text-xs font-bold text-stone-900">
                  <Upload className="h-4 w-4" />
                  Entrada B — Usar logótipo já existente
                </span>
                <h2 className="text-2xl font-bold text-stone-900">
                  Já tenho o ficheiro do meu logótipo (PNG, JPG ou SVG)
                </h2>
                <p className="text-sm text-stone-600 leading-relaxed">
                  Carregue o seu ficheiro até 8 MB (ou experimente os exemplos incluídos <strong>Forno da Vilariça</strong> e <strong>Oficina do São</strong>). O sistema remove fundos lisos ligados à margem, extrai a paleta cromática e prepara todas as variantes.
                </p>
              </div>
              <button
                type="button"
                id="btn-choose-entrada-b"
                onClick={() => {
                  setEntradaEscolhida("B");
                  setStep("b-dados");
                }}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-900 bg-[#FAF7F2] px-5 py-3.5 text-sm font-semibold text-stone-900 transition hover:bg-stone-900 hover:text-stone-50"
              >
                <span>Escolher Entrada B (Logótipo existente)</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          ECRÃ 3A.1: ENTRADA A — QUESTIONÁRIO E REFERÊNCIAS (1 a 5)
      ===================================================================== */}
      {step === "a-questionario" && (
        <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-10 shadow-xs space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Entrada A • Passo 1 de 4
              </p>
              <h1 className="mt-1 text-2xl font-bold text-stone-900 sm:text-3xl">
                Questionário de Marca e Imagens de Referência
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                As referências servem apenas de inspiração: o logótipo gerado será 100% original e vectorial.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="btn-preset-a-forno"
                onClick={() => applyPresetData("forno-da-vilarica")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-950 transition hover:bg-amber-200"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Preencher ensaio: Forno da Vilariça
              </button>
              <button
                type="button"
                id="btn-preset-a-oficina"
                onClick={() => applyPresetData("oficina-do-sao")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-800 transition hover:bg-stone-200/70"
              >
                Preencher exemplo: Oficina do São
              </button>
            </div>
          </div>

          <form onSubmit={handleGenerateDirectionsA} className="space-y-8">
            {/* Dados principais e criativos */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Nome da marca *
                </label>
                <input
                  type="text"
                  required
                  value={dados.nome}
                  onChange={(e) => setDados({ ...dados, nome: e.target.value })}
                  placeholder="Ex.: Forno da Vilariça"
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Sector de atividade *
                </label>
                <select
                  value={dados.sector}
                  onChange={(e) =>
                    setDados({ ...dados, sector: e.target.value as SectorId })
                  }
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                >
                  {Object.values(SECTORS).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.rotulo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Slogan (opcional)
                </label>
                <input
                  type="text"
                  value={dados.slogan}
                  onChange={(e) => setDados({ ...dados, slogan: e.target.value })}
                  placeholder="Ex.: Pão de trigo ao nascer do dia"
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Três palavras da marca *
                </label>
                <input
                  type="text"
                  required
                  value={tresPalavras}
                  onChange={(e) => setTresPalavras(e.target.value)}
                  placeholder="Ex.: Tradição, Forno a lenha, Trigo dourado"
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Cores preferidas *
                </label>
                <input
                  type="text"
                  required
                  value={coresPreferidas}
                  onChange={(e) => setCoresPreferidas(e.target.value)}
                  placeholder="Ex.: Terracota, ocre de trigo e castanho"
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Cores a evitar
                </label>
                <input
                  type="text"
                  value={coresEvitar}
                  onChange={(e) => setCoresEvitar(e.target.value)}
                  placeholder="Ex.: Néons frios, roxo sintético"
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Dados de contacto e serviços para o kit */}
            <div className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-5 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-stone-700">
                Dados para o estacionário, capas e assinatura de email
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600">
                    Serviços principais
                  </label>
                  <input
                    type="text"
                    value={dados.servicos}
                    onChange={(e) => setDados({ ...dados, servicos: e.target.value })}
                    placeholder="Pão, broa e bolos de festa"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600">
                    Nome da pessoa
                  </label>
                  <input
                    type="text"
                    value={dados.pessoa}
                    onChange={(e) => setDados({ ...dados, pessoa: e.target.value })}
                    placeholder="Marta Queirós"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600">
                    Cargo
                  </label>
                  <input
                    type="text"
                    value={dados.cargo}
                    onChange={(e) => setDados({ ...dados, cargo: e.target.value })}
                    placeholder="Mestra Padeira"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600">
                    NIF
                  </label>
                  <input
                    type="text"
                    value={dados.nif}
                    onChange={(e) => setDados({ ...dados, nif: e.target.value })}
                    placeholder="514 892 307"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600">
                    Email
                  </label>
                  <input
                    type="text"
                    value={dados.email}
                    onChange={(e) => setDados({ ...dados, email: e.target.value })}
                    placeholder="marta@fornodavilarica.pt"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={dados.telefone}
                    onChange={(e) => setDados({ ...dados, telefone: e.target.value })}
                    placeholder="+351 279 452 180"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600">
                    Website
                  </label>
                  <input
                    type="text"
                    value={dados.website}
                    onChange={(e) => setDados({ ...dados, website: e.target.value })}
                    placeholder="https://fornodavilarica.pt"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600">
                    Morada
                  </label>
                  <input
                    type="text"
                    value={dados.morada}
                    onChange={(e) => setDados({ ...dados, morada: e.target.value })}
                    placeholder="Largo da Feira 14, Vila Flor"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 1 a 5 Imagens de Referência com Nota */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-stone-900">
                    Imagens de referência (1 a 5 imagens obrigatórias, cada uma com nota) *
                  </h2>
                  <p className="text-xs text-stone-600">
                    Carregadas: <strong>{referencias.length} / 5</strong>. Indique em cada uma o que lhe agrada (forma, simplicidade, época, contraste).
                  </p>
                </div>

                {referencias.length < 5 && (
                  <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-[#FAF7F2] px-4 py-2 text-xs font-bold text-stone-900 hover:bg-stone-200/70">
                    <Plus className="h-4 w-4" />
                    <span>Carregar imagem de referência</span>
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

              {referencias.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-stone-300 bg-[#FAF7F2] p-8 text-center space-y-3">
                  <ImageIcon className="mx-auto h-8 w-8 text-stone-400" />
                  <p className="text-sm font-medium text-stone-700">
                    Ainda não adicionou imagens de referência (mínimo 1, máximo 5).
                  </p>
                  <p className="text-xs text-stone-500">
                    Pode carregar imagens do seu computador ou clicar em «Preencher ensaio: Forno da Vilariça» no topo para carregar 2 referências originais.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {referencias.map((ref, idx) => (
                    <div
                      key={idx}
                      className="flex gap-4 rounded-2xl border border-stone-200 bg-[#FAF7F2] p-4"
                    >
                      {ref.dataUrl ? (
                        <img
                          src={ref.dataUrl}
                          alt={ref.nomeFicheiro || `Referência ${idx + 1}`}
                          className="h-24 w-24 rounded-xl border border-stone-200 bg-white object-contain shrink-0"
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-stone-200 bg-white text-xs text-stone-400 shrink-0">
                          Ref #{idx + 1}
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-stone-800 truncate">
                            {idx + 1}. {ref.nomeFicheiro || `Referência ${idx + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setReferencias(referencias.filter((_, i) => i !== idx))
                            }
                            className="text-stone-400 hover:text-red-700"
                            title="Remover referência"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          required
                          value={ref.nota}
                          onChange={(e) => {
                            const next = [...referencias];
                            next[idx] = { ...next[idx], nota: e.target.value };
                            setReferencias(next);
                          }}
                          placeholder="O que lhe agrada nesta referência?"
                          className="w-full rounded-lg border border-stone-300 bg-white p-2 text-xs text-stone-900"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-stone-200 pt-6">
              <button
                type="button"
                onClick={() => setStep("entrada")}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar</span>
              </button>

              <button
                type="submit"
                id="btn-gerar-direcoes-a"
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800"
              >
                <span>Ver 2 Direções de Logótipo</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      )}

      {/* =====================================================================
          ECRÃ 3A.2: ENTRADA A — DUAS DIREÇÕES LADO A LADO
      ===================================================================== */}
      {step === "a-direcoes" && direcoesA && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Entrada A • Passo 2 de 4 • Regra das 2 Escolhas
              </p>
              <h1 className="mt-1 text-3xl font-bold text-stone-900">
                Escolha uma das 2 direções de logótipo
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                Cada direção distingue-se na forma do símbolo, no par tipográfico e na paleta. Escolha a direção que prefere para ver 2 versões afinadas.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStep("a-questionario")}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Editar questionário</span>
            </button>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {direcoesA.map((dir) => {
              const svgUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(dir.logoSvg)))}`;
              const symUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(dir.simboloSvg)))}`;
              const fp = FONT_PAIRS[dir.fontPairId];

              return (
                <div
                  key={dir.id}
                  className="flex flex-col justify-between rounded-3xl border-2 border-stone-200 bg-white p-7 shadow-xs transition hover:border-stone-900 space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-block rounded-lg bg-amber-100 px-3 py-1 text-xs font-bold text-amber-950">
                          {dir.titulo}
                        </span>
                        <h2 className="mt-2 text-xl font-bold text-stone-900">
                          {dir.subtitulo}
                        </h2>
                      </div>
                      <img
                        src={symUrl}
                        alt="Miniatura símbolo"
                        className="h-14 w-14 rounded-xl border border-stone-200 bg-[#FAF7F2] p-1.5 object-contain shrink-0"
                      />
                    </div>

                    {/* Pré-visualização grande do logótipo */}
                    <div
                      className="flex h-64 items-center justify-center rounded-2xl border border-stone-200 p-6"
                      style={{ backgroundColor: dir.paleta.papel.hex }}
                    >
                      <img
                        src={svgUrl}
                        alt={dir.titulo}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <p className="text-sm text-stone-600 leading-relaxed">
                      {dir.racional}
                    </p>

                    {/* Paleta e par de tipos da direção */}
                    <div className="grid gap-3 sm:grid-cols-2 pt-2">
                      <div className="rounded-xl border border-stone-200 bg-[#FAF7F2] p-3.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                          Paleta da Direção
                        </span>
                        <div className="mt-2 flex items-center gap-2">
                          {[
                            dir.paleta.primaria,
                            dir.paleta.secundaria,
                            dir.paleta.papel,
                            dir.paleta.tinta,
                            dir.paleta.neutro,
                          ].map((c, i) => (
                            <div
                              key={i}
                              className="h-7 w-7 rounded-lg border border-stone-300 shadow-2xs"
                              style={{ backgroundColor: c.hex }}
                              title={c.hex}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-stone-200 bg-[#FAF7F2] p-3.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                          Par de Tipos ({fp.nome})
                        </span>
                        <p className="mt-1.5 text-xs font-semibold text-stone-900">
                          Título: {fp.tituloFamily} ({fp.tituloWeight})
                        </p>
                        <p className="text-xs text-stone-600">
                          Texto: {fp.textoFamily} ({fp.textoWeight})
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    id={`btn-select-dir-${dir.directionId}`}
                    onClick={() => handleRequestRefinementA(dir.directionId, 1)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3.5 text-sm font-semibold text-stone-50 transition hover:bg-stone-800"
                  >
                    <span>Escolher esta direção e ver 2 versões afinadas</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =====================================================================
          ECRÃ 3A.3: ENTRADA A — REFINAMENTO (ATÉ 3 RONDAS)
      ===================================================================== */}
      {step === "a-refinamento" && refinamentoOpcoes && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Entrada A • Passo 3 de 4 • Ronda {refinamentoRound} de 3
              </p>
              <h1 className="mt-1 text-3xl font-bold text-stone-900">
                Duas versões afinadas da direção escolhida
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                Escolha a versão final para gerar as variantes ou peça «Mostrar outras 2» (máximo de 3 rondas).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setStep("a-direcoes")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar às 2 direções</span>
              </button>

              {refinamentoRound < 3 ? (
                <button
                  type="button"
                  id="btn-mostrar-outras-2"
                  onClick={() =>
                    handleRequestRefinementA(chosenDirectionId, refinamentoRound + 1)
                  }
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-stone-900 bg-[#FAF7F2] px-4 py-2.5 text-xs font-bold text-stone-900 transition hover:bg-stone-900 hover:text-stone-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Mostrar outras 2 (Ronda {refinamentoRound + 1}/3)</span>
                </button>
              ) : (
                <span className="rounded-xl bg-stone-200 px-3.5 py-2 text-xs font-bold text-stone-700">
                  Limite de 3 rondas atingido (3/3)
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {refinamentoOpcoes.map((opt, idx) => {
              const svgUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(opt.logoSvg)))}`;
              const symUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(opt.simboloSvg)))}`;
              const fp = FONT_PAIRS[opt.fontPairId];

              return (
                <div
                  key={opt.id}
                  className="flex flex-col justify-between rounded-3xl border-2 border-stone-200 bg-white p-7 shadow-xs transition hover:border-stone-900 space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-block rounded-lg bg-stone-900 px-3 py-1 text-xs font-bold text-amber-300">
                          {opt.titulo}
                        </span>
                        <h2 className="mt-2 text-xl font-bold text-stone-900">
                          {opt.subtitulo}
                        </h2>
                      </div>
                      <img
                        src={symUrl}
                        alt="Símbolo tamanho reduzido"
                        className="h-14 w-14 rounded-xl border border-stone-200 bg-[#FAF7F2] p-1.5 object-contain shrink-0"
                      />
                    </div>

                    <div
                      className="flex h-64 items-center justify-center rounded-2xl border border-stone-200 p-6"
                      style={{ backgroundColor: opt.paleta.papel.hex }}
                    >
                      <img
                        src={svgUrl}
                        alt={opt.titulo}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <p className="text-sm text-stone-600">{opt.racional}</p>

                    <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-[#FAF7F2] px-4 py-3 text-xs">
                      <div className="flex items-center gap-2">
                        {[
                          opt.paleta.primaria,
                          opt.paleta.secundaria,
                          opt.paleta.papel,
                          opt.paleta.tinta,
                        ].map((c, i) => (
                          <span
                            key={i}
                            className="h-5 w-5 rounded-full border border-stone-300"
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                      <span className="font-semibold text-stone-800">
                        {fp.tituloFamily} + {fp.textoFamily}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    id={`btn-approve-refined-${idx}`}
                    onClick={() => handleFinalizeLogoA(opt)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3.5 text-sm font-semibold text-stone-50 transition hover:bg-stone-800"
                  >
                    <Check className="h-4 w-4 text-amber-300" />
                    <span>Aprovar este logótipo e gerar variantes finais</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =====================================================================
          ECRÃ 3A.4: ENTRADA A — VARIANTES FINAIS DO LOGÓTIPO DE RAIZ
      ===================================================================== */}
      {step === "a-variantes" && variantesFinaisA && (
        <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-10 shadow-xs space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Entrada A • Passo 4 de 4 • Variantes Vectoriais Finais
              </p>
              <h1 className="mt-1 text-3xl font-bold text-stone-900">
                Variantes geradas para {dados.nome}
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                Horizontal, vertical, símbolo, monocromático e negativo prontos para alimentar o kit de 36 ficheiros.
              </p>
            </div>

            <button
              type="button"
              id="btn-a-avancar-propostas"
              onClick={() => setStep("propostas")}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800"
            >
              <span>Continuar para Propostas de Paleta e Tipos</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                titulo: "1. Variante Horizontal",
                nota: "Composição principal para cabeçalhos e papelaria",
                svg: variantesFinaisA.horizontalSvg,
                bg: chosenRefinedOption?.paleta.papel.hex || "#FAF7F2",
              },
              {
                titulo: "2. Variante Vertical",
                nota: "Composição centrada para formatos quadrados",
                svg: variantesFinaisA.verticalSvg,
                bg: chosenRefinedOption?.paleta.papel.hex || "#FAF7F2",
              },
              {
                titulo: "3. Símbolo / Ícone (icone.png)",
                nota: "Isolado para fotos de perfil, favicon e carimbos",
                svg: variantesFinaisA.simboloSvg,
                bg: "#FFFFFF",
              },
              {
                titulo: "4. Variante Monocromática",
                nota: "Aplicação a uma só cor de tinta escura",
                svg: variantesFinaisA.monocromaticoSvg,
                bg: "#FFFFFF",
              },
              {
                titulo: "5. Variante Negativa",
                nota: "Aplicação sobre fundos escuros e nocturnos",
                svg: variantesFinaisA.negativoSvg,
                bg: chosenRefinedOption?.paleta.tinta.hex || "#1C1917",
              },
            ].map((v, i) => (
              <div
                key={i}
                className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-4 space-y-3"
              >
                <div
                  className="flex h-48 items-center justify-center rounded-xl border border-stone-200 p-4"
                  style={{ backgroundColor: v.bg }}
                >
                  <img
                    src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(v.svg)))}`}
                    alt={v.titulo}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">{v.titulo}</h3>
                  <p className="text-xs text-stone-600">{v.nota}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          ECRÃ 3B: ENTRADA B — FICHEIRO DO LOGÓTIPO E DADOS DA MARCA
      ===================================================================== */}
      {step === "b-dados" && (
        <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-10 shadow-xs space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Entrada B • Logótipo Existente e Dados da Marca
              </p>
              <h1 className="mt-1 text-2xl font-bold text-stone-900 sm:text-3xl">
                Carregue o seu logótipo e preencha os dados
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                Aceita PNG, JPG ou SVG até 8 MB. Ou experimente de imediato o ensaio obrigatório <strong>Forno da Vilariça</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="btn-preset-b-forno"
                onClick={() => handleAnalyzeEntradaB("forno-da-vilarica")}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2.5 text-xs font-bold text-amber-950 shadow-2xs transition hover:bg-amber-200"
              >
                <Sparkles className="h-4 w-4" />
                <span>Carregar Ensaio: Forno da Vilariça</span>
              </button>
              <button
                type="button"
                id="btn-preset-b-oficina"
                onClick={() => handleAnalyzeEntradaB("oficina-do-sao")}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-xs font-semibold text-stone-800 transition hover:bg-stone-200/70"
              >
                <span>Exemplo: Oficina do São</span>
              </button>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            {/* Coluna esquerda: Formulário de dados da marca */}
            <div className="lg:col-span-7 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="b-input-nome"
                    className="block text-xs font-bold uppercase tracking-wider text-stone-700"
                  >
                    Nome da marca *
                  </label>
                  <input
                    id="b-input-nome"
                    type="text"
                    required
                    value={dados.nome}
                    onChange={(e) => setDados({ ...dados, nome: e.target.value })}
                    placeholder="Ex.: Forno da Vilariça"
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="b-select-sector"
                    className="block text-xs font-bold uppercase tracking-wider text-stone-700"
                  >
                    Sector de atividade *
                  </label>
                  <select
                    id="b-select-sector"
                    value={dados.sector}
                    onChange={(e) =>
                      setDados({ ...dados, sector: e.target.value as SectorId })
                    }
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                  >
                    {Object.values(SECTORS).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.rotulo}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                    Slogan
                  </label>
                  <input
                    type="text"
                    value={dados.slogan}
                    onChange={(e) => setDados({ ...dados, slogan: e.target.value })}
                    placeholder="Ex.: Pão de trigo ao nascer do dia"
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                    Serviços (usado no estilo Informativo)
                  </label>
                  <input
                    type="text"
                    value={dados.servicos}
                    onChange={(e) => setDados({ ...dados, servicos: e.target.value })}
                    placeholder="Ex.: Pão, broa e bolos de festa"
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600">
                    Pessoa de contacto
                  </label>
                  <input
                    type="text"
                    value={dados.pessoa}
                    onChange={(e) => setDados({ ...dados, pessoa: e.target.value })}
                    placeholder="Marta Queirós"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2 text-sm text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600">
                    Cargo
                  </label>
                  <input
                    type="text"
                    value={dados.cargo}
                    onChange={(e) => setDados({ ...dados, cargo: e.target.value })}
                    placeholder="Mestra Padeira e Sócia-Gerente"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2 text-sm text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600">
                    Email
                  </label>
                  <input
                    type="text"
                    value={dados.email}
                    onChange={(e) => setDados({ ...dados, email: e.target.value })}
                    placeholder="marta@fornodavilarica.pt"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2 text-sm text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={dados.telefone}
                    onChange={(e) => setDados({ ...dados, telefone: e.target.value })}
                    placeholder="+351 279 452 180"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2 text-sm text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600">
                    Website
                  </label>
                  <input
                    type="text"
                    value={dados.website}
                    onChange={(e) => setDados({ ...dados, website: e.target.value })}
                    placeholder="https://fornodavilarica.pt"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2 text-sm text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600">
                    NIF
                  </label>
                  <input
                    type="text"
                    value={dados.nif}
                    onChange={(e) => setDados({ ...dados, nif: e.target.value })}
                    placeholder="514 892 307"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2 text-sm text-stone-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-600">
                    Morada
                  </label>
                  <input
                    type="text"
                    value={dados.morada}
                    onChange={(e) => setDados({ ...dados, morada: e.target.value })}
                    placeholder="Largo da Feira 14, 5360-310 Vila Flor"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-[#FAF7F2] px-3.5 py-2 text-sm text-stone-900"
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
                  O ficheiro do logótipo é apenas um símbolo (sem o nome escrito) — compor o nome na variante horizontal
                </span>
              </label>
            </div>

            {/* Coluna direita: Carregamento e diagnóstico do ficheiro */}
            <div className="lg:col-span-5 space-y-5">
              <div className="rounded-2xl border-2 border-dashed border-stone-300 bg-[#FAF7F2] p-6 text-center space-y-3">
                <Upload className="mx-auto h-8 w-8 text-amber-800" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-stone-900">
                    Ficheiro do logótipo (PNG, JPG ou SVG • máx. 8 MB)
                  </p>
                  <p className="text-xs text-stone-600">
                    SVGs com scripts, entidades ou ligações externas são recusados por segurança.
                  </p>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-stone-50 hover:bg-stone-800">
                  <span>Escolher ficheiro do computador</span>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setSelectedFile(f);
                    }}
                    className="hidden"
                  />
                </label>

                {selectedFile && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-emerald-800">
                      Selecionado: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAnalyzeEntradaB()}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-800 px-4 py-2 text-xs font-bold text-white hover:bg-amber-900"
                    >
                      Analisar ficheiro carregado
                    </button>
                  </div>
                )}
              </div>

              {/* Diagnóstico do rascunho analisado */}
              {draft && (
                <div className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                      Pré-visualização do recorte
                    </span>
                    <span className="rounded-md bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                      {draft.width}×{draft.height} px ({draft.originalFormat.toUpperCase()})
                    </span>
                  </div>

                  <div className="checkerboard-bg flex h-44 items-center justify-center rounded-xl border border-stone-200 p-4">
                    <img
                      src={`/api/rascunhos/${draft.id}`}
                      alt="Logótipo processado"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <div className="text-xs text-stone-700 space-y-1.5">
                    {draft.backgroundStatus === "transparent_original" && (
                      <p className="flex items-center gap-1.5 text-emerald-800 font-medium">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Transparência original preservada como máscara.</span>
                      </p>
                    )}
                    {draft.backgroundStatus === "margin_removed" && (
                      <p className="flex items-center gap-1.5 text-emerald-800 font-medium">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>
                          Fundo de cor lisa ligado à margem removido automaticamente (brancos fechados interiores preservados).
                        </span>
                      </p>
                    )}
                    {draft.backgroundNotice && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
                        {draft.backgroundNotice}
                      </div>
                    )}
                    {draft.lowQuality && draft.qualityWarning && (
                      <div className="rounded-xl border border-amber-400 bg-amber-50 p-3.5 text-amber-950 space-y-2">
                        <p className="font-bold">Aviso de nitidez reduzida</p>
                        <p>{draft.qualityWarning}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setEntradaEscolhida("A");
                            setStep("a-questionario");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-bold text-amber-50 hover:bg-amber-950"
                        >
                          <PenTool className="h-3.5 w-3.5" />
                          <span>Abrir Entrada A para redesenhar logótipo de raiz</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    id="btn-b-avancar-propostas"
                    onClick={() => {
                      if (!dados.nome.trim()) {
                        setGlobalError("Preencha o nome da marca antes de continuar.");
                        return;
                      }
                      setStep("propostas");
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3.5 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800"
                  >
                    <span>Continuar para Propostas de Paleta e Tipos</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          ECRÃ 4: DUAS PROPOSTAS DE PALETA E TIPOS (+ VER MAIS PROPOSTAS)
      ===================================================================== */}
      {step === "propostas" && (
        <section className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Paleta e Tipografia • Regra das 2 Escolhas
              </p>
              <h1 className="mt-1 text-3xl font-bold text-stone-900">
                Duas propostas distintas de paleta e par de tipos
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                A primeira proposta é fiel ao logótipo e ao sector; a segunda oferece um contraste editorial e cromático claramente distinto.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setStep(entradaEscolhida === "A" ? "a-variantes" : "b-dados")
                }
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

          {/* Grelha de propostas (2 visíveis de imediato; 4 quando clica em Ver mais propostas) */}
          <div className="grid gap-6 md:grid-cols-2">
            {(showAllProposals ? propostas : propostas.slice(0, 2)).map((prop) => {
              const isSelected = selectedProposalId === prop.id;
              const fp = FONT_PAIRS[prop.fontPairId];

              return (
                <div
                  key={prop.id}
                  onClick={() => handleSelectProposal(prop)}
                  id={`card-proposta-${prop.id}`}
                  className={`cursor-pointer rounded-3xl border-2 p-7 transition space-y-5 ${
                    isSelected
                      ? "border-stone-950 bg-white ring-2 ring-stone-900/15 shadow-sm"
                      : "border-stone-200 bg-white/90 hover:border-stone-400"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold ${
                          isSelected
                            ? "bg-stone-900 text-amber-300"
                            : "bg-stone-100 text-stone-700"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                        Proposta {prop.titulo}
                      </span>
                      <h2 className="mt-2 text-xl font-bold text-stone-900">
                        {prop.subtitulo}
                      </h2>
                    </div>

                    <span className="rounded-lg border border-stone-200 bg-[#FAF7F2] px-3 py-1 text-xs font-bold text-stone-800">
                      Par: {fp.nome}
                    </span>
                  </div>

                  {/* Amostra ao vivo da paleta e dos tipos */}
                  <div
                    className="rounded-2xl border border-stone-200 p-6 space-y-2"
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
                      className="text-2xl leading-tight"
                    >
                      {dados.nome || "Nome da Marca"}
                    </p>
                    <p
                      style={{
                        fontFamily: fp.textoFamily,
                        fontWeight: fp.textoWeight,
                        color: prop.paleta.primaria.hex,
                      }}
                      className="text-base"
                    >
                      {dados.slogan ||
                        dados.servicos ||
                        "Composição tipográfica e cromática aplicada às peças do kit."}
                    </p>
                  </div>

                  {/* 5 faixas de cor */}
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: "Primária", c: prop.paleta.primaria },
                      { label: "Secundária", c: prop.paleta.secundaria },
                      { label: "Papel", c: prop.paleta.papel },
                      { label: "Tinta", c: prop.paleta.tinta },
                      { label: "Neutro", c: prop.paleta.neutro },
                    ].map((sw) => (
                      <div key={sw.label} className="space-y-1">
                        <div
                          className="h-11 w-full rounded-xl border border-stone-300 shadow-2xs"
                          style={{ backgroundColor: sw.c.hex }}
                        />
                        <p className="text-[11px] font-bold text-stone-800 truncate">
                          {sw.label}
                        </p>
                        <p className="font-mono text-[10px] text-stone-500">
                          {sw.c.hex}
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed">
                    {prop.descricao}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Afinação manual das 4 primeiras cores (o neutro recalcula-se) e do par tipográfico */}
          <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900">
                  Afinação manual de cores e tipografia (opcional)
                </h3>
                <p className="text-xs text-stone-600">
                  Pode corrigir as quatro primeiras cores (Primária, Secundária, Papel e Tinta); a quinta cor (<strong>Neutro: {customPalette.neutro.hex}</strong>) recalcula-se automaticamente entre Papel e Tinta.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {(
                [
                  { key: "primaria", label: "1. Primária", entry: customPalette.primaria },
                  { key: "secundaria", label: "2. Secundária", entry: customPalette.secundaria },
                  { key: "papel", label: "3. Papel (Fundo claro)", entry: customPalette.papel },
                  { key: "tinta", label: "4. Tinta (Fundo escuro)", entry: customPalette.tinta },
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
                      value={item.entry.hex}
                      onChange={(e) =>
                        handleCustomColorChange(item.key, e.target.value)
                      }
                      className="h-9 w-11 cursor-pointer rounded-lg border border-stone-300 bg-white p-0.5"
                    />
                    <input
                      type="text"
                      value={item.entry.hex}
                      onChange={(e) =>
                        handleCustomColorChange(item.key, e.target.value)
                      }
                      className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 font-mono text-xs text-stone-900"
                    />
                  </div>
                </div>
              ))}

              {/* 5. Neutro calculado automaticamente */}
              <div className="rounded-2xl border border-stone-200 bg-stone-100/80 p-3.5 space-y-2">
                <span className="block text-xs font-bold text-stone-700">
                  5. Neutro (Automático)
                </span>
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-9 w-11 rounded-lg border border-stone-300 shrink-0"
                    style={{ backgroundColor: customPalette.neutro.hex }}
                  />
                  <div className="text-xs">
                    <p className="font-mono font-bold text-stone-900">
                      {customPalette.neutro.hex}
                    </p>
                    <p className="text-[10px] text-stone-500">
                      Entre Papel e Tinta
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Escolha manual do par de tipos */}
            <div className="pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                Par tipográfico ativo
              </label>
              <div className="grid gap-2.5 sm:grid-cols-5">
                {Object.values(FONT_PAIRS).map((fp) => (
                  <button
                    key={fp.id}
                    type="button"
                    onClick={() => setSelectedFontPair(fp.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      selectedFontPair === fp.id
                        ? "border-stone-900 bg-stone-900 text-stone-50"
                        : "border-stone-200 bg-[#FAF7F2] text-stone-800 hover:border-stone-400"
                    }`}
                  >
                    <p className="text-xs font-bold">{fp.nome}</p>
                    <p className="text-[11px] opacity-85 mt-0.5">
                      {fp.tituloFamily} + {fp.textoFamily}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t border-stone-200 pt-6">
              <button
                type="button"
                id="btn-avancar-estilos"
                onClick={() => setStep("estilos")}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800"
              >
                <span>Aprovar Paleta e Escolher Estilos do Kit</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          ECRÃ 5: ESTILOS DO KIT (2 RECOMENDAÇÕES + CATÁLOGO) E POR GRUPO
      ===================================================================== */}
      {step === "estilos" && (
        <section className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Estilos de Conteúdo • Regra das 2 Escolhas
              </p>
              <h1 className="mt-1 text-3xl font-bold text-stone-900">
                Escolha o estilo do kit e afine cada grupo de peças
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                Para o sector <strong>{SECTORS[dados.sector]?.rotulo}</strong>, recomendamos dois estilos iniciais. Pode abrir o catálogo dos 6 estilos para o kit inteiro ou para cada grupo.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStep("propostas")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar a Paleta e Tipos</span>
            </button>
          </div>

          {/* 1. Estilo Global do Kit (2 recomendações + Ver catálogo) */}
          <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-stone-900">
                  Estilo global do kit (aplica-se a todas as peças por omissão)
                </h2>
                <p className="text-xs text-stone-600">
                  Duas recomendações para {SECTORS[dados.sector]?.rotulo}:
                </p>
              </div>

              <button
                type="button"
                id="btn-toggle-kit-catalog"
                onClick={() => setShowKitCatalog(!showKitCatalog)}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-900 bg-[#FAF7F2] px-4 py-2 text-xs font-bold text-stone-900 hover:bg-stone-900 hover:text-stone-50"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>
                  {showKitCatalog
                    ? "Mostrar apenas as 2 recomendações"
                    : "Ver catálogo (6 estilos)"}
                </span>
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(showKitCatalog
                ? (Object.keys(CONTENT_STYLES) as StyleId[])
                : SECTORS[dados.sector].recomendacoes.capas
              ).map((stId) => {
                const st = CONTENT_STYLES[stId];
                const active = kitStyle === stId;
                const isRec =
                  SECTORS[dados.sector].recomendacoes.capas.includes(stId);

                return (
                  <div
                    key={st.id}
                    id={`btn-kit-style-${st.id}`}
                    onClick={() => handleSelectKitStyle(st.id)}
                    className={`cursor-pointer rounded-2xl border-2 p-5 transition space-y-2 ${
                      active
                        ? "border-stone-900 bg-stone-900 text-stone-50"
                        : "border-stone-200 bg-[#FAF7F2] text-stone-900 hover:border-stone-400"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-base">{st.nome}</span>
                      {isRec && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            active
                              ? "bg-amber-400 text-stone-950"
                              : "bg-amber-100 text-amber-950"
                          }`}
                        >
                          Recomendado
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-xs leading-relaxed ${
                        active ? "text-stone-300" : "text-stone-600"
                      }`}
                    >
                      {st.descricao}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Painel de carregamento de fotografia se "fotografia" estiver escolhido */}
          {needsPhoto && (
            <div className="rounded-3xl border-2 border-amber-300 bg-amber-50/70 p-6 sm:p-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    Estilo Fotografia selecionado
                  </span>
                  <h3 className="text-lg font-bold text-stone-900">
                    Carregue a fotografia de fundo para as peças com estilo Fotografia
                  </h3>
                  <p className="text-xs text-stone-700">
                    O gerador aplica automaticamente um véu escuro calibrado para que o logótipo e o texto fiquem perfeitamente legíveis acima da imagem. (Na assinatura de email o estilo traduz-se em cores de tabela, sem imagem de fundo.)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-stone-50 hover:bg-stone-800">
                    <Upload className="h-4 w-4" />
                    <span>Carregar fotografia</span>
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

                  <button
                    type="button"
                    onClick={() => {
                      setPhotoDataUrl(
                        `data:image/svg+xml;base64,${btoa(
                          unescape(encodeURIComponent(SAMPLE_BAKERY_PHOTO_SVG))
                        )}`
                      );
                      setPhotoFilename("fotografia-forno-artesanal.svg");
                    }}
                    className="rounded-xl border border-amber-800 bg-white px-3.5 py-2.5 text-xs font-bold text-amber-950 hover:bg-amber-100"
                  >
                    Usar fotografia de ensaio
                  </button>
                </div>
              </div>

              {photoDataUrl ? (
                <div className="flex items-center gap-4 rounded-xl bg-white p-3 border border-amber-200">
                  <img
                    src={photoDataUrl}
                    alt="Fotografia selecionada"
                    className="h-16 w-24 rounded-lg object-cover border border-stone-200"
                  />
                  <div className="flex-1 text-xs">
                    <p className="font-bold text-emerald-900">
                      Fotografia pronta: {photoFilename || "imagem carregada"}
                    </p>
                    <p className="text-stone-600">
                      Será aplicada com véu escuro sob a camada do logótipo e do nome.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoDataUrl("");
                      setPhotoFilename("");
                    }}
                    className="text-xs font-semibold text-red-700 hover:underline"
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <p className="text-xs font-bold text-red-800">
                  Nenhuma fotografia carregada. Carregue uma fotografia ou escolha outro estilo antes de gerar o kit.
                </p>
              )}
            </div>
          )}

          {/* 2. Ajuste individual por grupo de conteúdos (2 recomendações + Ver catálogo em cada grupo) */}
          <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-stone-900">
                Ajuste por grupo de conteúdos (opcional)
              </h2>
              <p className="text-xs text-stone-600">
                Em cada grupo vê as 2 recomendações para o seu sector e o botão «Ver catálogo» para escolher qualquer um dos 6 estilos apenas para essa peça.
              </p>
            </div>

            <div className="divide-y divide-stone-200">
              {STYLE_GROUPS.map((grp) => {
                const recPair = SECTORS[dados.sector].recomendacoes[grp.key];
                const currentStyle = styleOverrides[grp.key];
                const isCatalogOpen = Boolean(openGroupCatalog[grp.key]);

                // Ensure the currently selected style is visible even when catalog is closed
                const visibleStyles: StyleId[] = isCatalogOpen
                  ? (Object.keys(CONTENT_STYLES) as StyleId[])
                  : Array.from(new Set([...recPair, currentStyle]));

                return (
                  <div
                    key={grp.key}
                    className="py-5 first:pt-0 last:pb-0 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="space-y-1 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900">
                          {grp.rotulo}
                        </span>
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-950">
                          Ativo: {CONTENT_STYLES[currentStyle].nome}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600">{grp.descricao}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {visibleStyles.map((stId) => {
                        const st = CONTENT_STYLES[stId];
                        const isSelected = currentStyle === stId;
                        const isRec = recPair.includes(stId);

                        return (
                          <button
                            key={stId}
                            type="button"
                            id={`btn-group-${grp.key}-style-${stId}`}
                            onClick={() =>
                              setStyleOverrides((prev) => ({
                                ...prev,
                                [grp.key]: stId,
                              }))
                            }
                            className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                              isSelected
                                ? "border-stone-900 bg-stone-900 text-stone-50"
                                : "border-stone-300 bg-[#FAF7F2] text-stone-800 hover:border-stone-500"
                            }`}
                          >
                            <span>{st.nome}</span>
                            {isRec && (
                              <span className="ml-1.5 opacity-75 text-[10px]">
                                ★
                              </span>
                            )}
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
                        className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-stone-100"
                      >
                        {isCatalogOpen ? "Fechar catálogo" : "Ver catálogo"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-stone-200 pt-6">
              <button
                type="button"
                onClick={() => setStep("propostas")}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Anterior</span>
              </button>

              <button
                type="button"
                id="btn-gerar-kit-final"
                disabled={Boolean(busyMessage)}
                onClick={handleGenerateFullKit}
                className="inline-flex items-center gap-2.5 rounded-xl bg-stone-900 px-7 py-4 text-sm font-bold text-stone-50 shadow-sm transition hover:bg-stone-800 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>Gerar os 36 Ficheiros e Pré-visualizar Kit</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          ECRÃ 6: PRÉ-VISUALIZAÇÃO COMPLETA NO BROWSER E DESCARREGAMENTO DO ZIP
      ===================================================================== */}
      {step === "resultado" && generatedKit && (
        <section className="space-y-8">
          {/* Banner de sucesso e botão de descarregamento do ZIP */}
          <div className="rounded-3xl border border-stone-900 bg-stone-900 p-8 text-stone-50 shadow-sm">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-3.5 py-1 text-xs font-bold text-amber-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Kit completo gerado com sucesso • 36 ficheiros verificados</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {generatedKit.zipFilename}
                </h1>
                <p className="text-sm text-stone-300 max-w-2xl">
                  Marca: <strong>{generatedKit.dados.nome}</strong> • Par tipográfico:{" "}
                  <strong>{FONT_PAIRS[generatedKit.fontPairId]?.nome}</strong> • Estilo base:{" "}
                  <strong>{CONTENT_STYLES[generatedKit.kitStyle]?.nome}</strong>. Pré-visualize cada peça abaixo ou descarregue o ZIP.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep("estilos")}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-800 px-4 py-3 text-xs font-semibold text-stone-200 hover:bg-stone-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Ajustar estilos</span>
                </button>

                <a
                  href={`/api/kits/${generatedKit.id}?download=1`}
                  id="btn-download-zip"
                  download={generatedKit.zipFilename}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-bold text-stone-950 shadow-sm transition hover:bg-amber-300"
                >
                  <Download className="h-4 w-4" />
                  <span>Descarregar ZIP (36 ficheiros)</span>
                </a>
              </div>
            </div>
          </div>

          {/* Filtros de categoria */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: "todas", label: "Todas as peças (36)" },
                { key: "variantes", label: "Variantes (5)" },
                { key: "redes", label: "Redes e Perfis (16)" },
                { key: "favicon", label: "Favicon (6)" },
                { key: "email", label: "Email (2)" },
                { key: "impressao", label: "Impressão PDF (2)" },
                { key: "guia", label: "Guia de Marca A4 (1)" },
                { key: "metadados", label: "Paleta, Tipos e LEIA-ME (4)" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveResultCategory(tab.key)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeResultCategory === tab.key
                    ? "bg-stone-900 text-stone-50"
                    : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Grelha de pré-visualização das 36 peças */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FORMAT_SPECS.filter(
              (s) =>
                activeResultCategory === "todas" ||
                s.categoria === activeResultCategory
            ).map((spec) => {
              const fileUrl = `/api/kits/${generatedKit.id}?ficheiro=${encodeURIComponent(
                spec.ficheiro
              )}`;

              // Para os 3 PDFs mostramos a pré-visualização PNG gerada em _previews/
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

              const appliedStyle = spec.styleGroup
                ? generatedKit.styleOverrides[spec.styleGroup]
                : null;

              return (
                <div
                  key={spec.id}
                  className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-stone-900">
                          {spec.nome}
                        </h3>
                        <p className="font-mono text-[11px] text-amber-900">
                          {spec.ficheiro}
                        </p>
                      </div>
                      <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-800 border border-stone-200 shrink-0">
                        {spec.tipo} • {spec.medidaLabel}
                      </span>
                    </div>

                    {/* Área visual da peça */}
                    {previewImgUrl ? (
                      <div
                        className={`flex h-52 items-center justify-center rounded-xl border border-stone-200 p-3 overflow-hidden ${
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
                      <div className="h-52 overflow-hidden rounded-xl border border-stone-200 bg-white">
                        <iframe
                          title="Pré-visualização da Assinatura HTML"
                          src={`${fileUrl}&preview=1`}
                          className="h-full w-full border-0"
                        />
                      </div>
                    ) : (
                      <div className="flex h-52 flex-col items-center justify-center rounded-xl border border-stone-200 bg-[#FAF7F2] p-4 text-center space-y-2">
                        <FileText className="h-8 w-8 text-stone-500" />
                        <p className="text-xs font-semibold text-stone-800">
                          Ficheiro de texto / configuração ({spec.tipo})
                        </p>
                        <p className="text-[11px] text-stone-500 max-w-xs">
                          Incluído na pasta <code>{spec.ficheiro}</code> dentro do ZIP.
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-stone-600 leading-relaxed">
                      {spec.nota}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-stone-100 pt-3 text-xs">
                    {appliedStyle ? (
                      <span className="rounded-md bg-amber-100/80 px-2 py-0.5 font-semibold text-amber-950">
                        Estilo: {CONTENT_STYLES[appliedStyle]?.nome}
                      </span>
                    ) : (
                      <span className="text-stone-400">Medida fixa</span>
                    )}

                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-stone-800 hover:text-amber-800"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Abrir ficheiro</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
