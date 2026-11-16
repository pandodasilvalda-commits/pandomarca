import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, verifyEntitlementCookie } from "@/lib/access";
import { analyzeAndStoreLogo, LogoAnalysisError } from "@/lib/analyze-logo";
import { SECTORS, SectorId } from "@/lib/formats";
import { generateFourProposals } from "@/lib/palette";
import { SAMPLE_BRANDS } from "@/lib/samples";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const entitlement = verifyEntitlementCookie(token);
  if (!entitlement) {
    return NextResponse.json(
      {
        ok: false,
        code: "unauthorized",
        error: "Sessão de acesso inválida ou expirada. Introduza novamente o seu código de acesso.",
      },
      { status: 401 }
    );
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let fileBuffer: Buffer | null = null;
    let filename = "logotipo.png";
    let mimeType = "image/png";
    let sector: SectorId = "restauracao";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const sectorField = (formData.get("sector") as string) || "restauracao";
      if (sectorField in SECTORS) {
        sector = sectorField as SectorId;
      }

      const presetId = formData.get("presetId") as string | null;
      if (presetId && (presetId === "forno-da-vilarica" || presetId === "oficina-do-sao")) {
        const sample = SAMPLE_BRANDS[presetId];
        fileBuffer = Buffer.from(sample.svg, "utf8");
        filename = `${presetId}.svg`;
        mimeType = "image/svg+xml";
        sector = sample.dados.sector;
      } else {
        const file = formData.get("ficheiro");
        if (!file || !(file instanceof File) || file.size === 0) {
          return NextResponse.json(
            {
              ok: false,
              code: "no_file",
              error: "Selecione um ficheiro de logótipo (PNG, JPG ou SVG) antes de continuar.",
            },
            { status: 400 }
          );
        }
        const arrayBuf = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuf);
        filename = file.name || "logotipo.png";
        mimeType = file.type || "";
      }
    } else {
      const body = await req.json().catch(() => ({}));
      if (body.sector && body.sector in SECTORS) {
        sector = body.sector as SectorId;
      }
      if (
        body.presetId &&
        (body.presetId === "forno-da-vilarica" || body.presetId === "oficina-do-sao")
      ) {
        const sample = SAMPLE_BRANDS[body.presetId as "forno-da-vilarica" | "oficina-do-sao"];
        fileBuffer = Buffer.from(sample.svg, "utf8");
        filename = `${body.presetId}.svg`;
        mimeType = "image/svg+xml";
        sector = sample.dados.sector;
      } else if (typeof body.svgText === "string" && body.svgText.trim()) {
        fileBuffer = Buffer.from(body.svgText, "utf8");
        filename = "logotipo.svg";
        mimeType = "image/svg+xml";
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        {
          ok: false,
          code: "no_file",
          error: "Nenhum ficheiro de logótipo recebido.",
        },
        { status: 400 }
      );
    }

    const { meta } = await analyzeAndStoreLogo({
      buffer: fileBuffer,
      filename,
      mimeType,
      entrada: "B",
    });

    const propostas = generateFourProposals(meta.paletaExtraida, sector);

    return NextResponse.json({
      ok: true,
      draft: meta,
      propostas,
      previewUrl: `/api/rascunhos/${meta.id}`,
    });
  } catch (err) {
    if (err instanceof LogoAnalysisError) {
      return NextResponse.json(
        {
          ok: false,
          code: err.code,
          error: err.message,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        code: "unreadable_file",
        error: "Não foi possível analisar o ficheiro enviado. Verifique se é um PNG, JPG ou SVG válido.",
      },
      { status: 400 }
    );
  }
}
