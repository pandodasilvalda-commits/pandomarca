import JSZip from "jszip";
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
  renderCoverPiece,
  renderEmailSignatureHtml,
  renderHorizontalVariant,
  renderInstagramPost,
  renderInstagramStory,
  renderLetterheadPdf,
  renderSignatureLogo,
  renderSquareOnBackground,
} from "./pieces";
import { createRandomId, KIT_TTL_MS, KitMeta, saveKit } from "../storage";
import type { CoverLayoutId } from "../capas/catalog";
import type { LogoVisualDna } from "../imagem";

export interface GenerateKitInput {
  draftId?: string;
  processedPng: Buffer;
  customIconPng?: Buffer;
  customWhiteLogoPng?: Buffer;
  vectorizedSvg?: string;
  negativeSvg?: string;
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
  code: "missing_photo" | "invalid_input";
  constructor(code: "missing_photo" | "invalid_input", message: string) {
    super(message);
    this.code = code;
  }
}

function renderPaletteSampleSvg(paleta: BrandPalette, brandName: string): string {
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
      <text x="8" y="200" font-family="sans-serif" font-weight="700" font-size="16" fill="#0F172A">${item.nome}</text>
      <text x="8" y="224" font-family="monospace" font-weight="600" font-size="15" fill="#334155">${item.cor.hex}</text>
      <text x="8" y="246" font-family="sans-serif" font-size="13" fill="#64748B">rgb(${item.cor.rgb.r}, ${item.cor.rgb.g}, ${item.cor.rgb.b})</text>
    </g>`;
    })
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="380" viewBox="0 0 1000 380">
  <rect width="1000" height="380" rx="16" fill="#FFFFFF" />
  <text x="40" y="54" font-family="sans-serif" font-weight="700" font-size="24" fill="#0F172A">Paleta Oficial — ${brandName.replace(/[<>&"]/g, "")}</text>
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

Este arquivo contém exactamente 36 ficheiros prontos a usar nas redes sociais,
no seu website, no seu cliente de email e em gráfica (impressão).

ESTRUTURA DE PASTAS E FICHEIROS:

1. variantes/ (5 ficheiros)
   - logotipo-principal.png : Logótipo processado com fundo transparente.
   - icone.png              : Símbolo / ícone quadrado a 1024×1024 px.
   - logotipo-horizontal.png: Composição horizontal a 1800×560 px.
   - fundo-claro.png        : Aplicação sobre fundo claro a 1200×1200 px.
   - fundo-escuro.png       : Aplicação sobre fundo escuro a 1200×1200 px.

2. Redes sociais e perfis (16 ficheiros)
   - facebook/foto-de-perfil.png          (320×320 px)
   - facebook/capa.png                    (851×315 px)
   - instagram/foto-de-perfil.png         (320×320 px)
   - instagram/publicacao-1080.png        (1080×1080 px)
   - instagram/story-1080x1920.png        (1080×1920 px)
   - x/foto-de-perfil.png                 (400×400 px)
   - x/cabecalho.png                      (1500×500 px)
   - youtube/foto-de-perfil.png           (800×800 px)
   - youtube/banner.png                   (2560×1440 px, zona segura centrada)
   - linkedin/perfil-pessoal.png          (400×400 px)
   - linkedin/capa-pessoal.png            (1584×396 px)
   - linkedin/perfil-empresa.png          (400×400 px)
   - linkedin/capa-empresa.png            (1512×256 px)
   - whatsapp-business/foto-de-perfil.png (640×640 px, fundo opaco)
   - google-business/logotipo.png         (720×720 px)
   - google-business/capa.png             (1024×576 px)

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
    vectorizedSvg,
    negativeSvg,
    logoDna,
    sessaoId,
    isDarkMonochrome,
    dados,
    paleta,
    fontPairId,
    kitStyle,
    coverLayoutId,
    styleOverrides,
    photoBuffer,
    cutoutBuffer,
  } = input;

  if (!dados.nome?.trim()) {
    throw new KitGenerationError("invalid_input", "O nome da marca é obrigatório.");
  }

  const effectiveStyles: StyleGroupOverrides = {
    capas: styleOverrides?.capas || kitStyle,
    publicacao: styleOverrides?.publicacao || kitStyle,
    story: styleOverrides?.story || kitStyle,
    cartao: styleOverrides?.cartao || kitStyle,
    papel: styleOverrides?.papel || kitStyle,
    assinatura: styleOverrides?.assinatura || kitStyle,
  };

  // Validate if any group uses "fotografia" that requires a photo when called from user flow
  // (Note: if photoBuffer is explicitly required, API route checks it, or if provided we pass it along)
  const zipFileMap = new Map<string, Buffer>();
  const allStorageFiles = new Map<string, Buffer>();

  const putZipFile = (relPath: string, buf: Buffer) => {
    zipFileMap.set(relPath, buf);
    allStorageFiles.set(relPath, buf);
  };

  // 1. Variantes do logótipo (5 ficheiros)
  const overlayWhiteLogoPng =
    customWhiteLogoPng ||
    (await createWhiteKnockoutLogo(processedPng, isDarkMonochrome));
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
    paddingRatio: 0.16,
    opaque: true,
  });

  const fundoEscuroPng = await renderSquareOnBackground({
    logoPng: overlayWhiteLogoPng,
    size: 1200,
    bgHex: paleta.tinta.hex,
    paddingRatio: 0.16,
    opaque: true,
  });

  putZipFile("variantes/logotipo-principal.png", processedPng);
  putZipFile("variantes/icone.png", iconePng);
  putZipFile("variantes/logotipo-horizontal.png", horizontalPng);
  putZipFile("variantes/fundo-claro.png", fundoClaroPng);
  putZipFile("variantes/fundo-escuro.png", fundoEscuroPng);

  // 2. Fotos de perfil e logótipos de redes (9 ficheiros)
  const profileSpecs: { path: string; size: number; padding: number }[] = [
    { path: "facebook/foto-de-perfil.png", size: 320, padding: 0.21 },
    { path: "instagram/foto-de-perfil.png", size: 320, padding: 0.21 },
    { path: "x/foto-de-perfil.png", size: 400, padding: 0.21 },
    { path: "youtube/foto-de-perfil.png", size: 800, padding: 0.21 },
    { path: "linkedin/perfil-pessoal.png", size: 400, padding: 0.21 },
    { path: "linkedin/perfil-empresa.png", size: 400, padding: 0.16 },
    { path: "whatsapp-business/foto-de-perfil.png", size: 640, padding: 0.21 },
    { path: "google-business/logotipo.png", size: 720, padding: 0.16 },
  ];

  for (const p of profileSpecs) {
    const buf = await renderSquareOnBackground({
      logoPng: iconePng,
      size: p.size,
      bgHex: paleta.papel.hex,
      paddingRatio: p.padding,
      opaque: true,
    });
    putZipFile(p.path, buf);
  }

  // 3. Capas de redes sociais (6 ficheiros)
  const coverSpecs: { id: string; path: string; width: number; height: number }[] = [
    { id: "fb-capa", path: "facebook/capa.png", width: 851, height: 315 },
    { id: "x-cabecalho", path: "x/cabecalho.png", width: 1500, height: 500 },
    { id: "yt-banner", path: "youtube/banner.png", width: 2560, height: 1440 },
    { id: "li-capa-pessoal", path: "linkedin/capa-pessoal.png", width: 1584, height: 396 },
    { id: "li-capa-empresa", path: "linkedin/capa-empresa.png", width: 1512, height: 256 },
    { id: "gb-capa", path: "google-business/capa.png", width: 1024, height: 576 },
  ];

  for (const c of coverSpecs) {
    const buf = await renderCoverPiece({
      id: c.id,
      width: c.width,
      height: c.height,
      style: effectiveStyles.capas,
      dados,
      paleta,
      fontPairId,
      processedPng,
      whiteLogoPng: overlayWhiteLogoPng,
      isDarkMonochrome,
      photoBuffer,
      coverLayoutId,
      cutoutBuffer,
      vectorizedSvg,
      negativeSvg,
      logoDna,
      sessaoId,
    });
    putZipFile(c.path, buf);
  }

  // 4. Instagram Publicação (1080×1080) e Story (1080×1920) (2 ficheiros)
  const igPostPng = await renderInstagramPost({
    style: effectiveStyles.publicacao,
    dados,
    paleta,
    fontPairId,
    processedPng,
    whiteLogoPng: overlayWhiteLogoPng,
    isDarkMonochrome,
    photoBuffer,
    vectorizedSvg,
    negativeSvg,
    logoDna,
    sessaoId,
  });
  putZipFile("instagram/publicacao-1080.png", igPostPng);

  const igStoryPng = await renderInstagramStory({
    style: effectiveStyles.story,
    dados,
    paleta,
    fontPairId,
    processedPng,
    whiteLogoPng: overlayWhiteLogoPng,
    isDarkMonochrome,
    photoBuffer,
    vectorizedSvg,
    negativeSvg,
    logoDna,
    sessaoId,
  });
  putZipFile("instagram/story-1080x1920.png", igStoryPng);

  // 5. Favicon (6 ficheiros)
  const favIco = await createMultiSizeIco(iconePng, [16, 32, 48]);
  const fav32 = await renderSquareOnBackground({
    logoPng: iconePng,
    size: 32,
    bgHex: paleta.papel.hex,
    paddingRatio: 0.08,
    opaque: false,
  });
  const appleTouch = await renderSquareOnBackground({
    logoPng: iconePng,
    size: 180,
    bgHex: paleta.papel.hex,
    paddingRatio: 0.16,
    opaque: true,
  });
  const icon192 = await renderSquareOnBackground({
    logoPng: iconePng,
    size: 192,
    bgHex: paleta.papel.hex,
    paddingRatio: 0.1,
    opaque: false,
  });
  const icon512 = await renderSquareOnBackground({
    logoPng: iconePng,
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

  // 6. Email (2 ficheiros)
  const emailLogoPng = await renderSignatureLogo(processedPng);
  const emailHtml = renderEmailSignatureHtml({
    style: effectiveStyles.assinatura,
    dados,
    paleta,
    fontPairId,
  });
  putZipFile("email/logotipo-assinatura.png", emailLogoPng);
  putZipFile("email/assinatura.html", Buffer.from(emailHtml, "utf8"));

  // 7. Impressão e Guia de Marca (3 ficheiros PDF)
  const cartaoRes = await renderBusinessCardPdf({
    style: effectiveStyles.cartao,
    dados,
    paleta,
    fontPairId,
    processedPng,
    whiteLogoPng: overlayWhiteLogoPng,
    isDarkMonochrome,
    photoBuffer,
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

  // 8. Paleta, Tipografia e LEIA-ME (4 ficheiros)
  const paletaJson = JSON.stringify(paleta, null, 2);
  const amostraSvg = renderPaletteSampleSvg(paleta, dados.nome);
  const tiposTxt = renderTypographyTxt(fontPairId, dados.nome);
  const slug = slugifyBrandName(dados.nome);
  const leiameTxt = renderReadmeTxt(dados, slug);

  putZipFile("paleta/paleta.json", Buffer.from(paletaJson, "utf8"));
  putZipFile("paleta/amostra.svg", Buffer.from(amostraSvg, "utf8"));
  putZipFile("tipografia/tipos.txt", Buffer.from(tiposTxt, "utf8"));
  putZipFile("LEIA-ME.txt", Buffer.from(leiameTxt, "utf8"));

  // Verify we have all 36 files from FORMAT_SPECS
  if (zipFileMap.size !== FORMAT_SPECS.length) {
    throw new Error(
      `Contagem de ficheiros inesperada: gerados ${zipFileMap.size}, esperados ${FORMAT_SPECS.length}`
    );
  }

  // Create ZIP with root folder `pandomarca-{slug}/`
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
    coverLayoutId,
    styleOverrides: effectiveStyles,
    coverArtOrigins: {
      tipo: "nascida-do-logotipo",
      estiloDirecao: logoDna?.estiloDirecao || effectiveStyles.capas,
      origemLogo: logoDna?.fixtureLogoOrigem || "logotipo-utilizador",
    },
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
