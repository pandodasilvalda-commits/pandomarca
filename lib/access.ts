import crypto from "crypto";
import { Entitlement, EntitlementKind } from "./formats";

export const ACCESS_COOKIE_NAME = "pandomarca_acesso";
export const ACCESS_TTL_SECONDS = 12 * 60 * 60; // 12 horas

export interface AccessConfigStatus {
  configured: boolean;
  missingVars: string[];
}

export function getAccessConfigStatus(): AccessConfigStatus {
  const missingVars: string[] = [];
  if (!process.env.KIT_ACCESS_CODE_WEBSITE?.trim()) {
    missingVars.push("KIT_ACCESS_CODE_WEBSITE");
  }
  if (!process.env.KIT_ACCESS_CODE_STANDALONE?.trim()) {
    missingVars.push("KIT_ACCESS_CODE_STANDALONE");
  }
  if (!process.env.KIT_GATE_SECRET?.trim()) {
    missingVars.push("KIT_GATE_SECRET");
  }
  return {
    configured: missingVars.length === 0,
    missingVars,
  };
}

export function verifyAccessCode(
  inputCode: string
): { valid: true; entitlement: Entitlement } | { valid: false; reason: "not_configured" | "invalid_code"; message: string } {
  const status = getAccessConfigStatus();
  if (!status.configured) {
    return {
      valid: false,
      reason: "not_configured",
      message:
        "O acesso ainda não está preparado neste ambiente. Configure as variáveis KIT_ACCESS_CODE_WEBSITE, KIT_ACCESS_CODE_STANDALONE e KIT_GATE_SECRET no ficheiro .env.local.",
    };
  }

  const trimmed = (inputCode || "").trim();
  if (!trimmed) {
    return {
      valid: false,
      reason: "invalid_code",
      message: "Introduza o seu código de acesso para continuar.",
    };
  }

  const websiteCode = process.env.KIT_ACCESS_CODE_WEBSITE!.trim();
  const standaloneCode = process.env.KIT_ACCESS_CODE_STANDALONE!.trim();

  let kind: EntitlementKind | null = null;
  if (safeCompare(trimmed, websiteCode)) {
    kind = "website_bonus";
  } else if (safeCompare(trimmed, standaloneCode)) {
    kind = "standalone";
  }

  if (!kind) {
    return {
      valid: false,
      reason: "invalid_code",
      message:
        "Código de acesso inválido. Verifique se copiou o código corretamente ou contacte a PandoWeb.",
    };
  }

  const expiresAt = new Date(Date.now() + ACCESS_TTL_SECONDS * 1000).toISOString();
  const entitlement: Entitlement = {
    id: `ent_${kind}_${crypto.randomBytes(6).toString("hex")}`,
    kind,
    status: "active",
    code: "***",
    websiteSubscriptionId: kind === "website_bonus" ? "sub_pandoweb_active" : undefined,
    expiresAt,
  };

  return { valid: true, entitlement };
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function signEntitlementCookie(entitlement: Entitlement): string {
  const secret = process.env.KIT_GATE_SECRET?.trim() || "fallback-unconfigured";
  const payload = Buffer.from(JSON.stringify(entitlement), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyEntitlementCookie(token?: string | null): Entitlement | null {
  if (!token) return null;
  const status = getAccessConfigStatus();
  if (!status.configured) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const secret = process.env.KIT_GATE_SECRET!.trim();
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  if (!safeCompare(sig, expectedSig)) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as Entitlement;
    if (decoded.status !== "active") return null;
    if (new Date(decoded.expiresAt).getTime() < Date.now()) return null;
    if (decoded.kind !== "website_bonus" && decoded.kind !== "standalone") return null;
    return decoded;
  } catch {
    return null;
  }
}
