import type { Metadata } from "next";
import { BandejaBench } from "@/components/bench/bandeja/BandejaBench";
export const metadata: Metadata = { title: "Bandeja" };
export default function Page() { return <main className="page-wrap py-12 sm:py-16"><p className="eyebrow">Benchmark 04 / decisión tipada</p><h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-7xl">Bandeja<span className="text-accent-hi">.</span></h1><p className="mb-10 mt-5 max-w-3xl text-lg text-muted">Tres respuestas tipadas en una llamada frente a una persona que clasifica con el teclado.</p><BandejaBench /></main>; }
