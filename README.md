# PandoMarca — Kit de Identidade Visual e Presença Digital para PME

O **PandoMarca** é um produto da **PandoWeb** (https://pandoweb.pt) que parte de um logótipo (criado de raiz na **Entrada A** ou carregado pelo utilizador na **Entrada B**) e entrega um arquivo ZIP (`pandomarca-{nome-simplificado}.zip`) com **exactamente 36 ficheiros** nas medidas oficiais de redes sociais, favicon, assinatura de email em HTML, estacionário para impressão (cartão de visita europeu 91×61 mm com sangria de 3 mm em duas páginas e papel de carta A4) e guia de marca A4 de uma página.

Toda a interface, documentação e ficheiros gerados estão em **português europeu (pt-PT)**.

---

## 1. Direitos de Acesso (`website_bonus` e `standalone`)

O PandoMarca distingue dois direitos de acesso de igual peso funcional:

1. **Oferta do website (`website_bonus`)**: atribuído como bónus a clientes que subscrevem um website PandoWeb. A criação do website é 0 € e a subscrição publicada em `pandoweb.pt` é de **160 € + IVA por ano** (alojamento, domínio, email, SSL e backups — este valor refere-se à subscrição do website, não ao preço do kit).
2. **Produto individual (`standalone`)**: destinado a clientes que adquiram ou subscrevam o PandoMarca de forma independente com código próprio. O preço e o meio de pagamento do kit individual ainda estão em aberto, pelo que nesta versão não há checkout, não se apresenta preço para o kit e não se efectua qualquer cobrança.

---

## 2. Como Correr em Local (`http://127.0.0.1:4317`)

### Pré-requisitos
- **Node.js 22+** e `npm`

### Passos de instalação e execução

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Copie o ficheiro `.env.example` para `.env.local` e preencha os valores de desenvolvimento local:
   ```bash
   cp .env.example .env.local
   ```
   Exemplo de valores apenas para desenvolvimento local em `.env.local`:
   ```env
   KIT_ACCESS_CODE_WEBSITE=kit-website-demo
   KIT_ACCESS_CODE_STANDALONE=kit-individual-demo
   KIT_GATE_SECRET=um-segredo-local
   AI_IMAGE_PROVIDER=
   AI_IMAGE_API_KEY=
   AI_IMAGE_ENDPOINT=
   AI_IMAGE_MODEL=
   ```
   > **Nota de segurança**: Nunca utilize estes valores em produção e nunca guarde chaves ou segredos reais no repositório.

3. Inicie o servidor de desenvolvimento (configurado na porta `4317`):
   ```bash
   npm run dev
   ```
   Abra no navegador: **http://127.0.0.1:4317**

4. Para executar a bateria de testes automáticos (validação de acessos, segurança SVG, remoção de fundo, 6 estilos, Entrada A e medidas exactas dos 36 ficheiros):
   ```bash
   npm test
   ```

5. Para validar a compilação de produção sem avisos:
   ```bash
   npm run build
   ```

---

## 3. Fornecedor de IA Encaixável e Gerador Vectorial SVG

Na **Entrada A (logótipo de raiz)**, a aplicação suporta duas vias:
- **Gerador próprio em SVG (`lib/logo-generator/svg-studio.ts`)**: disponível sempre, sem custos de API e sem chaves externas. Compõe símbolos originais desenhados para o sector e iniciais da marca com tipografia Fontsource convertida em curvas vectoriais.
- **Fornecedor de IA por variáveis de ambiente (`lib/logo-generator/ai-provider.ts`)**: configurável através de `AI_IMAGE_PROVIDER`, `AI_IMAGE_API_KEY`, `AI_IMAGE_ENDPOINT` e `AI_IMAGE_MODEL`. Quando vazias (configuração por omissão), a aplicação usa automaticamente o gerador SVG próprio sem interromper o fluxo.

---

## 4. Ensaio Obrigatório — Forno da Vilariça

Tanto na **Entrada A** como na **Entrada B** existe um botão de preenchimento rápido para percorrer e validar o ensaio completo da marca fictícia **Forno da Vilariça**:
- **Nome**: Forno da Vilariça
- **Sector**: Restauração (Padaria)
- **Slogan**: «Pão de trigo ao nascer do dia»
- **Serviços**: «Pão, broa e bolos de festa»
- **Contacto**: Marta Queirós (Mestra Padeira e Sócia-Gerente, `marta@fornodavilarica.pt`, `+351 279 452 180`, `https://fornodavilarica.pt`, `Largo da Feira 14, 5360-310 Vila Flor`, NIF `514 892 307`)

Além do Forno da Vilariça, a aplicação inclui também o exemplo histórico **Oficina do São**.

---

## 5. Documentação Técnica e Decisões em Aberto

Consulte [`docs/SPEC.md`](docs/SPEC.md) para a especificação detalhada do fluxo, ecrãs, tabela das 36 peças com ligações para as fontes oficiais (data de referência: 15 de novembro de 2026), arquitetura e lista de decisões em aberto (pagamentos Stripe, contas de utilizador, revisão humana e domínio de produção).
