import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import {
  FORMAT_SPECS,
  StyleId,
} from "@/lib/formats";
import {
  signEntitlementCookie,
  verifyAccessCode,
  verifyEntitlementCookie,
} from "@/lib/access";
import {
  analyzeAndStoreLogo,
  validateSvgSecurity,
} from "@/lib/analyze-logo";
import {
  buildBrandPalette,
  computeNeutralHex,
  generateFourProposals,
} from "@/lib/palette";
import { SAMPLE_BRANDS } from "@/lib/samples";
import { parseIcoSizes } from "@/lib/generate/ico";
import { generateFullBrandKit } from "@/lib/generate/kit";
import {
  mmToPt,
  renderCoverPiece,
  renderInstagramPost,
  renderInstagramStory,
} from "@/lib/generate/pieces";
import {
  generateFinalVariantsA,
  generateInitialDirections,
  generateRefinementRound,
} from "@/lib/logo-generator/svg-studio";

beforeAll(() => {
  process.env.KIT_ACCESS_CODE_WEBSITE = "kit-website-demo";
  process.env.KIT_ACCESS_CODE_STANDALONE = "kit-individual-demo";
  process.env.KIT_GATE_SECRET = "um-segredo-local";
  process.env.AI_IMAGE_PROVIDER = "";
  process.env.AI_IMAGE_API_KEY = "";
});

