import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import {
  getRedeSocialConfig,
  HIERARQUIA_INFORMACAO_PADRAO,
  REDES_SOCIAIS_CONFIG,
  REDES_SOCIAIS_LIST,
  resolverHierarquiaInformacaoConfig,
  TONS_DA_MARCA_LIST,
  type TomDaMarca,
} from "@/lib/config/redes-sociais";
import { FORMAT_SPECS } from "@/lib/formats";
import {
  signEntitlementCookie,
  verifyAccessCode,
  verifyEntitlementCookie,
} from "@/lib/access";
import { analyzeAndStoreLogo, validateSvgSecurity } from "@/lib/analyze-logo";
import {
  buildBrandPalette,
  computeNeutralHex,
  contrastRatio,
  generateFourProposals,
} from "@/lib/palette";
import { SAMPLE_BRANDS } from "@/lib/samples";
import { parseIcoSizes } from "@/lib/generate/ico";
import { generateFullBrandKit, regenerarPecaDoKit } from "@/lib/generate/kit";
import { mmToPt } from "@/lib/generate/pieces";
import {
  ajustarPropostaLogotipo,
  AVISO_VERIFIQUE_TEXTOS_PT,
  buildLogoVisualDna,
  buildNanoBananaRequest,
  buildTextosPedidosParaPeca,
  carregarPrompt,
  decodeBase64ImageInput,
  DEFAULT_GEMINI_MODEL,
  FalsoImagemProvider,
  GeminiImagemProvider,
  gerarDuasPropostasVisualMarca,
  gerarPecaRedeSocialComAuditoria,
  gerarPropostasLogotipoRonda,
  limparOrcamentoKit,
  RecraftImagemProvider,
  verificarERegistarCusto,
} from "@/lib/imagem";
import { cropResizeToRedeSpec, validarZonaSegura } from "@/lib/capas/safe-zone";
import {
  MAX_VECTOR_COLORS,
  MAX_VECTOR_SVG_BYTES,
  vetorizarImagemLocal,
} from "@/lib/vetorizar";
import { loadKitZip } from "@/lib/storage";

beforeAll(() => {
  process.env.KIT_ACCESS_CODE_WEBSITE = "kit-website-demo";
  process.env.KIT_ACCESS_CODE_STANDALONE = "kit-individual-demo";
  process.env.KIT_GATE_SECRET = "um-segredo-local";
  process.env.IMAGEM_MODO = "falso";
  process.env.IMAGEM_FORNECEDOR = "gemini";
  process.env.IMAGEM_MODELO = DEFAULT_GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "";
  process.env.RECRAFT_API_KEY = "";
  process.env.IMAGEM_LIMITE_POR_KIT_EUR = "1.5";
  process.env.IMAGEM_MAX_RONDAS = "3";
  process.env.IMAGEM_MAX_AJUSTES = "3";
});

