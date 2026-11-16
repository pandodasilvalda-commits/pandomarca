import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, verifyEntitlementCookie } from "@/lib/access";
import { analyzeAndStoreLogo } from "@/lib/analyze-logo";
import {
  TOM_DA_MARCA_SPECS,
  type TomDaMarca,
} from "@/lib/config/redes-sociais";
import {
  BrandPalette,
  FontPairId,
  SECTORS,
  SectorId,
} from "@/lib/formats";
import {
  ajustarPropostaLogotipo,
  buildLogoVisualDna,
  decodeBase64ImageInput,
  gerarPropostasLogotipoRonda,
  ImagemProviderError,
  LogoPropostaIA,
} from "@/lib/imagem";
import { buildBrandPalette, generateFourProposals } from "@/lib/palette";
import { updateDraftMeta } from "@/lib/storage";

function httpStatusForImagemError(err: ImagemProviderError): number {
  if (
    err.code === "budget_exceeded" ||
    err.code === "max_rounds" ||
    err.code === "max_adjustments"
  ) {
    return 429;
  }
  if (err.code === "invalid_input") return 400;
  return 503;
}

function parseTom(rawTom: unknown): TomDaMarca {
  if (typeof rawTom === "string" && rawTom in TOM_DA_MARCA_SPECS) {
    return rawTom as TomDaMarca;
  }
  return "tradicional";
}

