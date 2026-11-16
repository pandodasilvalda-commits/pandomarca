import { Suspense } from "react";
import { KitStudioWizard } from "@/components/kit-studio-wizard";

export const metadata = {
  title: "Criar Kit de Marca — PandoMarca | PandoWeb",
  description:
    "Crie um logótipo de raiz (Entrada A) ou carregue o seu logótipo existente (Entrada B) e gere os 38 ficheiros oficiais do kit de marca.",
};

export default function CriarKitPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-stone-600">
          A carregar o estúdio PandoMarca...
        </div>
      }
    >
      <KitStudioWizard />
    </Suspense>
  );
}
