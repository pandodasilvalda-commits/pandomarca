"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-800">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h1 className="mt-6 text-3xl font-bold text-stone-900">
        Ocorreu um problema inesperado
      </h1>
      <p className="mt-3 text-base text-stone-600">
        Não foi possível concluir a operação pedida. Pode tentar novamente ou regressar ao início do estúdio.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => reset()}
          id="btn-error-retry"
          className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-stone-50 shadow-xs transition hover:bg-stone-800"
        >
          <RotateCcw className="h-4 w-4" />
          Tentar novamente
        </button>
        <Link
          href="/criar"
          className="inline-flex items-center rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
        >
          Ir para Criar Kit
        </Link>
      </div>
    </div>
  );
}
