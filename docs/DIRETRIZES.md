# Diretrizes de Design, Tipografia e Composição — PandoMarca

Guia curto e prático para qualquer alteração ao gerador de identidades visuais. O PandoMarca serve múltiplas marcas e sectores: nenhuma decisão visual pode fixar cores, fontes ou textos de uma marca em particular.

## 1. Arquitetura Só-Imagem e Referência Obrigatória
- **Sem vetores desenhados por código nas peças sociais:** avatares, capas, publicações e stories nascem exclusivamente da camada de geração de imagem (`lib/imagem/`). A vetorização (`lib/vetorizar.ts`) é opcional e restringe-se a `favicon/*` e `impressao/*`.
- **Logótipo como imagem de referência:** o logótipo escolhido (Entrada A) ou carregado (Entrada B) segue intacto — nunca é redesenhado nem substituído por outra marca (ex.: zero fugas do ensaio «Forno da Vilariça» para outros clientes).
- **Modo falso (`IMAGEM_MODO=falso`):** em desenvolvimento e testes não são feitas chamadas pagas; as marcas distintas do ensaio base recebem composição de estúdio gerada a partir da sua própria paleta e logótipo.

## 2. Tipografia Adaptativa Multi-Marca
- **Derivada do cliente:** o par tipográfico é escolhido por `resolverParTipograficoMarca({ tom, sector, estiloDirecao })`.
  - Tons **Técnico, Jovem e Divertido** (e sectores digitais) usam pares **sem serifas** (`tecnica` Manrope + Source Sans 3, `moderna` Outfit + Manrope, `clara` Nunito + Source Sans 3).
  - Tons **Tradicional, Premium ou Jurídico/Patrimonial** podem usar pares **mistos ou serifados intencionais** (`confianca`, `editorial`, `classica` Lora + Source Serif 4).
- **Nunca por omissão nem por falha de fonte:** toda a cadeia (SVG, Satori/PDF, HTML de assinatura, UI do wizard) define explicitamente `fontFamily` na raiz, carrega localmente os pesos `@fontsource` (`400..800`) e declara fallback CSS da **mesma família** (`sans-serif` vs `serif`).

## 3. Legibilidade e Contraste Mínimo
- **Telemóvel (feed e story a `1080 px` de largura):**
  - Pílulas/contactos em publicações 4:5 (`1080×1350`), 1:1 (`1080×1080`) e Story (`1080×1920`) usam **≥ 38–42 px** (`≥ 3,5 %` da largura), repartidos em 1 ou 2 linhas equilibradas para leitura confortável num telefone.
- **Impressão (`300 DPI` / A4 e Cartão 85×55 mm):**
  - Guia A4 e Papel de Carta A4: corpo ≥ 18–22 px, títulos e nomes de marca destacados, legendas ≥ 16 px.
  - Cartão de Visita: frente ≥ 26 px no slogan/site; verso com nome ≥ 42 px, cargo/slogan ≥ 26 px e contactos ≥ 27 px (`fontWeight: 500`, `lineHeight: 1.32`).
- **Avatares a `40×40 px`:** isolam apenas o símbolo/emblema (sem texto corrido) com margem circular limpa nos cantos e contraste ≥ 40/255.
- **Contraste cromático:** texto informativo garante rácio mínimo **WCAG AA ≥ 4,5:1**; em fundos escuros adapta-se o texto escuro por aglomerados mantendo intactas as cores da marca ou aplicando brilho radial suave atrás do emblema.

## 4. Composição em 3 Camadas e Zonas Seguras
1. **Camada (a) Fundo / ambiente:** texturas, gradientes, molduras e fotografia **podem sangrar** fora da zona segura móvel até às margens do formato completo de computador.
2. **Camada (b) Informação da marca:** logótipo → nome → slogan → contactos ficam **sempre dentro** da `safeZoneMobile` e longe de todas as reservas de UI/avatar.
3. **Camada (c) Reservas de plataforma:**
   - **Capas horizontais bipartidas (Facebook `1640×624`, X `1500×500`):** bloco informativo **ancorado à esquerda** acima e à direita dos avatares desktop e móvel; fotografia/luz editorial ocupa a metade direita.
   - **Faixas ultra-largas (LinkedIn, YouTube `2560×1440`):** emblema + nome **em linha horizontal** (sem slogan nem contactos) dentro de `1546×423` no YouTube.
   - **Google Perfil de Empresa (`1024×576`):** ≥ 65 % de imagem em destaque e bloco compacto à esquerda.
   - **Instagram Story (`1080×1920`):** margens superior e inferior de `250 px` totalmente livres de texto e logótipo.

## 5. Verificação Obrigatória Antes de Fechar Alterações
- Correr testes automáticos com **pelo menos 3 marcas de tons distintos** (tecnológica sem serifa, clássica serifada intencional e próxima/artesanal), tanto na **Entrada A** (sem upload) como na **Entrada B** (com upload).
- Inspecionar visualmente as capturas Antes/Depois e multi-marca (`docs/revisao/...`) e validar `tsc`, `lint`, `npm test` e `npm run build`.
