import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, verifyEntitlementCookie } from "@/lib/access";
import { SECTORS, SectorId } from "@/lib/formats";
import {
  DirectionId,
  generateFinalVariantsA,
  generateInitialDirections,
  generateRefinementRound,
  QuestionnaireInputA,
  StudioLogoOption,
} from "@/lib/logo-generator/svg-studio";
import { analyzeAndStoreLogo } from "@/lib/analyze-logo";
import { generateFourProposals } from "@/lib/palette";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const entitlement = verifyEntitlementCookie(token);
  if (!entitlement) {
    return NextResponse.json(
      {
        ok: false,
        code: "unauthorized",
        error: "Sessão expirada ou não autenticada. Introduza o seu código de acesso.",
      },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const acao = String(body.acao || "direcoes");

    const rawInput = body.questionario || {};
    const nome = String(rawInput.nome || "").trim();
    if (!nome) {
      return NextResponse.json(
        {
          ok: false,
          error: "O nome da marca é obrigatório para criar o logótipo de raiz.",
        },
        { status: 400 }
      );
    }

    const sector: SectorId =
      rawInput.sector && rawInput.sector in SECTORS
        ? (rawInput.sector as SectorId)
        : "restauracao";

    const referencias = Array.isArray(rawInput.referencias)
      ? rawInput.referencias.slice(0, 5)
      : [];

    if (acao === "direcoes" && (referencias.length < 1 || referencias.length > 5)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Carregue entre 1 e 5 imagens de referência (cada uma com uma breve nota sobre o que lhe agrada) para orientar a criação.",
        },
        { status: 400 }
      );
    }

    const questionario: QuestionnaireInputA = {
      nome,
      slogan: String(rawInput.slogan || "").trim(),
      sector,
      tresPalavras: String(rawInput.tresPalavras || "").trim(),
      coresPreferidas: String(rawInput.coresPreferidas || "").trim(),
      coresEvitar: String(rawInput.coresEvitar || "").trim(),
      referencias,
    };

    if (acao === "direcoes") {
      const { directions, aiStatus } = await generateInitialDirections(questionario);
      return NextResponse.json({
        ok: true,
        directions,
        aiStatus,
      });
    }

    if (acao === "refinar") {
      const directionId: DirectionId =
        body.directionId === "contemporanea" ? "contemporanea" : "classica";
      const round = Number(body.round || 1);
      if (round < 1 || round > 3) {
        return NextResponse.json(
          {
            ok: false,
            code: "max_rounds_reached",
            error:
              "Atingiu o limite máximo de 3 rondas de afinação («Mostrar outras 2»). Escolha uma das versões geradas para prosseguir.",
          },
          { status: 400 }
        );
      }

      const options = await generateRefinementRound(questionario, directionId, round);
      return NextResponse.json({
        ok: true,
        round,
        maxRounds: 3,
        options,
      });
    }

    if (acao === "finalizar") {
      const chosen = body.chosenOption as StudioLogoOption | undefined;
      if (!chosen || !chosen.logoSvg || !chosen.simboloSvg) {
        return NextResponse.json(
          {
            ok: false,
            error: "Selecione uma versão do logótipo para gerar as variantes finais.",
          },
          { status: 400 }
        );
      }

      const variantes = await generateFinalVariantsA(questionario, chosen);

      // Convert the chosen vector SVG into a standard Draft so it feeds the exact same kit pipeline
      const { meta } = await analyzeAndStoreLogo({
        buffer: Buffer.from(variantes.horizontalSvg, "utf8"),
        filename: "logotipo-raiz.svg",
        mimeType: "image/svg+xml",
        entrada: "A",
        iconSvg: variantes.simboloSvg,
        variantesEntradaA: variantes,
      });

      // Override extracted palette with the studio-calibrated palette of the chosen direction
      meta.paletaExtraida = chosen.paleta;
      const propostas = generateFourProposals(chosen.paleta, sector);
      // Ensure the first proposal ("Direta") uses the chosen fontPairId from the studio logo
      propostas[0].fontPairId = chosen.fontPairId;

      return NextResponse.json({
        ok: true,
        draft: meta,
        variantes,
        propostas,
        previewUrl: `/api/rascunhos/${meta.id}`,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Ação desconhecida." },
      { status: 400 }
    );
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Erro ao gerar logótipo de raiz. Tente novamente.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
