import type { Metadata } from "next";
import { FlappyGame } from "@/components/flappy/FlappyGame";

export const metadata: Metadata = { title: "Flappy" };

export default function FlappyPage() {
  return <main className="page-wrap py-12 sm:py-16"><div className="mb-12"><p className="eyebrow">Benchmark 01 / tiempo real</p><h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-7xl">Flappy<span className="text-accent-hi">.</span></h1><p className="mt-5 max-w-2xl text-lg text-muted">Un piloto decide si aletear o planear. Los tubos y la gravedad no esperan a la red.</p></div><FlappyGame /></main>;
}
