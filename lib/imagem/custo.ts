import fs from "fs";
import os from "os";
import path from "path";
import { ImagemProviderError } from "./types";

export type OperacaoImagemTipo = "gerar" | "editar" | "removerFundo" | "vetorizar";

export const CUSTO_UNITARIO_EUR: Record<OperacaoImagemTipo, number> = {
  gerar: 0.06,
  editar: 0.08,
  removerFundo: 0.02,
  vetorizar: 0.0, // Vetorização local (vtracer + potrace) é sempre gratuita
};

export interface RegistoOperacaoCusto {
  timestamp: number;
  tipo: OperacaoImagemTipo;
  quantidade: number;
  custoEur: number;
  detalhe?: string;
}

export interface OrcamentoKitEstado {
  sessaoId: string;
  gastoEur: number;
  limiteEur: number;
  restanteEur: number;
  rondasUsadas: number;
  ajustesUsados: number;
  bloqueado: boolean;
  operacoes: RegistoOperacaoCusto[];
}

const BUDGET_DIR = path.join(/*turbopackIgnore: true*/ os.tmpdir(), "pandomarca", "orcamentos");

function cleanSessaoId(id: string): string {
  const cleaned = (id || "sessao-local").replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned || "sessao-local";
}

function getBudgetFilePath(sessaoId: string): string {
  fs.mkdirSync(BUDGET_DIR, { recursive: true });
  return path.join(/*turbopackIgnore: true*/ BUDGET_DIR, `${cleanSessaoId(sessaoId)}.json`);
}

function roundEur(val: number): number {
  return Math.round(val * 1000) / 1000;
}

export function getLimitePorKitEurFromEnv(): number {
  const raw = (process.env.IMAGEM_LIMITE_POR_KIT_EUR || "").trim();
  if (!raw) return 1.5;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1.5;
  return roundEur(parsed);
}

export function lerOrcamentoKit(
  sessaoId: string,
  limiteOverrideEur?: number
): OrcamentoKitEstado {
  const limiteEur =
    limiteOverrideEur !== undefined && Number.isFinite(limiteOverrideEur)
      ? roundEur(limiteOverrideEur)
      : getLimitePorKitEurFromEnv();

  const filePath = getBudgetFilePath(sessaoId);
  if (fs.existsSync(filePath)) {
    try {
      const stored = JSON.parse(fs.readFileSync(filePath, "utf8")) as OrcamentoKitEstado;
      const gastoEur = roundEur(stored.gastoEur || 0);
      return {
        sessaoId: cleanSessaoId(sessaoId),
        gastoEur,
        limiteEur,
        restanteEur: roundEur(Math.max(0, limiteEur - gastoEur)),
        rondasUsadas: stored.rondasUsadas || 0,
        ajustesUsados: stored.ajustesUsados || 0,
        bloqueado: gastoEur >= limiteEur - 0.0001,
        operacoes: Array.isArray(stored.operacoes) ? stored.operacoes : [],
      };
    } catch {
      // fallback to clean ledger
    }
  }

  return {
    sessaoId: cleanSessaoId(sessaoId),
    gastoEur: 0,
    limiteEur,
    restanteEur: limiteEur,
    rondasUsadas: 0,
    ajustesUsados: 0,
    bloqueado: false,
    operacoes: [],
  };
}

export function limparOrcamentoKit(sessaoId: string): void {
  const filePath = getBudgetFilePath(sessaoId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function verificarERegistarCusto(params: {
  sessaoId: string;
  tipo: OperacaoImagemTipo;
  quantidade?: number;
  limiteEur?: number;
  contarRonda?: boolean;
  contarAjuste?: boolean;
  detalhe?: string;
}): OrcamentoKitEstado {
  const quantidade = Math.max(1, params.quantidade || 1);
  const estado = lerOrcamentoKit(params.sessaoId, params.limiteEur);
  const custoOperacao = roundEur(CUSTO_UNITARIO_EUR[params.tipo] * quantidade);
  const novoTotal = roundEur(estado.gastoEur + custoOperacao);

  if (custoOperacao > 0 && novoTotal > estado.limiteEur + 0.0001) {
    throw new ImagemProviderError(
      "budget_exceeded",
      `Limite de orçamento por kit atingido (${estado.gastoEur.toFixed(2).replace(".", ",")} € gastos; teto configurado de ${estado.limiteEur.toFixed(2).replace(".", ",")} €). Escolha uma das propostas já geradas para prosseguir.`,
      {
        gastoEur: estado.gastoEur,
        limiteEur: estado.limiteEur,
        custoTentadoEur: custoOperacao,
      }
    );
  }

  const novoEstado: OrcamentoKitEstado = {
    sessaoId: estado.sessaoId,
    gastoEur: novoTotal,
    limiteEur: estado.limiteEur,
    restanteEur: roundEur(Math.max(0, estado.limiteEur - novoTotal)),
    rondasUsadas: estado.rondasUsadas + (params.contarRonda ? 1 : 0),
    ajustesUsados: estado.ajustesUsados + (params.contarAjuste ? 1 : 0),
    bloqueado: novoTotal >= estado.limiteEur - 0.0001,
    operacoes: [
      ...estado.operacoes,
      {
        timestamp: Date.now(),
        tipo: params.tipo,
        quantidade,
        custoEur: custoOperacao,
        detalhe: params.detalhe,
      },
    ],
  };

  fs.writeFileSync(
    getBudgetFilePath(params.sessaoId),
    JSON.stringify(novoEstado, null, 2),
    "utf8"
  );

  return novoEstado;
}