describe("Controlo de acesso, análise de ficheiro, configuração central de redes e 38 formatos", () => {
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
      validateSvgSecurity("<svg><script>alert(1)</script></svg>")
    ).toThrow(/segurança/);

    expect(() =>
      validateSvgSecurity('<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg></svg>')
    ).toThrow(/segurança/);

    expect(() =>
      validateSvgSecurity('<svg><image href="https://evil.example.com/a.png" /></svg>')
    ).toThrow(/segurança/);
  });

  it("remove fundo liso ligado à margem mantendo o branco fechado no interior do desenho", async () => {
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

    const { data, info } = await sharp(processedPng)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const cornerAlpha = data[3];
    const centerIdx =
      (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4;
    expect(cornerAlpha).toBe(0);
    expect(data[centerIdx + 3]).toBe(255);
    expect(data[centerIdx]).toBeGreaterThan(240);
    expect(data[centerIdx + 1]).toBeGreaterThan(240);
    expect(data[centerIdx + 2]).toBeGreaterThan(240);
  });

  it("centraliza as 18 redes sociais em lib/config/redes-sociais.ts com medidas e proporções Gemini exactas", () => {
    expect(REDES_SOCIAIS_LIST).toHaveLength(18);
    expect(FORMAT_SPECS).toHaveLength(38);

    expect(REDES_SOCIAIS_CONFIG["fb-perfil"].widthPx).toBe(720);
    expect(REDES_SOCIAIS_CONFIG["fb-perfil"].heightPx).toBe(720);
    expect(REDES_SOCIAIS_CONFIG["fb-perfil"].isCircle).toBe(true);

    expect(REDES_SOCIAIS_CONFIG["fb-capa"].widthPx).toBe(1640);
    expect(REDES_SOCIAIS_CONFIG["fb-capa"].heightPx).toBe(624);
    expect(REDES_SOCIAIS_CONFIG["fb-capa"].aspectRatioGemini).toBe("21:9");

    expect(REDES_SOCIAIS_CONFIG["ig-perfil"].widthPx).toBe(320);
    expect(REDES_SOCIAIS_CONFIG["ig-perfil"].heightPx).toBe(320);
    expect(REDES_SOCIAIS_CONFIG["ig-publicacao-1080x1350"].widthPx).toBe(1080);
    expect(REDES_SOCIAIS_CONFIG["ig-publicacao-1080x1350"].heightPx).toBe(1350);
    expect(REDES_SOCIAIS_CONFIG["ig-publicacao-1080x1350"].aspectRatioGemini).toBe("4:5");
    expect(REDES_SOCIAIS_CONFIG["ig-publicacao"].widthPx).toBe(1080);
    expect(REDES_SOCIAIS_CONFIG["ig-publicacao"].heightPx).toBe(1080);
    expect(REDES_SOCIAIS_CONFIG["ig-story"].widthPx).toBe(1080);
    expect(REDES_SOCIAIS_CONFIG["ig-story"].heightPx).toBe(1920);
    expect(REDES_SOCIAIS_CONFIG["ig-story"].margemTopoPx).toBe(250);
    expect(REDES_SOCIAIS_CONFIG["ig-story"].margemBasePx).toBe(250);

    expect(REDES_SOCIAIS_CONFIG["li-capa-pessoal"].widthPx).toBe(1584);
    expect(REDES_SOCIAIS_CONFIG["li-capa-pessoal"].heightPx).toBe(396);
    expect(REDES_SOCIAIS_CONFIG["li-capa-empresa"].widthPx).toBe(1128);
    expect(REDES_SOCIAIS_CONFIG["li-capa-empresa"].heightPx).toBe(191);

    expect(REDES_SOCIAIS_CONFIG["yt-perfil"].widthPx).toBe(800);
    expect(REDES_SOCIAIS_CONFIG["yt-banner"].widthPx).toBe(2560);
    expect(REDES_SOCIAIS_CONFIG["yt-banner"].heightPx).toBe(1440);
    expect(REDES_SOCIAIS_CONFIG["yt-banner"].safeZoneMobile.width).toBe(1546);
    expect(REDES_SOCIAIS_CONFIG["yt-banner"].safeZoneMobile.height).toBe(423);

    expect(REDES_SOCIAIS_CONFIG["x-perfil"].widthPx).toBe(400);
    expect(REDES_SOCIAIS_CONFIG["x-cabecalho"].widthPx).toBe(1500);
    expect(REDES_SOCIAIS_CONFIG["x-cabecalho"].heightPx).toBe(500);

    expect(REDES_SOCIAIS_CONFIG["gb-logotipo"].widthPx).toBe(720);
    expect(REDES_SOCIAIS_CONFIG["gb-capa"].widthPx).toBe(1024);
    expect(REDES_SOCIAIS_CONFIG["gb-capa"].heightPx).toBe(576);
    expect(REDES_SOCIAIS_CONFIG["wa-perfil"].widthPx).toBe(640);
    expect(REDES_SOCIAIS_CONFIG["wa-perfil"].opaque).toBe(true);
    expect(REDES_SOCIAIS_CONFIG["tiktok-perfil"].widthPx).toBe(200);
    expect(REDES_SOCIAIS_CONFIG["tiktok-perfil"].heightPx).toBe(200);
    expect(REDES_SOCIAIS_CONFIG["tiktok-perfil"].isCircle).toBe(true);
  });

  it("gera o kit completo de 38 ficheiros para Forno da Vilariça (Entrada B) com todas as medidas exactas", async () => {
    const forno = SAMPLE_BRANDS["forno-da-vilarica"];
    const { meta, processedPng } = await analyzeAndStoreLogo({
      buffer: Buffer.from(forno.svg, "utf8"),
      filename: "forno-da-vilarica.svg",
      mimeType: "image/svg+xml",
      entrada: "B",
    });

    expect(meta.originalFormat).toBe("svg");
    expect(meta.lowQuality).toBe(false);

    const kitResult = await generateFullBrandKit({
      draftId: meta.id,
      processedPng,
      isDarkMonochrome: meta.isDarkMonochrome,
      dados: { ...forno.dados, tom: "tradicional" },
      paleta: meta.paletaExtraida,
      fontPairId: "clara",
      kitStyle: "degrade",
      estiloVisual: "moderno",
    });

    expect(kitResult.meta.zipFilename).toBe("pandomarca-forno-da-vilarica.zip");
    expect(kitResult.meta.tom).toBe("tradicional");
    expect(kitResult.meta.coverArtOrigins?.tipo).toBe("so-imagem-com-referencia");

    const loadedZip = await JSZip.loadAsync(kitResult.zipBuffer);
    const nonDirEntries = Object.values(loadedZip.files).filter((f) => !f.dir);
    expect(nonDirEntries).toHaveLength(38);

    const rootPrefix = "pandomarca-forno-da-vilarica/";
    for (const spec of FORMAT_SPECS) {
      const zipEntry = loadedZip.file(`${rootPrefix}${spec.ficheiro}`);
      expect(zipEntry, `Ficheiro esperado no ZIP: ${spec.ficheiro}`).toBeTruthy();
      const buf = await zipEntry!.async("nodebuffer");
      expect(buf.length).toBeGreaterThan(10);

      if (spec.tipo === "PNG" && spec.widthPx && spec.heightPx) {
        const imgMeta = await sharp(buf).metadata();
        expect(imgMeta.width, `Largura de ${spec.ficheiro}`).toBe(spec.widthPx);
        expect(imgMeta.height, `Altura de ${spec.ficheiro}`).toBe(spec.heightPx);
      }

      if (spec.ficheiro === "email/logotipo-assinatura.png") {
        const imgMeta = await sharp(buf).metadata();
        expect(imgMeta.height).toBe(128);
        expect(imgMeta.width).toBeLessThanOrEqual(480);
      }

      if (spec.ficheiro === "favicon/favicon.ico") {
        const icoEntries = parseIcoSizes(buf);
        expect(icoEntries.map((e) => e.width)).toEqual([16, 32, 48]);
        expect(icoEntries.map((e) => e.height)).toEqual([16, 32, 48]);
      }

      if (spec.tipo === "PDF") {
        const pdfDoc = await PDFDocument.load(buf);
        expect(pdfDoc.getPageCount(), `Páginas de ${spec.ficheiro}`).toBe(spec.pages || 1);
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

    const assinaturaHtml = (
      await loadedZip.file(`${rootPrefix}email/assinatura.html`)!.async("nodebuffer")
    ).toString("utf8");
    expect(assinaturaHtml).toContain("514 892 307");
    expect(assinaturaHtml).toContain('height="64"');
    expect(assinaturaHtml).not.toMatch(/background-image\s*:/i);
  });
});

describe("Paleta, Tom da Marca e Camada IA Só-Imagem (Gemini Nano Banana 2.1)", () => {
  it("gera 4 propostas de paleta e tipos distintas e recalcula o neutro", () => {
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
    expect(p1.fontPairId).not.toBe(p2.fontPairId);
    expect(p1.paleta.primaria.hex).not.toBe(p2.paleta.primaria.hex);
    expect(p2.paleta.primaria.hex).not.toBe(p1.paleta.secundaria.hex);
    expect(computeNeutralHex("#FAF6F0", "#1C1917")).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("estrutura pedidos Gemini Nano Banana 2.1 com proporção nativa e referência multimodal obrigatória", async () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-nano-banana-2.1");

    // Pedidos de peça social sem logotipoReferencia devem falhar imediatamente
    expect(() =>
      buildNanoBananaRequest("Banner da marca", "rede-capa", {
        aspectRatioNativo: "21:9",
      })
    ).toThrow(/obrigatório como imagem de referência/);

    expect(() =>
      buildNanoBananaRequest("Avatar", "rede-avatar")
    ).toThrow(/obrigatório como imagem de referência/);

    const dummyRef = await sharp({
      create: { width: 120, height: 120, channels: 4, background: { r: 180, g: 70, b: 30, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const req = buildNanoBananaRequest("Capa Facebook moderna", "rede-capa", {
      logotipoReferencia: dummyRef,
      aspectRatioNativo: "21:9",
    });

    expect(req.model).toBe("gemini-nano-banana-2.1");
    expect(req.endpointPath).toContain("gemini-nano-banana-2.1:generateContent");
    expect(req.generationConfig.imageConfig.aspectRatio).toBe("21:9");
    expect(req.temReferenciaObrigatoria).toBe(true);
    expect(req.contents[0].parts).toHaveLength(2);
    expect("inlineData" in req.contents[0].parts[1]).toBe(true);

    // Adaptadores reais sem chaves nunca fazem rede
    const gemini = new GeminiImagemProvider();
    const recraft = new RecraftImagemProvider();
    await expect(gemini.gerar("teste", "logotipo-classico", 1)).rejects.toThrow(/GEMINI_API_KEY/);
    await expect(recraft.gerar("teste", "logotipo-moderno", 1)).rejects.toThrow(/RECRAFT_API_KEY/);

    // FalsoImagemProvider exige logotipoReferencia para peças seguintes
    const falso = new FalsoImagemProvider();
    await expect(falso.gerar("capa", "rede-capa", 1)).rejects.toThrow(/referência/);
    await expect(falso.gerar("avatar", "rede-avatar", 1)).rejects.toThrow(/referência/);
  });

  it("incorpora todos os 6 tons da marca nos prompts de logótipo e peças visuais", async () => {
    expect(TONS_DA_MARCA_LIST).toHaveLength(6);
    const tones: TomDaMarca[] = [
      "tradicional",
      "premium",
      "jovem",
      "tecnico",
      "natural",
      "divertido",
    ];

    const forno = SAMPLE_BRANDS["forno-da-vilarica"];
    const promptLogo = carregarPrompt("logotipo-classico", {
      nome: forno.dados.nome,
      sector: "Restauração",
      tom: "Premium",
    });
    expect(promptLogo.permiteTextoNoLogotipo).toBe("apenas_nome_ou_sem_texto");

    for (const tom of tones) {
      const sid = `sess_tom_${tom}_${Date.now()}`;
      limparOrcamentoKit(sid);
      const r = await gerarPropostasLogotipoRonda({
        sessaoId: sid,
        nome: forno.dados.nome,
        sector: forno.dados.sector,
        tom,
        ronda: 1,
      });
      expect(r.propostas[0].tom).toBe(tom);
      expect(r.propostas[1].tom).toBe(tom);
      expect(r.propostas[0].promptUsado.toLowerCase()).toContain(
        TONS_DA_MARCA_LIST.find((t) => t.id === tom)!.nome.toLowerCase()
      );
      limparOrcamentoKit(sid);
    }
  });

  it("executa Entrada A (rondas, ajustes, referência obrigatória -> Moderna & Clássica + 38 ficheiros + 40 px)", async () => {
    const sessId = `teste_fluxo_a_${Date.now()}`;
    limparOrcamentoKit(sessId);
    const forno = SAMPLE_BRANDS["forno-da-vilarica"];

    const r1 = await gerarPropostasLogotipoRonda({
      sessaoId: sessId,
      nome: forno.dados.nome,
      slogan: forno.dados.slogan,
      sector: forno.dados.sector,
      tom: "tradicional",
      tresPalavras: forno.questionarioA.tresPalavras,
      coresPreferidas: forno.questionarioA.coresPreferidas,
      ronda: 1,
    });

    expect(r1.config.modo).toBe("falso");
    expect(r1.propostas).toHaveLength(2);
    const [pClassica, pModerna] = r1.propostas;
    expect(pClassica.estilo).toBe("classico");
    expect(pModerna.estilo).toBe("moderno");
    expect(pClassica.sugestaoFontPairId).not.toBe(pModerna.sugestaoFontPairId);
    expect(pClassica.sugestaoPaleta.primaria.hex).not.toBe(pModerna.sugestaoPaleta.primaria.hex);
    expect(pClassica.imagemBase64).not.toBe(pModerna.imagemBase64);

    // Ajuste direto
    const aj1 = await ajustarPropostaLogotipo({
      sessaoId: sessId,
      nome: forno.dados.nome,
      sector: forno.dados.sector,
      tom: "tradicional",
      proposta: pClassica,
      instrucao: "Reforçar espessura do arco e contraste em papel",
      ajusteNumero: 1,
    });
    expect(aj1.propostaAjustada.ajusteNumero).toBe(1);
    expect(aj1.orcamento.ajustesUsados).toBe(1);

    // Limites de rondas, ajustes e orçamento
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

    // Logótipo escolhido torna-se referência obrigatória para gerar 1 Moderna em camadas + 1 Clássica
    const refLogoBuf = decodeBase64ImageInput(aj1.propostaAjustada.imagemBase64);
    const dna = buildLogoVisualDna({
      nome: forno.dados.nome,
      sector: forno.dados.sector,
      tom: "tradicional",
      paleta: aj1.propostaAjustada.sugestaoPaleta,
      estiloDirecao: "classico",
      fixtureLogoOrigem: aj1.propostaAjustada.fixtureNome,
      tresPalavras: forno.questionarioA.tresPalavras,
    });

    const [propModerna, propClassica] = await gerarDuasPropostasVisualMarca({
      redeId: "fb-capa",
      dados: { ...forno.dados, tom: "tradicional" },
      paleta: aj1.propostaAjustada.sugestaoPaleta,
      logotipoReferencia: refLogoBuf,
      logotipoDna: dna,
      sessaoId: sessId,
    });

    expect(propModerna.estiloVisual).toBe("moderno");
    expect(propClassica.estiloVisual).toBe("classico");
    expect(propModerna.referenciaLogoUsada).toBe(true);
    expect(propClassica.referenciaLogoUsada).toBe(true);
    expect(propModerna.aspectRatioGemini).toBe("21:9");
    expect(propModerna.avisoTextos).toBe(AVISO_VERIFIQUE_TEXTOS_PT);
    expect(propModerna.textosPedidos.join(" ")).toContain("Forno da Vilariça");
    expect(propModerna.audit.valida).toBe(true);
    expect(propClassica.audit.valida).toBe(true);
    expect(Buffer.compare(propModerna.buffer, propClassica.buffer)).not.toBe(0);

    // Gerar kit completo de 38 ficheiros usando o logótipo aprovado como referência
    const kit = await generateFullBrandKit({
      processedPng: refLogoBuf,
      isDarkMonochrome: false,
      estiloVisual: "moderno",
      usarVetorizacaoOpcional: false,
      logoDna: dna,
      sessaoId: sessId,
      dados: { ...forno.dados, tom: "tradicional" },
      paleta: aj1.propostaAjustada.sugestaoPaleta,
      fontPairId: aj1.propostaAjustada.sugestaoFontPairId,
      kitStyle: "fotografia",
    });

    expect(kit.meta.files).toHaveLength(38);
    expect(kit.meta.usarVetorizacaoOpcional).toBe(false);

    // Confirmar que todos os 18 relatórios de zona segura e leitura a 40 px passaram
    for (const rede of REDES_SOCIAIS_LIST) {
      const audit = kit.meta.safeZoneAudits?.[rede.id];
      expect(audit, `Auditoria ausente para ${rede.id}`).toBeDefined();
      expect(audit!.widthPx).toBe(rede.widthPx);
      expect(audit!.heightPx).toBe(rede.heightPx);
      expect(audit!.precisaRegeneracao, `Motivos em ${rede.id}: ${audit!.motivos.join("; ")}`).toBe(false);
      if (rede.test40px) {
        expect(audit!.circulo40pxLegivel, `40px falhou em ${rede.id}`).toBe(true);
        expect(audit!.contraste40px).toBeGreaterThanOrEqual(40);
      }
      if (rede.isCircle) {
        expect(audit!.cantosCirculoLimpos, `Cantos falharam em ${rede.id}`).toBe(true);
      }
      if (rede.id === "ig-story") {
        expect(audit!.margemTopoLivre).toBe(true);
        expect(audit!.margemBaseLivre).toBe(true);
      }
      if (rede.id === "yt-banner") {
        expect(audit!.zonaYouTubeLivre).toBe(true);
      }
    }

    const zip = await JSZip.loadAsync(kit.zipBuffer);
    expect(Object.values(zip.files).filter((f) => !f.dir)).toHaveLength(38);

    limparOrcamentoKit(sessId);
  });
});

describe("Auditoria de Zonas Seguras, Dados Reais, Vetorização Opcional e Regenerar Individual", () => {
  it("deteta violações em Story (250 px), YouTube (1546×423), capa FB (sobreposição avatar), cantos circulares e contraste 40 px", async () => {
    // a) Instagram Story com faixas de alto contraste nos 250 px do topo e da base
    const storySpec = getRedeSocialConfig("ig-story");
    const badStorySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
      <rect width="1080" height="1920" fill="#FAF6F0"/>
      <rect x="80" y="20" width="920" height="190" fill="#111111"/>
      ${Array.from({ length: 18 }, (_, i) => `<rect x="${90 + i * 50}" y="35" width="24" height="140" fill="#FFFFFF"/>`).join("")}
      <rect x="80" y="1700" width="920" height="190" fill="#111111"/>
      ${Array.from({ length: 18 }, (_, i) => `<rect x="${90 + i * 50}" y="1720" width="24" height="140" fill="#FFFFFF"/>`).join("")}
      <rect x="200" y="700" width="680" height="400" fill="#B84A24"/>
    </svg>`;
    const badStoryBuf = await sharp(Buffer.from(badStorySvg)).png().toBuffer();
    const auditStory = await validarZonaSegura(badStoryBuf, storySpec);
    expect(auditStory.precisaRegeneracao).toBe(true);
    expect(auditStory.margemTopoLivre).toBe(false);
    expect(auditStory.margemBaseLivre).toBe(false);

    // b) YouTube Banner com elementos de alto contraste fora da zona central 1546×423
    const ytSpec = getRedeSocialConfig("yt-banner");
    const badYtSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440">
      <rect width="2560" height="1440" fill="#FAF6F0"/>
      <rect x="520" y="520" width="1500" height="390" fill="#B84A24"/>
      ${Array.from({ length: 65 }, (_, i) => `<rect x="${200 + i * 28}" y="55" width="12" height="230" fill="#0F172A"/>`).join("")}
    </svg>`;
    const badYtBuf = await sharp(Buffer.from(badYtSvg)).png().toBuffer();
    const auditYt = await validarZonaSegura(badYtBuf, ytSpec);
    expect(auditYt.precisaRegeneracao).toBe(true);
    expect(auditYt.zonaYouTubeLivre).toBe(false);

    // c) Facebook Capa com alto contraste na área inferior esquerda coberta pelo avatar
    const fbCapaSpec = getRedeSocialConfig("fb-capa");
    const badFbSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1640" height="624">
      <rect width="1640" height="624" fill="#FAF6F0"/>
      <rect x="360" y="80" width="900" height="380" fill="#B84A24"/>
      ${Array.from({ length: 10 }, (_, i) => `<rect x="${45 + i * 24}" y="410" width="12" height="180" fill="#111111"/>`).join("")}
    </svg>`;
    const badFbBuf = await sharp(Buffer.from(badFbSvg)).png().toBuffer();
    const auditFb = await validarZonaSegura(badFbBuf, fbCapaSpec);
    expect(auditFb.precisaRegeneracao).toBe(true);
    expect(auditFb.avatarSemSobreposicao).toBe(false);

    // d) Avatar com cantos fora do círculo invadidos e avatar plano com baixo contraste a 40 px
    const tiktokSpec = getRedeSocialConfig("tiktok-perfil");
    const badCornersSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <rect width="200" height="200" fill="#FFFFFF"/>
      <circle cx="100" cy="100" r="96" fill="none" stroke="#111111" stroke-width="6"/>
      <circle cx="100" cy="100" r="108" fill="none" stroke="#111111" stroke-width="6"/>
      <circle cx="100" cy="100" r="120" fill="none" stroke="#111111" stroke-width="6"/>
      <circle cx="100" cy="100" r="132" fill="none" stroke="#111111" stroke-width="6"/>
      <circle cx="100" cy="100" r="45" fill="#B84A24"/>
    </svg>`;
    const auditCorners = await validarZonaSegura(
      await sharp(Buffer.from(badCornersSvg)).png().toBuffer(),
      tiktokSpec
    );
    expect(auditCorners.precisaRegeneracao).toBe(true);
    expect(auditCorners.cantosCirculoLimpos).toBe(false);

    // Low-contrast 40px flat avatar
    const lowContrastBuf = await sharp({
      create: { width: 200, height: 200, channels: 4, background: { r: 240, g: 236, b: 228, alpha: 1 } },
    })
      .png()
      .toBuffer();
    const auditLow40 = await validarZonaSegura(lowContrastBuf, tiktokSpec);
    expect(auditLow40.precisaRegeneracao).toBe(true);
    expect(auditLow40.circulo40pxLegivel).toBe(false);
    expect(auditLow40.contraste40px).toBeLessThan(40);

    // e) WhatsApp fundo transparente chumba opacidade
    const waSpec = getRedeSocialConfig("wa-perfil");
    const transparentBuf = await sharp({
      create: { width: 640, height: 640, channels: 4, background: { r: 180, g: 60, b: 30, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const auditWa = await validarZonaSegura(transparentBuf, waSpec);
    expect(auditWa.precisaRegeneracao).toBe(true);
    expect(auditWa.opacidadeValida).toBe(false);

    // f) cropResizeToRedeSpec achata corretamente para dimensões exactas opacas
    const wideRaw = await sharp({
      create: { width: 1200, height: 600, channels: 4, background: { r: 180, g: 80, b: 30, alpha: 0.5 } },
    })
      .png()
      .toBuffer();
    const croppedFb = await cropResizeToRedeSpec(wideRaw, fbCapaSpec);
    const metaCropped = await sharp(croppedFb).metadata();
    expect(metaCropped.width).toBe(1640);
    expect(metaCropped.height).toBe(624);
  });

  it("omite campos vazios em buildTextosPedidosParaPeca e restringe vetorização apenas a favicon e impressão", async () => {
    const forno = SAMPLE_BRANDS["forno-da-vilarica"];
    const dadosVazios = {
      ...forno.dados,
      slogan: "",
      servicos: "",
      morada: "",
      telefone: "",
      website: "",
      email: "",
      nif: "",
      pessoa: "",
      cargo: "",
    };

    expect(buildTextosPedidosParaPeca(dadosVazios, "fb-perfil")).toEqual([]);
    expect(buildTextosPedidosParaPeca(dadosVazios, "fb-capa")).toEqual(["Forno da Vilariça"]);

    const dadosCompletos = { ...forno.dados, tom: "tradicional" as const };
    const textosPost = buildTextosPedidosParaPeca(dadosCompletos, "ig-publicacao-1080x1350");
    expect(textosPost).toEqual([
      "Forno da Vilariça",
      "Pão de trigo ao nascer do dia",
      "Padaria tradicional • Pão em forno a lenha e broa",
      "fornodavilarica.pt",
    ]);

    const { meta, processedPng } = await analyzeAndStoreLogo({
      buffer: Buffer.from(forno.svg, "utf8"),
      filename: "forno.svg",
      mimeType: "image/svg+xml",
    });

    // Vetorização local cumpre limite <= 8 cores, < 200 KB e preview 32 px
    const vec = await vetorizarImagemLocal(processedPng, {
      maxColors: MAX_VECTOR_COLORS,
      maxBytes: MAX_VECTOR_SVG_BYTES,
      inkHex: meta.paletaExtraida.tinta.hex,
    });
    expect(vec.within8Colors).toBe(true);
    expect(vec.colorsCount).toBeLessThanOrEqual(8);
    expect(vec.under200Kb).toBe(true);
    expect(vec.byteSize).toBeLessThan(200 * 1024);
    expect(contrastRatio("#FAF8F5", "#1E100A")).toBeGreaterThanOrEqual(4.5);

    const p32Meta = await sharp(vec.preview32Png).metadata();
    expect(p32Meta.width).toBe(32);
    expect(p32Meta.height).toBe(32);

    // Gerar dois kits iguais variando apenas usarVetorizacaoOpcional (true vs false)
    const kitRaster = await generateFullBrandKit({
      draftId: meta.id,
      processedPng,
      isDarkMonochrome: false,
      dados: dadosCompletos,
      paleta: meta.paletaExtraida,
      fontPairId: "clara",
      kitStyle: "liso",
      estiloVisual: "classico",
      usarVetorizacaoOpcional: false,
    });
    const kitOptVec = await generateFullBrandKit({
      draftId: meta.id,
      processedPng,
      vectorizedSvg: vec.colorSvg,
      simboloSvg: vec.simboloSvg,
      negativeSvg: vec.negativoTransparenteSvg,
      isDarkMonochrome: false,
      dados: dadosCompletos,
      paleta: meta.paletaExtraida,
      fontPairId: "clara",
      kitStyle: "liso",
      estiloVisual: "classico",
      usarVetorizacaoOpcional: true,
    });

    // Peças sociais NÃO são desenhadas por vetorização — permanecem idênticas (só geração de imagem)!
    expect(
      Buffer.compare(
        kitRaster.zipFileMap.get("facebook/capa.png")!,
        kitOptVec.zipFileMap.get("facebook/capa.png")!
      )
    ).toBe(0);
    expect(kitOptVec.meta.usarVetorizacaoOpcional).toBe(true);

    // Regeneração individual atualiza peça, meta.json e ZIP mantendo 38 ficheiros
    const { meta: updatedMeta, peca: newPeca } = await regenerarPecaDoKit({
      kitId: kitOptVec.meta.id,
      redeId: "ig-publicacao-1080x1350",
      estiloVisual: "moderno",
    });

    expect(newPeca.estiloVisual).toBe("moderno");
    expect(updatedMeta.pecasMetadata?.["ig-publicacao-1080x1350"]?.estiloVisual).toBe("moderno");
    expect(updatedMeta.textosPedidosPorPeca?.["ig-publicacao-1080x1350"]).toEqual(textosPost);

    const reloadedZip = loadKitZip(kitOptVec.meta.id);
    expect(reloadedZip).not.toBeNull();
    const parsedZip = await JSZip.loadAsync(reloadedZip!.buffer);
    expect(Object.values(parsedZip.files).filter((f) => !f.dir)).toHaveLength(38);
    const updatedPngInZip = await parsedZip
      .file("pandomarca-forno-da-vilarica/instagram/publicacao-1080x1350.png")!
      .async("nodebuffer");
    expect(Buffer.compare(updatedPngInZip, newPeca.buffer)).toBe(0);
  });

  it("recusa invocação de gerarPecaRedeSocialComAuditoria sem logotipoReferencia", async () => {
    const forno = SAMPLE_BRANDS["forno-da-vilarica"];
    const base = buildBrandPalette({
      primaria: "#B84A24",
      secundaria: "#D9822B",
      papel: "#FAF6F0",
      tinta: "#2A1810",
    });

    await expect(
      gerarPecaRedeSocialComAuditoria({
        redeId: "fb-capa",
        estiloVisual: "moderno",
        dados: forno.dados,
        paleta: base,
        logotipoReferencia: Buffer.alloc(0),
      })
    ).rejects.toThrow(/obrigatório como imagem de referência/);
  });
});

describe("Composição própria por formato, camadas, hierarquia de corte e zona móvel/avatar", () => {
  it("define regras de disposição e hierarquia 1.º logótipo -> 2.º nome -> 3.º slogan -> 4.º contactos junto das medidas", () => {
    for (const spec of REDES_SOCIAIS_LIST) {
      expect(spec.composicao.hierarquiaInformacao).toEqual(HIERARQUIA_INFORMACAO_PADRAO);
      expect(spec.composicao.camadas.fundo.length).toBeGreaterThan(10);
      expect(spec.composicao.camadas.informacao.length).toBeGreaterThan(10);
      expect(spec.composicao.camadas.uiPlataforma.length).toBeGreaterThan(10);
      if (spec.tipoPeca !== "perfil") {
        expect(spec.composicao.fundoPodeExtravasarMobile).toBe(true);
      }
    }

    expect(getRedeSocialConfig("li-capa-pessoal").composicao.disposicao).toBe("faixa-ultra-larga");
    expect(getRedeSocialConfig("li-capa-empresa").composicao.disposicao).toBe("faixa-ultra-larga");
    expect(getRedeSocialConfig("yt-banner").composicao.disposicao).toBe("faixa-ultra-larga");

    expect(getRedeSocialConfig("fb-capa").composicao.disposicao).toBe("horizontal-bipartida");
    expect(getRedeSocialConfig("fb-capa").avatarOverlapMobile).toBeDefined();
    expect(getRedeSocialConfig("x-cabecalho").composicao.disposicao).toBe("horizontal-bipartida");
    expect(getRedeSocialConfig("x-cabecalho").avatarOverlapMobile).toBeDefined();

    expect(getRedeSocialConfig("gb-capa").composicao.disposicao).toBe("imagem-destaque-min-texto");
    expect(getRedeSocialConfig("ig-publicacao-1080x1350").composicao.disposicao).toBe("vertical-feed");
    expect(getRedeSocialConfig("ig-publicacao").composicao.disposicao).toBe("vertical-feed");
    expect(getRedeSocialConfig("ig-story").composicao.disposicao).toBe("vertical-story");
  });

  it("corta automaticamente slogan longo e contactos conforme a hierarquia de cada proporção", () => {
    const forno = SAMPLE_BRANDS["forno-da-vilarica"];
    const dadosCompletos = {
      ...forno.dados,
      slogan: "Pão artesanal de massa mãe cozido em forno a lenha todos os dias desde 1954",
    };

    // Faixas ultra-largas e Google Capa: só emblema + nome (cortam slogan e contactos)
    for (const id of ["li-capa-pessoal", "li-capa-empresa", "yt-banner", "gb-capa"] as const) {
      const spec = getRedeSocialConfig(id);
      const h = resolverHierarquiaInformacaoConfig(dadosCompletos, spec);
      expect(h.incluirLogotipo).toBe(true);
      expect(h.incluirNome).toBe(true);
      expect(h.incluirSlogan).toBe(false);
      expect(h.incluirContactos).toBe(false);
      expect(buildTextosPedidosParaPeca(dadosCompletos, id)).toEqual(["Forno da Vilariça"]);
    }

    // X Cabeçalho (maxCharsSlogan 44): corta slogan longo, mas mantém slogan curto; corta sempre contactos
    expect(buildTextosPedidosParaPeca(dadosCompletos, "x-cabecalho")).toEqual([
      "Forno da Vilariça",
    ]);
    expect(
      buildTextosPedidosParaPeca(
        { ...dadosCompletos, slogan: "Padaria em forno a lenha" },
        "x-cabecalho"
      )
    ).toEqual(["Forno da Vilariça", "Padaria em forno a lenha"]);

    // Facebook capa aceita slogan <= 56 caracteres sem contactos
    expect(buildTextosPedidosParaPeca({ ...forno.dados }, "fb-capa")).toEqual([
      "Forno da Vilariça",
      "Pão de trigo ao nascer do dia",
    ]);

    // IG Story aceita logótipo, nome, slogan e 1 linha de contacto curto
    expect(buildTextosPedidosParaPeca({ ...forno.dados }, "ig-story")).toEqual([
      "Forno da Vilariça",
      "Pão de trigo ao nascer do dia",
      "fornodavilarica.pt",
    ]);
  });

  it("chumba texto/logo fora da zona segura móvel ou sob foto de perfil móvel, mas aceita sangria de fotografia", async () => {
    const fbSpec = getRedeSocialConfig("fb-capa");

    // 1. Texto/letras fora da zona segura móvel (margem esquerda de desktop, x < 280) deve chumbar
    const badOuterTextSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1640" height="624">
      <rect width="1640" height="624" fill="#FAF6F0"/>
      <rect x="400" y="140" width="840" height="320" fill="#B84A24"/>
      ${Array.from({ length: 14 }, (_, i) => `<rect x="${20 + i * 16}" y="80" width="8" height="220" fill="#111111"/>`).join("")}
    </svg>`;
    const auditOuter = await validarZonaSegura(
      await sharp(Buffer.from(badOuterTextSvg)).png().toBuffer(),
      fbSpec
    );
    expect(auditOuter.precisaRegeneracao).toBe(true);
    expect(auditOuter.informacaoDentroZonaSeguraMobile).toBe(false);

    // 2. Elementos de alto contraste dentro de avatarOverlapMobile devem chumbar avatarSemSobreposicaoMovel
    const mobAv = fbSpec.avatarOverlapMobile!;
    const badMobAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1640" height="624">
      <rect width="1640" height="624" fill="#FAF6F0"/>
      <rect x="560" y="140" width="600" height="280" fill="#B84A24"/>
      ${Array.from({ length: 9 }, (_, i) => `<rect x="${mobAv.x + 12 + i * 18}" y="${mobAv.y + 18}" width="10" height="140" fill="#111111"/>`).join("")}
    </svg>`;
    const auditMobAv = await validarZonaSegura(
      await sharp(Buffer.from(badMobAvatarSvg)).png().toBuffer(),
      fbSpec
    );
    expect(auditMobAv.precisaRegeneracao).toBe(true);
    expect(auditMobAv.avatarSemSobreposicaoMovel).toBe(false);

    // 3. Fotografia natural da capa aprovada a sangrar até à margem direita fora da zona móvel deve PASSAR
    const refModernaPath = path.resolve(
      process.cwd(),
      "docs/referencias/ia-aprovada/capa-moderna.jpg"
    );
    const refModerna = fs.readFileSync(refModernaPath);
    const breadBleedRight = await sharp(refModerna)
      .extract({ left: 604, top: 0, width: 676, height: 720 })
      .resize(620, 624, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    const safeInfoPlate = await sharp({
      create: { width: 420, height: 320, channels: 4, background: { r: 250, g: 245, b: 226, alpha: 1 } },
    })
      .png()
      .toBuffer();
    const composedNaturalBleed = await sharp({
      create: { width: 1640, height: 624, channels: 4, background: { r: 39, g: 20, b: 13, alpha: 1 } },
    })
      .composite([
        { input: breadBleedRight, left: 1020, top: 0 },
        { input: safeInfoPlate, left: 560, top: 120 },
      ])
      .flatten({ background: { r: 39, g: 20, b: 13 } })
      .png()
      .toBuffer();

    const auditBleed = await validarZonaSegura(composedNaturalBleed, fbSpec);
    expect(auditBleed.precisaRegeneracao, `Motivos inesperados: ${auditBleed.motivos.join("; ")}`).toBe(false);
    expect(auditBleed.informacaoDentroZonaSeguraMobile).toBe(true);
    expect(auditBleed.avatarSemSobreposicao).toBe(true);
    expect(auditBleed.avatarSemSobreposicaoMovel).toBe(true);
  });

  it("gera composições próprias modernas e clássicas sem falhas nas 18 peças (Forno e marca personalizada Entrada B)", async () => {
    const sessId = `teste_composicoes_${Date.now()}`;
    limparOrcamentoKit(sessId);
    const forno = SAMPLE_BRANDS["forno-da-vilarica"];
    const basePaleta = buildBrandPalette({
      primaria: "#B84A24",
      secundaria: "#D9822B",
      papel: "#FAF6F0",
      tinta: "#2A1810",
    });

    const refLogoBuf = fs.readFileSync(
      path.resolve(process.cwd(), "docs/referencias/ia-aprovada/logo.jpg")
    );
    const dna = buildLogoVisualDna({
      nome: forno.dados.nome,
      sector: forno.dados.sector,
      tom: "tradicional",
      paleta: basePaleta,
      estiloDirecao: "moderno",
    });

    // Verifica ambos estilos nas representações críticas de cada proporção
    for (const redeId of [
      "fb-capa",
      "li-capa-pessoal",
      "li-capa-empresa",
      "yt-banner",
      "x-cabecalho",
      "gb-capa",
      "ig-publicacao-1080x1350",
      "ig-story",
    ] as const) {
      const [mod, cls] = await gerarDuasPropostasVisualMarca({
        redeId,
        dados: { ...forno.dados, tom: "tradicional" },
        paleta: basePaleta,
        logotipoReferencia: refLogoBuf,
        logotipoDna: dna,
        sessaoId: sessId,
      });

      expect(mod.audit.valida, `Moderno falhou em ${redeId}: ${mod.audit.motivos.join("; ")}`).toBe(true);
      expect(cls.audit.valida, `Clássico falhou em ${redeId}: ${cls.audit.motivos.join("; ")}`).toBe(true);
      expect(Buffer.compare(mod.buffer, cls.buffer)).not.toBe(0);
    }

    // Marca personalizada Entrada B (Oficina do São, tom técnico)
    const oficina = SAMPLE_BRANDS["oficina-do-sao"];
    const { meta: ofMeta, processedPng: ofPng } = await analyzeAndStoreLogo({
      buffer: Buffer.from(oficina.svg, "utf8"),
      filename: "oficina.svg",
      mimeType: "image/svg+xml",
      entrada: "B",
    });
    const ofDna = buildLogoVisualDna({
      nome: oficina.dados.nome,
      sector: oficina.dados.sector,
      tom: "tecnico",
      paleta: ofMeta.paletaExtraida,
      estiloDirecao: "moderno",
    });

    for (const redeId of ["fb-capa", "li-capa-pessoal", "yt-banner", "gb-capa", "ig-story"] as const) {
      const [mod, cls] = await gerarDuasPropostasVisualMarca({
        redeId,
        dados: { ...oficina.dados, tom: "tecnico" },
        paleta: ofMeta.paletaExtraida,
        logotipoReferencia: ofPng,
        logotipoDna: ofDna,
        sessaoId: sessId,
      });
      expect(mod.audit.valida, `Oficina moderno em ${redeId}: ${mod.audit.motivos.join("; ")}`).toBe(true);
      expect(cls.audit.valida, `Oficina clássico em ${redeId}: ${cls.audit.motivos.join("; ")}`).toBe(true);
    }

    limparOrcamentoKit(sessId);
  });
});
