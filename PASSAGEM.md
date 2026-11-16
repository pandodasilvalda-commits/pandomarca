# PASSAGEM — PandoMarca

> Última atualização: 2026-11-16 21:25 (Lisboa) · por Programador (caixa, ficheiros de passagem)
> Última verificação de quota: Antigravity (relato do operador, 16/11/2026, Lisboa): Gemini semanal 71 % · 5 h 96 % · Argon semanal 14 % · Claude/GPT 100 % · renovação semanal 23/11/2026 ~11h–12h Lisboa. Não verificada de novo nesta sessão.

## 1. Objetivo do produto
O PandoMarca é o kit de identidade visual da PandoWeb para PME: parte de um logótipo (gerado na Entrada A ou carregado na Entrada B) e entrega um ZIP com exactamente 38 ficheiros (variantes, 18 peças para redes sociais, favicon, assinatura de email, cartão, papel de carta e guia). Toda a geração visual é só por imagem: o logótipo escolhido é a referência obrigatória de todas as peças seguintes. A interface, a documentação e os ficheiros gerados estão em pt-PT.

## 2. Fase atual
- Fase: arquitetura só-imagem (plano em docs/SPEC.md; 38 formatos, zonas seguras por rede, tons da marca)
- Estado: em revisão — o código e as capturas já estão em `main` (commit `4ad873f`); falta a revisão humana e a decisão do fornecedor/orçamento para o modo real

## 3. Feito (com commits)
| Data | Commit | O quê |
| --- | --- | --- |
| 2026-11-16 | `b43038d` | Fases 1, 2 e 3: Entradas A e B, estilos e formatos iniciais |
| 2026-11-16 | `e6aa64b` / `e4a80e4` | Imagens de revisão do Forno da Vilariça; afinação de logótipos e capas |
| 2026-11-16 | `23d86d0` | Fase IA: camada de imagem em modo falso, frontend completo |
| 2026-11-16 | `d830f9b` | Referências de IA aprovadas pelo Bernardo em `docs/referencias/ia-aprovada/` (logótipo e capas Forno da Vilariça) |
| 2026-11-16 | `1cbdf07` | Removidos o preço inventado (160 €) e notas internas dos ecrãs públicos |
| 2026-11-16 | `4ad873f` | Só-imagem: referência obrigatória, zonas seguras desktop/telemóvel, 38 formatos, 18 redes em `lib/config/redes-sociais.ts`, capturas em `docs/revisao/so-imagem/` |

## 4. Testes
- Comando: `npm test` (também `npx tsc --noEmit` e `npm run lint`)
- Resultado do último run: 12 testes no ficheiro `tests/pandomarca.test.ts` (acesso, 38 formatos, camada só-imagem, zonas seguras, vetorização opcional). Run desta sessão não repetido; o commit `4ad873f` inclui a actualização destes testes.
- Testes a falhar e porquê: não verificado nesta sessão

## 5. Em curso (ponto exato onde parou)
- Tarefa: nenhuma no repositório neste momento. O pedido «msg6» (geração só de imagem, perfis e capas por rede, zonas seguras, capturas em `docs/revisao/so-imagem/`) já foi integrado em `main` no commit `4ad873f` (16/11/2026, 17:10 Lisboa).
- Ficheiros tocados: ver esse commit (entre outros: `lib/imagem/`, `lib/config/redes-sociais.ts`, `lib/capas/safe-zone.ts`, `components/kit-studio-wizard.tsx`, `docs/revisao/so-imagem/`)
- Último passo concluído: arquitectura só-imagem e 6 capturas de revisão no repositório
- Falta: revisão humana das capturas e decisão do Bernardo sobre o modo real
- Ramo: `main`

