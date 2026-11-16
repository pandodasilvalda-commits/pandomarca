import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, verifyEntitlementCookie } from "@/lib/access";
import {
  getRedeSocialConfig,
  isRedeSocialId,
  TOM_DA_MARCA_SPECS,
  type RedeSocialId,
  type TomDaMarca,
} from "@/lib/config/redes-sociais";
import {
  BrandData,
  BrandPaletteHex,
  SECTORS,
  SectorId,
} from "@/lib/formats";
import {
  AVISO_VERIFIQUE_TEXTOS_PT,
  gerarDuasPropostasVisualMarca,
  gerarPecaRedeSocialComAuditoria,
  ImagemProviderError,
  type PecaGeradaIA,
} from "@/lib/imagem";
import { buildBrandPalette } from "@/lib/palette";
import { loadDraft } from "@/lib/storage";

function serializePeca(p: PecaGeradaIA) {
  return {
    id: `${p.redeId}-${p.estiloVisual}`,
    redeId: p.redeId,
    estiloVisual: p.estiloVisual,
    tituloProposta: p.tituloProposta,
    previewDataUrl: `data:image/png;base64,${p.buffer.toString("base64")}`,
    width: p.width,
    height: p.height,
    origem: p.origem,
    fixtureNome: p.fixtureNome,
    aspectRatioGemini: p.aspectRatioGemini,
    referenciaLogoUsada: p.referenciaLogoUsada,
    textosPedidos: p.textosPedidos,
    avisoTextos: p.avisoTextos,
    audit: p.audit,
  };
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const entitlement = verifyEntitlementCookie(token);
  if (!entitlement) {
    return NextResponse.json(
      {
        ok: false,
        code: "unauthorized",
        error:
          "Sessão expirada ou não autenticada. Introduza novamente o seu código de acesso.",
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
            "O rascunho expirou. Volte a carregar ou escolher o logótipo.",
        },
        { status: 410 }
      );
    }
    if (loaded.status === "not_found") {
      return NextResponse.json(
        {
          ok: false,
          code: "not_found",
          error: "Rascunho de logótipo não encontrado.",
        },
        { status: 404 }
      );
    }

    const rawDados = body.dados || {};
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
      nome: String(rawDados.nome || "").trim() || "PandoMarca",
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

    const rawPaleta: BrandPaletteHex = body.paleta?.primaria
      ? body.paleta
      : {
          primaria: loaded.meta.paletaExtraida.primaria.hex,
          secundaria: loaded.meta.paletaExtraida.secundaria.hex,
          papel: loaded.meta.paletaExtraida.papel.hex,
          tinta: loaded.meta.paletaExtraida.tinta.hex,
        };
    const paleta = buildBrandPalette(rawPaleta);

    const redeId: RedeSocialId =
      typeof body.redeId === "string" && isRedeSocialId(body.redeId)
        ? body.redeId
        : "fb-capa";
    const bypassCache = Boolean(body.regenerar);

    let pecas: PecaGeradaIA[];
    if (
      body.apenasUmEstilo &&
      (body.estiloVisual === "moderno" || body.estiloVisual === "classico")
    ) {
      const unica = await gerarPecaRedeSocialComAuditoria({
        redeId,
        estiloVisual: body.estiloVisual,
        dados,
        paleta,
        logotipoReferencia: loaded.processedPng,
        logotipoDna: loaded.meta.logoDna,
        sessaoId: loaded.meta.sessaoImagemId,
        bypassCache: true,
      });
      pecas = [unica];
    } else {
      pecas = await gerarDuasPropostasVisualMarca({
        redeId,
        dados,
        paleta,
        logotipoReferencia: loaded.processedPng,
        logotipoDna: loaded.meta.logoDna,
        sessaoId: loaded.meta.sessaoImagemId,
        bypassCache,
      });
    }

    return NextResponse.json({
      ok: true,
      rede: getRedeSocialConfig(redeId),
      avisoTextos: AVISO_VERIFIQUE_TEXTOS_PT,
      propostas: pecas.map(serializePeca),
    });
  } catch (err) {
    if (err instanceof ImagemProviderError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message },
        { status: err.code === "invalid_input" ? 400 : 503 }
      );
    }
    const msg =
      err instanceof Error
        ? err.message
        : "Não foi possível gerar as propostas visuais a partir do logótipo.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
