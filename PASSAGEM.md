# PASSAGEM — PandoMarca

> Última atualização: 2026-11-17 11:26 (Lisboa) · por Antigravity
> Última verificação de quota: Antigravity (relato do operador, 16/11/2026, Lisboa): Gemini semanal 71 % · 5 h 96 % · Argon semanal 14 % · Claude/GPT 100 % · renovação semanal 23/11/2026 ~11h–12h Lisboa. Não verificada de novo nesta sessão.

## 1. Objetivo do produto
O PandoMarca é o kit de identidade visual da PandoWeb para PME: parte de um logótipo (gerado na Entrada A ou carregado na Entrada B) e entrega um ZIP com exactamente 38 ficheiros (variantes, 18 peças para redes sociais, favicon, assinatura de email, cartão, papel de carta e guia). Toda a geração visual é só por imagem: o logótipo escolhido é a referência obrigatória de todas as peças seguintes. A interface, a documentação e os ficheiros gerados estão em pt-PT.

## 2. Fase atual
- Fase: arquitetura só-imagem em modo de demonstração (`IMAGEM_MODO=falso`), com suporte completo da Entrada B para logótipos reais de clientes sem fugas do ensaio anterior (`lib/logo-surface.ts`, `lib/imagem/falso.ts`, `lib/generate/kit.ts` e `app/api/capas/route.ts`)
- Estado: pedido «msg8» concluído e validado com a marca **PandoWeb** em `IMAGEM_MODO=falso` (**17/17** testes Vitest, `tsc`/`lint`/`next build` OK, E2E Playwright Entrada B completo com `pandomarca-pandoweb.zip` de 38 ficheiros e 7 folhas de revisão em `docs/revisao/pandoweb/`); aguarda revisão humana do Bernardo antes da decisão do modo real

## 3. Feito (com commits)
| Data | Commit | O quê |
| --- | --- | --- |
| 2026-11-16 | `b43038d` | Fases 1, 2 e 3: Entradas A e B, estilos e formatos iniciais |
| 2026-11-16 | `e6aa64b` / `e4a80e4` | Imagens de revisão do Forno da Vilariça; afinação de logótipos e capas |
| 2026-11-16 | `23d86d0` | Fase IA: camada de imagem em modo falso, frontend completo |
| 2026-11-16 | `d830f9b` | Referências de IA aprovadas pelo Bernardo em `docs/referencias/ia-aprovada/` (logótipo e capas Forno da Vilariça) |
| 2026-11-16 | `1cbdf07` | Removidos o preço inventado (160 €) e notas internas dos ecrãs públicos |
| 2026-11-16 | `4ad873f` | Só-imagem: referência obrigatória, zonas seguras desktop/telemóvel, 38 formatos, 18 redes em `lib/config/redes-sociais.ts`, capturas em `docs/revisao/so-imagem/` |
| 2026-11-16 | `8d200ea` | Documentação de passagem: `PASSAGEM.md`, `AGENTS.md` e `docs/REGRAS_LIMITES.md` |
| 2026-11-16 | `52ed186` | Pedido msg7: composição própria por formato em 3 camadas, auditoria móvel/avatar, vista dupla Computador + Telemóvel e 10 capturas em `docs/revisao/composicao/` |
| 2026-11-17 | `msg8` (atual) | Entrada B verificada com o logótipo real da PandoWeb (`docs/referencias/pandoweb/pandoweb-logo-v2.png`): paleta extraída do cliente, knockout em fundo escuro mantendo azul eléctrico/mascote + halo radial limpo, isolamento da mascote nos avatares a 40 px e 7 capturas em `docs/revisao/pandoweb/` |

## 4. Testes
- Comando: `npx tsc --noEmit && npm run lint && npm test && npm run build`
- Resultado do último run (2026-11-17 11:24 Lisboa): TypeScript 0 erros; ESLint 0 erros (18 avisos pré-existentes de `<img>` e parâmetros `_`); Vitest **17/17** testes a passar (inclui teste completo PandoWeb Entrada B sem resíduos de ensaios anteriores); Next.js `build` OK.
- Ensaio E2E Playwright (2026-11-17 11:25 Lisboa): percurso integral Entrada B `/criar` (`kit-website-demo`, desktop `1440×960` e telemóvel `390×844` com `overflow=0px`, 0 erros consola/HTTP), `pandomarca-pandoweb.zip` extraído com 38 ficheiros, PDFs renderizados com `pdftoppm`, assinatura HTML validada e 7 capturas inspecionadas em `docs/revisao/pandoweb/`.
- Testes a falhar e porquê: nenhum.

## 5. Em curso (ponto exato onde parou)
- Tarefa: pedido «msg8» concluído e entregue em `main`.
- Ficheiros tocados: `lib/logo-surface.ts`, `lib/generate/{pieces.ts,kit.ts}`, `lib/imagem/{falso.ts,index.ts,referencia.ts,types.ts}`, `app/api/capas/route.ts`, `components/kit-studio-wizard.tsx`, `tests/pandomarca.test.ts`, `docs/referencias/pandoweb/pandoweb-logo-v2.png`, `docs/revisao/pandoweb/*.png`, `PASSAGEM.md`.
- Último passo concluído: substituição do halo rectangular por brilho radial circular sem arestas atrás da mascote nas peças escuras, ajuste tipográfico (`Manrope`) na pílula de contactos e inspeção visual final das 7 folhas + ficheiros brutos exportados do ZIP.
- Falta: revisão humana das capturas em `docs/revisao/pandoweb/` e `docs/revisao/composicao/` pelo Bernardo e decisão explícita sobre fornecedor/orçamento para o modo real.
- Ramo: `main`

