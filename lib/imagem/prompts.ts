import fs from "fs";
import path from "path";

export type PromptTemplateId =
  | "logotipo-classico"
  | "logotipo-moderno"
  | "logotipo-editorial"
  | "ajuste-logotipo"
  | "foto-perfil"
  | "capa-fundo"
  | "publicacao-instagram"
  | "story-instagram"
  | "fundo-fotografia"
  | "fundo-padrao-textura"
  | "objeto-recorte";

export interface PromptTemplateLoaded {
  id: PromptTemplateId;
  titulo: string;
  estilo: string;
  permiteTextoNoLogotipo: "apenas_nome_ou_sem_texto" | "sem_texto_nenhum" | "apenas_dados_reais_cliente";
  promptFinal: string;
}

const PROMPTS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "lib", "imagem", "prompts");

function parseMarkdownFrontmatter(raw: string): {
  meta: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw.trim() };
  }
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      meta[k] = v;
    }
  }
  return { meta, body: match[2].trim() };
}

export function carregarPrompt(
  id: PromptTemplateId,
  variaveis: Record<string, string | undefined>
): PromptTemplateLoaded {
  const filePath = path.join(/*turbopackIgnore: true*/ PROMPTS_DIR, `${id}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Modelo de prompt não encontrado: ${id}.md`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const { meta, body } = parseMarkdownFrontmatter(raw);

  const interpolated = body.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const v = (variaveis[key] || "").trim();
    return v || "neutro equilibrado";
  });

  const policyRaw = meta["permite_texto_no_logotipo"];
  const permiteTextoNoLogotipo: PromptTemplateLoaded["permiteTextoNoLogotipo"] =
    policyRaw === "sem_texto_nenhum"
      ? "sem_texto_nenhum"
      : policyRaw === "apenas_dados_reais_cliente"
      ? "apenas_dados_reais_cliente"
      : "apenas_nome_ou_sem_texto";

  return {
    id,
    titulo: meta["titulo"] || id,
    estilo: meta["estilo"] || "",
    permiteTextoNoLogotipo,
    promptFinal: interpolated,
  };
}

export function listarPromptsDisponiveis(): PromptTemplateId[] {
  if (!fs.existsSync(PROMPTS_DIR)) return [];
  return fs
    .readdirSync(PROMPTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, "") as PromptTemplateId);
}
