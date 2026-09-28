import type { Metadata } from "next";
import { Arena } from "@/components/tetris/Arena";

export const metadata: Metadata = { title: "Tetris" };

export default function TetrisPage() {
  return <main className="page-wrap py-12 sm:py-16"><div className="mb-12"><p className="eyebrow">Benchmark 02 / bajo presión</p><h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-7xl">Tetris<span className="text-accent-hi">.</span></h1><p className="mt-5 max-w-2xl text-lg text-muted">Jev, Laya o tú eligen entre caídas legales. Ambos pozos reciben las mismas piezas, pero cada decisión cambia el tablero.</p></div><Arena /></main>;
}
