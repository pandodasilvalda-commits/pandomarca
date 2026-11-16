import Link from "next/link";
import {
  CONTENT_STYLES,
  FONT_PAIRS,
  FORMAT_SPECS,
  FormatCategory,
  REFERENCE_DATE_PT,
} from "@/lib/formats";
import { ArrowRight, ExternalLink, FileCheck2, Layers, Palette, Type } from "lucide-react";

const CATEGORY_LABELS: Record<FormatCategory, { titulo: string; descricao: string }> = {
  variantes: {
    titulo: "1. Variantes do Logótipo (5 ficheiros)",
    descricao:
      "Versões base com transparência e fundos controlados para utilização transversal.",
  },
  redes: {
    titulo: "2. Redes Sociais e Perfis (16 ficheiros PNG)",
    descricao:
      "Fotos de perfil, capas, publicação quadrada e story vertical nas medidas recomendadas pelas plataformas.",
  },
  favicon: {
    titulo: "3. Favicon e Ícones de Website (6 ficheiros)",
    descricao:
      "Ícone multi-resolução .ico (16, 32 e 48 px), separadores retina, iOS/Safari e manifesto PWA.",
  },
  email: {
    titulo: "4. Assinatura de Email (2 ficheiros)",
    descricao:
      "Tabela HTML com CSS em linha compatível com clientes de email e logótipo a 128 px de altura (apresentado a 64 px).",
  },
  impressao: {
    titulo: "5. Estacionário para Impressão (2 ficheiros PDF)",
    descricao:
      "Cartão de visita europeu (91×61 mm com corte 85×55 mm e sangria de 3 mm em duas páginas) e papel de carta A4.",
  },
  guia: {
    titulo: "6. Guia de Marca (1 ficheiro PDF)",
    descricao:
      "Documento síntese A4 de uma página com variantes, cinco cores (HEX e RGB) e par tipográfico.",
  },
  metadados: {
    titulo: "7. Paleta, Tipografia e Documentação (4 ficheiros)",
    descricao:
      "Ficheiros técnicos de referência cromática, ligações Google Fonts e instruções LEIA-ME em português europeu.",
  },
};

const CATEGORY_ORDER: FormatCategory[] = [
  "variantes",
  "redes",
  "favicon",
  "email",
  "impressao",
  "guia",
  "metadados",
];

export default function FormatosPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-14">
      {/* Cabeçalho */}
      <div className="flex flex-col justify-between gap-6 border-b border-stone-200 pb-8 lg:flex-row lg:items-end">
        <div className="space-y-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-bold text-amber-950">
            <Layers className="h-3.5 w-3.5" />
            <span>Data de referência das medidas: {REFERENCE_DATE_PT}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl">
            Catálogo Oficial dos 36 Formatos do Kit
          </h1>
          <p className="text-base text-stone-600 leading-relaxed">
            Todos os ficheiros gerados pelo PandoMarca seguem medidas determinísticas verificadas por testes automáticos. Cada formato de plataforma externa indica a respetiva documentação oficial.
          </p>
        </div>

        <Link
          href="/criar"
          id="formatos-cta-criar"
          className="inline-flex items-center gap-2 self-start rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800 lg:self-auto"
        >
          <span>Criar kit com estes 36 formatos</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Tabelas por categoria */}
      <div className="space-y-12">
        {CATEGORY_ORDER.map((cat) => {
          const items = FORMAT_SPECS.filter((f) => f.categoria === cat);
          const info = CATEGORY_LABELS[cat];

          return (
            <section
              key={cat}
              className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden"
            >
              <div className="border-b border-stone-200 bg-[#FAF7F2] px-6 py-5">
                <h2 className="text-xl font-bold text-stone-900">{info.titulo}</h2>
                <p className="mt-1 text-sm text-stone-600">{info.descricao}</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/70 text-xs font-bold uppercase tracking-wider text-stone-500">
                      <th className="py-3.5 px-6">Peça</th>
                      <th className="py-3.5 px-4">Ficheiro no ZIP</th>
                      <th className="py-3.5 px-4">Medida</th>
                      <th className="py-3.5 px-4">Tipo</th>
                      <th className="py-3.5 px-6">Notas e Fonte Oficial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 text-sm">
                    {items.map((spec) => (
                      <tr key={spec.id} className="hover:bg-stone-50/60">
                        <td className="py-4 px-6 font-semibold text-stone-900 whitespace-nowrap">
                          {spec.nome}
                        </td>
                        <td className="py-4 px-4 font-mono text-xs text-amber-900 whitespace-nowrap">
                          {spec.ficheiro}
                        </td>
                        <td className="py-4 px-4 font-medium text-stone-800 whitespace-nowrap">
                          {spec.medidaLabel}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-md bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-800 border border-stone-200">
                            {spec.tipo}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-stone-600 leading-relaxed">
                          <span>{spec.nota}</span>
                          {spec.fonteUrl && spec.fonteNome && (
                            <span className="ml-2 inline-block">
                              <a
                                href={spec.fonteUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-950"
                              >
                                <span>[{spec.fonteNome}]</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      {/* Catálogo dos 6 estilos e 5 pares de tipos */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5">
            <Palette className="h-5 w-5 text-amber-800" />
            <h2 className="text-xl font-bold text-stone-900">
              Seis Estilos de Conteúdo
            </h2>
          </div>
          <p className="text-sm text-stone-600">
            Aplicados a capas, publicação (1080×1080), story (1080×1920), cartão de visita, papel de carta e assinatura de email. O conteúdo (logótipo e texto) fica sempre numa camada acima do fundo.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.values(CONTENT_STYLES).map((st) => (
              <div
                key={st.id}
                className="rounded-xl border border-stone-200 bg-[#FAF7F2] p-4 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">{st.nome}</span>
                  <code className="text-xs text-stone-500">{st.id}</code>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {st.descricao}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5">
            <Type className="h-5 w-5 text-amber-800" />
            <h2 className="text-xl font-bold text-stone-900">
              Cinco Pares Tipográficos (Fontsource OFL)
            </h2>
          </div>
          <p className="text-sm text-stone-600">
            Incluídos localmente no repositório para renderização determinística sem depender de chamadas à rede no momento de gerar o kit.
          </p>
          <div className="space-y-3">
            {Object.values(FONT_PAIRS).map((fp) => (
              <div
                key={fp.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-stone-200 bg-[#FAF7F2] p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900">{fp.nome}</span>
                    <span className="text-xs text-stone-500">({fp.serveSobretudo})</span>
                  </div>
                  <p className="text-xs text-stone-700 mt-1">
                    Título: <strong>{fp.tituloFamily} ({fp.tituloWeight})</strong> • Texto:{" "}
                    <strong>{fp.textoFamily} ({fp.textoWeight})</strong>
                  </p>
                </div>
                <FileCheck2 className="h-4 w-4 text-emerald-700 shrink-0" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