## 6. Próximos passos (por ordem, cada um verificável)
1. Rever as 7 capturas Entrada B da PandoWeb em `docs/revisao/pandoweb/` (junto com as 10 capturas em `docs/revisao/composicao/`) — ter presente que `IMAGEM_MODO=falso` usa composição de estúdio a partir da paleta do logótipo carregado, não mostrando ainda fundos fotográficos/texturas generativas integrados pelo Gemini em torno do emblema nem variações criativas entre rondas — critério de «feito»: revisão aprovada pelo Bernardo.
2. Bernardo decide o fornecedor e o orçamento do modo real (recomendação já feita: Nano Banana 2.1, cerca de 0,60 USD por kit) — critério de «feito»: ordem explícita, por escrito.
3. Só depois dessa ordem: ligar o adaptador Gemini em ambiente local de teste, com `GEMINI_API_KEY` só em variáveis de ambiente, sem publicação — critério de «feito»: modo real a gerar no computador de desenvolvimento, testes a passar, sem custos escondidos.

## 7. Decisões tomadas (não voltar atrás sem falar com o Bernardo)
- 2026-11-16 — Geração só de imagem, sem vetores desenhados por código nas peças sociais — o Bernardo rejeitou a composição por SVG/regras; não ficava bem.
- 2026-11-16 — O logótipo gerado e escolhido é a imagem de referência de todas as peças seguintes, para manter consistência.
- 2026-11-16 — Cada rede social tem o seu formato de foto de perfil e de capa, com margens/zonas seguras em computador e em telemóvel, e o tom visual ajusta-se a cada marca (6 tons).
- 2026-11-16 — Composição própria por formato em 3 camadas (fundo/ambiente com sangria permitida, bloco informativo dentro da zona segura móvel segundo hierarquia 1.º logótipo → 2.º nome → 3.º slogan → 4.º contactos, e reserva de avatar desktop/telemóvel) apresentada lado a lado em Computador + Telemóvel.
- 2026-11-16 — Modo falso por omissão (`IMAGEM_MODO=falso`); o adaptador Gemini não faz chamadas pagas sem `GEMINI_API_KEY`.
- 2026-11-16 — As referências aprovadas estão em `docs/referencias/ia-aprovada/` (`d830f9b`) e não se substituem sem o Bernardo.
- 2026-11-16 — Ecrãs públicos sem preços inventados nem notas internas (`1cbdf07`). Preço do kit `standalone` continua «a definir». Sem checkout.
- 2026-11-17 — Na Entrada B em modo falso, qualquer marca distinta do ensaio «Forno da Vilariça» usa a paleta e o ficheiro carregado intacto (isolando o emblema só nos avatares e preservando cores/contornos nas adaptações para fundo escuro), nunca recaindo nas imagens de padaria.

## 8. Perguntas em aberto para o Bernardo
- [ ] Fornecedor e orçamento do modo real de geração de imagem (bloqueia: sim, o modo real)
- [ ] Preço e meio de pagamento do kit individual `standalone` (bloqueia: não, o desenvolvimento local)
- [ ] Domínio final (ex.: marca.pandoweb.pt) e políticas de códigos por cliente (bloqueia: não)

## 9. Como correr e testar
- Requisitos: Node.js 22+ e npm
- Instalar: `npm ci` e `cp .env.example .env.local` (códigos de acesso só no `.env.local`; `IMAGEM_MODO=falso`)
- Variáveis de ambiente: ver `.env.example` (nomes apenas, nunca valores). Chaves `GEMINI_API_KEY` e `RECRAFT_API_KEY` ficam vazias no exemplo.
- Correr: `npm run dev` → abrir http://127.0.0.1:4317 (ensaios «Forno da Vilariça» ou Entrada B com `docs/referencias/pandoweb/pandoweb-logo-v2.png`)
- Testar: `npx tsc --noEmit && npm run lint && npm test`
- Capturas de revisão: `docs/revisao/pandoweb/`, `docs/revisao/composicao/` (e anteriores em `docs/revisao/so-imagem/`, `docs/revisao/fase-ia/`, `docs/revisao/logotipos/`)

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
| 2026-11-16 22:18 | Antigravity | Concluído pedido msg7: composição própria por formato em 3 camadas, auditoria móvel/avatar, vista dupla lado a lado e 10 capturas em `docs/revisao/composicao/` |
| 2026-11-17 11:26 | Antigravity | Concluído pedido msg8: Entrada B completa com PandoWeb em modo falso usando o logótipo do cliente, halo radial limpo, avatares 40 px e 7 capturas em `docs/revisao/pandoweb/` |
