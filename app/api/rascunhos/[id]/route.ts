import { NextRequest, NextResponse } from "next/server";
import { loadDraft } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const loaded = loadDraft(id);

  if (loaded.status === "expired") {
    return NextResponse.json(
      {
        ok: false,
        code: "expired_draft",
        error: "Este rascunho expirou (validade de 2 horas). Carregue ou gere novamente o logótipo.",
      },
      { status: 410 }
    );
  }

  if (loaded.status === "not_found") {
    return NextResponse.json(
      {
        ok: false,
        code: "not_found",
        error: "Rascunho não encontrado. Comece um novo processo de criação do kit.",
      },
      { status: 404 }
    );
  }

  const wantMeta = req.nextUrl.searchParams.get("meta") === "1";
  if (wantMeta) {
    return NextResponse.json({
      ok: true,
      draft: loaded.meta,
    });
  }

  return new NextResponse(new Uint8Array(loaded.processedPng), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
