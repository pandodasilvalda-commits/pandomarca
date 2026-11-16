import { NextRequest, NextResponse } from "next/server";
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
      // Rewrite relative img src="logotipo-assinatura.png" for browser preview if requested with ?preview=1
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
  });
}
