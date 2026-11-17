import { BrandData } from "./formats";

export interface SampleBrandPreset {
  id: "forno-da-vilarica" | "oficina-do-sao";
  titulo: string;
  subtitulo: string;
  dados: BrandData;
  svg: string;
  questionarioA: {
    tresPalavras: string;
    coresPreferidas: string;
    coresEvitar: string;
    referencias: { titulo: string; nota: string; svg: string }[];
  };
}

export const FORNO_DA_VILARICA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" width="1400" height="919">
  <!-- Símbolo original: Arco de forno transmontano em pedra e tijolo com espiga de trigo central -->
  <g transform="translate(80, 48)">
    <!-- Base / soleira do forno -->
    <rect x="18" y="256" width="244" height="22" rx="6" fill="#3E2415" />
    <rect x="34" y="284" width="212" height="10" rx="5" fill="#C2592B" />

    <!-- Arco exterior de alvenaria -->
    <path d="M 30 248 L 30 144 C 30 68, 92 14, 140 14 C 188 14, 250 68, 250 144 L 250 248 Z" fill="#B84A24" />

    <!-- Aduelas de pedra estilizadas no arco -->
    <path d="M 52 248 L 52 146 C 52 84, 98 38, 140 38 C 182 38, 228 84, 228 146 L 228 248 Z" fill="#FDF8F2" />

    <!-- Boca interior escura do forno -->
    <path d="M 74 248 L 74 152 C 74 102, 108 64, 140 64 C 172 64, 206 102, 206 152 L 206 248 Z" fill="#2A1810" />

    <!-- Brasa / brilho quente do forno ao amanhecer -->
    <path d="M 92 248 C 92 198, 114 168, 140 168 C 166 168, 188 198, 188 248 Z" fill="#D9822B" />

    <!-- Espiga de trigo estilizada erguendo-se no centro -->
    <rect x="137" y="96" width="6" height="142" rx="3" fill="#FDF8F2" />
    <!-- Grãos da espiga à esquerda e direita -->
    <ellipse cx="123" cy="122" rx="12" ry="6" transform="rotate(-32 123 122)" fill="#E6A145" />
    <ellipse cx="157" cy="122" rx="12" ry="6" transform="rotate(32 157 122)" fill="#E6A145" />
    <ellipse cx="121" cy="146" rx="13" ry="6.5" transform="rotate(-32 121 146)" fill="#E6A145" />
    <ellipse cx="159" cy="146" rx="13" ry="6.5" transform="rotate(32 159 146)" fill="#E6A145" />
    <ellipse cx="123" cy="170" rx="12" ry="6" transform="rotate(-32 123 170)" fill="#FDF8F2" />
    <ellipse cx="157" cy="170" rx="12" ry="6" transform="rotate(32 157 170)" fill="#FDF8F2" />
    <ellipse cx="140" cy="96" rx="6" ry="13" fill="#E6A145" />
  </g>

  <!-- Composição tipográfica vectorial da marca -->
  <g transform="translate(380, 140)" fill="#2A1810">
    <!-- FORNO (traçado geométrico limpo) -->
    <text x="0" y="32" font-family="Nunito, sans-serif" font-weight="800" font-size="52" letter-spacing="3" fill="#2A1810">FORNO</text>
    <text x="2" y="88" font-family="Lora, Georgia, serif" font-weight="600" font-size="38" fill="#B84A24">da Vilariça</text>
    <rect x="2" y="108" width="168" height="4" rx="2" fill="#D9822B" />
    <text x="2" y="138" font-family="Nunito, sans-serif" font-weight="600" font-size="15" letter-spacing="4" fill="#6E4730">PADARIA ARTESANAL</text>
  </g>
