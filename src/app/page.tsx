import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { JevMark } from "@/components/brand/JevMark";
import { RecentResults } from "@/components/shell/RecentResults";

const cards = [
  { href: "/flappy", number: "01", title: "Flappy", overline: "TIEMPO REAL", description: "Un pájaro, tubos que no esperan y decisiones de vuelo por la red.", stat: "2 s", statLabel: "presupuesto por decisión" },
  { href: "/tetris", number: "02", title: "Tetris", overline: "BAJO PRESIÓN", description: "Dos pozos con las mismas piezas. El modelo elige dónde cae cada una.", stat: "2", statLabel: "pozos sincronizados" },
  { href: "/strawberry", number: "03", title: "Strawberry", overline: "EN PARALELO", description: "Una pregunta, N preguntas juntas o N llamadas: tiempo, acierto y coste.", stat: "N", statLabel: "preguntas simultáneas" },
  { href: "/bandeja", number: "04", title: "Bandeja", overline: "DECISIÓN TIPADA", description: "Tres etiquetas por ticket en una sola llamada, frente a una persona.", stat: "3", statLabel: "respuestas por llamada" },
  { href: "/cascada", number: "05", title: "Cascada", overline: "ESCALADO", description: "Laya decide primero; Jev y una persona reciben los casos difíciles.", stat: "A→B", statLabel: "dos umbrales" },
  { href: "/guardia", number: "06", title: "Guardia", overline: "SEGURIDAD", description: "Filtra instrucciones hostiles y mide las falsas alarmas.", stat: "60", statLabel: "entradas etiquetadas" },
  { href: "/chat", number: "07", title: "Chat en vivo", overline: "BAJO CARGA", description: "Un chat acelera y muestra cola, p95 y ritmo sostenible.", stat: "40/s", statLabel: "ritmo máximo de prueba" },
  { href: "/carretera", number: "08", title: "Carretera", overline: "PERCEPCIÓN", description: "Carretera infinita: hasta dónde llega cada piloto sin que lo atropellen.", stat: "∞", statLabel: "carriles" },
];

export default function Home() {
  return <main>
    <section className="page-wrap relative grid min-h-[min(700px,85dvh)] items-center gap-10 overflow-hidden py-20 lg:grid-cols-[1.1fr_.9fr]">
      <div className="relative z-10">
        <p className="eyebrow mb-7">Laboratorio de decisiones / edición 01</p>
        <h1 className="max-w-3xl text-[clamp(3.8rem,10vw,8.6rem)] font-semibold leading-[.94] tracking-[-.075em]">Jev<br /><span className="text-accent-hi">Benchmark.</span></h1>
        <p className="mt-8 max-w-[38rem] text-lg leading-relaxed text-muted">Ocho pruebas para medir cómo deciden Jev, Laya y una persona: juegos en tiempo real y decisiones sobre datos etiquetados.</p>
        <Link href="/strawberry" className="btn btn-primary mt-9">Empezar por Strawberry <ArrowUpRight size={18} /></Link>
      </div>
      <div className="relative mx-auto grid w-full max-w-[520px] place-items-center lg:max-w-none" aria-hidden="true">
        <div className="absolute aspect-square w-[75%] rounded-full border border-accent/20 shadow-[0_0_120px_10px_rgb(184_20_77_/_0.12)]" />
        <div className="absolute aspect-square w-[95%] rotate-45 border border-white/5" />
        <JevMark className="relative w-[70%] drop-shadow-[0_28px_45px_rgb(0_0_0_/_0.35)]" />
        <div className="metric absolute bottom-5 left-4 text-xs tracking-[.2em] text-faint">SYSTEM ONE / JEV-LATEST</div>
      </div>
    </section>

    <section className="page-wrap border-t border-line pt-9" aria-labelledby="benchmarks-title">
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3"><h2 id="benchmarks-title" className="text-3xl font-semibold tracking-tight">Juegos</h2><p className="text-sm text-muted">Decisiones mientras el mundo sigue avanzando.</p></div>
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <BenchmarkCard card={cards[0]} large />
        <div className="grid gap-4"><BenchmarkCard card={cards[1]} /><BenchmarkCard card={cards[7]} /></div>
      </div>
    </section>
    <section className="page-wrap mt-16 border-t border-line pt-9" aria-labelledby="decisions-title"><div className="mb-8 flex flex-wrap items-baseline justify-between gap-3"><h2 id="decisions-title" className="text-3xl font-semibold tracking-tight">Decisiones</h2><p className="text-sm text-muted">Acierto, confianza, coste y escala.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards.slice(2, 7).map(card => <BenchmarkCard key={card.href} card={card} />)}</div></section>
    <RecentResults />
  </main>;
}

