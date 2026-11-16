# Regras de utilização dos limites (PandoWeb)

**Versão:** 16/11/2026 · **Dono:** Bernardo Silva · **Operador:** Programador (bot)
**Aplica-se a:** qualquer agente ou LLM que trabalhe nos repositórios PandoWeb (Antigravity `agy`, OpenCode, Copilot CLI, Kiro, Codex, etc.).

---

## 0. A regra de ouro

> **Nenhum trabalho fica só na cabeça do agente.**
> No fim de **cada passo** (não só quando a quota acaba), o agente atualiza o `PASSAGEM.md` do repositório, faz commit e push.

Porquê: a quota pode acabar **a meio de um turno**, sem aviso. O agente nem sempre vê quanto lhe resta (no `agy` não há comando de uso fora da sessão). Se o ficheiro estiver sempre atualizado, qualquer outro agente pega no trabalho em 2 minutos.

---

## 1. Limiares (o que fazer conforme a quota que resta)

| Quota que resta (5 h **ou** semanal, a que for mais baixa) | O que o agente faz |
| --- | --- |
| **> 30 %** | Trabalho normal. Passos pequenos, commit no fim de cada um. |
| **30 % – 15 %** | Só tarefas pequenas e já definidas. Nada de refactors grandes nem tarefas de «xhigh». Baixar o esforço (`medium`/`low`) quando a tarefa é mecânica. |
| **15 % – 10 %** | **Não começa nada novo.** Termina o passo em curso, deixa os testes a passar (ou anota o que falha), atualiza o `PASSAGEM.md`, commit e push. |
| **≤ 10 %** | **Para já.** Escreve o `PASSAGEM.md` mesmo que o passo fique a meio (secção «Em curso» com o ponto exato), commit `wip:` e push. Avisa o operador. |
| **0 %** | Não se reativa nada pago. Muda-se de ferramenta (ver secção 3) ou espera-se pela renovação. |

Notas:
- No Antigravity, o limite de 5 horas renova sozinho; o semanal renova à segunda-feira (próximo: **23/11/2026, ~11h–12h, Lisboa**). Se só o de 5 h está baixo e falta pouco para renovar, **esperar** costuma ser melhor do que mudar de ferramenta.
- Gemini (Flash, Hydrogen, Argon, Orchestrator) partilham um poço; Claude e GPT partilham outro. Ver `/workspace/agy/MODELOS_ANTIGRAVITY.md`.
- Argon tem hoje um limite próprio muito baixo (14 % a 16/11). Usar só para arquitetura que precise mesmo dele.

---

## 2. Como verificar a quota (por ferramenta)

O **operador verifica a quota antes de cada fase** e anota o valor no `PASSAGEM.md` («Última verificação de quota»).

| Ferramenta | Como ver o que resta | Notas |
| --- | --- | --- |
| Antigravity CLI (`agy`) | Dentro da sessão tmux já aberta: `/usage` (ou `/quota`). Na app: seletor de modelo → *View Usage*. | Não abrir conversas novas só para ver a quota (gasta quota). Não há `agy usage` fora da sessão. |
| OpenCode (modelos grátis Zen) | Sem painel público de limites nos grátis; os erros 429 dizem que acabou. | Limites dos grátis não publicados, exceto LongCat (100 pedidos/dia). |
| GitHub Copilot CLI | Na sessão: `/usage`; ou em github.com → Settings → Copilot. | O Free tem «allowance» de AI Credits **sem número publicado**. |
| Kiro CLI / IDE | Painel de subscrição dentro do Kiro (atualiza de 5 em 5 min). | Free: 50 créditos/mês, renova no início do mês. |
| Codex CLI | Na sessão: `/status`; ou o painel de uso do Codex. | Free: «limitado», sem número publicado. |
| OpenRouter (`:free`) | `GET https://openrouter.ai/api/v1/key` → `free_model_daily_requests`. | 50 pedidos/dia sem créditos comprados; renova 00:00 UTC. |
| Gemini API (chave AI Studio) | Google AI Studio → página de limites do projeto. | Limites grátis não publicados em número fixo. |

---

## 3. Ordem de recurso (quando a ferramenta principal acaba)

Antes de sair do Antigravity, **usar primeiro o outro poço do próprio Antigravity** (já está pago no AI Pro, custo extra zero).

