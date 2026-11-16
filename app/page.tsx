import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  FileArchive,
  Layers,
  PenTool,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      {/* Hero Editorial */}
      <section className="rounded-3xl border border-stone-200/90 bg-white p-8 shadow-xs sm:p-12 lg:p-16">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7 space-y-6">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
              PandoWeb • Estúdio de Identidade para PME
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-stone-950 sm:text-5xl lg:text-[3.35rem] leading-[1.08]">
              Do logótipo ao kit completo de marca em 36 ficheiros exactos.
            </h1>
            <p className="text-lg text-stone-600 leading-relaxed max-w-2xl">
              O <strong>PandoMarca</strong> parte de um logótipo criado de raiz ou já existente e entrega o kit completo de ficheiros de que uma PME portuguesa precisa para se apresentar: redes sociais, favicon, assinatura de email, cartão de visita, papel de carta A4 e guia de marca de uma página.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/criar?entrada=A"
                id="hero-cta-entrada-a"
                className="inline-flex items-center gap-2.5 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800"
              >
                <PenTool className="h-4 w-4 text-amber-400" />
                <span>Entrada A — Criar logótipo de raiz</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/criar?entrada=B"
                id="hero-cta-entrada-b"
                className="inline-flex items-center gap-2.5 rounded-xl border border-stone-300 bg-[#FAF7F2] px-6 py-3.5 text-sm font-semibold text-stone-900 transition hover:bg-stone-200/70"
              >
                <Upload className="h-4 w-4 text-amber-800" />
                <span>Entrada B — Usar logótipo existente</span>
              </Link>
              <Link
                href="/formatos"
                id="hero-cta-formatos"
                className="inline-flex items-center gap-1.5 px-3 py-3 text-sm font-semibold text-stone-700 underline decoration-stone-300 underline-offset-4 hover:text-stone-950"
              >
                <span>Ver lista dos 36 formatos</span>
              </Link>
            </div>
          </div>

          {/* Resumo visual do arquivo ZIP */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between border-b border-stone-200 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    Entrega determinística
                  </span>
                  <h2 className="mt-0.5 text-xl font-bold text-stone-900">
                    pandomarca-&#123;marca&#125;.zip
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-bold text-amber-950">
                  <FileArchive className="h-3.5 w-3.5" />
                  36 ficheiros
                </span>
              </div>

              <ul className="space-y-3 text-sm text-stone-700">
                <li className="flex items-start justify-between gap-2">
                  <span className="font-medium text-stone-900">Variantes do logótipo</span>
                  <span className="rounded-md bg-white px-2.5 py-0.5 text-xs font-semibold text-stone-700 border border-stone-200">
                    5 PNG
                  </span>
                </li>
                <li className="flex items-start justify-between gap-2">
                  <span className="font-medium text-stone-900">
                    Redes sociais e perfis (FB, IG, X, YT, LI, WA, Google)
                  </span>
                  <span className="rounded-md bg-white px-2.5 py-0.5 text-xs font-semibold text-stone-700 border border-stone-200 shrink-0">
                    16 PNG
                  </span>
                </li>
                <li className="flex items-start justify-between gap-2">
                  <span className="font-medium text-stone-900">
                    Favicon e Web App Manifest (.ico 16/32/48, Apple, PWA)
                  </span>
                  <span className="rounded-md bg-white px-2.5 py-0.5 text-xs font-semibold text-stone-700 border border-stone-200 shrink-0">
                    6 ficheiros
                  </span>
                </li>
                <li className="flex items-start justify-between gap-2">
                  <span className="font-medium text-stone-900">
                    Assinatura de email (HTML com CSS em linha + PNG 128 px)
                  </span>
                  <span className="rounded-md bg-white px-2.5 py-0.5 text-xs font-semibold text-stone-700 border border-stone-200 shrink-0">
                    2 ficheiros
                  </span>
                </li>
                <li className="flex items-start justify-between gap-2">
                  <span className="font-medium text-stone-900">
                    Estacionário para impressão (Cartão 91×61 mm + Papel A4)
                  </span>
                  <span className="rounded-md bg-white px-2.5 py-0.5 text-xs font-semibold text-stone-700 border border-stone-200 shrink-0">
                    2 PDF
                  </span>
                </li>
                <li className="flex items-start justify-between gap-2">
                  <span className="font-medium text-stone-900">
                    Guia de marca A4, paleta (JSON + SVG), tipos e LEIA-ME
                  </span>
                  <span className="rounded-md bg-white px-2.5 py-0.5 text-xs font-semibold text-stone-700 border border-stone-200 shrink-0">
                    5 ficheiros
                  </span>
                </li>
              </ul>

              <div className="rounded-xl bg-stone-900 p-4 text-xs text-stone-200 leading-relaxed">
                <strong className="text-amber-300">Regra das 2 escolhas:</strong>{" "}
                em cada passo criativo vê sempre duas propostas claramente distintas lado a lado, com opção de pedir mais ou abrir o catálogo completo dos 6 estilos.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Duas entradas para o mesmo kit */}
      <section className="mt-14 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-lg bg-amber-100/80 px-3 py-1.5 text-xs font-bold text-amber-950">
              <PenTool className="h-3.5 w-3.5" />
              Entrada A — Logótipo de Raiz
            </div>
            <h2 className="text-2xl font-bold text-stone-900">
              Criar um logótipo de estúdio a partir do zero
            </h2>
            <p className="text-sm text-stone-600 leading-relaxed">
              Responda ao questionário da marca, indique palavras-chave, cores preferidas e cores a evitar, e carregue de 1 a 5 imagens de referência com nota do que lhe agrada. Compare 2 direções distintas, refine até 3 rondas e obtenha as variantes horizontal, vertical, símbolo, monocromático e negativo.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-stone-100">
            <Link
              href="/criar?entrada=A"
              className="inline-flex items-center gap-2 text-sm font-bold text-stone-900 hover:text-amber-800"
            >
              <span>Começar pela Entrada A</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-lg bg-stone-200 px-3 py-1.5 text-xs font-bold text-stone-900">
              <Upload className="h-3.5 w-3.5" />
              Entrada B — Logótipo Existente
            </div>
            <h2 className="text-2xl font-bold text-stone-900">
              Partir de um ficheiro PNG, JPG ou SVG (até 8 MB)
            </h2>
            <p className="text-sm text-stone-600 leading-relaxed">
              O servidor analisa a transparência, remove automaticamente fundos de cor lisa ligados à margem (mantendo o branco fechado no interior do desenho), extrai a paleta dos píxeis opacos, verifica a nitidez e gera todas as variantes e os 36 formatos. Inclui o ensaio <strong>Forno da Vilariça</strong> pronto a testar.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-stone-100">
            <Link
              href="/criar?entrada=B"
              className="inline-flex items-center gap-2 text-sm font-bold text-stone-900 hover:text-amber-800"
            >
              <span>Começar pela Entrada B</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Duas formas de acesso de igual peso */}
      <section className="mt-14 space-y-6">
        <div className="max-w-3xl space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
            Direitos de Acesso
          </p>
          <h2 className="text-3xl font-bold text-stone-900">
            Duas formas de acesso, o mesmo kit completo
          </h2>
          <p className="text-base text-stone-600">
            O PandoMarca distingue no código dois direitos de acesso de igual peso funcional (<code>website_bonus</code> e <code>standalone</code>). Ambos entregam exactamente o mesmo arquivo ZIP de 36 ficheiros.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-stone-200 bg-white p-7 space-y-4">
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">
                Oferta do Website (website_bonus)
              </span>
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
            </div>
            <h3 className="text-xl font-bold text-stone-900">
              Incluído como bónus na subscrição de website PandoWeb
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              O cliente que subscreve um website em{" "}
              <a
                href="https://pandoweb.pt"
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline"
              >
                pandoweb.pt
              </a>{" "}
              recebe o PandoMarca como bónus, desbloqueado com um código de acesso gerado pela PandoWeb. Na PandoWeb, a criação do site é <strong>0 €</strong> e a subscrição anual publicada é de <strong>160 € + IVA por ano</strong> (inclui alojamento, domínio, email, SSL e backups — este valor é o da subscrição do website, não o preço do kit).
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-7 space-y-4">
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-bold text-amber-950">
                Produto Individual (standalone)
              </span>
              <Sparkles className="h-5 w-5 text-amber-800" />
            </div>
            <h3 className="text-xl font-bold text-stone-900">
              Acesso autónomo ao kit sem subscrição de website
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              Outras empresas ou profissionais podem aceder ao PandoMarca à parte, através de um código próprio de tipo <code>standalone</code>. O preço e o meio de pagamento do kit individual ainda estão em aberto, pelo que nesta versão não há checkout, não se apresenta preço para o kit e não se efectua qualquer cobrança.
            </p>
          </div>
        </div>
      </section>

      {/* Transparência: O que existe agora vs. o que ainda não existe */}
      <section className="mt-14 rounded-2xl border border-stone-200 bg-[#F3EFE6] p-8 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              <span>O que está incluído e funcional nesta versão</span>
            </h3>
            <ul className="space-y-2.5 text-sm text-stone-700">
              <li>• Validação de código por ambiente (<code>website_bonus</code> e <code>standalone</code>) com cookie HttpOnly assinado válido por 12 horas.</li>
              <li>• <strong>Entrada A</strong>: Questionário, 1 a 5 referências com nota, 2 direções de estúdio, até 3 rondas de afinação («Mostrar outras 2») e 5 variantes finais.</li>
              <li>• <strong>Entrada B</strong>: Carregamento PNG/JPG/SVG até 8 MB, remoção de fundo liso ligado à margem, extração de paleta e diagnóstico de nitidez.</li>
              <li>• Quatro propostas distintas de paleta e par tipográfico (5 pares Fontsource OFL locais) e catálogo de 6 estilos de conteúdo ajustáveis por grupo.</li>
              <li>• Pré-visualização completa no browser e descarregamento do ZIP com 36 ficheiros verificados ao píxel e ao milímetro.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <Compass className="h-5 w-5 text-amber-800" />
              <span>O que ainda não existe nesta versão (previsto para futuro)</span>
            </h3>
            <ul className="space-y-2.5 text-sm text-stone-700">
              <li>• <strong>Sem pagamentos nem checkout</strong>: não há integração Stripe (cartão, MB Way ou Multibanco) nem cobrança nesta fase.</li>
              <li>• <strong>Sem contas de utilizador nem base de dados</strong>: o acesso é feito apenas por código e os rascunhos/kits são guardados temporariamente em disco local.</li>
              <li>• <strong>Sem revisão humana ativa</strong>: a revisão opcional pela equipa PandoWeb e a emissão automática de códigos por cliente estão apenas previstas na arquitetura.</li>
              <li>• <strong>Sem deploy nem domínio de produção fechado</strong>: aplicação desenhada para execução e verificação local.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
