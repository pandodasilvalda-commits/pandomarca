import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, verifyEntitlementCookie } from "@/lib/access";
import { analyzeAndStoreLogo, validateSvgSecurity } from "@/lib/analyze-logo";
import { TOM_DA_MARCA_SPECS, type TomDaMarca } from "@/lib/config/redes-sociais";
import {
  BrandData,
  BrandPaletteHex,
  FONT_PAIRS,
  FontPairId,
  resolverParTipograficoMarca,
  SECTORS,
  SectorId,
} from "@/lib/formats";
import {
  buildLogoVisualDna,
  decodeBase64ImageInput,
  getImagemConfig,
  verificarERegistarCusto,
} from "@/lib/imagem";
import { extractSuggestedPaletteFromColorList } from "@/lib/imagem/falso";
import { buildBrandPalette, generateFourProposals } from "@/lib/palette";
import { loadDraft, updateDraftMeta } from "@/lib/storage";
import {
  gerar5VariantesDoVetor,
  vetorizarImagemLocal,
} from "@/lib/vetorizar";

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
    const acao = String(body.acao || "preview");

    if (acao === "preview") {
      let inputBuf: Buffer | null = null;
      if (typeof body.imagemBase64 === "string" && body.imagemBase64.trim()) {
        inputBuf = decodeBase64ImageInput(body.imagemBase64);
      } else if (typeof body.draftId === "string" && body.draftId.trim()) {
        const loaded = loadDraft(body.draftId);
        if (loaded.status === "expired") {
          return NextResponse.json(
            {
              ok: false,
              code: "expired_draft",
              error: "O rascunho expirou. Volte a escolher ou carregar o logótipo.",
            },
            { status: 410 }
          );
        }
        if (loaded.status === "not_found") {
          return NextResponse.json(
            {
              ok: false,
              code: "not_found",
              error: "Rascunho não encontrado.",
            },
            { status: 404 }
          );
        }
        inputBuf = loaded.processedPng;
      }

      if (!inputBuf || inputBuf.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            code: "missing_image",
            error: "Nenhuma imagem enviada para vetorização local.",
          },
          { status: 400 }
        );
      }

      const maxColors =
        typeof body.maxColors === "number"
          ? Math.max(2, Math.min(8, body.maxColors))
          : 8;
      const inkHex =
        typeof body.inkHex === "string" && /^#[0-9a-f]{6}$/i.test(body.inkHex)
          ? body.inkHex
          : "#2A1810";
      const paletteHints = Array.isArray(body.paletteHints)
        ? body.paletteHints.filter((x: unknown): x is string => typeof x === "string")
        : undefined;

      const vetor = await vetorizarImagemLocal(inputBuf, {
        maxColors,
        inkHex,
        paletteHints,
        simboloApenas: Boolean(body.simboloApenas),
      });

      let orcamento = undefined;
      if (typeof body.sessaoId === "string" && body.sessaoId.trim()) {
        orcamento = verificarERegistarCusto({
          sessaoId: body.sessaoId,
          tipo: "vetorizar",
          quantidade: 1,
          detalhe: "Vetorização local gratuita (vtracer + potrace)",
        });
      }

      const paletaSugerida =
        body.paleta?.primaria && body.paleta?.tinta
          ? buildBrandPalette(body.paleta as BrandPaletteHex)
          : extractSuggestedPaletteFromColorList(vetor.colorsHex);

      return NextResponse.json({
        ok: true,
        vetor: {
          colorSvg: vetor.colorSvg,
          simboloSvg: vetor.simboloSvg,
          simboloNegativoSvg: vetor.simboloNegativoSvg,
          monocromaticoSvg: vetor.monocromaticoSvg,
          negativoSvg: vetor.negativoSvg,
          negativoTransparenteSvg: vetor.negativoTransparenteSvg,
          previewDataUrl: vetor.previewDataUrl,
          preview32DataUrl: vetor.preview32DataUrl,
          byteSize: vetor.byteSize,
          maxBytes: vetor.maxBytes,
          under200Kb: vetor.under200Kb,
          colorsHex: vetor.colorsHex,
          colorsCount: vetor.colorsCount,
          within8Colors: vetor.within8Colors,
          pathCount: vetor.pathCount,
          width: vetor.width,
          height: vetor.height,
          backgroundRemoved: vetor.backgroundRemoved,
          engine: vetor.engine,
        },
        paletaSugerida,
        orcamento,
      });
    }

    if (acao === "confirmar") {
      const v = body.vetor;
      if (!v?.colorSvg || !v?.simboloSvg || !v?.monocromaticoSvg || !v?.negativoSvg) {
        return NextResponse.json(
          {
            ok: false,
            code: "missing_vector",
            error: "Faltam os SVGs vetorizados para gerar as 5 variantes.",
          },
          { status: 400 }
        );
      }

      validateSvgSecurity(v.colorSvg);
      validateSvgSecurity(v.simboloSvg);
      validateSvgSecurity(v.monocromaticoSvg);
      validateSvgSecurity(v.negativoSvg);

      const rawDados = body.dados || {};
      const nome = String(rawDados.nome || "").trim();
      if (!nome) {
        return NextResponse.json(
          {
            ok: false,
            code: "missing_name",
            error: "Indique o nome da marca para finalizar o vetor.",
          },
          { status: 400 }
        );
      }

      const sector: SectorId =
        rawDados.sector && rawDados.sector in SECTORS
          ? (rawDados.sector as SectorId)
          : "restauracao";

      const rawTom = rawDados.tom;
      const tom: TomDaMarca | undefined =
        typeof rawTom === "string" && rawTom in TOM_DA_MARCA_SPECS
          ? (rawTom as TomDaMarca)
          : undefined;
      const estiloDirecao =
        body.estiloDirecao === "moderno" || body.estiloDirecao === "classico"
          ? body.estiloDirecao
          : undefined;

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

      const fontPairId: FontPairId =
        body.fontPairId && body.fontPairId in FONT_PAIRS
          ? (body.fontPairId as FontPairId)
          : resolverParTipograficoMarca({ tom, sector, estiloDirecao });

      const colorsList = Array.isArray(v.colorsHex) ? v.colorsHex : [];
      const paletaFallback = extractSuggestedPaletteFromColorList(colorsList);
      const paleta = body.paleta?.primaria
        ? buildBrandPalette({
            primaria: String(body.paleta.primaria),
            secundaria: String(
              body.paleta.secundaria || paletaFallback.secundaria.hex
            ),
            papel: String(body.paleta.papel || paletaFallback.papel.hex),
            tinta: String(body.paleta.tinta || paletaFallback.tinta.hex),
          })
        : paletaFallback;

      const variantes = await gerar5VariantesDoVetor({
        vetor: {
          colorSvg: v.colorSvg,
          simboloSvg: v.simboloSvg,
          monocromaticoSvg: v.monocromaticoSvg,
          negativoSvg: v.negativoSvg,
          negativoTransparenteSvg: v.negativoTransparenteSvg || v.negativoSvg,
        },
        dados,
        paleta,
        fontPairId,
      });

      const variantesSvgMeta = {
        horizontalSvg: variantes.horizontalSvg,
        verticalSvg: variantes.verticalSvg,
        simboloSvg: variantes.simboloSvg,
        monocromaticoSvg: variantes.monocromaticoSvg,
        negativoSvg: variantes.negativoSvg,
        negativoTransparenteSvg: variantes.negativoTransparenteSvg,
      };

      const { meta } = await analyzeAndStoreLogo({
        buffer: variantes.processedPng,
        filename: "logotipo-vetorizado.png",
        mimeType: "image/png",
        entrada: body.entrada === "B" ? "B" : "A",
        iconSvg: variantes.simboloSvg,
        variantesEntradaA: variantesSvgMeta,
      });

      const logoDna = buildLogoVisualDna({
        nome: dados.nome,
        sector: dados.sector,
        tom,
        paleta,
        estiloDirecao,
        fixtureLogoOrigem:
          typeof body.fixtureNome === "string" && body.fixtureNome.trim()
            ? body.fixtureNome.trim()
            : undefined,
        tresPalavras:
          typeof body.tresPalavras === "string" ? body.tresPalavras : undefined,
        aspectRatio: meta.width / Math.max(1, meta.height),
        isDarkMonochrome: meta.isDarkMonochrome,
      });

      const svgByteSize = Buffer.byteLength(v.colorSvg, "utf8");
      const updated =
        updateDraftMeta(meta.id, {
          tom,
          paletaExtraida: paleta,
          svgSource: v.colorSvg,
          vectorizedSvg: variantes.horizontalSvg,
          simboloSvg: variantes.simboloSvg,
          simboloNegativoSvg:
            typeof v.simboloNegativoSvg === "string" ? v.simboloNegativoSvg : undefined,
          monochromeSvg: variantes.monocromaticoSvg,
          negativeSvg: variantes.negativoSvg,
          sessaoImagemId:
            typeof body.sessaoId === "string" ? body.sessaoId : undefined,
          logoDna,
          vectorStats: {
            byteSize: svgByteSize,
            colorsHex: colorsList,
            under200Kb: svgByteSize < 200 * 1024,
            within8Colors: colorsList.length <= 8,
          },
        }) || { ...meta, logoDna };

      const propostas = generateFourProposals(paleta, sector, { tom, estiloDirecao });
      propostas[0].fontPairId = fontPairId;

      return NextResponse.json({
        ok: true,
        draft: updated,
        variantes: variantesSvgMeta,
        propostas,
        previewUrl: `/api/rascunhos/${updated.id}`,
        imagemConfig: getImagemConfig().modo,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Ação desconhecida em /api/vetorizar." },
      { status: 400 }
    );
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Não foi possível processar a vetorização local.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
