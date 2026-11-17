# PASSAGEM — PandoMarca

> Última atualização: 2026-11-17 20:15 (Lisboa) · por Antigravity
> Última verificação de quota: Antigravity (relato do operador, 16/11/2026, Lisboa): Gemini semanal 71 % · 5 h 96 % · Argon semanal 14 % · Claude/GPT 100 % · renovação semanal 23/11/2026 ~11h–12h Lisboa. Não verificada de novo nesta sessão.

## 1. Objetivo do produto
O PandoMarca é o kit de identidade visual da PandoWeb para PME: parte de um logótipo (gerado na Entrada A ou carregado na Entrada B) e entrega um ZIP com exactamente 38 ficheiros (variantes, 18 peças para redes sociais, favicon, assinatura de email, cartão, papel de carta e guia). Toda a geração visual é só por imagem: o logótipo escolhido é a referência obrigatória de todas as peças seguintes. A interface, a documentação e os ficheiros gerados estão em pt-PT.

## 2. Fase atual
- Fase: pedido «msg9 + complemento multi-marca» (em curso — **Passos 1 e 2 concluídos**) em modo de demonstração (`IMAGEM_MODO=falso`)
- Estado: **Passo 2** concluído (`tsc` 0 erros e **17/17** Vitest OK): pílulas IG para telemóvel com `38–42 px` em 1–3 linhas equilibradas na tipografia própria da marca, ancoragem à esquerda em `fb-capa`/`x-cabecalho` acima e à direita dos avatares, isolamento multi-marca nas Entradas A e B (zero valores fixos da PandoWeb e zero fugas do ensaio Forno da Vilariça), amostras multi-tom (`vertice-digital`, `quinta-do-alvor`, `atelier-terra-viva`) em `lib/samples.ts` e criação de `docs/DIRETRIZES.md` referenciado em `AGENTS.md`. Falta o **Passo 3** (testes multi-marca alargados, folhas Antes/Depois e multi-marca em `docs/revisao/correcoes-tipografia/` com inspeção visual, e gate completo `tsc`, `lint`, `test`, `build`).

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
| 2026-11-17 | `9799e81` | Pedido msg8: Entrada B completa com PandoWeb em modo falso usando o logótipo do cliente, halo radial limpo, avatares 40 px e 7 capturas em `docs/revisao/pandoweb/` |
| 2026-11-17 | `9f1bd27` | Pedido msg9 Passo 1: motor tipográfico genérico derivado do tom/sector/logótipo (`resolverParTipograficoMarca`, 6 pares incluindo `classica`), pesos `400..800` embebidos sem serifas acidentais e escalas A4/Cartão/Email aumentadas |
| 2026-11-17 | *(passo 2 msg9)* | Legibilidade IG em telemóvel (`38–42 px` com `packPillLines`), ancoragem à esquerda em FB/X, isolamento multi-marca A/B, `MULTI_TONE_SAMPLE_BRANDS` em `lib/samples.ts` e `docs/DIRETRIZES.md` |

## 4. Testes
- Comando: `npx tsc --noEmit && npm test`
- Resultado do último run (2026-11-17 20:15 Lisboa): TypeScript 0 erros; Vitest **17/17** testes a passar (após Passo 2, 65,17 s).
- Ensaio E2E Playwright (2026-11-17 11:25 Lisboa): válido da etapa msg8 (`pandomarca-pandoweb.zip`, 38 ficheiros); novo ensaio visual e testes multi-marca no Passo 3.
- Testes a falhar e porquê: nenhum.

## 5. Em curso (ponto exato onde parou)
- Tarefa: pedido «msg9» + complemento multi-marca — **Passos 1 e 2 fechados** em `main`, pronto a iniciar o **Passo 3**.
- Ficheiros tocados no Passo 2: `docs/DIRETRIZES.md`, `AGENTS.md`, `lib/samples.ts`, `lib/imagem/referencia.ts`, `lib/imagem/index.ts`, `lib/imagem/falso.ts`, `PASSAGEM.md`.
- Último passo concluído: isolamento genérico multi-marca no gerador em modo falso (Entradas A e B sem cores fixas nem fugas de padaria), pílulas móveis IG (`>= 38–42 px` em 1–3 linhas equilibradas com contraste WCAG AA `>= 4,5:1`), ancoragem à esquerda acima/à direita dos avatares em `fb-capa`/`x-cabecalho`, amostras multi-tom (`tecnico`, `tradicional`, `natural`) em `lib/samples.ts` e diretrizes práticas em `docs/DIRETRIZES.md`.
- Falta:
  - **Passo 3**: expandir `tests/pandomarca.test.ts` (verificação integral de `FONT_PAIRS` locais `400..800`, PandoWeb + 3 marcas multi-tom em Entrada A e Entrada B, centróide à esquerda no FB, pílula IG nítida e zero fugas), gerar e inspecionar visualmente 5 folhas Antes/Depois e multi-marca em `docs/revisao/correcoes-tipografia/`, correr gate completo (`tsc`, `lint`, `test`, `build`).
