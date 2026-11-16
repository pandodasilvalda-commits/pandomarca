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
  contrastRatio,
  generateFourProposals,
} from "@/lib/palette";
import { SAMPLE_BRANDS } from "@/lib/samples";
import { parseIcoSizes } from "@/lib/generate/ico";
import { generateFullBrandKit } from "@/lib/generate/kit";
import {
  createWhiteKnockoutLogo,
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
import {
  ajustarPropostaLogotipo,
  buildLogoVisualDna,
  carregarPrompt,
  decodeBase64ImageInput,
  GeminiImagemProvider,
  gerarArteCapaDaMarca,
  gerarArtePublicacaoDaMarca,
  gerarPropostasLogotipoRonda,
  limparOrcamentoKit,
  RecraftImagemProvider,
  verificarERegistarCusto,
} from "@/lib/imagem";
import {
  gerar5VariantesDoVetor,
  MAX_VECTOR_COLORS,
  MAX_VECTOR_SVG_BYTES,
  vetorizarImagemLocal,
} from "@/lib/vetorizar";
import {
  getAllCoverLayouts,
  getCoverProposalsPair,
} from "@/lib/capas/catalog";
import { renderLayeredCover } from "@/lib/capas/composer";

beforeAll(() => {
  process.env.KIT_ACCESS_CODE_WEBSITE = "kit-website-demo";
  process.env.KIT_ACCESS_CODE_STANDALONE = "kit-individual-demo";
  process.env.KIT_GATE_SECRET = "um-segredo-local";
  process.env.AI_IMAGE_PROVIDER = "";
  process.env.AI_IMAGE_API_KEY = "";
  process.env.IMAGEM_MODO = "falso";
  process.env.IMAGEM_FORNECEDOR = "";
  process.env.GEMINI_API_KEY = "";
  process.env.RECRAFT_API_KEY = "";
  process.env.IMAGEM_LIMITE_POR_KIT_EUR = "1.5";
  process.env.IMAGEM_MAX_RONDAS = "3";
  process.env.IMAGEM_MAX_AJUSTES = "3";
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

describe("Fase IA — Camada trocável sem chaves, vetorização local, capas em camadas e dados reais", () => {
  it("funciona em IMAGEM_MODO=falso sem chaves API, devolve 2 propostas distintas e adapta com instruções", async () => {
    const sessId = `teste_ia_${Date.now()}`;
    limparOrcamentoKit(sessId);

    // Verificar política estrita nos ficheiros de prompt (.md)
    const promptLogo = carregarPrompt("logotipo-classico", {
      nome: "Forno da Vilariça",
      sector: "Restauração",
    });
    expect(promptLogo.permiteTextoNoLogotipo).toBe("apenas_nome_ou_sem_texto");
    expect(promptLogo.promptFinal).toContain("Forno da Vilariça");

    const promptFundo = carregarPrompt("fundo-fotografia", {
      sector: "Padaria tradicional",
    });
    expect(promptFundo.permiteTextoNoLogotipo).toBe("sem_texto_nenhum");
    expect(promptFundo.promptFinal).toContain("SEM TEXTO NENHUM");

    // Adaptadores reais vazios recusam chamadas sem chave (zero rede)
    const gemini = new GeminiImagemProvider();
    const recraft = new RecraftImagemProvider();
    await expect(gemini.gerar("teste", "logotipo-classico", 1)).rejects.toThrow(
      /GEMINI_API_KEY/
    );
    await expect(recraft.gerar("teste", "logotipo-moderno", 1)).rejects.toThrow(
      /RECRAFT_API_KEY/
    );

    // Ronda 1 em modo falso devolve 1 clássica e 1 moderna de fontes diferentes
    const forno = SAMPLE_BRANDS["forno-da-vilarica"];
    const r1 = await gerarPropostasLogotipoRonda({
      sessaoId: sessId,
      nome: forno.dados.nome,
      slogan: forno.dados.slogan,
      sector: forno.dados.sector,
      tresPalavras: forno.questionarioA.tresPalavras,
      coresPreferidas: forno.questionarioA.coresPreferidas,
      ronda: 1,
    });

    expect(r1.config.modo).toBe("falso");
    expect(r1.config.semCustosReais).toBe(true);
    expect(r1.propostas).toHaveLength(2);
    const [pClassica, pModerna] = r1.propostas;
    expect(pClassica.estilo).toBe("classico");
    expect(pModerna.estilo).toBe("moderno");
    expect(pClassica.sugestaoFontPairId).not.toBe(pModerna.sugestaoFontPairId);
    expect(pClassica.sugestaoPaleta.primaria.hex).not.toBe(
      pModerna.sugestaoPaleta.primaria.hex
    );
    expect(pClassica.imagemBase64).toContain("data:image/png;base64,");
    expect(pModerna.imagemBase64).toContain("data:image/png;base64,");
    expect(pClassica.imagemBase64).not.toBe(pModerna.imagemBase64);

    // Ajuste dentro do teto de orçamento
    const aj1 = await ajustarPropostaLogotipo({
      sessaoId: sessId,
      nome: forno.dados.nome,
      sector: forno.dados.sector,
      proposta: pClassica,
      instrucao: "Reforçar espessura do arco do forno",
      ajusteNumero: 1,
    });
    expect(aj1.propostaAjustada.ajusteNumero).toBe(1);
    expect(aj1.orcamento.ajustesUsados).toBe(1);

    // Limites configuráveis de rondas, ajustes e teto de orçamento por kit
    await expect(
      gerarPropostasLogotipoRonda({
        sessaoId: sessId,
        nome: forno.dados.nome,
        ronda: 4,
      })
    ).rejects.toThrow(/Limite de 3 rondas/);

    await expect(
      ajustarPropostaLogotipo({
        sessaoId: sessId,
        nome: forno.dados.nome,
        proposta: pClassica,
        instrucao: "Teste limite",
        ajusteNumero: 4,
      })
    ).rejects.toThrow(/Limite de 3 ajustes/);

    expect(() =>
      verificarERegistarCusto({
        sessaoId: sessId,
        tipo: "editar",
        quantidade: 25,
        limiteEur: 0.25,
      })
    ).toThrow(/Limite de orçamento por kit atingido/);

    limparOrcamentoKit(sessId);
  });

  it("vetoriza localmente (vtracer + potrace) <= 8 cores, < 200 KB, preview 32 px e gera 5 variantes + 36 ficheiros exatos", async () => {
    const sessId = `teste_vec_${Date.now()}`;
    limparOrcamentoKit(sessId);
    const forno = SAMPLE_BRANDS["forno-da-vilarica"];
    const r1 = await gerarPropostasLogotipoRonda({
      sessaoId: sessId,
      nome: forno.dados.nome,
      sector: forno.dados.sector,
      ronda: 1,
    });

    const inputBuf = decodeBase64ImageInput(r1.propostas[0].imagemBase64);
    const vec = await vetorizarImagemLocal(inputBuf, {
      maxColors: MAX_VECTOR_COLORS,
      maxBytes: MAX_VECTOR_SVG_BYTES,
      inkHex: r1.propostas[0].sugestaoPaleta.tinta.hex,
      paletteHints: [
        r1.propostas[0].sugestaoPaleta.primaria.hex,
        r1.propostas[0].sugestaoPaleta.secundaria.hex,
        r1.propostas[0].sugestaoPaleta.tinta.hex,
        r1.propostas[0].sugestaoPaleta.papel.hex,
      ],
    });

    expect(vec.within8Colors).toBe(true);
    expect(vec.colorsCount).toBeLessThanOrEqual(8);
    expect(vec.colorsCount).toBeGreaterThanOrEqual(1);
    expect(vec.colorsHex).not.toContain("#D7C4BC");
    expect(vec.under200Kb).toBe(true);
    expect(vec.byteSize).toBeLessThan(200 * 1024);
    expect(vec.colorSvg).toContain("<svg");
    expect(vec.simboloSvg).toContain("<svg");
    expect(vec.simboloNegativoSvg).toContain("<svg");
    expect(vec.monocromaticoSvg).toContain("<svg");
    expect(vec.negativoSvg).toContain("<svg");
    expect(vec.negativoSvg).toMatch(/#FAF8F5|#F4B858/i);
    expect(vec.negativoSvg).not.toContain("#2A1810");
    expect(contrastRatio("#FAF8F5", "#1E100A")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#F4B858", "#1E100A")).toBeGreaterThanOrEqual(4.5);

    const p32Meta = await sharp(vec.preview32Png).metadata();
    expect(p32Meta.width).toBe(32);
    expect(p32Meta.height).toBe(32);

    const variantes = await gerar5VariantesDoVetor({
      vetor: vec,
      dados: forno.dados,
      paleta: r1.propostas[0].sugestaoPaleta,
      fontPairId: r1.propostas[0].sugestaoFontPairId,
    });
    expect(variantes.negativoTransparenteSvg).toMatch(/#FAF8F5|#F4B858/i);

    const logoDna = buildLogoVisualDna({
      nome: forno.dados.nome,
      sector: forno.dados.sector,
      paleta: r1.propostas[0].sugestaoPaleta,
      estiloDirecao: r1.propostas[0].estilo,
      fixtureLogoOrigem: r1.propostas[0].fixtureNome,
      tresPalavras: forno.questionarioA.tresPalavras,
    });

    const { meta } = await analyzeAndStoreLogo({
      buffer: variantes.processedPng,
      filename: "vetorizado.png",
      mimeType: "image/png",
      entrada: "A",
      iconSvg: variantes.simboloSvg,
      variantesEntradaA: {
        horizontalSvg: variantes.horizontalSvg,
        verticalSvg: variantes.verticalSvg,
        simboloSvg: variantes.simboloSvg,
        monocromaticoSvg: variantes.monocromaticoSvg,
        negativoSvg: variantes.negativoSvg,
        negativoTransparenteSvg: variantes.negativoTransparenteSvg,
      },
    });

    const kit = await generateFullBrandKit({
      draftId: meta.id,
      processedPng: variantes.processedPng,
      customIconPng: variantes.iconPng,
      customWhiteLogoPng: variantes.whiteLogoPng,
      vectorizedSvg: variantes.horizontalSvg,
      negativeSvg: variantes.negativoTransparenteSvg,
      logoDna,
      sessaoId: sessId,
      isDarkMonochrome: meta.isDarkMonochrome,
      dados: forno.dados,
      paleta: r1.propostas[0].sugestaoPaleta,
      fontPairId: r1.propostas[0].sugestaoFontPairId,
      kitStyle: "fotografia",
      coverLayoutId: "moderno-recorte",
    });

    expect(kit.meta.coverArtOrigins?.tipo).toBe("nascida-do-logotipo");
    expect(kit.meta.coverArtOrigins?.estiloDirecao).toBe("classico");

    const zip = await JSZip.loadAsync(kit.zipBuffer);
    const files = Object.values(zip.files).filter((f) => !f.dir);
    expect(files).toHaveLength(36);

    for (const spec of FORMAT_SPECS) {
      const entry = zip.file(`pandomarca-forno-da-vilarica/${spec.ficheiro}`);
      expect(entry, `Falta ficheiro do kit: ${spec.ficheiro}`).toBeTruthy();
      const buf = await entry!.async("nodebuffer");
      if (spec.tipo === "PNG" && spec.widthPx && spec.heightPx) {
        const m = await sharp(buf).metadata();
        expect(m.width, `Largura ${spec.ficheiro}`).toBe(spec.widthPx);
        expect(m.height, `Altura ${spec.ficheiro}`).toBe(spec.heightPx);
      }
    }

    limparOrcamentoKit(sessId);
  });

  it("compõe 6 layouts de capa (3 modernos + 3 clássicos), propõe sempre 1 Moderna + 1 Clássica, garante WCAG AA e omite campos vazios", async () => {
    const allLayouts = getAllCoverLayouts();
    expect(allLayouts).toHaveLength(6);
    expect(allLayouts.filter((l) => l.categoria === "moderno")).toHaveLength(3);
    expect(allLayouts.filter((l) => l.categoria === "classico")).toHaveLength(3);

    // Regra fixa: 1 Moderna + 1 Clássica em todas as rondas
    for (const round of [1, 2, 3]) {
      const pair = getCoverProposalsPair({ round, sector: "restauracao" });
      expect(pair).toHaveLength(2);
      expect(pair[0].categoria).toBe("moderno");
      expect(pair[1].categoria).toBe("classico");
      expect(pair[0].id).not.toBe(pair[1].id);
    }

    const forno = SAMPLE_BRANDS["forno-da-vilarica"];
    const { meta, processedPng } = await analyzeAndStoreLogo({
      buffer: Buffer.from(forno.svg, "utf8"),
      filename: "forno.svg",
      mimeType: "image/svg+xml",
    });
    const whiteLogoPng = await createWhiteKnockoutLogo(
      processedPng,
      meta.isDarkMonochrome
    );

    // Testar todas as 6 capas em Facebook (851×315) e YouTube (2560×1440 zona segura 1544×423)
    for (const layout of allLayouts) {
      const fbRes = await renderLayeredCover({
        coverFormatId: "fb-capa",
        width: 851,
        height: 315,
        layoutId: layout.id,
        dados: forno.dados,
        paleta: meta.paletaExtraida,
        fontPairId: layout.categoria === "classico" ? "editorial" : "moderna",
        processedPng,
        whiteLogoPng,
      });
      const fbMeta = await sharp(fbRes.buffer).metadata();
      expect(fbMeta.width).toBe(851);
      expect(fbMeta.height).toBe(315);
      expect(fbRes.audit.wcagAaPassed, `WCAG AA em ${layout.id}`).toBe(true);
      expect(fbRes.audit.contrastRatio).toBeGreaterThanOrEqual(4.5);
      expect(fbRes.audit.logoHeightRatio).toBeGreaterThanOrEqual(0.35);
      expect(fbRes.audit.logoOverlappedByObject).toBe(false);
      expect(fbRes.audit.safeZoneRespectsAvatar).toBe(true);
      expect(fbRes.audit.linesRendered.join(" ")).toContain("Torre de Moncorvo");

      const ytRes = await renderLayeredCover({
        coverFormatId: "yt-banner",
        width: 2560,
        height: 1440,
        layoutId: layout.id,
        dados: forno.dados,
        paleta: meta.paletaExtraida,
        fontPairId: "clara",
        processedPng,
        whiteLogoPng,
      });
      const ytMeta = await sharp(ytRes.buffer).metadata();
      expect(ytMeta.width).toBe(2560);
      expect(ytMeta.height).toBe(1440);
      expect(ytRes.audit.wcagAaPassed).toBe(true);
    }

    // Regra de dados reais: sem telefone/NIF/serviços/slogan não inventa texto nem números exemplo
    const semDadosOpcionais = {
      ...forno.dados,
      slogan: "",
      servicos: "",
      telefone: "",
      email: "",
      website: "",
      morada: "",
      nif: "",
      pessoa: "",
      cargo: "",
    };

    const capaMinima = await renderLayeredCover({
      coverFormatId: "fb-capa",
      width: 851,
      height: 315,
      layoutId: "classico-informativo",
      dados: semDadosOpcionais,
      paleta: meta.paletaExtraida,
      fontPairId: "clara",
      processedPng,
      whiteLogoPng,
    });
    expect(capaMinima.audit.linesRendered).toHaveLength(0);

    const postSemServicos = await renderInstagramPost({
      style: "informativo",
      dados: semDadosOpcionais,
      paleta: meta.paletaExtraida,
      fontPairId: "clara",
      processedPng,
      whiteLogoPng,
      isDarkMonochrome: false,
    });
    const postMeta = await sharp(postSemServicos).metadata();
    expect(postMeta.width).toBe(1080);

    const kitMinimal = await generateFullBrandKit({
      draftId: meta.id,
      processedPng,
      isDarkMonochrome: false,
      dados: semDadosOpcionais,
      paleta: meta.paletaExtraida,
      fontPairId: "clara",
      kitStyle: "liso",
    });
    const zipMin = await JSZip.loadAsync(kitMinimal.zipBuffer);
    const sigHtml = (
      await zipMin.file("pandomarca-forno-da-vilarica/email/assinatura.html")!.async("nodebuffer")
    ).toString("utf8");
    expect(sigHtml).not.toContain("_____");
    expect(sigHtml).not.toContain("NIF:");
    expect(sigHtml).not.toContain("+351");
  });

  it("gera capas e publicações nascidas diretamente do logótipo escolhido (referência, paleta, formas e estilo)", async () => {
    const forno = SAMPLE_BRANDS["forno-da-vilarica"];
    const sessId = "sess-arte-da-marca";
    limparOrcamentoKit(sessId);

    const r1 = await gerarPropostasLogotipoRonda({
      sessaoId: sessId,
      nome: forno.dados.nome,
      sector: forno.dados.sector,
      tresPalavras: forno.questionarioA.tresPalavras,
      ronda: 1,
    });

    const classica = r1.propostas.find((p) => p.estilo === "classico")!;
    const moderna = r1.propostas.find((p) => p.estilo === "moderno")!;
    const refClassica = decodeBase64ImageInput(classica.imagemBase64);
    const refModerna = decodeBase64ImageInput(moderna.imagemBase64);

    const dnaClassico = buildLogoVisualDna({
      nome: forno.dados.nome,
      sector: forno.dados.sector,
      paleta: classica.sugestaoPaleta,
      estiloDirecao: "classico",
      fixtureLogoOrigem: classica.fixtureNome,
      tresPalavras: forno.questionarioA.tresPalavras,
    });
    const dnaModerno = buildLogoVisualDna({
      nome: forno.dados.nome,
      sector: forno.dados.sector,
      paleta: moderna.sugestaoPaleta,
      estiloDirecao: "moderno",
      fixtureLogoOrigem: moderna.fixtureNome,
      tresPalavras: forno.questionarioA.tresPalavras,
    });

    const layoutClassico = getAllCoverLayouts().find((l) => l.id === "classico-rotulo")!;
    const layoutModerno = getAllCoverLayouts().find((l) => l.id === "moderno-texto-atras")!;

    const arteCapaClassica = await gerarArteCapaDaMarca({
      layout: layoutClassico,
      nome: forno.dados.nome,
      sector: forno.dados.sector,
      paleta: classica.sugestaoPaleta,
      estiloPeca: "fotografia",
      logotipoReferencia: refClassica,
      logotipoDna: dnaClassico,
      sessaoId: sessId,
    });
    expect(arteCapaClassica.permiteTextoNoLogotipo).toBe("sem_texto_nenhum");
    expect(arteCapaClassica.referenciaLogoUsada).toBe(true);
    expect(arteCapaClassica.promptUsado.toLowerCase()).toContain("arco de forno");
    expect(arteCapaClassica.promptUsado.toLowerCase()).toContain("espiga");

    const arteCapaModerna = await gerarArteCapaDaMarca({
      layout: layoutModerno,
      nome: forno.dados.nome,
      sector: forno.dados.sector,
      paleta: moderna.sugestaoPaleta,
      estiloPeca: "degrade",
      logotipoReferencia: refModerna,
      logotipoDna: dnaModerno,
      sessaoId: sessId,
    });
    expect(arteCapaModerna.permiteTextoNoLogotipo).toBe("sem_texto_nenhum");
    expect(arteCapaModerna.referenciaLogoUsada).toBe(true);
    expect(arteCapaModerna.promptUsado.toLowerCase()).toContain("monograma");
    expect(Buffer.compare(arteCapaClassica.buffer, arteCapaModerna.buffer)).not.toBe(0);

    const artePostClassica = await gerarArtePublicacaoDaMarca({
      tipo: "publicacao-instagram",
      nome: forno.dados.nome,
      sector: forno.dados.sector,
      paleta: classica.sugestaoPaleta,
      estiloPeca: "padrao",
      logotipoReferencia: refClassica,
      logotipoDna: dnaClassico,
      sessaoId: sessId,
    });
    expect(artePostClassica.permiteTextoNoLogotipo).toBe("sem_texto_nenhum");
    expect(artePostClassica.referenciaLogoUsada).toBe(true);
    expect(artePostClassica.promptUsado.toLowerCase()).toContain("arco de forno");

    const arteStoryModerna = await gerarArtePublicacaoDaMarca({
      tipo: "story-instagram",
      nome: forno.dados.nome,
      sector: forno.dados.sector,
      paleta: moderna.sugestaoPaleta,
      estiloPeca: "degrade",
      logotipoReferencia: refModerna,
      logotipoDna: dnaModerno,
      sessaoId: sessId,
    });
    expect(arteStoryModerna.permiteTextoNoLogotipo).toBe("sem_texto_nenhum");
    expect(arteStoryModerna.referenciaLogoUsada).toBe(true);

    // Compor peças finais e validar auditoria + divergência visual clássica vs moderna
    const whiteClassico = await createWhiteKnockoutLogo(refClassica, false);
    const whiteModerno = await createWhiteKnockoutLogo(refModerna, false);

    const fbClassico = await renderLayeredCover({
      coverFormatId: "fb-capa",
      width: 851,
      height: 315,
      layoutId: layoutClassico.id,
      dados: forno.dados,
      paleta: classica.sugestaoPaleta,
      fontPairId: "editorial",
      processedPng: refClassica,
      whiteLogoPng: whiteClassico,
      logoDna: dnaClassico,
      estiloPeca: "fotografia",
      sessaoId: sessId,
    });
    const fbModerno = await renderLayeredCover({
      coverFormatId: "fb-capa",
      width: 851,
      height: 315,
      layoutId: layoutClassico.id,
      dados: forno.dados,
      paleta: moderna.sugestaoPaleta,
      fontPairId: "moderna",
      processedPng: refModerna,
      whiteLogoPng: whiteModerno,
      logoDna: dnaModerno,
      estiloPeca: "fotografia",
      sessaoId: sessId,
    });

    const fbClassicoMeta = await sharp(fbClassico.buffer).metadata();
    const fbModernoMeta = await sharp(fbModerno.buffer).metadata();
    expect(fbClassicoMeta.width).toBe(851);
    expect(fbClassicoMeta.height).toBe(315);
    expect(fbModernoMeta.width).toBe(851);
    expect(fbModernoMeta.height).toBe(315);
    expect(fbClassico.audit.referenciaLogoUsada).toBe(true);
    expect(fbClassico.audit.estiloDoLogotipo).toBe("classico");
    expect(fbClassico.audit.formasDoLogotipo.toLowerCase()).toContain("arco de forno");
    expect(fbModerno.audit.referenciaLogoUsada).toBe(true);
    expect(fbModerno.audit.estiloDoLogotipo).toBe("moderno");
    expect(Buffer.compare(fbClassico.buffer, fbModerno.buffer)).not.toBe(0);

    const ytClassico = await renderLayeredCover({
      coverFormatId: "yt-banner",
      width: 2560,
      height: 1440,
      layoutId: "classico-moldura",
      dados: forno.dados,
      paleta: classica.sugestaoPaleta,
      fontPairId: "editorial",
      processedPng: refClassica,
      whiteLogoPng: whiteClassico,
      logoDna: dnaClassico,
      estiloPeca: "fotografia",
      sessaoId: sessId,
    });
    const ytMeta = await sharp(ytClassico.buffer).metadata();
    expect(ytMeta.width).toBe(2560);
    expect(ytMeta.height).toBe(1440);
    expect(ytClassico.audit.referenciaLogoUsada).toBe(true);
    expect(ytClassico.audit.wcagAaPassed).toBe(true);

    const postClassico = await renderInstagramPost({
      style: "fotografia",
      dados: forno.dados,
      paleta: classica.sugestaoPaleta,
      fontPairId: "editorial",
      processedPng: refClassica,
      whiteLogoPng: whiteClassico,
      isDarkMonochrome: false,
      logoDna: dnaClassico,
      sessaoId: sessId,
    });
    const postModerno = await renderInstagramPost({
      style: "fotografia",
      dados: forno.dados,
      paleta: moderna.sugestaoPaleta,
      fontPairId: "moderna",
      processedPng: refModerna,
      whiteLogoPng: whiteModerno,
      isDarkMonochrome: false,
      logoDna: dnaModerno,
      sessaoId: sessId,
    });
    const postCMeta = await sharp(postClassico).metadata();
    const postMMeta = await sharp(postModerno).metadata();
    expect(postCMeta.width).toBe(1080);
    expect(postCMeta.height).toBe(1080);
    expect(postMMeta.width).toBe(1080);
    expect(postMMeta.height).toBe(1080);
    expect(Buffer.compare(postClassico, postModerno)).not.toBe(0);

    const storyClassico = await renderInstagramStory({
      style: "fotografia",
      dados: forno.dados,
      paleta: classica.sugestaoPaleta,
      fontPairId: "editorial",
      processedPng: refClassica,
      whiteLogoPng: whiteClassico,
      isDarkMonochrome: false,
      logoDna: dnaClassico,
      sessaoId: sessId,
    });
    const storyModerno = await renderInstagramStory({
      style: "fotografia",
      dados: forno.dados,
      paleta: moderna.sugestaoPaleta,
      fontPairId: "moderna",
      processedPng: refModerna,
      whiteLogoPng: whiteModerno,
      isDarkMonochrome: false,
      logoDna: dnaModerno,
      sessaoId: sessId,
    });
    const storyCMeta = await sharp(storyClassico).metadata();
    const storyMMeta = await sharp(storyModerno).metadata();
    expect(storyCMeta.width).toBe(1080);
    expect(storyCMeta.height).toBe(1920);
    expect(storyMMeta.width).toBe(1080);
    expect(storyMMeta.height).toBe(1920);
    expect(Buffer.compare(storyClassico, storyModerno)).not.toBe(0);

    limparOrcamentoKit(sessId);
  });
});


