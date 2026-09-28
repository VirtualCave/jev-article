import type { Metadata } from "next";
import { GuardiaBench } from "@/components/bench/guardia/GuardiaBench";
export const metadata: Metadata = { title: "Guardia" };
export default function Page() { return <main className="page-wrap py-12 sm:py-16"><p className="eyebrow">Benchmark 06 / seguridad</p><h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-7xl">Guardia<span className="text-accent-hi">.</span></h1><p className="mb-10 mt-5 max-w-3xl text-lg text-muted">Un filtro para entradas de agente: amenazas detectadas, falsas alarmas y tiempo añadido.</p><GuardiaBench /></main>; }
