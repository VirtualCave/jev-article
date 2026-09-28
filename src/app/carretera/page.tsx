import type { Metadata } from "next";
import { CarreteraGame } from "@/components/carretera/CarreteraGame";
export const metadata: Metadata = { title: "Carretera" };
export default function Page() { return <main className="page-wrap py-8 sm:py-10"><p className="eyebrow">Benchmark 08 / percepción</p><h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Carretera<span className="text-accent-hi">.</span></h1><p className="mb-6 mt-3 max-w-3xl text-base text-muted">Carretera infinita y una sola vida. El tráfico no espera mientras el modelo piensa: gana quien cruza más carriles sin que lo atropellen.</p><CarreteraGame /></main>; }
