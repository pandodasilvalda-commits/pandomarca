"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Layers, Sparkles } from "lucide-react";

export function SiteHeader() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Início", icon: Compass },
    { href: "/formatos", label: "Formatos", icon: Layers },
    { href: "/criar", label: "Criar kit", icon: Sparkles },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/90 bg-[#FAF7F2]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
        <Link
          href="/"
          id="nav-brand-logo"
          className="group flex items-center gap-3 text-stone-900 transition-opacity hover:opacity-90"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-sm font-bold tracking-wider text-amber-50 shadow-sm transition-transform group-hover:scale-[1.02]">
            PM
          </span>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-stone-900 leading-none">
              PandoMarca
            </span>
            <span className="mt-1 text-xs font-medium text-stone-500">
              Um produto PandoWeb para PME
            </span>
          </div>
        </Link>

        {/* Navegação sempre visível em computador e telemóvel (sem menu escondido em hamburger) */}
        <nav
          aria-label="Navegação principal"
          className="flex items-center gap-1.5 sm:gap-2"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                id={`nav-link-${item.href.replace("/", "") || "inicio"}`}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all sm:px-4 ${
                  active
                    ? "bg-stone-900 text-stone-50 shadow-xs"
                    : "text-stone-700 hover:bg-stone-200/75 hover:text-stone-950"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-stone-200/90 bg-[#F3EFE6] text-stone-600">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:px-8">
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-stone-900">
            PandoMarca — Kit de Identidade Visual e Presença Digital
          </p>
          <p className="text-xs text-stone-600 max-w-2xl">
            Desenvolvido pela{" "}
            <a
              href="https://pandoweb.pt"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950"
            >
              PandoWeb (pandoweb.pt)
            </a>
            . Entrega 36 ficheiros prontos a usar em redes sociais, favicon, assinatura de email, estacionário e guia de marca.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-stone-600">
          <Link href="/" className="hover:text-stone-900">
            Início
          </Link>
          <span>•</span>
          <Link href="/formatos" className="hover:text-stone-900">
            36 Formatos Oficiais
          </Link>
          <span>•</span>
          <Link href="/criar" className="hover:text-stone-900">
            Criar Kit de Marca
          </Link>
        </div>
      </div>
    </footer>
  );
}