describe("Fase 1 — Controlo de acesso, análise de ficheiro, variantes e 36 formatos", () => {
  it("valida códigos website_bonus e standalone, assina cookie e recusa código inválido", () => {
    const bad = verifyAccessCode("codigo-errado");
    expect(bad.valid).toBe(false);
    if (!bad.valid) {
      expect(bad.reason).toBe("invalid_code");
      expect(bad.message).toContain("inválido");
    }

    const web = verifyAccessCode("kit-website-demo");
    expect(web.valid).toBe(true);
    if (web.valid) {
      expect(web.entitlement.kind).toBe("website_bonus");
      const token = signEntitlementCookie(web.entitlement);
      const verified = verifyEntitlementCookie(token);
      expect(verified?.kind).toBe("website_bonus");
    }

    const ind = verifyAccessCode("kit-individual-demo");
    expect(ind.valid).toBe(true);
    if (ind.valid) {
      expect(ind.entitlement.kind).toBe("standalone");
    }
  });

  it("recusa SVGs inseguros com scripts, entidades ou ligações externas", () => {
    expect(() =>
      validateSvgSecurity('<svg><script>alert(1)</script></svg>')
    ).toThrow(/segurança/);

    expect(() =>
      validateSvgSecurity('<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg></svg>')
    ).toThrow(/segurança/);

    expect(() =>
      validateSvgSecurity('<svg><image href="https://evil.example.com/a.png" /></svg>')
    ).toThrow(/segurança/);
  });

  it("remove fundo liso ligado à margem mantendo o branco fechado no interior do desenho", async () => {
    // Criamos uma imagem com fundo creme/branco (#FFFFFF) na margem, um anel colorido (#B84A24)
    // e um círculo branco (#FFFFFF) fechado no centro (100,100) que NÃO deve ficar transparente!
    const svgWithClosedInteriorWhite = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#FFFFFF" />
      <circle cx="100" cy="100" r="65" fill="#B84A24" />
      <circle cx="100" cy="100" r="28" fill="#FFFFFF" />
    </svg>`;

    const pngFlat = await sharp(Buffer.from(svgWithClosedInteriorWhite))
      .flatten({ background: "#FFFFFF" })
      .resize(600, 600)
      .png()
      .toBuffer();

    const { meta, processedPng } = await analyzeAndStoreLogo({
      buffer: pngFlat,
      filename: "anel.png",
      mimeType: "image/png",
    });

    expect(meta.backgroundStatus).toBe("margin_removed");
    expect(meta.lowQuality).toBe(false);

    // Verificar que o canto (0,0) está transparente e o centro exacto (branco fechado) está opaco!
    const { data, info } = await sharp(processedPng)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const cornerAlpha = data[3];
    const centerIdx =
      (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4;
    const centerR = data[centerIdx];
    const centerG = data[centerIdx + 1];
    const centerB = data[centerIdx + 2];
    const centerAlpha = data[centerIdx + 3];

    expect(cornerAlpha).toBe(0);
    expect(centerAlpha).toBe(255);
    expect(centerR).toBeGreaterThan(240);
    expect(centerG).toBeGreaterThan(240);
    expect(centerB).toBeGreaterThan(240);
  });

  it("gera o kit completo de 36 ficheiros para Forno da Vilariça (Entrada B) com todas as medidas exactas", async () => {
    const forno = SAMPLE_BRANDS["forno-da-vilarica"];
    const { meta, processedPng } = await analyzeAndStoreLogo({
      buffer: Buffer.from(forno.svg, "utf8"),
      filename: "forno-da-vilarica.svg",
      mimeType: "image/svg+xml",
      entrada: "B",
    });

    // Um SVG nítido não leva aviso de baixa resolução
    expect(meta.originalFormat).toBe("svg");
    expect(meta.lowQuality).toBe(false);

    const kitResult = await generateFullBrandKit({
      draftId: meta.id,
      processedPng,
      isDarkMonochrome: meta.isDarkMonochrome,
      dados: forno.dados,
      paleta: meta.paletaExtraida,
      fontPairId: "clara",
      kitStyle: "degrade",
      styleOverrides: {
        capas: "degrade",
        publicacao: "padrao",
        story: "degrade",
        cartao: "liso",
        papel: "informativo",
        assinatura: "informativo",
      },
    });

    expect(kitResult.meta.zipFilename).toBe("pandomarca-forno-da-vilarica.zip");

    // Descompactar o ZIP e confirmar exactamente 36 ficheiros (sem pastas vazias a contar nem _previews)
    const loadedZip = await JSZip.loadAsync(kitResult.zipBuffer);
    const nonDirEntries = Object.values(loadedZip.files).filter((f) => !f.dir);
    expect(nonDirEntries.length).toBe(36);

    const rootPrefix = "pandomarca-forno-da-vilarica/";
    for (const spec of FORMAT_SPECS) {
      const zipEntry = loadedZip.file(`${rootPrefix}${spec.ficheiro}`);
      expect(zipEntry, `Ficheiro esperado no ZIP: ${spec.ficheiro}`).toBeTruthy();
      const buf = await zipEntry!.async("nodebuffer");
      expect(buf.length).toBeGreaterThan(10);

      // Confirmar medidas de todos os PNG com medida fixa
      if (spec.tipo === "PNG" && spec.widthPx && spec.heightPx) {
        const imgMeta = await sharp(buf).metadata();
        expect(imgMeta.width, `Largura de ${spec.ficheiro}`).toBe(spec.widthPx);
        expect(imgMeta.height, `Altura de ${spec.ficheiro}`).toBe(spec.heightPx);
      }

      // Confirmar altura 128 px do logótipo da assinatura de email
      if (spec.ficheiro === "email/logotipo-assinatura.png") {
        const imgMeta = await sharp(buf).metadata();
        expect(imgMeta.height).toBe(128);
        expect(imgMeta.width).toBeLessThanOrEqual(480);
      }

      // Confirmar favicon.ico com 16, 32 e 48 px no mesmo ficheiro
      if (spec.ficheiro === "favicon/favicon.ico") {
        const icoEntries = parseIcoSizes(buf);
        const sizes = icoEntries.map((e) => e.width);
        expect(sizes).toEqual([16, 32, 48]);
        expect(icoEntries.map((e) => e.height)).toEqual([16, 32, 48]);
      }

      // Confirmar PDFs (cartão 91×61 mm em 2 páginas com TrimBox 85×55 mm; papel e guia em A4 210×297 mm)
      if (spec.tipo === "PDF") {
        const pdfDoc = await PDFDocument.load(buf);
        expect(pdfDoc.getPageCount(), `Páginas de ${spec.ficheiro}`).toBe(
          spec.pages || 1
        );
        const firstPage = pdfDoc.getPage(0);
        const { width, height } = firstPage.getSize();
        expect(width).toBeCloseTo(mmToPt(spec.widthMm!), 1);
        expect(height).toBeCloseTo(mmToPt(spec.heightMm!), 1);

        if (spec.ficheiro === "impressao/cartao-de-visita.pdf") {
          const trimBox = firstPage.getTrimBox();
          const bleedBox = firstPage.getBleedBox();
          expect(trimBox.width).toBeCloseTo(mmToPt(85), 1);
          expect(trimBox.height).toBeCloseTo(mmToPt(55), 1);
          expect(bleedBox.width).toBeCloseTo(mmToPt(91), 1);
          expect(bleedBox.height).toBeCloseTo(mmToPt(61), 1);
        }
      }
    }

    // Confirmar HTML da assinatura (CSS em linha, NIF presente, sem background-image)
    const assinaturaHtml = (
      await loadedZip.file(`${rootPrefix}email/assinatura.html`)!.async("nodebuffer")
    ).toString("utf8");
    expect(assinaturaHtml).toContain("514 892 307");
    expect(assinaturaHtml).toContain('height="64"');
    expect(assinaturaHtml).not.toMatch(/background-image\s*:/i);
  });
});

describe("Fase 2 — Quatro propostas distintas e seis estilos de conteúdo", () => {
  it("gera 4 propostas de paleta e tipos onde as 2 primeiras são claramente diferentes (não apenas cores trocadas)", () => {
    const base = buildBrandPalette({
      primaria: "#B84A24",
      secundaria: "#D9822B",
      papel: "#FAF6F0",
      tinta: "#2A1810",
    });

    const props = generateFourProposals(base, "restauracao");
    expect(props).toHaveLength(4);

    const [p1, p2] = props;
    expect(p1.id).toBe("direta");
    expect(p2.id).toBe("contrastada");
    // As duas primeiras têm pares tipográficos diferentes e primárias diferentes (não a secundária trocada)
    expect(p1.fontPairId).not.toBe(p2.fontPairId);
    expect(p1.paleta.primaria.hex).not.toBe(p2.paleta.primaria.hex);
    expect(p2.paleta.primaria.hex).not.toBe(p1.paleta.secundaria.hex);

    // Recálculo automático do neutro entre papel e tinta
    const novoNeutro = computeNeutralHex("#FAF6F0", "#1C1917");
    expect(novoNeutro).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("mede publicação (1080×1080), story (1080×1920) e capa em cada um dos 6 estilos do catálogo", async () => {
    const forno = SAMPLE_BRANDS["forno-da-vilarica"];
    const { meta, processedPng } = await analyzeAndStoreLogo({
      buffer: Buffer.from(forno.svg, "utf8"),
      filename: "forno.svg",
      mimeType: "image/svg+xml",
    });

    // Criar uma fotografia de teste para o estilo "fotografia"
    const samplePhoto = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 160, g: 95, b: 45 },
      },
    })
      .png()
      .toBuffer();

    const styles: StyleId[] = [
      "liso",
      "degrade",
      "padrao",
      "informativo",
      "fotografia",
      "minimal",
    ];

    for (const st of styles) {
      const postBuf = await renderInstagramPost({
        style: st,
        dados: forno.dados,
        paleta: meta.paletaExtraida,
        fontPairId: "clara",
        processedPng,
        whiteLogoPng: processedPng,
        isDarkMonochrome: false,
        photoBuffer: samplePhoto,
      });
      const postMeta = await sharp(postBuf).metadata();
      expect(postMeta.width, `Post width in style ${st}`).toBe(1080);
      expect(postMeta.height, `Post height in style ${st}`).toBe(1080);

      const storyBuf = await renderInstagramStory({
        style: st,
        dados: forno.dados,
        paleta: meta.paletaExtraida,
        fontPairId: "clara",
        processedPng,
        whiteLogoPng: processedPng,
        isDarkMonochrome: false,
        photoBuffer: samplePhoto,
      });
      const storyMeta = await sharp(storyBuf).metadata();
      expect(storyMeta.width, `Story width in style ${st}`).toBe(1080);
      expect(storyMeta.height, `Story height in style ${st}`).toBe(1920);

      const coverBuf = await renderCoverPiece({
        id: "fb-capa",
        width: 851,
        height: 315,
        style: st,
        dados: forno.dados,
        paleta: meta.paletaExtraida,
        fontPairId: "clara",
        processedPng,
        whiteLogoPng: processedPng,
        isDarkMonochrome: false,
        photoBuffer: samplePhoto,
      });
      const coverMeta = await sharp(coverBuf).metadata();
      expect(coverMeta.width, `Cover width in style ${st}`).toBe(851);
      expect(coverMeta.height, `Cover height in style ${st}`).toBe(315);
    }
  });
});

describe("Fase 3 — Logótipo de raiz (Entrada A) e ensaio completo Forno da Vilariça", () => {
  it("gera 2 direções distintas sem AI_IMAGE_API_KEY, até 3 rondas de refinamento, 5 variantes e o ZIP de 36 ficheiros", async () => {
    const forno = SAMPLE_BRANDS["forno-da-vilarica"];
    const questionario = {
      nome: forno.dados.nome,
      slogan: forno.dados.slogan,
      sector: forno.dados.sector,
      tresPalavras: forno.questionarioA.tresPalavras,
      coresPreferidas: forno.questionarioA.coresPreferidas,
      coresEvitar: forno.questionarioA.coresEvitar,
      referencias: forno.questionarioA.referencias.map((r) => ({
        nomeFicheiro: r.titulo,
        nota: r.nota,
      })),
    };

    const { directions, aiStatus } = await generateInitialDirections(questionario);
    expect(aiStatus.usedAiProvider).toBe(false);
    expect(directions).toHaveLength(2);

    const [d1, d2] = directions;
    expect(d1.directionId).toBe("classica");
    expect(d2.directionId).toBe("contemporanea");
    expect(d1.fontPairId).not.toBe(d2.fontPairId);
    expect(d1.paleta.primaria.hex).not.toBe(d2.paleta.primaria.hex);
    expect(d1.logoSvg).not.toBe(d2.logoSvg);

    // 3 rondas de afinação
    const r1 = await generateRefinementRound(questionario, "classica", 1);
    const r2 = await generateRefinementRound(questionario, "classica", 2);
    const r3 = await generateRefinementRound(questionario, "classica", 3);
    expect(r1).toHaveLength(2);
    expect(r2).toHaveLength(2);
    expect(r3).toHaveLength(2);
    expect(r1[0].logoSvg).not.toBe(r1[1].logoSvg);
    expect(r1[0].simboloSvg).not.toBe(r2[0].simboloSvg);

    // Gerar variantes finais (horizontal, vertical, símbolo, monocromático e negativo)
    const variantes = await generateFinalVariantsA(questionario, r1[0]);
    expect(variantes.horizontalSvg).toContain("<svg");
    expect(variantes.verticalSvg).toContain("<svg");
    expect(variantes.simboloSvg).toContain("<svg");
    expect(variantes.monocromaticoSvg).toContain("<svg");
    expect(variantes.negativoSvg).toContain("<svg");

    // Passar ao mesmo pipeline de análise e geração do ZIP de 36 ficheiros
    const { meta, processedPng } = await analyzeAndStoreLogo({
      buffer: Buffer.from(variantes.horizontalSvg, "utf8"),
      filename: "forno-raiz.svg",
      mimeType: "image/svg+xml",
      entrada: "A",
      iconSvg: variantes.simboloSvg,
      variantesEntradaA: variantes,
    });

    const kitA = await generateFullBrandKit({
      draftId: meta.id,
      processedPng,
      isDarkMonochrome: meta.isDarkMonochrome,
      dados: forno.dados,
      paleta: r1[0].paleta,
      fontPairId: r1[0].fontPairId,
      kitStyle: "padrao",
      styleOverrides: {
        capas: "degrade",
        publicacao: "padrao",
        story: "degrade",
        cartao: "liso",
        papel: "informativo",
        assinatura: "informativo",
      },
    });

    const zipA = await JSZip.loadAsync(kitA.zipBuffer);
    const filesA = Object.values(zipA.files).filter((f) => !f.dir);
    expect(filesA).toHaveLength(36);
  });
});