function BenchmarkCard({ card, large = false }: { card: typeof cards[number]; large?: boolean }) {
  return <Link href={card.href} className={`panel group relative flex min-h-64 flex-col overflow-hidden p-6 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-accent-hi/50 sm:p-8 ${large ? "lg:min-h-[546px]" : ""}`}>
    <div className="flex items-center justify-between text-xs"><span className="eyebrow">{card.number} / {card.overline}</span><ArrowUpRight size={20} className="text-muted transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></div>
    <div className={`my-8 flex min-h-28 items-center justify-center ${large ? "lg:flex-1" : ""}`} aria-hidden="true">{card.href === "/flappy" ? <FlappyPreview /> : card.href === "/tetris" ? <TetrisPreview /> : card.href === "/strawberry" ? <StrawPreview /> : card.href === "/carretera" ? <RoadPreview /> : <span className="metric text-6xl font-semibold tracking-tighter text-accent-hi/80">{card.stat}</span>}</div>
    <div className="mt-auto flex items-end justify-between gap-4 border-t border-line pt-5"><div><h3 className="text-3xl font-semibold tracking-tight">{card.title}</h3><p className="mt-2 max-w-[20rem] text-sm leading-relaxed text-muted">{card.description}</p></div><div className="hidden shrink-0 text-right sm:block"><span className="metric block text-2xl">{card.stat}</span><span className="text-[11px] text-muted">{card.statLabel}</span></div></div>
  </Link>;
}

function FlappyPreview() { return <div className="relative h-44 w-52 overflow-hidden rounded-lg border border-white/10 bg-[#70c5ce] shadow-xl lg:h-60 lg:w-72"><div className="absolute inset-x-0 bottom-0 h-8 bg-[#ded895]" /><div className="absolute left-12 top-[42%] h-5 w-6 rounded-[40%] border-[3px] border-[#543847] bg-[#f5d54e] shadow-[7px_3px_0_-1px_#f5a623] motion-safe:animate-bounce" /><div className="absolute right-9 top-0 h-16 w-9 border-[3px] border-[#543847] bg-[#73bf2e] lg:h-23" /><div className="absolute right-9 bottom-8 h-20 w-9 border-[3px] border-[#543847] bg-[#73bf2e] lg:h-25" /></div>; }
function TetrisPreview() { return <div className="grid grid-cols-10 gap-[3px] rounded-lg border border-white/10 bg-[#152447] p-3 shadow-xl">{Array.from({ length: 50 }, (_, i) => <span key={i} className={`h-3 w-3 rounded-[2px] ${[21, 31, 32, 33, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49].includes(i) ? "bg-[#ae8fd3]" : "bg-[#24365a]"}`} />)}</div>; }
function StrawPreview() { return <div className="flex max-w-full gap-1 overflow-hidden">{"strawberry".split("").map((letter, i) => <span key={i} className={`metric grid h-8 w-7 shrink-0 place-items-center rounded border text-sm sm:h-10 sm:w-8 ${letter === "r" ? "border-accent-hi bg-accent text-white" : "border-white/10 bg-white/5 text-muted"}`}>{letter}</span>)}</div>; }
function RoadPreview() { return <div className="relative h-36 w-52 overflow-hidden rounded-lg border border-white/10 bg-[#09142e] shadow-xl">{[0, 1, 2, 3, 4].map(i => <div key={i} className="absolute inset-x-0 h-6 border-b border-dashed border-white/15" style={{ top: 8 + i * 24 }} />)}<div className="absolute left-8 top-3 h-4 w-10 rounded-sm bg-[#d9b34e]" /><div className="absolute right-8 top-[56px] h-4 w-10 rounded-sm bg-[#d57480]" /><div className="absolute left-1/2 top-[104px] h-4 w-4 -translate-x-1/2 rounded-full bg-white" /></div>; }
