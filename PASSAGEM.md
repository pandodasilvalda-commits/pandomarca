# PASSAGEM — PandoMarca

> Última atualização: 2026-11-17 20:41 (Lisboa) · por Antigravity
> Última verificação de quota: Antigravity (relato do operador, 16/11/2026, Lisboa): Gemini semanal 71 % · 5 h 96 % · Argon semanal 14 % · Claude/GPT 100 % · renovação semanal 23/11/2026 ~11h–12h Lisboa. Não verificada de novo nesta sessão.

## 1. Objetivo do produto
O PandoMarca é o kit de identidade visual da PandoWeb para PME: parte de um logótipo (gerado na Entrada A ou carregado na Entrada B) e entrega um ZIP com exactamente 38 ficheiros (variantes, 18 peças para redes sociais, favicon, assinatura de email, cartão, papel de carta e guia). Toda a geração visual é só por imagem: o logótipo escolhido é a referência obrigatória de todas as peças seguintes. A interface, a documentação e os ficheiros gerados estão em pt-PT.

## 2. Fase atual
- Fase: pedido «msg9 + complemento multi-marca» (**concluído** em `IMAGEM_MODO=falso`, zero custos)
- Estado: **Passos 1, 2 e 3 concluídos** (`tsc` 0 erros, `lint` 0 erros, Vitest **21/21** a passar e `npm run build` OK). Corrigidos na origem do gerador: (a) par tipográfico genérico por tom/sector/logótipo (`resolverParTipograficoMarca`, 6 pares incluindo `classica`, pesos `400..800` locais sem serifas acidentais); (b) pílulas IG em telemóvel (`38–42 px` com `packPillLines`, bandas `>= 80–150 px`); (c) ancoragem à esquerda em `fb-capa` e `x-cabecalho` (centróide `< 820 px`, massa esquerda `>= 95 %`); (d) isolamento multi-marca nas Entradas A e B (`lib/imagem/index.ts`, `lib/imagem/falso.ts`) com proteção contra corte a branco em selos escuros preenchidos (`liftDetachedBottomPedestal`), preservação de recortes interiores em logótipos dark-monochrome (`convertDarkMonochromePreservingCutouts`), proteção de brasões empilhados (`findStackedWordmarkSplitY`), fundos escuros coerentes sem castanho turvo e adaptação garantida de wordmarks em modo moderno; e (e) 5 folhas de inspeção visual Antes/Depois e multi-marca verificadas em `docs/revisao/correcoes-tipografia/`.

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
| 2026-11-17 | `05dbf9b` | Pedido msg9 Passo 2: legibilidade IG em telemóvel (`38–42 px` com `packPillLines`), ancoragem à esquerda em FB/X, isolamento multi-marca A/B, `MULTI_TONE_SAMPLE_BRANDS` em `lib/samples.ts` e `docs/DIRETRIZES.md` |
| 2026-11-17 | *(passo 3 msg9)* | Proteção de selos/recortes escuros e brasões empilhados em `lib/logo-surface.ts`, contraste de wordmarks e fundos coerentes em `lib/imagem/falso.ts`/`index.ts`, 4 novos testes multi-marca (`21/21` OK), 5 folhas em `docs/revisao/correcoes-tipografia/` e gate completo (`tsc`, `lint`, `test`, `build`) |

## 4. Testes
- Comando: `npx tsc --noEmit && npm run lint && npm test && npm run build`
- Resultado do último run (2026-11-17 20:40 Lisboa): TypeScript 0 erros; ESLint 0 erros (17 avisos pré-existentes); Vitest **21/21** testes a passar (115,65 s — incluindo os 6 `FONT_PAIRS`, PandoWeb + 3 marcas multi-tom `vertice-digital`, `quinta-do-alvor`, `atelier-terra-viva` em Entradas A e B); Next.js `build` 12 rotas OK.
- Inspeção visual (2026-11-17 20:31 Lisboa): verificadas visualmente as 5 folhas `01` a `05` em `docs/revisao/correcoes-tipografia/` (Antes/Depois PandoWeb, multi-marca Entrada B e Entrada A sem upload).
- Testes a falhar e porquê: nenhum.

## 5. Em curso (ponto exato onde parou)
- Tarefa: pedido «msg9» + complemento multi-marca — **concluído** e pronto para revisão do Bernardo em `main`.
- Ficheiros tocados no Passo 3: `lib/logo-surface.ts`, `lib/imagem/falso.ts`, `lib/imagem/index.ts`, `tests/pandomarca.test.ts`, `docs/revisao/correcoes-tipografia/01..05.png`, `PASSAGEM.md`.
- Último passo concluído: correções de contraste e proteção de emblemas/selos escuros em superfícies escuras (`lib/logo-surface.ts`, `lib/imagem/falso.ts`), afinação de paletas por ronda para tons `tecnico`, `natural` e `tradicional` (`lib/imagem/index.ts`), expansão da suite Vitest para `21/21` testes cobrindo PandoWeb + 3 marcas multi-tom em Entradas A e B, geração e validação visual das 5 folhas de revisão em `docs/revisao/correcoes-tipografia/` e passagem integral de `tsc`, `lint`, `test` e `build`.
- Falta: aguardar revisão visual do Bernardo e decisões em aberto (secção 8).
- Ramo: `main`

## 6. Próximos passos (por ordem, cada um verificável)
1. Apresentar as 5 folhas `docs/revisao/correcoes-tipografia/` ao Bernardo para aprovação visual das correções de tipografia, legibilidade em telemóvel, ancoragem Facebook e comportamento multi-marca.
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
- Testar: `npx tsc --noEmit && npm run lint && npm test && npm run build`
- Capturas de revisão: `docs/revisao/correcoes-tipografia/`, `docs/revisao/pandoweb/`, `docs/revisao/composicao/` (e anteriores em `docs/revisao/so-imagem/`, `docs/revisao/fase-ia/`, `docs/revisao/logotipos/`)

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
| 2026-11-17 20:41 | Antigravity | Pedido msg9 Passo 3 concluído: proteção de selos/brasões escuros e contraste de wordmarks multi-tom, 21/21 testes OK, build OK e 5 folhas em `docs/revisao/correcoes-tipografia/` |
