import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_TTL_SECONDS,
  getAccessConfigStatus,
  signEntitlementCookie,
  verifyAccessCode,
  verifyEntitlementCookie,
} from "@/lib/access";

export async function GET(req: NextRequest) {
  const configStatus = getAccessConfigStatus();
  const cookieVal = req.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const entitlement = verifyEntitlementCookie(cookieVal);

  return NextResponse.json({
    configured: configStatus.configured,
    missingVars: configStatus.missingVars,
    authenticated: Boolean(entitlement),
    entitlement,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const codigo = typeof body.codigo === "string" ? body.codigo : "";

    const result = verifyAccessCode(codigo);
    if (!result.valid) {
      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error: result.message,
        },
        { status: result.reason === "not_configured" ? 503 : 401 }
      );
    }

    const signed = signEntitlementCookie(result.entitlement);
    const res = NextResponse.json({
      ok: true,
      entitlement: result.entitlement,
    });

    res.cookies.set({
      name: ACCESS_COOKIE_NAME,
      value: signed,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ACCESS_TTL_SECONDS,
      path: "/",
    });

    return res;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Não foi possível validar o código de acesso. Tente novamente.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ACCESS_COOKIE_NAME);
  return res;
}
