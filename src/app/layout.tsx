import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SiteNav } from "@/components/shell/SiteNav";
import { HealthProvider } from "@/hooks/useHealth";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Jev Benchmark", template: "%s · Jev Benchmark" },
  description: "Ocho pruebas para medir cómo deciden Jev, Clef, Clef-Flash, Laya y una persona: juegos en tiempo real y decisiones sobre datos etiquetados.",
  openGraph: { title: "Jev Benchmark", description: "Ocho pruebas para medir decisiones de Jev, Clef, Clef-Flash, Laya y una persona." },
  icons: { icon: "/brand/jev-logo.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" data-scroll-behavior="smooth"><body className={`${GeistSans.variable} ${GeistMono.variable}`}><HealthProvider><SiteNav />{children}</HealthProvider></body></html>;
}
