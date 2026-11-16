import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, verifyEntitlementCookie } from "@/lib/access";
import {
  isRedeSocialId,
  REDES_SOCIAIS_CONFIG,
} from "@/lib/config/redes-sociais";
import { KitGenerationError, regenerarPecaDoKit } from "@/lib/generate/kit";
import { loadKitFile, loadKitMeta, loadKitZip } from "@/lib/storage";

function getMimeType(filePath: string): string {
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".pdf")) return "application/pdf";
  if (filePath.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".json") || filePath.endsWith(".webmanifest"))
    return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const loaded = loadKitMeta(id);

  if (loaded.status === "expired") {
    return NextResponse.json(
      {
        ok: false,
        code: "expired_kit",
        error: "Este kit expirou (validade de 6 horas). Gere novamente o kit.",
      },
      { status: 410 }
    );
  }

  if (loaded.status === "not_found") {
    return NextResponse.json(
      {
        ok: false,
        code: "not_found",
        error: "Kit não encontrado.",
      },
      { status: 404 }
    );
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  if (download) {
    const zip = loadKitZip(id);
    if (!zip) {
      return NextResponse.json(
        { ok: false, error: "Ficheiro ZIP não encontrado." },
        { status: 404 }
      );
    }
    return new NextResponse(new Uint8Array(zip.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zip.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const ficheiro = req.nextUrl.searchParams.get("ficheiro");
  if (ficheiro) {
    // Support serving logotipo-assinatura.png inside email/assinatura.html iframe preview
    const fileBuf = loadKitFile(id, ficheiro);
    if (!fileBuf) {
      return NextResponse.json(
        { ok: false, error: "Peça não encontrada no kit." },
        { status: 404 }
      );
    }

    if (ficheiro === "email/assinatura.html") {
      const isPreview = req.nextUrl.searchParams.get("preview") === "1";
      if (isPreview) {
        const htmlStr = fileBuf
          .toString("utf8")
          .replace(
            'src="logotipo-assinatura.png"',
            `src="/api/kits/${id}?ficheiro=email/logotipo-assinatura.png"`
          );
        return new NextResponse(htmlStr, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }

    return new NextResponse(new Uint8Array(fileBuf), {
      status: 200,
      headers: {
        "Content-Type": getMimeType(ficheiro),
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    kit: loaded.meta,
    redesConfig: REDES_SOCIAIS_CONFIG,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
    const { id } = await context.params;
    const body = await req.json();
    const acao = String(body.acao || "regenerar");
    const redeIdRaw = String(body.redeId || "");

    if (acao !== "regenerar") {
      return NextResponse.json(
        { ok: false, error: "Ação desconhecida." },
        { status: 400 }
      );
    }

    if (!isRedeSocialId(redeIdRaw)) {
      return NextResponse.json(
        {
          ok: false,
          code: "invalid_rede",
          error: "Identificador de peça social inválido para regeneração.",
        },
        { status: 400 }
      );
    }

    const estiloVisual: "moderno" | "classico" | undefined =
      body.estiloVisual === "moderno" || body.estiloVisual === "classico"
        ? body.estiloVisual
        : undefined;

    const updated = await regenerarPecaDoKit({
      kitId: id,
      redeId: redeIdRaw,
      estiloVisual,
    });

    const pecaMeta = updated.meta.pecasMetadata?.[redeIdRaw];
    const cacheBust = Date.now();
    return NextResponse.json({
      ok: true,
      redeId: redeIdRaw,
      kit: updated.meta,
      peca: {
        redeId: updated.peca.redeId,
        estiloVisual: updated.peca.estiloVisual,
        tituloProposta: updated.peca.tituloProposta,
        width: updated.peca.width,
        height: updated.peca.height,
        origem: updated.peca.origem,
        fixtureNome: updated.peca.fixtureNome,
        aspectRatioGemini: updated.peca.aspectRatioGemini,
        referenciaLogoUsada: updated.peca.referenciaLogoUsada,
        textosPedidos: updated.peca.textosPedidos,
        avisoTextos: updated.peca.avisoTextos,
        audit: updated.peca.audit,
        previewUrl: `/api/kits/${id}?ficheiro=${encodeURIComponent(
          pecaMeta?.ficheiro || ""
        )}&t=${cacheBust}`,
      },
    });
  } catch (err) {
    if (err instanceof KitGenerationError) {
      const status =
        err.code === "not_found"
          ? 404
          : err.code === "invalid_input"
          ? 400
          : 500;
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message },
        { status }
      );
    }
    const msg =
      err instanceof Error
        ? err.message
        : "Não foi possível regenerar a peça selecionada.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
