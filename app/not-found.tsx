import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
        Erro 404
      </p>
      <h1 className="mt-3 text-3xl font-bold text-stone-900">
        Página não encontrada
      </h1>
      <p className="mt-3 text-base text-stone-600">
        O endereço que procura não existe nesta aplicação local do PandoMarca.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          href="/"
          className="rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-800"
        >
          Voltar ao Início
        </Link>
        <Link
          href="/criar"
          className="rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
        >
          Criar kit de marca
        </Link>
      </div>
    </div>
  );
}