| Tipo de tarefa | 1.ª escolha | 2.ª | 3.ª |
| --- | --- | --- | --- |
| Arquitetura / especificação / bugs difíceis | `agy` Hydrogen high/xhigh | `agy` Claude Opus 5.5 / Sonnet 5.5 (poço Claude/GPT) | Kiro Free (Claude Sonnet 4.5, 50 créditos/mês) |
| Implementação normal de uma fase | `agy` Hydrogen medium | `agy` Claude Sonnet 5.5 | OpenCode + modelo grátis sem treino (GLM-5.3-Flash Free / DeepSeek V4.1 Flash Free) |
| Correções pequenas, textos, testes, lint | `agy` Gemini 3.8 Flash low/medium | OpenCode + modelo grátis sem treino | Copilot CLI Free (com treino desligado) |
| Revisão de código / segunda opinião | `agy` Claude Sonnet 5.5 | Copilot CLI Free | Codex CLI (ChatGPT Free, se a conta deixar) |
| Imagens (PandoMarca) | Só no fluxo aprovado do PandoMarca | — | — |

Ao mudar de ferramenta, o novo agente **começa sempre por ler** `AGENTS.md` e `PASSAGEM.md`.

---

## 4. Custos: proibido sem ordem explícita do Bernardo

1. **Overage / créditos extra sempre desligados.** No Antigravity: «AI Credit Overages» = **Never** (`useG1Credits=false`).
2. Não comprar créditos, não ativar «pay-as-you-go», não adicionar cartão, não aceitar «trials» que pedem cartão (ex.: Cerebras pede cartão → excluído).
3. **Fallbacks pagos escondidos:** no OpenRouter, nunca pôr um modelo pago na lista de fallback de um `:free` (passa a cobrar). No Kilo, mudar o `small_model` para um grátis (o predefinido gasta créditos). No OpenCode, não carregar créditos na consola.
4. Se uma ferramenta pedir método de pagamento para continuar, **parar** e perguntar ao Bernardo.

---

## 5. Privacidade e segredos

1. **Nunca** pôr palavras-passe, chaves ou tokens em mensagens, código ou no `PASSAGEM.md`. Só variáveis de ambiente (ex.: `.env` fora do Git, `.gitignore` atualizado).
2. Em ferramentas grátis que **podem treinar com os dados**, não enviar: código de clientes, dados pessoais, `.env`, chaves, contratos, conversas de clientes.
3. Antes de usar uma conta grátis, **desligar o treino** quando existe opção:
   - GitHub Copilot Free: Settings → Copilot → Privacy (o treino está **ligado por omissão** desde 24/04/2026).
   - Mistral Vibe Free: treino ligado por omissão → desligar nas definições.
   - Kiro Free: «opt-out» de recolha de conteúdo nas definições.
   - Codex / ChatGPT: controlos de treino do ChatGPT aplicam-se ao Codex.
   - OpenRouter: nas definições de privacidade, excluir fornecedores que treinam.
4. No OpenCode, usar só modelos grátis marcados «zero retention / não treina» (lista em `LLM_GRATIS.md`). Evitar Big Pickle, Iceman, Inkling, Flint, MiMo, Nemotron.
5. Gemini API grátis (chave AI Studio): os dados **são usados para melhorar produtos** → só código interno sem dados de clientes.
6. Repositórios de clientes reais: só Antigravity (AI Pro) ou ferramentas confirmadas sem treino.

---

## 6. Forma de trabalhar (para gastar menos)

1. **Passos pequenos:** cada pedido ao agente = 1 objetivo verificável (ex.: «criar endpoint X com testes»).
2. **Commit no fim de cada passo**, mensagem clara (`feat:`, `fix:`, `docs:`, `wip:`). Push para o ramo de trabalho.
3. Não colar logs ou ZIPs grandes nas mensagens; apontar para ficheiros.
4. Escolher o modelo mais barato que cumpre (Flash para mecânico, Hydrogen para fases, Claude para revisão, Argon só se indispensável).
5. Nada de vários agentes em paralelo (Swarm/Boost) sem necessidade real.
6. Nunca publicar em produção, comprar domínios/serviços ou falar com clientes sem ordem do Bernardo.

---

## 7. Checklist do operador (antes de cada fase)

- [ ] Ver a quota da ferramenta (secção 2) e anotar no `PASSAGEM.md`.
- [ ] Se < 30 %: dividir a fase em passos menores ou trocar de modelo/poço.
- [ ] Confirmar overage = Never.
- [ ] Confirmar que o agente leu `AGENTS.md` + `PASSAGEM.md`.
- [ ] Mandar o pedido com a instrução: «no fim de cada passo, atualiza o PASSAGEM.md, commit e push».
- [ ] No fim: verificar o commit, o `PASSAGEM.md` e as capturas de ecrã.

## 8. Instrução-padrão a colar no início de cada pedido a um agente

```
Antes de começar: lê AGENTS.md e PASSAGEM.md.
No fim de cada passo: atualiza PASSAGEM.md (feito, em curso, próximos passos, testes), commit e push.
Se a quota estiver abaixo de 15 % ou receberes aviso de limite: não comeces nada novo, fecha o passo, atualiza PASSAGEM.md, commit e push.
Nunca escrevas segredos em ficheiros; usa variáveis de ambiente.
```