function resolvePalette(
  rawPaleta: unknown,
  fallback: BrandPalette
): BrandPalette {
  if (rawPaleta && typeof rawPaleta === "object") {
    const p = rawPaleta as Record<string, unknown>;
    const extractHex = (v: unknown): string | undefined => {
      if (typeof v === "string") return v;
      if (v && typeof v === "object" && "hex" in v && typeof (v as { hex?: unknown }).hex === "string") {
        return (v as { hex: string }).hex;
      }
      return undefined;
    };
    const prim = extractHex(p.primaria);
    const sec = extractHex(p.secundaria);
    const pap = extractHex(p.papel);
    const tin = extractHex(p.tinta);
    if (prim && sec && pap && tin) {
      return buildBrandPalette({
        primaria: prim,
        secundaria: sec,
        papel: pap,
        tinta: tin,
      });
    }
  }
  return fallback;
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
          "Sessão expirada ou não autenticada. Introduza o seu código de acesso.",
      },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const acao = String(body.acao || "ronda");

    const rawInput = body.questionario || {};
    const nome = String(rawInput.nome || body.nome || "").trim();
    if (!nome) {
      return NextResponse.json(
        {
          ok: false,
          code: "missing_name",
          error:
            "O nome da marca é obrigatório para criar o logótipo de raiz.",
        },
        { status: 400 }
      );
    }

    const sector: SectorId =
      rawInput.sector && rawInput.sector in SECTORS
        ? (rawInput.sector as SectorId)
        : body.sector && body.sector in SECTORS
        ? (body.sector as SectorId)
        : "restauracao";

    const tom = parseTom(rawInput.tom ?? body.tom);

    if (acao === "ronda") {
      const sessaoId = String(body.sessaoId || `sess_${entitlement.id}`);
      const ronda = Number(body.ronda || 1);
      const resRonda = await gerarPropostasLogotipoRonda({
        sessaoId,
        nome,
        slogan: String(rawInput.slogan || body.slogan || "").trim(),
        sector,
        tom,
        tresPalavras: String(rawInput.tresPalavras || "").trim(),
        coresPreferidas: String(rawInput.coresPreferidas || "").trim(),
        coresEvitar: String(rawInput.coresEvitar || "").trim(),
        simbolo: Boolean(rawInput.simbolo),
        ronda,
        limiteOverrideEur:
          typeof body.limiteOverrideEur === "number"
            ? body.limiteOverrideEur
            : undefined,
      });
      return NextResponse.json({
        ok: true,
        ronda,
        tom,
        ...resRonda,
      });
    }

    if (acao === "ajustar") {
      const sessaoId = String(body.sessaoId || `sess_${entitlement.id}`);
      const proposta = body.proposta as LogoPropostaIA | undefined;
      if (!proposta || !proposta.imagemBase64) {
        return NextResponse.json(
          {
            ok: false,
            code: "invalid_input",
            error: "Selecione uma proposta válida para aplicar o ajuste.",
          },
          { status: 400 }
        );
      }

      const resAjuste = await ajustarPropostaLogotipo({
        sessaoId,
        nome,
        sector,
        tom: parseTom(proposta.tom || tom),
        proposta,
        instrucao: String(body.instrucao || ""),
        ajusteNumero: Number(body.ajusteNumero || 1),
        limiteOverrideEur:
          typeof body.limiteOverrideEur === "number"
            ? body.limiteOverrideEur
            : undefined,
      });
      return NextResponse.json({
        ok: true,
        ...resAjuste,
      });
    }

    if (acao === "escolher") {
      const sessaoId = String(body.sessaoId || `sess_${entitlement.id}`);
      const proposta = body.proposta as Partial<LogoPropostaIA> | undefined;
      if (!proposta?.imagemBase64) {
        return NextResponse.json(
          {
            ok: false,
            code: "invalid_input",
            error:
              "Selecione uma proposta de logótipo válida antes de prosseguir.",
          },
          { status: 400 }
        );
      }

      const logoBuf = decodeBase64ImageInput(proposta.imagemBase64);
      if (!logoBuf || logoBuf.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            code: "invalid_input",
            error:
              "A imagem do logótipo selecionado encontra-se vazia ou inválida.",
          },
          { status: 400 }
        );
      }

      const { meta } = await analyzeAndStoreLogo({
        buffer: logoBuf,
        filename: "logotipo-ia.png",
        mimeType: "image/png",
        entrada: "A",
      });

      const tomFinal = parseTom(proposta.tom || tom);
      const estiloDirecao: "classico" | "moderno" =
        proposta.estilo === "moderno" ? "moderno" : "classico";
      const paletaFinal = resolvePalette(
        proposta.sugestaoPaleta,
        meta.paletaExtraida
      );

      const logoDna = buildLogoVisualDna({
        nome,
        sector,
        tom: tomFinal,
        paleta: paletaFinal,
        estiloDirecao,
        fixtureLogoOrigem: proposta.fixtureNome,
        tresPalavras: String(rawInput.tresPalavras || "").trim() || undefined,
        aspectRatio: meta.width / Math.max(1, meta.height),
        isDarkMonochrome: meta.isDarkMonochrome,
      });

      const updatedMeta =
        updateDraftMeta(meta.id, {
          tom: tomFinal,
          paletaExtraida: paletaFinal,
          sessaoImagemId: sessaoId,
          logoDna,
          estiloVisualEscolhido: estiloDirecao,
          usarVetorizacaoOpcional: Boolean(body.usarVetorizacaoOpcional),
        }) || {
          ...meta,
          tom: tomFinal,
          paletaExtraida: paletaFinal,
          sessaoImagemId: sessaoId,
          logoDna,
          estiloVisualEscolhido: estiloDirecao,
        };

      const propostas = generateFourProposals(paletaFinal, sector);
      if (proposta.sugestaoFontPairId) {
        propostas[0].fontPairId = proposta.sugestaoFontPairId as FontPairId;
      }

      return NextResponse.json({
        ok: true,
        draft: updatedMeta,
        propostas,
        previewUrl: `/api/rascunhos/${updatedMeta.id}`,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Ação desconhecida." },
      { status: 400 }
    );
  } catch (err) {
    if (err instanceof ImagemProviderError) {
      return NextResponse.json(
        {
          ok: false,
          code: err.code,
          error: err.message,
          detalhes: err.detalhes,
        },
        { status: httpStatusForImagemError(err) }
      );
    }
    const msg =
      err instanceof Error
        ? err.message
        : "Erro ao gerar logótipo de raiz. Tente novamente.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
