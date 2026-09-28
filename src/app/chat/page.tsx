import type { Metadata } from "next";
import { ChatBench } from "@/components/bench/ChatBench";
export const metadata: Metadata = { title: "Chat en vivo" };
export default function Page() {
  return (
    <main className="page-wrap overflow-anchor-none py-3">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="eyebrow">Benchmark 07 / bajo carga</p>
        <h1 className="text-2xl font-semibold tracking-tight">Chat en vivo<span className="text-accent-hi">.</span></h1>
      </div>
      <ChatBench />
    </main>
  );
}
