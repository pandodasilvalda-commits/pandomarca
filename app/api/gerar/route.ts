import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, verifyEntitlementCookie } from "@/lib/access";
import {
  REDES_SOCIAIS_CONFIG,
  TOM_DA_MARCA_SPECS,
  type TomDaMarca,
} from "@/lib/config/redes-sociais";
import {
  BrandData,
  BrandPaletteHex,
  CONTENT_STYLES,
  FONT_PAIRS,
  FontPairId,
  SECTORS,
  SectorId,
  StyleGroupOverrides,
  StyleId,
} from "@/lib/formats";
import { AVISO_VERIFIQUE_TEXTOS_PT } from "@/lib/imagem";
import { Resvg } from "@resvg/resvg-js";
import { buildBrandPalette } from "@/lib/palette";
import { loadDraft } from "@/lib/storage";
import { generateFullBrandKit } from "@/lib/generate/kit";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const entitlement = verifyEntitlementCookie(token);
  if (!entitlement) {
    return NextResponse.json(
      {
        ok: false,
        code: "unauthorized",
        error:
          "Sessão expirada ou código não validado. Introduza novamente o código de acesso.",
      },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const draftId = String(body.draftId || "");
    const loaded = loadDraft(draftId);

    if (loaded.status === "expired") {
      return NextResponse.json(
        {
          ok: false,
          code: "expired_draft",
          error:
            "O seu rascunho expirou (limite de 2 horas). Por favor volte a carregar ou escolher o logótipo.",
        },
        { status: 410 }
      );
    }

    if (loaded.status === "not_found") {
      return NextResponse.json(
        {
          ok: false,
          code: "not_found",
          error:
            "Rascunho de logótipo não encontrado. Recomece o passo do logótipo.",
        },
        { status: 404 }
      );
    }

    const rawDados = body.dados || {};
    const nome = String(rawDados.nome || "").trim();
    if (!nome) {
      return NextResponse.json(
        {
          ok: false,
          code: "missing_name",
          error: "Indique o nome da marca para gerar o kit.",
        },
        { status: 400 }
      );
    }

    const sector: SectorId =
      rawDados.sector && rawDados.sector in SECTORS
        ? (rawDados.sector as SectorId)
        : "restauracao";

    const rawTom = rawDados.tom ?? loaded.meta.tom ?? loaded.meta.logoDna?.tom;
    const tom: TomDaMarca =
      typeof rawTom === "string" && rawTom in TOM_DA_MARCA_SPECS
        ? (rawTom as TomDaMarca)
        : "tradicional";

    const dados: BrandData = {
      nome,
      sector,
      tom,
      simbolo: Boolean(rawDados.simbolo),
      slogan: String(rawDados.slogan || "").trim(),
      pessoa: String(rawDados.pessoa || "").trim(),
      cargo: String(rawDados.cargo || "").trim(),
      email: String(rawDados.email || "").trim(),
      telefone: String(rawDados.telefone || "").trim(),
      website: String(rawDados.website || "").trim(),
      morada: String(rawDados.morada || "").trim(),
      nif: String(rawDados.nif || "").trim(),
      servicos: String(rawDados.servicos || "").trim(),
    };

    const rawPaleta: BrandPaletteHex = body.paleta || {
      primaria: loaded.meta.paletaExtraida.primaria.hex,
      secundaria: loaded.meta.paletaExtraida.secundaria.hex,
      papel: loaded.meta.paletaExtraida.papel.hex,
      tinta: loaded.meta.paletaExtraida.tinta.hex,
    };
    const paleta = buildBrandPalette(rawPaleta);

    const fontPairId: FontPairId =
      body.fontPairId && body.fontPairId in FONT_PAIRS
        ? (body.fontPairId as FontPairId)
        : SECTORS[sector].parSugerido;

    const kitStyle: StyleId =
      body.kitStyle && body.kitStyle in CONTENT_STYLES
        ? (body.kitStyle as StyleId)
        : SECTORS[sector].recomendacoes.capas[0];

    const rawOverrides = body.styleOverrides || {};
    const styleOverrides: StyleGroupOverrides = {
      capas:
        rawOverrides.capas && rawOverrides.capas in CONTENT_STYLES
          ? rawOverrides.capas
          : kitStyle,
      publicacao:
        rawOverrides.publicacao && rawOverrides.publicacao in CONTENT_STYLES
          ? rawOverrides.publicacao
          : kitStyle,
      story:
        rawOverrides.story && rawOverrides.story in CONTENT_STYLES
          ? rawOverrides.story
          : kitStyle,
      cartao:
        rawOverrides.cartao && rawOverrides.cartao in CONTENT_STYLES
          ? rawOverrides.cartao
          : kitStyle,
      papel:
        rawOverrides.papel && rawOverrides.papel in CONTENT_STYLES
          ? rawOverrides.papel
          : kitStyle,
      assinatura:
        rawOverrides.assinatura && rawOverrides.assinatura in CONTENT_STYLES
          ? rawOverrides.assinatura
          : kitStyle,
    };

    // Peças sociais são 100% geração de imagem; foto de utilizador só se aplica ao estacionário se selecionado «Fotografia»
    const stationeryGroupsUsingPhoto = (["cartao", "papel"] as const).some(
      (k) => styleOverrides[k] === "fotografia"
    );

    let photoBuffer: Buffer | undefined;
    if (
      typeof body.photoDataUrl === "string" &&
      body.photoDataUrl.startsWith("data:image/")
    ) {
      const base64Part = body.photoDataUrl.split(",")[1];
      if (base64Part) {
        photoBuffer = Buffer.from(base64Part, "base64");
      }
    }

    let cutoutBuffer: Buffer | undefined;
    if (
      typeof body.cutoutDataUrl === "string" &&
      body.cutoutDataUrl.startsWith("data:image/")
    ) {
      const base64Part = body.cutoutDataUrl.split(",")[1];
      if (base64Part) {
        cutoutBuffer = Buffer.from(base64Part, "base64");
      }
    }

    if (
      stationeryGroupsUsingPhoto &&
      (!photoBuffer || photoBuffer.length === 0)
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "missing_photo",
          error:
            "Escolheu o estilo «Fotografia» para o estacionário, mas ainda não carregou uma imagem.",
        },
        { status: 400 }
      );
    }

    const estiloVisual: "moderno" | "classico" | undefined =
      body.estiloVisual === "moderno" || body.estiloVisual === "classico"
        ? body.estiloVisual
        : loaded.meta.estiloVisualEscolhido;

    const usarVetorizacaoOpcional =
      typeof body.usarVetorizacaoOpcional === "boolean"
        ? body.usarVetorizacaoOpcional
        : Boolean(loaded.meta.usarVetorizacaoOpcional);

    let customWhiteLogoPng: Buffer | undefined;
    if (
      usarVetorizacaoOpcional &&
      loaded.meta.variantesEntradaA?.negativoTransparenteSvg
    ) {
      try {
        const resvgWhite = new Resvg(
          loaded.meta.variantesEntradaA.negativoTransparenteSvg,
          { fitTo: { mode: "width", value: 1400 } }
        );
        customWhiteLogoPng = Buffer.from(resvgWhite.render().asPng());
      } catch {
        customWhiteLogoPng = undefined;
      }
    }

    const vectorizedSvg =
      loaded.meta.variantesEntradaA?.horizontalSvg || loaded.meta.vectorizedSvg;
    const negativeSvg =
      loaded.meta.variantesEntradaA?.negativoTransparenteSvg ||
      loaded.meta.negativeSvg;

    const result = await generateFullBrandKit({
      draftId: loaded.meta.id,
      processedPng: loaded.processedPng,
      customIconPng: loaded.iconPng,
      customWhiteLogoPng,
      vectorizedSvg,
      simboloSvg: loaded.meta.simboloSvg,
      negativeSvg,
      usarVetorizacaoOpcional,
      estiloVisual,
      logoDna: loaded.meta.logoDna,
      sessaoId: loaded.meta.sessaoImagemId,
      isDarkMonochrome: loaded.meta.isDarkMonochrome,
      dados,
      paleta,
      fontPairId,
      kitStyle,
      styleOverrides,
      photoBuffer,
      cutoutBuffer,
    });

    return NextResponse.json({
      ok: true,
      kit: result.meta,
      downloadUrl: `/api/kits/${result.meta.id}?download=1`,
      redesConfig: REDES_SOCIAIS_CONFIG,
      avisoTextos: AVISO_VERIFIQUE_TEXTOS_PT,
    });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Não foi possível gerar os ficheiros do kit. Tente novamente.";
    return NextResponse.json(
      {
        ok: false,
        code: "generation_failed",
        error: msg,
      },
      { status: 500 }
    );
  }
}
