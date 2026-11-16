# Especificação Técnica e Funcional — PandoMarca

## 1. Visão Geral e Contexto

O **PandoMarca** é um produto da **PandoWeb** (https://pandoweb.pt), agência web portuguesa focada em PME. A aplicação parte de um logótipo (criado de raiz ou carregado pelo utilizador) e gera de forma determinística o kit completo de identidade visual e presença digital de que uma PME precisa: variantes do logótipo, redes sociais e perfis, favicon completo, assinatura de email em HTML, estacionário para impressão (cartão de visita com marcas de corte e sangria, e papel de carta A4), guia de marca A4 de uma página, paleta e documentação tipográfica — num total exacto de **36 ficheiros** prontos a descarregar num arquivo ZIP (`pandomarca-{nome-simplificado}.zip`).

Toda a interface, mensagens de erro, documentação e ficheiros gerados estão redigidos em **português europeu (pt-PT)**.

### Direitos de Acesso (`Entitlement`)

O produto distingue dois tipos de direito de acesso com igual peso funcional (o kit gerado é idêntico em ambos):

1. **Oferta do website (`website_bonus`)**: atribuído como bónus a clientes que subscrevem um website PandoWeb (cuja criação do site é 0 € e a subscrição publicada em pandoweb.pt é de 160 € + IVA por ano, incluindo alojamento, domínio, email, SSL e backups — valor referente à subscrição do website e não ao preço do kit).
2. **Produto individual (`standalone`)**: destinado a clientes que adquiram ou subscrevam o PandoMarca de forma avulsa com código próprio. Nesta versão não existe checkout, não se apresenta preço para o kit individual e não se efectuam cobranças.

Modelo previsto no código para evolução futura:

```ts
export type EntitlementKind = "website_bonus" | "standalone";
export type EntitlementStatus = "active" | "revoked" | "expired";

export interface Entitlement {
  id: string;
  kind: EntitlementKind;
  status: EntitlementStatus;
  clientId?: string;
  code: string;
  websiteSubscriptionId?: string; // apenas em website_bonus
  purchaseId?: string;            // apenas em standalone, quando existir pagamento
  expiresAt: string;
}
```

---

## 2. Fluxos de Utilização

### Regra das 2 Escolhas
Após a recolha dos dados iniciais da marca, e em cada etapa criativa ou grupo de conteúdos, o utilizador vê sempre **duas propostas claramente distintas lado a lado**, com possibilidade de pedir mais opções ou abrir o catálogo completo:
- **Logótipo de raiz (Entrada A)**: 2 direções iniciais distintas em forma, carácter e tipografia; depois 2 versões afinadas da direção escolhida, com botão «Mostrar outras 2» até um máximo de 3 rondas.
- **Paleta e tipografia**: 2 propostas imediatas («Direta» e «Contrastada»), com o botão «Ver mais propostas» que revela mais duas («Clara» e «Afinada»).
- **Estilo do kit e estilo por grupo de peças**: 2 recomendações iniciais ajustadas ao sector de atividade, mais o botão «Ver catálogo» para escolher qualquer um dos 6 estilos.

### 2.1 Sequência Comum
1. O utilizador escolhe a entrada (**Entrada A** — criar logótipo de raiz, ou **Entrada B** — usar logótipo existente) ou acede a «Criar kit».
2. Introduz o código de acesso. O servidor valida o código face às variáveis de ambiente (`KIT_ACCESS_CODE_WEBSITE` ou `KIT_ACCESS_CODE_STANDALONE`), identifica o tipo (`website_bonus` ou `standalone`) e guarda a sessão num cookie `HttpOnly`, `SameSite=lax`, com validade de 12 horas (`secure` em produção).
3. Preenche os dados da marca (nome, sector, slogan, pessoa, cargo, contactos, NIF e lista curta de serviços).
4. **Na Entrada A**: responde ao questionário de marca, carrega 1 a 5 imagens de referência com nota sobre o que agrada em cada uma, escolhe entre 2 direções de logótipo, refina entre 2 versões afinadas (até 3 rondas) e obtém as variantes finais (horizontal, vertical, símbolo, monocromático e negativo).
5. **Na Entrada B**: carrega um ficheiro PNG, JPG ou SVG (até 8 MB) ou experimenta um exemplo embutido («Forno da Vilariça» ou «Oficina do São»). O servidor analisa transparência, remove fundo liso ligado à margem preservando brancos interiores fechados, extrai a paleta dos píxeis opacos e avalia a nitidez.
6. Escolhe entre 2 propostas de paleta e par tipográfico (ou vê as 4 propostas e edita cores manualmente, recalculando-se o neutro entre papel e tinta).
7. Escolhe o estilo global do kit entre 2 recomendações do sector (ou abre o catálogo de 6 estilos) e, opcionalmente, ajusta o estilo de cada grupo de peças (Capas, Publicação, Story, Cartão, Papel de carta, Assinatura). Se escolher o estilo `fotografia`, carrega a fotografia pretendida.
8. O servidor gera de forma determinística os 36 ficheiros e o arquivo ZIP.
9. O utilizador pré-visualiza todas as peças no browser organizadas por grupo e descarrega o ficheiro `pandomarca-{nome-simplificado}.zip`.

---

## 3. Ecrãs da Aplicação

A navegação principal é permanentemente visível em computador e em telemóvel (**Início**, **Formatos**, **Criar kit**), sem depender de um menu escondido num ícone hamburger.

| Ecrã | Rota / Vista | Função |
| :--- | :--- | :--- |
| **Início** | `/` | Apresenta o PandoMarca, explica as duas formas de acesso (`website_bonus` com contexto dos 160 € + IVA/ano da subscrição do website e `standalone` sem preço definido), resume o conteúdo do ZIP de 36 ficheiros e esclarece o que ainda não faz parte desta versão. |
| **Formatos** | `/formatos` | Lista detalhada das 36 peças do kit, com medidas exactas, formato de ficheiro, notas técnicas e ligações para as fontes oficiais (data de referência: 15 de novembro de 2026). |
| **Acesso** | `/criar` (passo código) | Pede o código de acesso e valida o direito (`website_bonus` ou `standalone`), tratando também o estado de variáveis de ambiente por configurar. |
| **Escolha da entrada** | `/criar` (passo entrada) | Permite optar entre **Entrada A** (criar logótipo de raiz) e **Entrada B** (usar um logótipo já existente). |
| **Entrada A — Questionário** | `/criar` (A.1) | Recolhe nome, slogan, sector, três palavras da marca, cores preferidas, cores a evitar, dados de contacto/serviços e 1 a 5 imagens de referência com nota descritiva por imagem. |
| **Entrada A — Direções** | `/criar` (A.2) | Mostra 2 direções originais lado a lado (ex.: Clássica Estruturada vs. Contemporânea Editorial), cada uma com logótipo vectorial, paleta e par de tipos. |
| **Entrada A — Refinamento** | `/criar` (A.3) | Mostra 2 versões afinadas da direção escolhida, com botão «Mostrar outras 2» disponível até 3 rondas. |
| **Entrada A — Variantes finais** | `/criar` (A.4) | Apresenta as variantes horizontal, vertical, símbolo, monocromático e negativo antes de passar às propostas do kit. |
| **Entrada B — Dados e Ficheiro** | `/criar` (B.1) | Carregamento de logótipo (PNG, JPG, SVG até 8 MB), botões de ensaio rápido («Forno da Vilariça» e «Oficina do São»), diagnóstico de fundo e nitidez (com sugestão de redesenho na Entrada A se a resolução for baixa) e formulário de dados da marca. |
| **Propostas** | `/criar` (Propostas) | Duas propostas distintas de paleta e par tipográfico lado a lado, botão «Ver mais propostas» (4 no total) e afinação manual das 4 cores base com recálculo automático do neutro. |
| **Estilos** | `/criar` (Estilos) | Duas recomendações de estilo para o kit inteiro mais catálogo dos 6 estilos (`liso`, `degrade`, `padrao`, `informativo`, `fotografia`, `minimal`), e afinação individual por grupo de conteúdos. |
| **Pré-visualização e ZIP** | `/criar` (Resultado) | Galeria com todas as peças geradas agrupadas por categoria, indicação de medidas e formatos, pré-visualização da assinatura HTML e botão de descarregamento do ZIP com 36 ficheiros. |
| **Erro** | Estados inline / página de erro | Mensagens claras em pt-PT com ação de recuperação ou nova tentativa (sem ficheiro, ficheiro ilegível, SVG inseguro, código inválido, acesso por configurar, rascunho expirado, fotografia em falta). |

---

## 4. Lista Exacta de Formatos e Fontes Oficiais

Data de referência das especificações das plataformas: **15 de novembro de 2026**.
O arquivo ZIP denomina-se `pandomarca-{nome-simplificado}.zip` e contém uma pasta de topo `pandomarca-{nome-simplificado}/` com **exactamente 36 ficheiros**:

### 4.1 Variantes do Logótipo (5 ficheiros)
| Ficheiro | Medida | Notas |
| :--- | :--- | :--- |
| `variantes/logotipo-principal.png` | Medida do original processado | Fundo transparente |
| `variantes/icone.png` | `1024×1024 px` | Símbolo / ícone isolado com fundo transparente |
| `variantes/logotipo-horizontal.png` | `1800×560 px` | Versão horizontal (se o original for apenas símbolo, compõe o nome da marca no tipo de título) |
| `variantes/fundo-claro.png` | `1200×1200 px` | Aplicado sobre fundo claro (`papel`) |
| `variantes/fundo-escuro.png` | `1200×1200 px` | Aplicado sobre fundo escuro (`tinta`); logótipos escuros sem cor passam a branco, logótipos coloridos preservam as cores com contraste |

### 4.2 Redes Sociais e Perfis (16 ficheiros PNG)
| Peça | Ficheiro | Medida | Fonte Oficial e Notas |
| :--- | :--- | :--- | :--- |
| Facebook, foto de perfil | `facebook/foto-de-perfil.png` | `320×320 px` | [Facebook Help](https://www.facebook.com/help/125379114252045). Apresentado em círculo (176×176 em computador, 196×196 em telemóvel). Desenho contido na zona segura circular. |
| Facebook, capa | `facebook/capa.png` | `851×315 px` | [Facebook Help](https://www.facebook.com/help/125379114252045). Mínimo 400×150. A foto de perfil sobrepõe-se à zona inferior esquerda, pelo que o logótipo e o texto evitam essa área. |
| Instagram, foto de perfil | `instagram/foto-de-perfil.png` | `320×320 px` | [Ajuda do Instagram](https://help.instagram.com/1631821640426723). Largura mínima preservada de 320 px; composição inscrita em círculo. |
| Instagram, publicação | `instagram/publicacao-1080.png` | `1080×1080 px` | [Ajuda do Instagram](https://help.instagram.com/1631821640426723). Quadrado na largura máxima preservada de 1080 px. Usa o estilo selecionado para Publicação. |
| Instagram, story | `instagram/story-1080x1920.png` | `1080×1920 px` | [Guia de anúncios da Meta para Stories](https://www.facebook.com/business/ads-guide/update/image/instagram-story). Proporção 9:16; texto e logótipo fora das faixas superior e inferior da interface. |
| X, foto de perfil | `x/foto-de-perfil.png` | `400×400 px` | [Ajuda do X](https://help.x.com/en/managing-your-account/how-to-customize-your-profile). Quadrado apresentado em máscara circular. |
| X, cabeçalho | `x/cabecalho.png` | `1500×500 px` | [Ajuda do X](https://help.x.com/en/managing-your-account/how-to-customize-your-profile). Proporção 3:1; o canto inferior esquerdo é reservado para a sobreposição da foto de perfil. |
| YouTube, foto de perfil | `youtube/foto-de-perfil.png` | `800×800 px` | [YouTube Help](https://support.google.com/youtube/answer/10456525). Ficheiro de origem a 800×800 px para garantir nitidez na miniatura de 98×98 px. |
| YouTube, banner | `youtube/banner.png` | `2560×1440 px` | [YouTube Help](https://support.google.com/youtube/answer/10456525). Fundo estendido a toda a tela (TV) e conteúdo centrado na zona segura escalada de `1544×423 px` (sem moldura visível). |
| LinkedIn, perfil pessoal | `linkedin/perfil-pessoal.png` | `400×400 px` | [LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a549049). Mínimo quadrado oficial (aceita de 400×400 a 7680×4320). |
| LinkedIn, capa pessoal | `linkedin/capa-pessoal.png` | `1584×396 px` | [LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a568217). Proporção 4:1 com zona inferior esquerda livre da foto de perfil. |
| LinkedIn, logótipo da empresa | `linkedin/perfil-empresa.png` | `400×400 px` | [LinkedIn Help, Páginas](https://www.linkedin.com/help/linkedin/answer/a563309). Recomendado 400×400 px (mínimo 268×268 px). |
| LinkedIn, capa da empresa | `linkedin/capa-empresa.png` | `1512×256 px` | [LinkedIn Help, Páginas](https://www.linkedin.com/help/linkedin/answer/a563309). Medida recomendada atualizada de 1512×256 px. |
| WhatsApp Business, foto de perfil | `whatsapp-business/foto-de-perfil.png` | `640×640 px` | [Documentação On-Premises Meta](https://developers.facebook.com/docs/whatsapp/on-premises/reference/settings/profile/photo/). Fundo obrigatoriamente opaco. |
| Google Business, logótipo | `google-business/logotipo.png` | `720×720 px` | [Google Business Profile Help](https://support.google.com/business/answer/6103862). Recomendado 720×720 px (mínimo 250×250 px). |
| Google Business, capa | `google-business/capa.png` | `1024×576 px` | [Google Business Profile Help](https://support.google.com/business/answer/6103862). Proporção 16:9 a 1024×576 px. |

### 4.3 Favicon (6 ficheiros)
| Ficheiro | Medida | Fonte Oficial e Notas |
| :--- | :--- | :--- |
| `favicon/favicon.ico` | `16×16`, `32×32` e `48×48 px` | [Google Search Central](https://developers.google.com/search/docs/appearance/favicon). Contentor ICO multi-resolução com as 3 medidas embebidas. |
| `favicon/favicon-32x32.png` | `32×32 px` | Ícone de separador para ecrãs de alta densidade. |
| `favicon/apple-touch-icon.png` | `180×180 px` | [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/app-icons). Fundo obrigatoriamente opaco. |
| `favicon/icon-192.png` | `192×192 px` | [web.dev, manifesto](https://web.dev/articles/add-manifest). Ícone para Web App Manifest. |
| `favicon/icon-512.png` | `512×512 px` | [web.dev, manifesto](https://web.dev/articles/add-manifest). Ícone de alta resolução para PWA. |
| `favicon/site.webmanifest` | JSON | Aponta para `icon-192.png` e `icon-512.png` e inclui `theme_color` e `background_color` do kit. |

### 4.4 Email, Impressão, Guia e Metadados (9 ficheiros)
| Ficheiro | Medida | Notas |
| :--- | :--- | :--- |
| `email/assinatura.html` | HTML | Tabela com CSS inline compatível com clientes de email; sem imagens de fundo; inclui NIF se preenchido. |
| `email/logotipo-assinatura.png` | Altura exacta `128 px` (máx. largura `480 px`) | Apresentado a 64 px de altura (`height="64"`) no código HTML da assinatura para nitidez Retina/HiDPI. |
| `impressao/cartao-de-visita.pdf` | Página `91×61 mm` (corte `85×55 mm`, sangria `3 mm`), 2 páginas | Frente e verso com `TrimBox` e `BleedBox` definidos no PDF e marcas de corte discretas na margem de sangria. |
| `impressao/papel-de-carta.pdf` | `210×297 mm` (A4, [ISO 216](https://www.iso.org/obp/ui#iso:std:iso:216:ed-2:en)), 1 página | Cabeçalho com o estilo selecionado, corpo central branco para escrita e rodapé com contactos e campo NIF (preenchido ou com linha para preenchimento). |
| `guia-de-marca/guia-de-marca.pdf` | `210×297 mm` (A4), 1 página | Síntese visual da marca: variantes do logótipo, 5 cores da paleta com valores HEX e RGB, e o par tipográfico com regras de uso. |
| `paleta/paleta.json` | JSON | As 5 cores do kit (`primaria`, `secundaria`, `papel`, `tinta`, `neutro`) em HEX e RGB. |
| `paleta/amostra.svg` | SVG | Amostra vectorial das cinco cores da paleta com os respetivos códigos. |
| `tipografia/tipos.txt` | TXT | Identificação das famílias de título e texto, pesos e endereço para o par no Google Fonts. |
| `LEIA-ME.txt` | TXT | Guia em português europeu explicando onde e como utilizar cada pasta e ficheiro do kit. |

---

## 5. Arquitetura e Stack Tecnológica

- **Framework**: Next.js (App Router) com TypeScript.
- **Estilos e UI**: Tailwind CSS e componentes inspirados em shadcn/ui, desenhados com estética editorial de agência.
- **Processamento de imagem e documentos no servidor**:
  - `sharp` — análise de canal alfa, remoção flood-fill de fundo liso ligado às margens, extração de paleta cromática, geração de variantes e ícones.
  - `satori` + `@resvg/resvg-js` — composição determinística de peças gráficas em SVG com fontes locais e rasterização em PNG nas medidas exactas. As camadas de fundo (degradê, padrão, fotografia com véu escuro) são sempre desenhadas abaixo da camada de conteúdo (logótipo, nome, slogan e contactos), garantindo legibilidade absoluta.
  - `pdf-lib` — geração de ficheiros PDF com dimensões físicas em pontos PostScript (`1 mm = 72 / 25.4 pt`), incluindo `TrimBox` e `BleedBox` no cartão de visita (`91×61 mm`) e formato A4 (`210×297 mm`) no papel de carta e guia de marca.
  - `jszip` — empacotamento dos 36 ficheiros em memória e gravação em disco temporário.
- **Tipografia Local (Fontsource OFL)**:
  - `@fontsource/fraunces`, `@fontsource/plus-jakarta-sans`, `@fontsource/space-grotesk`, `@fontsource/instrument-serif`, `@fontsource/cormorant-garamond`, `@fontsource/source-sans-3`, `@fontsource/rubik`, `@fontsource/nunito`, `@fontsource/ibm-plex-sans` e `@fontsource/inter`. Carregadas diretamente a partir de `node_modules` em disco, sem chamadas de rede durante a geração.
- **Gerador de Logótipo de Raiz (Entrada A) e IA Plugável**:
  - `lib/logo-generator/svg-studio.ts`: motor paramétrico próprio em SVG que cria símbolos, monogramas entrelaçados, emblemas arquitectónicos e insígnias editoriais à medida do nome, iniciais, sector e palavras-chave da marca, sobre grelha óptica rigorosa.
  - `lib/logo-generator/ai-provider.ts`: interface plugável configurada via `AI_IMAGE_PROVIDER` e `AI_IMAGE_API_KEY`. Quando as variáveis estão vazias (por omissão), utiliza o gerador vectorial próprio sem erros nem bloqueios.
- **Armazenamento Temporário**:
  - Rascunhos guardados em `os.tmpdir()/pandomarca/rascunhos` (TTL de 2 horas) e kits gerados em `os.tmpdir()/pandomarca/kits` (TTL de 6 horas).

---

## 6. Roadmap e Faseamento

- **Fase 1 — Entrada B, kit e formatos (Implementada)**: Porta de acesso por código (`website_bonus` / `standalone`), carregamento e análise de logótipo (PNG/JPG/SVG), remoção inteligente de fundo liso ligado à margem, extração de paleta, variantes do logótipo, geração dos 36 ficheiros nas medidas exactas, pré-visualização e descarregamento do ZIP, e bateria de testes automáticos de dimensões.
- **Fase 2 — Duas propostas, estilos, publicação e story (Implementada)**: Quatro propostas distintas de paleta e tipografia (2 visíveis + «Ver mais propostas»), catálogo de 6 estilos de conteúdo (`liso`, `degrade`, `padrao`, `informativo`, `fotografia`, `minimal`), recomendações por sector para o kit e por grupo de peças, publicação `1080×1080` e story `1080×1920`, e testes automáticos nos 6 estilos.
- **Fase 3 — Logótipo de raiz / Entrada A (Implementada)**: Questionário completo com carregamento de 1 a 5 referências e notas, geração de 2 direções claramente distintas, refinamento em 2 versões afinadas com até 3 rondas («Mostrar outras 2»), variantes finais (horizontal, vertical, símbolo, monocromático e negativo), fornecedor de IA plugável por ambiente com fallback para o motor SVG de estúdio, e ensaio completo com a marca **Forno da Vilariça**.
- **Fase 4 — Fora de âmbito nesta versão (Futuro)**: Contas de utilizador, base de dados persistente, emissão automática de códigos por cliente, checkout e pagamentos (Stripe com cartão, MB Way e Multibanco para o kit individual), fluxo de revisão humana pela equipa PandoWeb e publicação num domínio de produção.

---

## 7. Decisões em Aberto (Não Fechadas Nesta Versão)

As seguintes matérias permanecem deliberadamente em aberto para decisão futura da PandoWeb e não são assumidas como fechadas no código:

1. **Preço e meio de pagamento do kit individual (`standalone`)**: ainda por definir se será pagamento único ou subscrição, qual o valor em euros e quando avançar com a integração Stripe (cartão, MB Way e Multibanco).
2. **Duração do direito `website_bonus`**: definir se o acesso ao PandoMarca e às respetivas atualizações se mantém apenas enquanto a subscrição anual do website PandoWeb (160 € + IVA/ano) estiver ativa ou se o código inicial permite regenerações posteriores.
3. **Fornecedor concreto de IA de imagem**: a arquitetura disponibiliza a interface encaixável (`AI_IMAGE_PROVIDER`, `AI_IMAGE_API_KEY`, `AI_IMAGE_ENDPOINT`, `AI_IMAGE_MODEL`), ficando em aberto a escolha comercial de um fornecedor externo.
4. **Limite de rondas na Entrada A**: nesta versão o botão «Mostrar outras 2» permite até 3 rondas de refinamento; fica em aberto se esse limite se mantém fixo ou configurável por tipo de acesso.
5. **Fotografia na assinatura de email**: nesta versão a assinatura usa exclusivamente tabelas HTML e cores sólidas (sem imagens de fundo, dado o bloqueio frequente nos clientes de email); fica em aberto se alguma variante futura poderá incluir miniatura fotográfica lateral opcional.
6. **Sangria do cartão de visita**: fixada em `3 mm` (página `91×61 mm` para corte `85×55 mm`) nesta versão; poderá no futuro aceitar parametrização para gráficas que peçam `2 mm` ou formato ISO/IEC 7810 ID-1.
7. **Tamanho de origem da foto de perfil do YouTube**: mantido em `800×800 px` como ficheiro de origem para garantir nitidez na apresentação a `98×98 px`.
8. **Proporção e resolução da capa do Google Business**: mantida em `1024×576 px` (16:9) como decisão de produção; a monitorizar caso a Google volte a publicar uma dimensão única oficial.
9. **Ficheiro extra para anúncios de Instagram Story (`1440×2560 px`)**: o guia de anúncios da Meta recomenda `1440×2560 px` para anúncios pagos; fica em aberto se uma versão futura acrescentará um 37.º ficheiro específico para tráfego pago além do `1080×1920 px` orgânico.
10. **Prazo, âmbito e preço de uma revisão humana opcional**: em aberto como funcionará o serviço de afinação manual por um designer da PandoWeb.
11. **Domínio de produção**: `marca.pandoweb.pt` é apenas uma hipótese exemplificativa, ainda em aberto.
