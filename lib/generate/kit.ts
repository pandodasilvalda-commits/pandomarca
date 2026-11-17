import JSZip from "jszip";
import {
  getRedeSocialConfig,
  REDES_SOCIAIS_LIST,
  REFERENCE_DATE_REDES_PT,
  type RedeSocialId,
  type TomDaMarca,
} from "../config/redes-sociais";
import {
  BrandData,
  BrandPalette,
  FONT_PAIRS,
  FontPairId,
  FORMAT_SPECS,
  slugifyBrandName,
  StyleGroupOverrides,
  StyleId,
} from "../formats";
import { createMultiSizeIco } from "./ico";
import {
  createWhiteKnockoutLogo,
  extractIconSquare,
  renderBrandGuidePdf,
  renderBusinessCardPdf,
  renderEmailSignatureHtml,
  renderHorizontalVariant,
  renderLetterheadPdf,
  renderRedeSocialPiece,
  renderSignatureLogo,
  renderSquareOnBackground,
  resolveOptionalFaviconSourcePng,
} from "./pieces";
import {
  createRandomId,
  KIT_TTL_MS,
  KitMeta,
  KitPecaMeta,
  loadDraft,
  loadKitFile,
  loadKitMeta,
  saveKit,
  updateKitMetaAndFile,
} from "../storage";
import type { SafeZoneAuditResult } from "../capas/safe-zone";
import type { CoverLayoutId } from "../capas/catalog";
import type { LogoVisualDna, PecaGeradaIA } from "../imagem";
import { vetorizarImagemLocal } from "../vetorizar";

export interface GenerateKitInput {
  draftId?: string;
  processedPng: Buffer;
  customIconPng?: Buffer;
  customWhiteLogoPng?: Buffer;
  vectorizedSvg?: string;
  simboloSvg?: string;
  negativeSvg?: string;
  usarVetorizacaoOpcional?: boolean;
  estiloVisual?: "moderno" | "classico";
  logoDna?: LogoVisualDna;
  sessaoId?: string;
  isDarkMonochrome: boolean;
  dados: BrandData;
  paleta: BrandPalette;
  fontPairId: FontPairId;
  kitStyle: StyleId;
  coverLayoutId?: CoverLayoutId;
  styleOverrides?: Partial<StyleGroupOverrides>;
  photoBuffer?: Buffer;
  cutoutBuffer?: Buffer;
}

export interface GeneratedKitResult {
  meta: KitMeta;
  zipBuffer: Buffer;
  zipFileMap: Map<string, Buffer>;
  allStorageFiles: Map<string, Buffer>;
}

export class KitGenerationError extends Error {
  code: "missing_photo" | "invalid_input" | "not_found";
  constructor(code: "missing_photo" | "invalid_input" | "not_found", message: string) {
    super(message);
    this.code = code;
  }
}

function resolveEstiloVisualKit(input: {
  estiloVisual?: "moderno" | "classico";
  coverLayoutId?: CoverLayoutId;
  kitStyle?: StyleId;
  logoDna?: LogoVisualDna;
}): "moderno" | "classico" {
  if (input.estiloVisual === "moderno" || input.estiloVisual === "classico") {
    return input.estiloVisual;
  }
  if (input.coverLayoutId?.startsWith("classico-")) return "classico";
  if (input.coverLayoutId?.startsWith("moderno-")) return "moderno";
  if (
    input.logoDna?.estiloDirecao === "moderno" ||
    input.logoDna?.estiloDirecao === "classico"
  ) {
    return input.logoDna.estiloDirecao;
  }
  if (input.kitStyle === "informativo" || input.kitStyle === "minimal") return "classico";
  return "moderno";
}

