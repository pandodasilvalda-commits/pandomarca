# Especificação Técnica e Funcional — PandoMarca

## 1. Visão Geral e Contexto

O **PandoMarca** é um produto da **PandoWeb** (https://pandoweb.pt), agência web portuguesa focada em PME. A aplicação segue uma arquitetura **só de geração de imagem** (sem composição por regras SVG nas peças visuais): parte de um logótipo (gerado de raiz na Entrada A ou carregado pelo utilizador na Entrada B), utiliza esse logótipo escolhido como **imagem de referência obrigatória** em todos os pedidos seguintes (`aspectRatio` nativo + zona segura livre), corta/redimensiona no servidor com auditoria automática de zonas seguras e entrega um arquivo ZIP (`pandomarca-{nome-simplificado}.zip`) com **exatamente 38 ficheiros**.

Toda a interface, mensagens de erro, documentação e ficheiros gerados estão redigidos em **português europeu (pt-PT)**.

### Direitos de Acesso (`Entitlement`)

O produto distingue dois tipos de direito de acesso com igual peso funcional (o kit gerado é idêntico em ambos):

1. **Oferta do website (`website_bonus`)**: atribuído como bónus a clientes que subscrevem um website PandoWeb, desbloqueado com código próprio gerado pela PandoWeb.
2. **Produto individual (`standalone`)**: destinado a clientes que adquiram ou subscrevam o PandoMarca de forma avulsa com código próprio (**Preço a definir**). Nesta versão não existe checkout nem cobrança.

Modelo no código para evolução futura:

```ts
export type EntitlementKind = "website_bonus" | "standalone";
export type EntitlementStatus = "active" | "revoked" | "expired";

export interface Entitlement {
  id: string;
  kind: EntitlementKind;
  status: EntitlementStatus;
  clientId?: string;
  code: string;
  websiteSubscriptionId?: string;
  purchaseId?: string;
  expiresAt: string;
}
```

---

## 2. Fluxo Só-Imagem e Assistente em 7 Passos

1. **Passo 1 — Acesso**: Valida o código face às variáveis de ambiente (`KIT_ACCESS_CODE_WEBSITE` ou `KIT_ACCESS_CODE_STANDALONE`), identifica `website_bonus` ou `standalone` e guarda a sessão em cookie `HttpOnly`, `SameSite=lax` por 12 horas (`secure` em produção).
2. **Passo 2 — Dados da marca e Tom visual (`TomDaMarca`)**: Recolhe dados reais (nome, setor, slogan, pessoa, cargo, contactos, NIF, serviços), palavras-chave/cores e o **Tom visual da marca** (`tradicional`, `premium`, `jovem`, `tecnico`, `natural`, `divertido`). Inclui a opção discreta `usarVetorizacaoOpcional` (desativada por omissão, restrita apenas a favicon e PDFs de impressão).
3. **Passo 3 — Logótipo (Referência Obrigatória)**:
   - **Entrada A**: gera 2 propostas de logótipo distintas (Clássica com símbolo vs Moderna) ajustadas ao tom e setor, com rondas adicionais (até 3) e ajustes por instrução (até 3).
   - **Entrada B**: analisa transparência, remove fundo liso ligado à margem preservando brancos fechados interiores, extrai paleta e confirma o logótipo como referência visual do kit.
4. **Passo 4 — Paleta & Tipos**: Duas propostas imediatas («Direta» e «Contrastada») ou catálogo de 4, com afinação manual e recálculo do neutro.
5. **Passo 5 — Propostas das peças (Moderna em camadas vs Clássica)**: Com o logótipo escolhido como referência visual obrigatória (`inlineData`), gera 2 propostas completas por rede social (perfis gerados do emblema testados a 40 px, capas, publicações 4:5 e 1:1, story), mostra sobreposição de **zonas seguras em computador e telemóvel**, exibe **`«Verifique os textos»`** com os `textosPedidos` reais e botão **`Regenerar`**.
6. **Passo 6 — Pré-visualização final das 38 peças**: Permite alternar vista **Computador / Telemóvel**, ligar/desligar guias de zona segura, inspecionar os **testes em círculo a 40 px** dos avatares e clicar em **`Regenerar`** peça a peça (`POST /api/kits/[id]`).
7. **Passo 7 — Entrega ZIP (38 ficheiros)**: Descarregamento de `pandomarca-{nome-simplificado}.zip`.

---

## 3. Ecrãs Públicos e Privados

A navegação principal é permanentemente visível em computador e em telemóvel (**Início**, **Formatos**, **Criar kit**).

| Ecrã | Rota / Vista | Função |
| :--- | :--- | :--- |
| **Início** | `/` | Apresenta o PandoMarca, mostra o selo discreto de demonstração, resume o fluxo só-imagem em 38 ficheiros e explica as duas formas de acesso (`website_bonus` e `standalone` com «Preço a definir»). |
| **Formatos** | `/formatos` | Lista detalhada dos 38 formatos definidos em `lib/config/redes-sociais.ts` e `lib/formats.ts` (data de referência: 15 de novembro de 2026). |
| **Criar Kit** | `/criar` | Assistente em 7 passos descritos na secção 2. |

---

## 4. Lista Exata dos 38 Formatos e Fontes Oficiais

Data de referência das especificações das plataformas: **15 de novembro de 2026**.
O arquivo ZIP denomina-se `pandomarca-{nome-simplificado}.zip` e contém uma pasta de topo `pandomarca-{nome-simplificado}/` com **exatamente 38 ficheiros**:

### 4.1 Variantes do Logótipo (5 ficheiros)
| Ficheiro | Medida | Notas |
| :--- | :--- | :--- |
| `variantes/logotipo-principal.png` | Medida do original processado | Fundo transparente |
| `variantes/icone.png` | `1024×1024 px` | Emblema / ícone isolado com fundo transparente |
| `variantes/logotipo-horizontal.png` | `1800×560 px` | Versão horizontal derivada |
| `variantes/fundo-claro.png` | `1200×1200 px` | Aplicado sobre fundo claro (`papel`) |
| `variantes/fundo-escuro.png` | `1200×1200 px` | Aplicado sobre fundo escuro (`tinta`) com contraste preservado |

### 4.2 Redes Sociais e Perfis (18 ficheiros PNG — Fonte única `lib/config/redes-sociais.ts`)
| Peça | Ficheiro | Medida | Aspect Gemini | Fonte Oficial e Zonas Seguras |
| :--- | :--- | :--- | :--- | :--- |
| Facebook, foto de perfil | `facebook/foto-de-perfil.png` | `720×720 px` | `1:1` | [Facebook Help](https://www.facebook.com/help/125379114252045). Círculo (176×176 desktop / 196×196 telemóvel); testada a 40 px. |
| Facebook, capa | `facebook/capa.png` | `1640×624 px` | `21:9` | [Facebook Help](https://www.facebook.com/help/125379114252045). Zona segura móvel centrada (1080×536) e canto inferior esquerdo livre para avatar. |
| Instagram, foto de perfil | `instagram/foto-de-perfil.png` | `320×320 px` | `1:1` | [Ajuda do Instagram](https://help.instagram.com/1631821640426723). Círculo 1:1 testado a 40 px. |
| Instagram, publicação vertical (4:5) | `instagram/publicacao-1080x1350.png` | `1080×1350 px` | `4:5` | [Ajuda do Instagram](https://help.instagram.com/1631821640426723). Feed vertical 4:5 com área interior 888×1050 compatível com a grelha. |
| Instagram, publicação quadrada (1:1) | `instagram/publicacao-1080.png` | `1080×1080 px` | `1:1` | [Ajuda do Instagram](https://help.instagram.com/1631821640426723). Quadrado 1:1 com margem de 96 px. |
| Instagram, story (9:16) | `instagram/story-1080x1920.png` | `1080×1920 px` | `9:16` | [Guia de anúncios da Meta para Stories](https://www.facebook.com/business/ads-guide/update/image/instagram-story). Obrigatoriamente 250 px topo e 250 px base livres de texto/logótipo. |
| LinkedIn, perfil pessoal | `linkedin/perfil-pessoal.png` | `400×400 px` | `1:1` | [LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a549049). Círculo 1:1 testado a 40 px. |
| LinkedIn, capa pessoal | `linkedin/capa-pessoal.png` | `1584×396 px` | `21:9` | [LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a568217). 4:1 com canto inferior esquerdo reservado ao avatar. |
| LinkedIn, logótipo da empresa | `linkedin/perfil-empresa.png` | `400×400 px` | `1:1` | [LinkedIn Help, Páginas](https://www.linkedin.com/help/linkedin/answer/a563309). Recomendado 400×400 px para Página de Empresa. |
| LinkedIn, capa da página | `linkedin/capa-empresa.png` | `1128×191 px` | `21:9` | [LinkedIn Help, Páginas](https://www.linkedin.com/help/linkedin/answer/a563309). Banner panorâmico padrão 1128×191 px com zona central segura. |
| YouTube, avatar | `youtube/foto-de-perfil.png` | `800×800 px` | `1:1` | [YouTube Help](https://support.google.com/youtube/answer/10456525). Círculo 98×98 px e leitura a 40 px. |
| YouTube, banner | `youtube/banner.png` | `2560×1440 px` | `16:9` | [YouTube Help](https://support.google.com/youtube/answer/10456525). 16:9 completo para TV com conteúdo obrigatoriamente dentro de `1546×423 px` ao centro. |
| X, foto de perfil | `x/foto-de-perfil.png` | `400×400 px` | `1:1` | [Ajuda do X](https://help.x.com/en/managing-your-account/how-to-customize-your-profile). Círculo testado a 40 px. |
| X, cabeçalho | `x/cabecalho.png` | `1500×500 px` | `21:9` | [Ajuda do X](https://help.x.com/en/managing-your-account/how-to-customize-your-profile). Proporção 3:1 com sobreposição inferior esquerda livre. |
| Google Perfil de Empresa, logótipo | `google-business/logotipo.png` | `720×720 px` | `1:1` | [Google Business Profile Help](https://support.google.com/business/answer/6103862). Quadrado 720×720 px testado a 40 px. |
| Google Perfil de Empresa, capa | `google-business/capa.png` | `1024×576 px` | `16:9` | [Google Business Profile Help](https://support.google.com/business/answer/6103862). 16:9 a 1024×576 px. |
| WhatsApp Business, foto de perfil | `whatsapp-business/foto-de-perfil.png` | `640×640 px` | `1:1` | [Documentação Meta](https://developers.facebook.com/docs/whatsapp/on-premises/reference/settings/profile/photo/). Fundo obrigatoriamente opaco em círculo, testado a 40 px. |
| TikTok, foto de perfil | `tiktok/foto-de-perfil.png` | `200×200 px` | `1:1` | [TikTok Help Center](https://support.tiktok.com/en/using-tiktok/creating-your-account/setting-up-your-profile). Círculo 200×200 px testado a 40 px. |

### 4.3 Favicon (6 ficheiros — vetorização opcional)
- `favicon/favicon.ico` (`16×16`, `32×32`, `48×48`), `favicon/favicon-32x32.png`, `favicon/apple-touch-icon.png` (`180×180`), `favicon/icon-192.png`, `favicon/icon-512.png`, `favicon/site.webmanifest`.

### 4.4 Email, Impressão, Guia e Metadados (9 ficheiros)
- `email/assinatura.html`, `email/logotipo-assinatura.png` (altura 128 px), `impressao/cartao-de-visita.pdf` (`91×61 mm` / corte `85×55 mm` / sangria `3 mm`, 2 páginas), `impressao/papel-de-carta.pdf` (`210×297 mm` A4), `guia-de-marca/guia-de-marca.pdf` (`210×297 mm` A4), `paleta/paleta.json`, `paleta/amostra.svg`, `tipografia/tipos.txt`, `LEIA-ME.txt`.

---

## 5. Stack Tecnológica

- **Next.js (App Router)** com TypeScript e Tailwind CSS.
- **Processamento de imagem**: `sharp` (corte/redimensionamento `cropResizeToRedeSpec`, flood-fill de fundo mantendo branco fechado, auditoria `validarZonaSegura` e composição de demonstração a partir de `docs/referencias/ia-aprovada/`).
- **Camada IA**: `lib/imagem/gemini.ts` (`gemini-nano-banana-2.1` com `inlineData` obrigatório e `IMAGEM_MODO=falso` por omissão) + `lib/imagem/recraft.ts`.
- **Impressão e Guia**: `satori`, `@resvg/resvg-js`, `pdf-lib` e fontes locais Fontsource OFL; `lib/vetorizar.ts` (`vtracer` + `potrace`) apenas quando `usarVetorizacaoOpcional` está ativo para favicon/impressão.
- **Empacotamento e armazenamento temporário**: `jszip` (38 ficheiros) e `/tmp/pandomarca/`.
