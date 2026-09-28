"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readHistory, type HistoryEntry } from "@/lib/history";

export function RecentResults() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  useEffect(() => { const id = requestAnimationFrame(() => setItems(readHistory().slice(0, 5))); return () => cancelAnimationFrame(id); }, []);
  return <section className="page-wrap mt-18 pb-24">
    <div className="mb-6 flex items-baseline justify-between gap-4"><h2 className="text-2xl font-semibold tracking-tight">Últimos resultados</h2><span className="eyebrow">Guardados en este navegador</span></div>
    {items.length ? <div className="divide-y divide-line border-y border-line">{items.map(item => <Link key={item.id} href={`/${item.kind}`} className="grid gap-1 py-4 transition-colors hover:bg-white/3 sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-4"><span className="text-sm text-accent-hi capitalize">{item.kind}</span><span className="font-medium">{item.label}<span className="ml-3 text-sm font-normal text-muted">{item.detail}</span></span><time className="metric text-xs text-muted">{new Date(item.at).toLocaleDateString("es-ES")}</time></Link>)}</div> : <div className="panel px-6 py-7 text-sm text-muted">Todavía no hay resultados. Ejecuta un benchmark para verlos aquí.</div>}
  </section>;
}
