# PandoMarca — Kit de Identidade Visual e Presença Digital para PME

O **PandoMarca** é um produto da **PandoWeb** (https://pandoweb.pt) que parte de um logótipo (criado de raiz na **Entrada A** ou carregado pelo utilizador na **Entrada B**) e entrega um arquivo ZIP (`pandomarca-{nome-simplificado}.zip`) com **exactamente 36 ficheiros** nas medidas oficiais de redes sociais, favicon, assinatura de email em HTML, estacionário para impressão (cartão de visita europeu 91×61 mm com sangria de 3 mm em duas páginas e papel de carta A4) e guia de marca A4 de uma página.

Toda a interface, documentação e ficheiros gerados estão em **português europeu (pt-PT)**.

---

## 1. Direitos de Acesso (`website_bonus` e `standalone`)

O PandoMarca distingue dois direitos de acesso de igual peso funcional:

1. **Oferta do website (`website_bonus`)**: atribuído como bónus a clientes que subscrevem um website PandoWeb. A criação do website é 0 € e a subscrição publicada em `pandoweb.pt` é de **160 € + IVA por ano** (alojamento, domínio, email, SSL e backups — este valor refere-se à subscrição do website, não ao preço do kit).
2. **Produto individual (`standalone`)**: destinado a clientes que adquiram ou subscrevam o PandoMarca de forma independente com código próprio. O preço e o meio de pagamento do kit individual ainda estão em aberto, pelo que nesta versão não há checkout, não se apresenta preço para o kit e não se efectua qualquer cobrança.

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
   IMAGEM_FORNECEDOR=
   IMAGEM_MODELO=
   GEMINI_API_KEY=
   RECRAFT_API_KEY=
   IMAGEM_LIMITE_POR_KIT_EUR=1.5
   IMAGEM_MAX_RONDAS=3
   IMAGEM_MAX_AJUSTES=3
   ```

3. Variáveis de ambiente documentadas:
   - `KIT_ACCESS_CODE_WEBSITE`: código de acesso da oferta do website (`website_bonus`).
   - `KIT_ACCESS_CODE_STANDALONE`: código de acesso do kit individual (`standalone`).
   - `KIT_GATE_SECRET`: segredo HMAC-SHA256 para assinar cookies `HttpOnly`.
   - `IMAGEM_MODO`: `falso` (por omissão, sem custos; usa amostras locais em `tests/fixtures/`) ou `real`.
   - `IMAGEM_FORNECEDOR`: fornecedor futuro (`gemini` ou `recraft`).
   - `IMAGEM_MODELO`: identificador do modelo quando `IMAGEM_MODO=real`.
   - `GEMINI_API_KEY` / `RECRAFT_API_KEY`: chaves da API (sempre vazias em `.env.example` e sem chamadas ativas nesta fase).
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

## 3. Camada de IA Trocável, Vetorização Local e Capas Nascidas do Logótipo

- **Camada encaixável em `lib/imagem/`**: interface unificada (`gerar`, `editar`, `removerFundo`, `vetorizar`), adaptadores estruturais vazios `gemini.ts` e `recraft.ts` (sem chamadas pagas), controlador de custo por kit (`lib/imagem/custo.ts`) com bloqueio acima do limite e prompts em `lib/imagem/prompts/*.md` (logótipos sem slogans nem texto extra; capas/fundos sem texto nenhum). O gerador geométrico (`lib/logo-generator/svg-studio.ts`) permanece disponível como reserva gratuita.
- **Vetorização local gratuita (`lib/vetorizar.ts`)**: utiliza `@neplex/vectorizer` (`vtracer`) e `potrace` para converter em SVG limpo com redução até 8 cores e tamanho inferior a 200 KB, seguido de ecrã **Confirmar vetor** com comparação Original vs Vetor e pré-visualização dedicada a 32 px (versões clara e escura). Todas as 5 variantes oficiais saem diretamente do vetor confirmado.
- **Capas e publicações nascidas do logótipo (`lib/capas/` e `lib/imagem/referencia.ts`)**: o prompt de cada capa e publicação Instagram recebe a referência do logótipo escolhido (`logotipoReferencia`), a paleta e o ADN visual (`logotipoDna` — formas, motivos e estilo), compondo em código apenas o logótipo vetorizado adaptado, as zonas seguras por plataforma (YouTube `1544×423`, avatares inferiores à esquerda), contraste WCAG AA e os textos reais do cliente (linhas vazias omitidas). Mantém o catálogo de 6 layouts (3 modernos, 3 clássicos) com propostas 1 Moderna + 1 Clássica.

---

## 4. Ensaio Obrigatório — Forno da Vilariça

O botão **Preencher ensaio: Forno da Vilariça** no assistente passo a passo preenche:
- **Nome**: Forno da Vilariça
- **Sector**: Restauração e Alimentação
- **Slogan**: «Pão de trigo ao nascer do dia»
- **Serviços**: «Padaria tradicional • Pão em forno a lenha e broa»
- **Localidade**: «Rua do Forno 14, 5160-242 Torre de Moncorvo»
- **Contacto**: Marta Queirós (Mestra Padeira e Sócia-Gerente, `marta@fornodavilarica.pt`, `+351 279 452 180`, `https://fornodavilarica.pt`, NIF `514 892 307`)

---

## 5. Documentação Técnica e Decisões em Aberto

Consulte [`docs/SPEC.md`](docs/SPEC.md) para a especificação dos 36 ficheiros com ligações oficiais (data de referência: 15 de novembro de 2026) e decisões futuras (pagamentos Stripe, contas, revisão humana PandoWeb e domínio final).

