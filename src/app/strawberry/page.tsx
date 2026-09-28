import type { Metadata } from "next";
import { StrawberryBench } from "@/components/strawberry/StrawberryBench";

export const metadata: Metadata = { title: "Strawberry" };

export default function StrawberryPage() {
  return <main className="page-wrap py-12 sm:py-16"><div className="mb-12"><p className="eyebrow">Benchmark 03 / en paralelo</p><h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-7xl">Strawberry<span className="text-accent-hi">.</span></h1><p className="mt-5 max-w-3xl text-lg text-muted">Tres formas de contar la misma letra. El recuento es barato; N preguntas juntas descomponen el problema en una ida y vuelta; N consultas simultáneas miden el coste de paralelizar. Cada ronda rota el orden y se comparan medianas.</p></div><StrawberryBench /></main>;
}
