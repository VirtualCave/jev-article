import type { Metadata } from "next";
import { CascadaBench } from "@/components/bench/cascada/CascadaBench";
export const metadata: Metadata = { title: "Cascada" };
export default function Page() { return <main className="page-wrap py-12 sm:py-16"><p className="eyebrow">Benchmark 05 / escalado</p><h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-7xl">Cascada<span className="text-accent-hi">.</span></h1><p className="mb-10 mt-5 max-w-3xl text-lg text-muted">Resolver barato primero y escalar solo las decisiones inciertas.</p><CascadaBench /></main>; }