## 6. Próximos passos (por ordem, cada um verificável)
1. Rever as capturas em `docs/revisao/so-imagem/` (consistência com o logótipo de referência, zonas seguras em computador e telemóvel, fotos de perfil em círculo a 40 px, tom da marca) — critério de «feito»: revisão mostrada ao Bernardo.
2. Bernardo decide o fornecedor e o orçamento do modo real (recomendação já feita: Nano Banana 2.1, cerca de 0,60 USD por kit) — critério de «feito»: ordem explícita, por escrito.
3. Só depois dessa ordem: ligar o adaptador Gemini em ambiente local de teste, com `GEMINI_API_KEY` só em variáveis de ambiente, sem publicação — critério de «feito»: modo real a gerar no computador de desenvolvimento, testes a passar, sem custos escondidos.

## 7. Decisões tomadas (não voltar atrás sem falar com o Bernardo)
- 2026-11-16 — Geração só de imagem, sem vetores desenhados por código nas peças sociais — o Bernardo rejeitou a composição por SVG/regras; não ficava bem.
- 2026-11-16 — O logótipo gerado e escolhido é a imagem de referência de todas as peças seguintes, para manter consistência.
- 2026-11-16 — Cada rede social tem o seu formato de foto de perfil e de capa, com margens/zonas seguras em computador e em telemóvel, e o tom visual ajusta-se a cada marca (6 tons).
- 2026-11-16 — Modo falso por omissão (`IMAGEM_MODO=falso`); o adaptador Gemini não faz chamadas pagas sem `GEMINI_API_KEY`.
- 2026-11-16 — As referências aprovadas estão em `docs/referencias/ia-aprovada/` (`d830f9b`) e não se substituem sem o Bernardo.
- 2026-11-16 — Ecrãs públicos sem preços inventados nem notas internas (`1cbdf07`). Preço do kit `standalone` continua «a definir». Sem checkout.

## 8. Perguntas em aberto para o Bernardo
- [ ] Fornecedor e orçamento do modo real de geração de imagem (bloqueia: sim, o modo real)
- [ ] Preço e meio de pagamento do kit individual `standalone` (bloqueia: não, o desenvolvimento local)
- [ ] Domínio final (ex.: marca.pandoweb.pt) e políticas de códigos por cliente (bloqueia: não)

## 9. Como correr e testar
- Requisitos: Node.js 22+ e npm
- Instalar: `npm ci` e `cp .env.example .env.local` (códigos de acesso só no `.env.local`; `IMAGEM_MODO=falso`)
- Variáveis de ambiente: ver `.env.example` (nomes apenas, nunca valores). Chaves `GEMINI_API_KEY` e `RECRAFT_API_KEY` ficam vazias no exemplo.
- Correr: `npm run dev` → abrir http://127.0.0.1:4317 (ensaio «Forno da Vilariça» no assistente)
- Testar: `npx tsc --noEmit && npm run lint && npm test`
- Capturas de revisão: `docs/revisao/so-imagem/` (e anteriores em `docs/revisao/fase-ia/`, `docs/revisao/logotipos/`)

## 10. Não tocar
- `docs/referencias/ia-aprovada/` — referências aprovadas pelo Bernardo; são a base do modo falso e da consistência visual
- Preços e notas internas nos ecrãs públicos — já foram retirados de propósito
- Não ligar o modo real nem gastar API sem ordem explícita do Bernardo
- `LICENSE` e avisos de licença das dependências

## 11. Riscos e notas para o próximo agente
- O `AGENTS.md` desta raiz já existia com um bloco automático do Next.js; esse bloco foi conservado no fim do ficheiro (o `next dev` volta a criá-lo se for apagado).
- Vetorização (`lib/vetorizar.ts`) é opcional e só para `favicon/*` e `impressao/*`. Não voltar a desenhar capas ou perfis por SVG procedimental.
- Sem contas de utilizador nem base de dados: acesso por códigos de ambiente e cookie HttpOnly; rascunhos em `/tmp`.
- Não publicar, não comprar serviços e não criar custos sem ordem do Bernardo.

## 12. Histórico de passagens (só a última linha por sessão)
| Data | Ferramenta / modelo | Resumo de 1 linha |
| --- | --- | --- |
| 2026-11-16 21:25 | Programador (caixa) | Criados PASSAGEM.md, AGENTS.md e docs/REGRAS_LIMITES.md; msg6 já estava em `4ad873f` |
