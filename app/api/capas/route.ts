import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, verifyEntitlementCookie } from "@/lib/access";
import {
  getAllCoverLayouts,
  getCoverLayoutById,
  getCoverProposalsPair,
} from "@/lib/capas/catalog";
import { renderLayeredCover } from "@/lib/capas/composer";
import {
  BrandData,
  BrandPaletteHex,
  FONT_PAIRS,
  FontPairId,
  SECTORS,
  SectorId,
} from "@/lib/formats";
import { createWhiteKnockoutLogo } from "@/lib/generate/pieces";
import { decodeBase64ImageInput } from "@/lib/imagem";
import { buildBrandPalette } from "@/lib/palette";
import { loadDraft } from "@/lib/storage";
import { Resvg } from "@resvg/resvg-js";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const entitlement = verifyEntitlementCookie(token);
  if (!entitlement) {
    return NextResponse.json(
      {
        ok: false,
        code: "unauthorized",
        error: "Sessão expirada ou não autenticada. Introduza novamente o seu código de acesso.",
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
          error: "O rascunho expirou. Volte a carregar ou confirmar o logótipo.",
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

    const dados: BrandData = {
      nome: String(rawDados.nome || "").trim() || "PandoMarca",
      sector,
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

    const fontPairId: FontPairId =
      body.fontPairId && body.fontPairId in FONT_PAIRS
        ? (body.fontPairId as FontPairId)
        : SECTORS[sector].parSugerido;

    let whiteLogoPng: Buffer | undefined;
    if (loaded.meta.variantesEntradaA?.negativoTransparenteSvg) {
      try {
        whiteLogoPng = Buffer.from(
          new Resvg(loaded.meta.variantesEntradaA.negativoTransparenteSvg, {
            fitTo: { mode: "width", value: 1400 },
          })
            .render()
            .asPng()
        );
      } catch {
        whiteLogoPng = undefined;
      }
    }
    if (!whiteLogoPng) {
      whiteLogoPng = await createWhiteKnockoutLogo(
        loaded.processedPng,
        loaded.meta.isDarkMonochrome
      );
    }

    let photoBuffer: Buffer | undefined;
    if (typeof body.photoDataUrl === "string" && body.photoDataUrl.startsWith("data:image/")) {
      photoBuffer = decodeBase64ImageInput(body.photoDataUrl);
    }

    const round = Math.max(1, Number(body.round || 1));
    const pair = getCoverProposalsPair({ round, sector });

    const vectorizedSvg =
      loaded.meta.variantesEntradaA?.horizontalSvg || loaded.meta.vectorizedSvg;
    const negativeSvg =
      loaded.meta.variantesEntradaA?.negativoTransparenteSvg ||
      loaded.meta.negativeSvg;

    const targets = body.listAll
      ? getAllCoverLayouts()
      : typeof body.layoutId === "string" && getCoverLayoutById(body.layoutId)
      ? [getCoverLayoutById(body.layoutId)!]
      : pair;

    const rendered = await Promise.all(
      targets.map(async (spec) => {
        const res = await renderLayeredCover({
          coverFormatId: "fb-capa",
          width: 851,
          height: 315,
          layoutId: spec.id,
          dados,
          paleta,
          fontPairId,
          processedPng: loaded.processedPng,
          whiteLogoPng,
          vectorizedSvg,
          negativeSvg,
          logoDna: loaded.meta.logoDna,
          estiloPeca: body.estiloPeca,
          photoBuffer,
          sessaoId: loaded.meta.sessaoImagemId,
        });
        return {
          spec,
          previewDataUrl: `data:image/png;base64,${res.buffer.toString("base64")}`,
          audit: res.audit,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      round,
      pairLayoutIds: pair.map((p) => p.id),
      layouts: rendered,
    });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Não foi possível compor as pré-visualizações de capas.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
