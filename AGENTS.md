# AGENTS.md — PandoMarca

1. Antes de qualquer trabalho, lê PASSAGEM.md (estado atual e próximos passos).
2. Segue as regras em docs/REGRAS_LIMITES.md e as diretrizes visuais em docs/DIRETRIZES.md.
3. No fim de cada passo: atualiza PASSAGEM.md, faz commit e push.
4. Nunca escrevas palavras-passe, chaves ou tokens em ficheiros ou mensagens. Usa variáveis de ambiente (ver `.env.example`).
5. Não actives overage nem créditos extra pagos. Não publiques em produção, não cries custos e não contactes clientes sem ordem explícita do Bernardo.
6. Escreve em português de Portugal nos documentos e na interface.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