function renderPaletteSampleSvg(
  paleta: BrandPalette,
  brandName: string,
  fontPairId: FontPairId = "moderna"
): string {
  const pair = FONT_PAIRS[fontPairId] || FONT_PAIRS.moderna;
  const titleFont = `'${pair.tituloFamily}', ${pair.tituloCssFallback}`;
  const bodyFont = `'${pair.textoFamily}', ${pair.textoCssFallback}`;
  const entries = [
    { nome: "Primária", cor: paleta.primaria },
    { nome: "Secundária", cor: paleta.secundaria },
    { nome: "Papel", cor: paleta.papel },
    { nome: "Tinta", cor: paleta.tinta },
    { nome: "Neutro", cor: paleta.neutro },
  ];

  const cards = entries
    .map((item, idx) => {
      const x = 40 + idx * 188;
      return `<g transform="translate(${x}, 90)">
      <rect width="168" height="170" rx="12" fill="${item.cor.hex}" stroke="#CBD5E1" stroke-width="1.5" />
      <text x="8" y="200" font-family="${titleFont}" font-weight="${pair.tituloWeight}" font-size="16" fill="#0F172A">${item.nome}</text>
      <text x="8" y="224" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="600" font-size="15" fill="#334155">${item.cor.hex}</text>
      <text x="8" y="246" font-family="${bodyFont}" font-size="13" fill="#64748B">rgb(${item.cor.rgb.r}, ${item.cor.rgb.g}, ${item.cor.rgb.b})</text>
    </g>`;
    })
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="380" viewBox="0 0 1000 380">
  <rect width="1000" height="380" rx="16" fill="#FFFFFF" />
  <text x="40" y="54" font-family="${titleFont}" font-weight="${pair.tituloWeight}" font-size="24" fill="#0F172A">Paleta Oficial — ${brandName.replace(/[<>&"]/g, "")}</text>
  ${cards}
</svg>`;
}

function renderTypographyTxt(fontPairId: FontPairId, brandName: string): string {
  const pair = FONT_PAIRS[fontPairId] || FONT_PAIRS.moderna;
  return `TIPOGRAFIA OFICIAL DA MARCA — ${brandName}
============================================================

Par Tipográfico: ${pair.nome}
Indicação principal: ${pair.serveSobretudo}

1. Tipo de Título
   Família: ${pair.tituloFamily}
   Peso recomendado: ${pair.tituloWeight}
   Licença: SIL Open Font License (OFL)

2. Tipo de Texto / Corpo
   Família: ${pair.textoFamily}
   Peso recomendado: ${pair.textoWeight}
   Licença: SIL Open Font License (OFL)

Ligação direta para o par no Google Fonts:
${pair.googleFontsUrl}
`;
}

function renderReadmeTxt(dados: BrandData, slug: string): string {
  return `PANDOMARCA — KIT DE IDENTIDADE VISUAL E PRESENÇA DIGITAL
============================================================
Marca: ${dados.nome}
Pasta do kit: pandomarca-${slug}
Data de referência das medidas: ${REFERENCE_DATE_REDES_PT}

Este arquivo contém exactamente 38 ficheiros prontos a usar nas redes sociais,
no seu website, no seu cliente de email e em gráfica (impressão).

ESTRUTURA DE PASTAS E FICHEIROS:

1. variantes/ (5 ficheiros)
   - logotipo-principal.png : Logótipo processado com fundo transparente.
   - icone.png              : Símbolo / ícone quadrado a 1024×1024 px.
   - logotipo-horizontal.png: Composição horizontal a 1800×560 px.
   - fundo-claro.png        : Aplicação sobre fundo claro a 1200×1200 px.
   - fundo-escuro.png       : Aplicação sobre fundo escuro a 1200×1200 px.

2. Redes sociais e perfis (18 ficheiros — gerados com o logótipo como referência e zonas seguras verificadas)
   - facebook/foto-de-perfil.png          (720×720 px, círculo testado a 40 px)
   - facebook/capa.png                    (1640×624 px, zona segura móvel centrada)
   - instagram/foto-de-perfil.png         (320×320 px, círculo testado a 40 px)
   - instagram/publicacao-1080x1350.png   (1080×1350 px, formato vertical 4:5)
   - instagram/publicacao-1080.png        (1080×1080 px, formato quadrado 1:1)
   - instagram/story-1080x1920.png        (1080×1920 px, 250 px topo e base livres)
   - linkedin/perfil-pessoal.png          (400×400 px, círculo testado a 40 px)
   - linkedin/capa-pessoal.png            (1584×396 px)
   - linkedin/perfil-empresa.png          (400×400 px, página de empresa)
   - linkedin/capa-empresa.png            (1128×191 px, capa da página)
   - youtube/foto-de-perfil.png           (800×800 px, avatar circular)
   - youtube/banner.png                   (2560×1440 px, zona segura central 1546×423 px)
   - x/foto-de-perfil.png                 (400×400 px, círculo testado a 40 px)
   - x/cabecalho.png                      (1500×500 px)
   - google-business/logotipo.png         (720×720 px)
   - google-business/capa.png             (1024×576 px)
   - whatsapp-business/foto-de-perfil.png (640×640 px, fundo opaco)
   - tiktok/foto-de-perfil.png            (200×200 px, círculo testado a 40 px)

3. favicon/ (6 ficheiros para o website)
   - favicon.ico            : Multi-resolução com 16×16, 32×32 e 48×48 px.
   - favicon-32x32.png      : Ícone nítido para separadores do navegador.
   - apple-touch-icon.png   : 180×180 px com fundo opaco para iOS/Safari.
   - icon-192.png           : 192×192 px para Android e Web App Manifest.
   - icon-512.png           : 512×512 px para instalação PWA.
   - site.webmanifest       : Ficheiro de manifesto configurado com as cores da marca.

4. email/ (2 ficheiros)
   - assinatura.html        : Assinatura em tabela HTML com CSS em linha.
   - logotipo-assinatura.png: Logótipo com 128 px de altura (mostrado a 64 px no HTML).

5. impressao/ (2 ficheiros PDF prontos para gráfica)
   - cartao-de-visita.pdf   : 91×61 mm (corte 85×55 mm + sangria 3 mm), 2 páginas (frente e verso).
   - papel-de-carta.pdf     : A4 (210×297 mm) com cabeçalho, miolo branco e rodapé com NIF.

6. guia-de-marca/ (1 ficheiro PDF)
   - guia-de-marca.pdf      : Síntese A4 com variantes, paleta HEX/RGB e tipografia.

7. paleta/ e tipografia/ (3 ficheiros)
   - paleta/paleta.json     : Valores HEX e RGB das 5 cores do kit.
   - paleta/amostra.svg     : Amostra visual vectorial da paleta.
   - tipografia/tipos.txt   : Famílias tipográficas, pesos e ligação Google Fonts.

Gerado localmente por PandoMarca (um produto PandoWeb — https://pandoweb.pt).
`;
}

export async function generateFullBrandKit(
  input: GenerateKitInput
): Promise<GeneratedKitResult> {
  const {
    draftId = "direct",
    processedPng,
    customIconPng,
    customWhiteLogoPng,
    vectorizedSvg: inputVectorizedSvg,
    simboloSvg: inputSimboloSvg,
    negativeSvg: inputNegativeSvg,
    usarVetorizacaoOpcional = false,
    logoDna,
    sessaoId,
    isDarkMonochrome,
    dados: rawDados,
    paleta,
    fontPairId,
    kitStyle,
    coverLayoutId,
    styleOverrides,
    photoBuffer,
  } = input;

  if (!rawDados.nome?.trim()) {
    throw new KitGenerationError("invalid_input", "O nome da marca é obrigatório.");
  }

  if (!processedPng || processedPng.length === 0) {
    throw new KitGenerationError(
      "invalid_input",
      "O logótipo escolhido é obrigatório para gerar as peças do kit."
    );
  }

  const tomResolved: TomDaMarca =
    rawDados.tom || logoDna?.tom || "tradicional";
  const dados: BrandData = { ...rawDados, tom: tomResolved };

  const estiloVisual = resolveEstiloVisualKit({
    estiloVisual: input.estiloVisual,
    coverLayoutId,
    kitStyle,
    logoDna,
  });

  const effectiveStyles: StyleGroupOverrides = {
    capas: styleOverrides?.capas || kitStyle,
    publicacao: styleOverrides?.publicacao || kitStyle,
    story: styleOverrides?.story || kitStyle,
    cartao: styleOverrides?.cartao || kitStyle,
    papel: styleOverrides?.papel || kitStyle,
    assinatura: styleOverrides?.assinatura || kitStyle,
  };

  const zipFileMap = new Map<string, Buffer>();
  const allStorageFiles = new Map<string, Buffer>();

  const putZipFile = (relPath: string, buf: Buffer) => {
    zipFileMap.set(relPath, buf);
    allStorageFiles.set(relPath, buf);
  };

  // Vetorização local estritamente opcional e apenas aplicável a favicon e impressão
  let optVectorizedSvg = inputVectorizedSvg;
  let optSimboloSvg = inputSimboloSvg;
  let optNegativeSvg = inputNegativeSvg;

  if (usarVetorizacaoOpcional && (!optVectorizedSvg || !optSimboloSvg)) {
    try {
      const vec = await vetorizarImagemLocal(processedPng, {
        maxColors: 8,
        inkHex: paleta.tinta.hex,
        paletteHints: [
          paleta.primaria.hex,
          paleta.secundaria.hex,
          paleta.tinta.hex,
          paleta.papel.hex,
        ],
      });
      optVectorizedSvg = optVectorizedSvg || vec.colorSvg;
      optSimboloSvg = optSimboloSvg || vec.simboloSvg;
      optNegativeSvg = optNegativeSvg || vec.negativoTransparenteSvg;
    } catch {
      // Mantém raster em favicon e impressão se falhar a vetorização opcional
    }
  }

  // 1. Variantes do logótipo (5 ficheiros)
  const overlayWhiteLogoPng =
    customWhiteLogoPng ||
    (await createWhiteKnockoutLogo(processedPng, isDarkMonochrome, paleta.tinta.hex));
  const iconePng = await extractIconSquare(processedPng, customIconPng);
  const horizontalPng = await renderHorizontalVariant({
    processedPng,
    iconPng: iconePng,
    dados,
    paleta,
    fontPairId,
  });

  const fundoClaroPng = await renderSquareOnBackground({
    logoPng: processedPng,
    size: 1200,
    bgHex: paleta.papel.hex,
    paddingRatio: 0.10,
    opaque: true,
  });

  const fundoEscuroPng = await renderSquareOnBackground({
    logoPng: overlayWhiteLogoPng,
    size: 1200,
    bgHex: paleta.tinta.hex,
    paddingRatio: 0.10,
    opaque: true,
  });

  putZipFile("variantes/logotipo-principal.png", processedPng);
  putZipFile("variantes/icone.png", iconePng);
  putZipFile("variantes/logotipo-horizontal.png", horizontalPng);
  putZipFile("variantes/fundo-claro.png", fundoClaroPng);
  putZipFile("variantes/fundo-escuro.png", fundoEscuroPng);

  // 2. Todas as 18 peças de redes sociais e perfis — pipeline só-imagem com referência obrigatória + zonas seguras
  const textosPedidosPorPeca: Record<string, string[]> = {};
  const safeZoneAudits: Record<string, SafeZoneAuditResult> = {};
  const pecasMetadata: Record<string, KitPecaMeta> = {};

  for (const spec of REDES_SOCIAIS_LIST) {
    const groupStyle = spec.styleGroup
      ? effectiveStyles[spec.styleGroup]
      : effectiveStyles.capas;
    const peca = await renderRedeSocialPiece({
      redeId: spec.id,
      estiloVisual,
      dados,
      paleta,
      processedPng,
      logoDna,
      style: groupStyle,
      fontPairId,
      sessaoId,
    });

    putZipFile(spec.ficheiro, peca.buffer);
    textosPedidosPorPeca[spec.id] = peca.textosPedidos;
    safeZoneAudits[spec.id] = peca.audit;
    pecasMetadata[spec.id] = {
      redeId: spec.id,
      ficheiro: spec.ficheiro,
      estiloVisual: peca.estiloVisual,
      origem: peca.origem,
      fixtureNome: peca.fixtureNome,
      aspectRatioGemini: peca.aspectRatioGemini,
      referenciaLogoUsada: peca.referenciaLogoUsada,
      textosPedidos: peca.textosPedidos,
      avisoTextos: peca.avisoTextos,
      audit: peca.audit,
    };
  }

  // 3. Favicon (6 ficheiros — pode usar vetorização opcional quando ativada)
  const faviconSourcePng = await resolveOptionalFaviconSourcePng({
    iconePng,
    simboloSvg: optSimboloSvg,
    usarVetorizacaoOpcional,
  });

  const favIco = await createMultiSizeIco(faviconSourcePng, [16, 32, 48]);
  const fav32 = await renderSquareOnBackground({
    logoPng: faviconSourcePng,
    size: 32,
    bgHex: paleta.papel.hex,
    paddingRatio: 0.08,
    opaque: false,
  });
  const appleTouch = await renderSquareOnBackground({
    logoPng: faviconSourcePng,
    size: 180,
    bgHex: paleta.papel.hex,
    paddingRatio: 0.16,
    opaque: true,
  });
  const icon192 = await renderSquareOnBackground({
    logoPng: faviconSourcePng,
    size: 192,
    bgHex: paleta.papel.hex,
    paddingRatio: 0.1,
    opaque: false,
  });
  const icon512 = await renderSquareOnBackground({
    logoPng: faviconSourcePng,
    size: 512,
    bgHex: paleta.papel.hex,
    paddingRatio: 0.1,
    opaque: false,
  });

  const webmanifestObj = {
    name: dados.nome,
    short_name: dados.nome.slice(0, 24),
    description: dados.slogan || `Kit de marca ${dados.nome}`,
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    theme_color: paleta.primaria.hex,
    background_color: paleta.papel.hex,
    display: "standalone",
  };

  putZipFile("favicon/favicon.ico", favIco);
  putZipFile("favicon/favicon-32x32.png", fav32);
  putZipFile("favicon/apple-touch-icon.png", appleTouch);
  putZipFile("favicon/icon-192.png", icon192);
  putZipFile("favicon/icon-512.png", icon512);
  putZipFile(
    "favicon/site.webmanifest",
    Buffer.from(JSON.stringify(webmanifestObj, null, 2), "utf8")
  );

  // 4. Email (2 ficheiros)
  const emailLogoPng = await renderSignatureLogo(processedPng);
  const emailHtml = renderEmailSignatureHtml({
    style: effectiveStyles.assinatura,
    dados,
    paleta,
    fontPairId,
  });
  putZipFile("email/logotipo-assinatura.png", emailLogoPng);
  putZipFile("email/assinatura.html", Buffer.from(emailHtml, "utf8"));

  // 5. Impressão e Guia de Marca (3 ficheiros PDF — pode usar vetorização opcional nos de impressão)
  const cartaoRes = await renderBusinessCardPdf({
    style: effectiveStyles.cartao,
    dados,
    paleta,
    fontPairId,
    processedPng,
    whiteLogoPng: overlayWhiteLogoPng,
    isDarkMonochrome,
    photoBuffer,
    vectorizedSvg: optVectorizedSvg,
    negativeSvg: optNegativeSvg,
    usarVetorizacaoOpcional,
  });
  putZipFile("impressao/cartao-de-visita.pdf", cartaoRes.pdfBuffer);
  allStorageFiles.set("_previews/cartao.png", cartaoRes.frontPreviewPng);

  const papelRes = await renderLetterheadPdf({
    style: effectiveStyles.papel,
    dados,
    paleta,
    fontPairId,
    processedPng,
    whiteLogoPng: overlayWhiteLogoPng,
    isDarkMonochrome,
    photoBuffer,
    vectorizedSvg: optVectorizedSvg,
    negativeSvg: optNegativeSvg,
    usarVetorizacaoOpcional,
  });
  putZipFile("impressao/papel-de-carta.pdf", papelRes.pdfBuffer);
  allStorageFiles.set("_previews/papel.png", papelRes.previewPng);

  const guiaRes = await renderBrandGuidePdf({
    dados,
    paleta,
    fontPairId,
    kitStyle,
    principalPng: processedPng,
    iconePng,
    horizontalPng,
    fundoClaroPng,
    fundoEscuroPng,
  });
  putZipFile("guia-de-marca/guia-de-marca.pdf", guiaRes.pdfBuffer);
  allStorageFiles.set("_previews/guia.png", guiaRes.previewPng);

  // 6. Paleta, Tipografia e LEIA-ME (4 ficheiros)
  const paletaJson = JSON.stringify(paleta, null, 2);
  const amostraSvg = renderPaletteSampleSvg(paleta, dados.nome, fontPairId);
  const tiposTxt = renderTypographyTxt(fontPairId, dados.nome);
  const slug = slugifyBrandName(dados.nome);
  const leiameTxt = renderReadmeTxt(dados, slug);

  putZipFile("paleta/paleta.json", Buffer.from(paletaJson, "utf8"));
  putZipFile("paleta/amostra.svg", Buffer.from(amostraSvg, "utf8"));
  putZipFile("tipografia/tipos.txt", Buffer.from(tiposTxt, "utf8"));
  putZipFile("LEIA-ME.txt", Buffer.from(leiameTxt, "utf8"));

  // Verifica exactamente os 38 ficheiros esperados em FORMAT_SPECS
  if (zipFileMap.size !== FORMAT_SPECS.length) {
    throw new Error(
      `Contagem de ficheiros inesperada: gerados ${zipFileMap.size}, esperados ${FORMAT_SPECS.length}`
    );
  }

  // Montar ZIP em pandomarca-{slug}/
  const zip = new JSZip();
  const rootFolder = `pandomarca-${slug}`;
  for (const spec of FORMAT_SPECS) {
    const fileBuf = zipFileMap.get(spec.ficheiro);
    if (!fileBuf) {
      throw new Error(`Ficheiro em falta no kit: ${spec.ficheiro}`);
    }
    zip.file(`${rootFolder}/${spec.ficheiro}`, fileBuf);
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const now = Date.now();
  const meta: KitMeta = {
    id: createRandomId("kit"),
    draftId,
    createdAt: now,
    expiresAt: now + KIT_TTL_MS,
    slug,
    zipFilename: `${rootFolder}.zip`,
    dados,
    paleta,
    fontPairId,
    kitStyle,
    tom: tomResolved,
    estiloVisual,
    usarVetorizacaoOpcional: Boolean(usarVetorizacaoOpcional),
    coverLayoutId,
    styleOverrides: effectiveStyles,
    coverArtOrigins: {
      tipo: "so-imagem-com-referencia",
      estiloVisual,
      tom: tomResolved,
      origemLogo: logoDna?.fixtureLogoOrigem || "logotipo-utilizador",
    },
    textosPedidosPorPeca,
    safeZoneAudits,
    pecasMetadata,
    files: Array.from(zipFileMap.keys()),
  };

  saveKit(meta, zipBuffer, allStorageFiles);

  return {
    meta,
    zipBuffer,
    zipFileMap,
    allStorageFiles,
  };
}

/**
 * Regenera uma única peça social do kit já criado (ex.: após clique em «Regenerar» no aviso
 * «Verifique os textos» ou em alerta de zona segura), atualizando o PNG e reconstruindo o ZIP.
 */
export async function regenerarPecaDoKit(params: {
  kitId: string;
  redeId: RedeSocialId;
  estiloVisual?: "moderno" | "classico";
}): Promise<{ meta: KitMeta; peca: PecaGeradaIA }> {
  const loaded = loadKitMeta(params.kitId);
  if (loaded.status === "expired") {
    throw new KitGenerationError(
      "invalid_input",
      "Este kit expirou (validade de 6 horas). Gere novamente o kit."
    );
  }
  if (loaded.status !== "ok") {
    throw new KitGenerationError("not_found", "Kit não encontrado.");
  }

  const kitMeta = loaded.meta;
  const rede = getRedeSocialConfig(params.redeId);

  const loadedDraft =
    kitMeta.draftId && kitMeta.draftId !== "direct"
      ? loadDraft(kitMeta.draftId)
      : { status: "not_found" as const };

  const refLogoPng =
    loadedDraft.status === "ok"
      ? loadedDraft.processedPng
      : loadKitFile(params.kitId, "variantes/logotipo-principal.png");

  if (!refLogoPng || refLogoPng.length === 0) {
    throw new KitGenerationError(
      "invalid_input",
      "Referência do logótipo não disponível para regenerar esta peça."
    );
  }

  const estiloVisual =
    params.estiloVisual || kitMeta.estiloVisual || "moderno";

  const peca = await renderRedeSocialPiece({
    redeId: params.redeId,
    estiloVisual,
    dados: kitMeta.dados,
    paleta: kitMeta.paleta,
    processedPng: refLogoPng,
    logoDna: loadedDraft.status === "ok" ? loadedDraft.meta.logoDna : undefined,
    style: rede.styleGroup
      ? kitMeta.styleOverrides[rede.styleGroup]
      : kitMeta.kitStyle,
    fontPairId: kitMeta.fontPairId,
    sessaoId:
      loadedDraft.status === "ok" ? loadedDraft.meta.sessaoImagemId : undefined,
    bypassCache: true,
  });

  // Recriar o ZIP preservando os restantes ficheiros
  const rootFolder = `pandomarca-${kitMeta.slug}`;
  const zip = new JSZip();
  for (const spec of FORMAT_SPECS) {
    if (spec.ficheiro === rede.ficheiro) {
      zip.file(`${rootFolder}/${spec.ficheiro}`, peca.buffer);
    } else {
      const buf = loadKitFile(params.kitId, spec.ficheiro);
      if (buf) {
        zip.file(`${rootFolder}/${spec.ficheiro}`, buf);
      }
    }
  }

  const nextZipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const nextTextos = {
    ...(kitMeta.textosPedidosPorPeca || {}),
    [params.redeId]: peca.textosPedidos,
  };
  const nextAudits = {
    ...(kitMeta.safeZoneAudits || {}),
    [params.redeId]: peca.audit,
  };
  const nextPecasMeta: Record<string, KitPecaMeta> = {
    ...(kitMeta.pecasMetadata || {}),
    [params.redeId]: {
      redeId: params.redeId,
      ficheiro: rede.ficheiro,
      estiloVisual: peca.estiloVisual,
      origem: peca.origem,
      fixtureNome: peca.fixtureNome,
      aspectRatioGemini: peca.aspectRatioGemini,
      referenciaLogoUsada: peca.referenciaLogoUsada,
      textosPedidos: peca.textosPedidos,
      avisoTextos: peca.avisoTextos,
      audit: peca.audit,
    },
  };

  const updatedMeta = updateKitMetaAndFile({
    kitId: params.kitId,
    relPath: rede.ficheiro,
    fileBuffer: peca.buffer,
    zipBuffer: nextZipBuffer,
    patch: {
      textosPedidosPorPeca: nextTextos,
      safeZoneAudits: nextAudits,
      pecasMetadata: nextPecasMeta,
    },
  });

  if (!updatedMeta) {
    throw new KitGenerationError(
      "invalid_input",
      "Não foi possível guardar a peça regenerada."
    );
  }

  return { meta: updatedMeta, peca };
}