</svg>`;

export const OFICINA_DO_SAO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" width="1400" height="919">
  <g transform="translate(82, 56)">
    <!-- Escudo octogonal técnico de oficina -->
    <polygon points="80,16 196,16 260,80 260,196 196,260 80,260 16,196 16,80" fill="#1D3557" />
    <polygon points="90,34 186,34 242,90 242,186 186,242 90,242 34,186 34,90" fill="#F4F1EA" />
    <!-- Compasso e chave estilizados no centro -->
    <path d="M 138 64 L 92 204 L 114 204 L 138 124 L 162 204 L 184 204 Z" fill="#1D3557" />
    <circle cx="138" cy="76" r="18" fill="#D66829" />
    <rect x="102" y="152" width="72" height="14" rx="7" fill="#D66829" />
  </g>
  <g transform="translate(376, 144)">
    <text x="0" y="34" font-family="Manrope, sans-serif" font-weight="800" font-size="48" letter-spacing="2" fill="#1D3557">OFICINA</text>
    <text x="2" y="88" font-family="Source Serif 4, Georgia, serif" font-weight="600" font-size="38" fill="#D66829">do São</text>
    <rect x="2" y="108" width="150" height="4" rx="2" fill="#1D3557" />
    <text x="2" y="138" font-family="Manrope, sans-serif" font-weight="600" font-size="14" letter-spacing="3.5" fill="#4A5568">RESTAURO E METALOMECÂNICA</text>
  </g>
</svg>`;

