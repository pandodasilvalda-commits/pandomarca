# PandoMarca — Kit de Identidade Visual e Presença Digital para PME

O **PandoMarca** é um produto da **PandoWeb** (https://pandoweb.pt) focado em **geração de imagem pura a partir do logótipo aprovado**. Parte de um logótipo gerado de raiz na **Entrada A** ou carregado pelo utilizador na **Entrada B** e entrega um arquivo ZIP (`pandomarca-{nome-simplificado}.zip`) com **exatamente 38 ficheiros**: variantes, 18 peças para redes sociais (Facebook, Instagram 1:1 e 4:5, Instagram Story, LinkedIn pessoal e página, YouTube, X, Google Perfil de Empresa, WhatsApp Business e TikTok), favicon multi-resolução, assinatura de email HTML, cartão de visita 91×61 mm, papel de carta A4 e guia de marca A4.

Toda a interface, documentação e ficheiros gerados estão em **português europeu (pt-PT)**.

---

## 1. Direitos de Acesso (`website_bonus` e `standalone`)

O PandoMarca distingue dois direitos de acesso de igual peso funcional:

1. **Oferta do website (`website_bonus`)**: atribuído como bónus a clientes que subscrevem um website em `pandoweb.pt`, desbloqueado com código gerado pela PandoWeb.
2. **Produto individual (`standalone`)**: acesso autónomo ao kit sem subscrição de website, através de código próprio (**Preço a definir**). O meio de pagamento do kit individual ainda está em aberto, pelo que nesta versão não há checkout nem cobrança.

---

## 2. Como Correr em Local e Preparar para Deploy (Português Europeu)

### Pré-requisitos
- **Node.js 22+** e `npm`

### Passos de instalação e execução

1. Instale as dependências:
   ```bash
   npm ci
   ```

2. Copie `.env.example` para `.env.local` (nunca guarde chaves ou segredos no repositório):
   ```bash
   cp .env.example .env.local
   ```
   Exemplo de valores apenas para desenvolvimento/testes sem custos em `.env.local`:
   ```env
   KIT_ACCESS_CODE_WEBSITE=kit-website-demo
   KIT_ACCESS_CODE_STANDALONE=kit-individual-demo
   KIT_GATE_SECRET=um-segredo-local
   IMAGEM_MODO=falso
   IMAGEM_FORNECEDOR=gemini
   IMAGEM_MODELO=gemini-nano-banana-2.1
   GEMINI_API_KEY=
   RECRAFT_API_KEY=
   IMAGEM_LIMITE_POR_KIT_EUR=1.5
   IMAGEM_MAX_RONDAS=3
   IMAGEM_MAX_AJUSTES=3
   ```

3. Variáveis de ambiente documentadas:
   - `KIT_ACCESS_CODE_WEBSITE`: código de acesso da oferta do website (`website_bonus`).
   - `KIT_ACCESS_CODE_STANDALONE`: código de acesso do kit individual (`standalone`).
   - `KIT_GATE_SECRET`: segredo HMAC-SHA256 para assinar cookies `HttpOnly` válidos por 12 horas.
   - `IMAGEM_MODO`: `falso` (por omissão, sem custos; deriva imagens das referências aprovadas em `docs/referencias/ia-aprovada/` via `sharp`) ou `real`.
   - `IMAGEM_FORNECEDOR`: `gemini` (por omissão para Nano Banana 2.1) ou `recraft`.
   - `IMAGEM_MODELO`: `gemini-nano-banana-2.1` (por omissão).
   - `GEMINI_API_KEY` / `RECRAFT_API_KEY`: chaves da API (sempre vazias em `.env.example` e sem chamadas ativas pagas nesta fase).
   - `IMAGEM_LIMITE_POR_KIT_EUR`, `IMAGEM_MAX_RONDAS`, `IMAGEM_MAX_AJUSTES`: teto de custo por kit (EUR) e limites configuráveis de rondas e ajustes.

4. Servidor local de desenvolvimento (porta `4317`):
   ```bash
   npm run dev
   ```
   Abra no navegador: **http://127.0.0.1:4317**

5. Verificações obrigatórias:
   ```bash
   npx tsc --noEmit
   npm run lint
   npm test
   ```

6. Compilação e execução de produção (preparado para deploy — **sem publicação automática**):
   ```bash
   npm run build
   npm start
   ```
   Em produção online, configure as variáveis acima no servidor de destino (mantendo `NODE_ENV=production` para ativar cookies `Secure`), nunca expondo segredos nem variáveis privadas no código de cliente.

---

## 3. Arquitetura Só-Imagem, Zonas Seguras e Referência Obrigatória

- **Configuração central das redes sociais (`lib/config/redes-sociais.ts`)**: reúne num único ficheiro os 18 formatos sociais (data de referência **15 de novembro de 2026**), as proporções nativas `aspectRatioGemini` (`1:1`, `4:5`, `9:16`, `16:9`, `21:9`), as áreas `safeZoneDesktop` e `safeZoneMobile`, as sobreposições de avatar (`avatarOverlapDesktop`), as margens de 250 px nos Stories, a zona segura `1546×423` do YouTube e os 6 tons visuais da marca (`tradicional`, `premium`, `jovem`, `tecnico`, `natural`, `divertido`).
- **Geração só por imagem (`lib/imagem/` e `lib/imagem/gemini.ts`)**:
  - `buildNanoBananaRequest` estrutura os pedidos para `gemini-nano-banana-2.1` com inclusão multimodal obrigatória do logótipo escolhido (`inlineData`) em **todas** as peças seguintes (perfis, capas, publicações 1:1 e 4:5, stories).
  - Na Entrada A, o utilizador gera sempre 2 propostas distintas (Clássica com símbolo vs Moderna) com base nos dados e no **Tom visual da marca**, podendo avançar rondas ou ajustar por instrução.
  - Todas as fotos de perfil nascem do emblema do logótipo aprovado e são validadas em máscara circular a **40 px**.
  - Nas peças seguintes geram-se sempre 2 propostas visuais completas (**1 Moderna em camadas + 1 Clássica**), com escolha por vista de computador ou telemóvel.
- **Corte e auditoria de zonas seguras (`lib/capas/safe-zone.ts`)**: `cropResizeToRedeSpec` corta/redimensiona ao tamanho oficial exato e `validarZonaSegura` assinala `precisaRegeneracao = true` caso detete elementos nas margens de 250 px do Story, fora de `1546×423` no YouTube, sob a foto de perfil, nos cantos circulares ou com baixo contraste a 40 px.
- **Aviso «Verifique os textos» e regeneração individual**: cada peça guarda `textosPedidos` (exclusivamente dos campos preenchidos pelo cliente) e mostra **«Verifique os textos»** com botão **`Regenerar`** (`POST /api/kits/[id]`), atualizando o PNG e reconstruindo o ZIP.
- **Vetorização estritamente opcional (`lib/vetorizar.ts`)**: nunca se desenham peças sociais por código ou SVG procedimental; `usarVetorizacaoOpcional` aplica-se exclusivamente a `favicon/*` e `impressao/*` PDF.

---

## 4. Ensaio Obrigatório — Forno da Vilariça

O botão **Preencher ensaio: Forno da Vilariça** no assistente passo a passo preenche:
- **Nome**: Forno da Vilariça
- **Sector**: Restauração
- **Tom visual da marca**: Tradicional (editável entre os 6 tons)
- **Slogan**: «Pão de trigo ao nascer do dia»
- **Serviços**: «Padaria tradicional • Pão em forno a lenha e broa»
- **Localidade**: «Rua do Forno 14, 5160-242 Torre de Moncorvo»
- **Contacto**: Marta Queirós (Mestra Padeira e Sócia-Gerente, `marta@fornodavilarica.pt`, `+351 279 452 180`, `https://fornodavilarica.pt`, NIF `514 892 307`)

---

## 5. O que ainda falta antes de abrir em produção

- **Ligação paga de geração de imagem desativada**: o adaptador `GeminiImagemProvider` (`gemini-nano-banana-2.1`) em `lib/imagem/gemini.ts` encontra-se estruturado com envio multimodal de `inlineData` e proporções nativas, mantendo por agora `IMAGEM_MODO=falso` com derivação via `sharp` a partir de `docs/referencias/ia-aprovada/`, sem chaves nem chamadas externas pagas.
- **Sem pagamentos nem checkout**: o acesso `standalone` tem **preço a definir**; não existe integração Stripe (cartão, MB Way ou Multibanco) nem fluxo de cobrança nesta versão.
- **Sem contas de utilizador nem base de dados**: a entrada é feita por validação de códigos de ambiente (`website_bonus` e `standalone`) com cookie `HttpOnly` assinado válido por 12 horas, e os rascunhos/kits são guardados temporariamente em disco local (`/tmp`).
- **Revisão humana PandoWeb e publicação ativa em aberto**: falta definir o domínio final (por exemplo `marca.pandoweb.pt`), políticas de emissão de códigos por cliente, revisão humana opcional pela equipa PandoWeb e chaves de produção.
- **Especificação técnica detalhada**: consulte [`docs/SPEC.md`](docs/SPEC.md) para a lista oficial dos 38 formatos com fontes documentadas (data de referência: 15 de novembro de 2026).