- Ramo: `main`

## 6. Próximos passos (por ordem, cada um verificável)
1. **Passo 3 (msg9):** expandir `tests/pandomarca.test.ts` (fontes, contrastes, zonas seguras, centróide à esquerda no FB, multi-marca sans vs serifada intencional na Entrada A e B), gerar e inspecionar visualmente as 5 folhas Antes/Depois e multi-marca em `docs/revisao/correcoes-tipografia/`, correr `tsc && lint && test && build`, atualizar `PASSAGEM.md` e fechar msg9.
2. Depois da aprovação visual pelo Bernardo e decisão explícita sobre fornecedor/orçamento: ligar modo real Gemini em ambiente local de teste sem publicação.

## 7. Decisões tomadas (não voltar atrás sem falar com o Bernardo)
- 2026-11-16 — Geração só de imagem, sem vetores desenhados por código nas peças sociais — o Bernardo rejeitou a composição por SVG/regras; não ficava bem.
- 2026-11-16 — O logótipo gerado e escolhido é a imagem de referência de todas as peças seguintes, para manter consistência.
- 2026-11-16 — Cada rede social tem o seu formato de foto de perfil e de capa, com margens/zonas seguras em computador e em telemóvel, e o tom visual ajusta-se a cada marca (6 tons).
- 2026-11-16 — Composição própria por formato em 3 camadas (fundo/ambiente com sangria permitida, bloco informativo dentro da zona segura móvel segundo hierarquia 1.º logótipo → 2.º nome → 3.º slogan → 4.º contactos, e reserva de avatar desktop/telemóvel) apresentada lado a lado em Computador + Telemóvel.
- 2026-11-16 — Modo falso por omissão (`IMAGEM_MODO=falso`); o adaptador Gemini não faz chamadas pagas sem `GEMINI_API_KEY`.
- 2026-11-16 — As referências aprovadas estão em `docs/referencias/ia-aprovada/` (`d830f9b`) e não se substituem sem o Bernardo.
- 2026-11-16 — Ecrãs públicos sem preços inventados nem notas internas (`1cbdf07`). Preço do kit `standalone` continua «a definir». Sem checkout.
- 2026-11-17 — Na Entrada B em modo falso, qualquer marca distinta do ensaio «Forno da Vilariça» usa a paleta e o ficheiro carregado intacto (isolando o emblema só nos avatares e preservando cores/contornos nas adaptações para fundo escuro), nunca recaindo nas imagens de padaria.
- 2026-11-17 — O PandoMarca é genérico e multi-marca: tipografia, paleta, escalas e composições derivam do tom, sector e logótipo de cada cliente (sem valores fixos de nenhuma marca cliente, incluindo a PandoWeb; pares serifados só quando o tom/sector ou escolha manual o pedirem).

## 8. Perguntas em aberto para o Bernardo
- [ ] Fornecedor e orçamento do modo real de geração de imagem (bloqueia: sim, o modo real)
- [ ] Preço e meio de pagamento do kit individual `standalone` (bloqueia: não, o desenvolvimento local)
- [ ] Domínio final (ex.: marca.pandoweb.pt) e políticas de códigos por cliente (bloqueia: não)

## 9. Como correr e testar
- Requisitos: Node.js 22+ e npm
- Instalar: `npm ci` e `cp .env.example .env.local` (códigos de acesso só no `.env.local`; `IMAGEM_MODO=falso`)
- Variáveis de ambiente: ver `.env.example` (nomes apenas, nunca valores). Chaves `GEMINI_API_KEY` e `RECRAFT_API_KEY` ficam vazias no exemplo.
- Correr: `npm run dev` → abrir http://127.0.0.1:4317 (ensaios «Forno da Vilariça», presets multi-tom ou Entrada B com `docs/referencias/pandoweb/pandoweb-logo-v2.png`)
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
| 2026-11-17 19:59 | Antigravity | Pedido msg9 Passo 1: motor tipográfico genérico por tom/sector/logótipo (6 pares), pesos 400–800 embebidos e escalas A4/Cartão/Assinatura melhoradas |
| 2026-11-17 20:15 | Antigravity | Pedido msg9 Passo 2: pílula IG 38–42 px legível, ancoragem esquerda FB/X, isolamento multi-marca Entradas A/B, presets em lib/samples.ts e docs/DIRETRIZES.md |