export const SAMPLE_BRANDS: Record<SampleBrandPreset["id"], SampleBrandPreset> = {
  "forno-da-vilarica": {
    id: "forno-da-vilarica",
    titulo: "Forno da Vilariça",
    subtitulo: "Ensaio obrigatório — Padaria tradicional em Torre de Moncorvo",
    dados: {
      nome: "Forno da Vilariça",
      sector: "restauracao",
      simbolo: false,
      slogan: "Pão de trigo ao nascer do dia",
      pessoa: "Marta Queirós",
      cargo: "Mestra Padeira e Sócia-Gerente",
      email: "marta@fornodavilarica.pt",
      telefone: "+351 279 452 180",
      website: "https://fornodavilarica.pt",
      morada: "Rua do Forno 14, 5160-242 Torre de Moncorvo",
      nif: "514 892 307",
      servicos: "Padaria tradicional • Pão em forno a lenha e broa",
    },
    svg: FORNO_DA_VILARICA_SVG,
    questionarioA: {
      tresPalavras: "Tradição, Forno a lenha, Trigo dourado",
      coresPreferidas: "Terracota, ocre de trigo e castanho tostado",
      coresEvitar: "Néons frios, roxo sintético e verde fluorescente",
      referencias: [
        {
          titulo: "Arco de forno em pedra de xisto e tijolo",
          nota: "Gosto da forma arquitectónica do arco da boca do forno e do contraste quente com a farinha.",
          svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
            <rect width="240" height="240" rx="24" fill="#FAF4EC"/>
            <path d="M50 190 V115 C50 70 82 44 120 44 C158 44 190 70 190 115 V190 Z" fill="#B84A24"/>
            <path d="M78 190 V122 C78 92 96 74 120 74 C144 74 162 92 162 122 V190 Z" fill="#2A1810"/>
            <circle cx="120" cy="148" r="24" fill="#E6A145"/>
          </svg>`,
        },
        {
          titulo: "Espiga de trigo gravada em selo de padaria",
          nota: "Agrada-me a simetria da espiga estilizada com traço limpo que funciona bem em carimbos e sacos de papel.",
          svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
            <rect width="240" height="240" rx="24" fill="#2A1810"/>
            <circle cx="120" cy="120" r="78" fill="none" stroke="#E6A145" stroke-width="6"/>
            <line x1="120" y1="62" x2="120" y2="182" stroke="#FAF4EC" stroke-width="6" stroke-linecap="round"/>
            <ellipse cx="102" cy="98" rx="14" ry="7" transform="rotate(-30 102 98)" fill="#E6A145"/>
            <ellipse cx="138" cy="98" rx="14" ry="7" transform="rotate(30 138 98)" fill="#E6A145"/>
            <ellipse cx="102" cy="128" rx="14" ry="7" transform="rotate(-30 102 128)" fill="#E6A145"/>
            <ellipse cx="138" cy="128" rx="14" ry="7" transform="rotate(30 138 128)" fill="#E6A145"/>
          </svg>`,
        },
      ],
    },
  },
  "oficina-do-sao": {
    id: "oficina-do-sao",
    titulo: "Oficina do São",
    subtitulo: "Exemplo histórico — Restauro e metalomecânica (Serviços)",
    dados: {
      nome: "Oficina do São",
      sector: "servicos",
      simbolo: false,
      slogan: "Precisão mecânica desde 1988",
      pessoa: "Joaquim São",
      cargo: "Mestre Torneiro e Fundador",
      email: "geral@oficinadosao.pt",
      telefone: "+351 226 108 490",
      website: "https://oficinadosao.pt",
      morada: "Rua da Fundição 82, 4450-120 Matosinhos",
      nif: "502 641 920",
      servicos: "Tornearia, soldadura TIG e restauro de peças clássicas",
    },
    svg: OFICINA_DO_SAO_SVG,
    questionarioA: {
      tresPalavras: "Rigor, Aço, Ofício",
      coresPreferidas: "Azul oficina escuro e laranja zarcão",
      coresEvitar: "Tons pastel e dourados brilhantes",
      referencias: [
        {
          titulo: "Placa esmaltada industrial portuguesa",
          nota: "Gosto da geometria octogonal sólida e da tipografia forte.",
          svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
            <rect width="240" height="240" rx="24" fill="#1D3557"/>
            <polygon points="80,40 160,40 200,80 200,160 160,200 80,200 40,160 40,80" fill="none" stroke="#F4F1EA" stroke-width="8"/>
            <circle cx="120" cy="120" r="28" fill="#D66829"/>
          </svg>`,
        },
      ],
    },
  },
};

export interface MultiToneTestBrand {
  id: "vertice-digital" | "quinta-do-alvor" | "atelier-terra-viva";
  arquetipo: string;
  dados: BrandData;
  svg: string;
  coresEsperadas: {
    primaria: string;
    secundaria: string;
    papel: string;
    tinta: string;
  };
  parTipograficoEsperado: "tecnica" | "classica" | "clara";
}

export const MULTI_TONE_SAMPLE_BRANDS: Record<
  MultiToneTestBrand["id"],
  MultiToneTestBrand
> = {
  "vertice-digital": {
    id: "vertice-digital",
    arquetipo: "Tecnológica e modular (sem serifa)",
    dados: {
      nome: "Vértice Digital",
      sector: "tecnologia",
      tom: "tecnico",
      simbolo: true,
      slogan: "Plataformas cloud e software à medida",
      pessoa: "Tiago Neves",
      cargo: "Diretor de Engenharia",
      email: "ola@verticedigital.pt",
      telefone: "+351 253 910 420",
      website: "https://verticedigital.pt",
      morada: "Avenida Central 118, Braga",
      nif: "516 402 819",
      servicos: "Arquitetura Cloud • Automação • APIs Empresariais",
    },
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="1280" height="720">
      <rect x="44" y="40" width="240" height="240" rx="52" fill="#0F172A"/>
      <polygon points="100,96 164,228 228,96 196,96 164,168 132,96" fill="#0EA5E9"/>
      <circle cx="164" cy="96" r="16" fill="#38BDF8"/>
      <text x="320" y="150" font-family="Manrope, sans-serif" font-weight="800" font-size="56" fill="#0F172A">VÉRTICE</text>
      <text x="322" y="210" font-family="Manrope, sans-serif" font-weight="600" font-size="38" fill="#0284C7">Digital</text>
      <rect x="322" y="232" width="160" height="6" rx="3" fill="#0EA5E9"/>
    </svg>`,
    coresEsperadas: {
      primaria: "#0284C7",
      secundaria: "#0EA5E9",
      papel: "#F8FAFC",
      tinta: "#0F172A",
    },
    parTipograficoEsperado: "tecnica",
  },
  "quinta-do-alvor": {
    id: "quinta-do-alvor",
    arquetipo: "Clássica, patrimonial e vínica (serifada intencional)",
    dados: {
      nome: "Quinta do Alvor",
      sector: "restauracao",
      tom: "tradicional",
      simbolo: false,
      slogan: "Enoturismo e cozinha duriense desde 1924",
      pessoa: "Henrique Sá",
      cargo: "Anfitrião e Produtor",
      email: "reservas@quintadoalvor.pt",
      telefone: "+351 254 730 115",
      website: "https://quintadoalvor.pt",
      morada: "Estrada Nacional 222, Pinhão, Douro",
      nif: "503 198 440",
      servicos: "Provas de Vinho • Mesa Regional • Estadias",
    },
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 380" width="1280" height="760">
      <g transform="translate(46, 50)">
        <circle cx="120" cy="130" r="106" fill="#FAF6EE" stroke="#6B2737" stroke-width="10"/>
        <circle cx="120" cy="130" r="88" fill="none" stroke="#B4843E" stroke-width="3"/>
        <path d="M120 62 C92 98 92 160 120 198 C148 160 148 98 120 62 Z" fill="#6B2737"/>
        <circle cx="120" cy="128" r="16" fill="#B4843E"/>
      </g>
      <text x="310" y="156" font-family="Lora, Georgia, serif" font-weight="700" font-size="52" fill="#2B1418">Quinta</text>
      <text x="312" y="216" font-family="Lora, Georgia, serif" font-weight="600" font-size="42" fill="#6B2737">do Alvor</text>
      <rect x="312" y="236" width="174" height="4" rx="2" fill="#B4843E"/>
      <text x="312" y="268" font-family="Lora, Georgia, serif" font-weight="500" font-size="16" letter-spacing="3" fill="#6B2737">ALTO DOURO • 1924</text>
    </svg>`,
    coresEsperadas: {
      primaria: "#6B2737",
      secundaria: "#B4843E",
      papel: "#FAF6EE",
      tinta: "#2B1418",
    },
    parTipograficoEsperado: "classica",
  },
  "atelier-terra-viva": {
    id: "atelier-terra-viva",
    arquetipo: "Próxima, natural e artesanal (orgânica limpa)",
    dados: {
      nome: "Atelier Terra Viva",
      sector: "comercio",
      tom: "natural",
      simbolo: true,
      slogan: "Cerâmica de autor moldada à mão",
      pessoa: "Inês Faria",
      cargo: "Ceramista Fundadora",
      email: "atelier@terraviva.pt",
      telefone: "+351 253 814 905",
      website: "https://terraviva.pt",
      morada: "Largo da Olaria 27, Barcelos",
      nif: "515 720 612",
      servicos: "Peças de Mesa • Oficinas Criativas • Encomendas",
    },
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="1280" height="720">
      <rect x="44" y="44" width="232" height="232" rx="116" fill="#2E6F5E"/>
      <path d="M160 88 C118 118 110 182 160 222 C210 182 202 118 160 88 Z" fill="#FBF7F0"/>
      <ellipse cx="160" cy="176" rx="34" ry="22" fill="#C86D44"/>
      <text x="314" y="148" font-family="Nunito, sans-serif" font-weight="800" font-size="48" fill="#1F3A32">Atelier</text>
      <text x="314" y="206" font-family="Nunito, sans-serif" font-weight="700" font-size="44" fill="#C86D44">Terra Viva</text>
      <rect x="314" y="228" width="150" height="5" rx="2.5" fill="#2E6F5E"/>
    </svg>`,
    coresEsperadas: {
      primaria: "#2E6F5E",
      secundaria: "#C86D44",
      papel: "#FBF7F0",
      tinta: "#1F3A32",
    },
    parTipograficoEsperado: "clara",
  },
};

