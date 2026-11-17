import type { Metadata } from "next";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/500.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-serif-4/700.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/500.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/source-sans-3/700.css";
import "@fontsource/libre-baskerville/400.css";
import "@fontsource/libre-baskerville/600.css";
import "@fontsource/libre-baskerville/700.css";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/500.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/600.css";
import "@fontsource/lora/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "PandoMarca — Kit de Identidade Visual e Presença Digital | PandoWeb",
  description:
    "Crie um logótipo de raiz ou carregue o seu logótipo existente e receba o kit completo de 38 ficheiros para redes sociais, favicon, assinatura de email, estacionário e guia de marca.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT">
      <body className="min-h-screen flex flex-col bg-[#FAF7F2] text-stone-900 antialiased selection:bg-amber-900 selection:text-amber-50">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
