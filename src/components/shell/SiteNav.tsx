"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { JevMark } from "@/components/brand/JevMark";
import { useHealth } from "@/hooks/useHealth";

const groups = [
  { label: "Juegos", links: [{ href: "/flappy", label: "Flappy" }, { href: "/tetris", label: "Tetris" }, { href: "/carretera", label: "Carretera" }] },
  { label: "Decisiones", links: [{ href: "/strawberry", label: "Strawberry" }, { href: "/bandeja", label: "Bandeja" }, { href: "/cascada", label: "Cascada" }, { href: "/guardia", label: "Guardia" }, { href: "/chat", label: "Chat en vivo" }] },
];

export function SiteNav() {
  const path = usePathname();
  const health = useHealth();
  const nav = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState<{ path: string; name: string | null }>({ path, name: null });
  if (menu.path !== path) setMenu({ path, name: null });
  const open = menu.name;
  const setOpen = (name: string | null) => setMenu({ path, name });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(current => ({ ...current, name: null })); };
    const onPointer = (event: PointerEvent) => { if (!nav.current?.contains(event.target as Node)) setMenu(current => ({ ...current, name: null })); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onPointer); };
  }, []);

  return <header className="sticky top-0 z-50 border-b border-line bg-bg/90 backdrop-blur-xl">
    <div className="page-wrap grid grid-cols-1 items-center gap-1 py-2 sm:flex sm:min-h-17 sm:gap-6">
      <Link href="/" className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight"><span aria-hidden="true"><JevMark className="h-8 w-8" /></span>Jev Benchmark</Link>
      <nav ref={nav} aria-label="Benchmarks" className="flex w-full items-center gap-1 sm:ml-auto sm:w-auto">
        {groups.map(group => {
          const active = group.links.some(link => link.href === path);
          const shown = open === group.label;
          return <div key={group.label} className="relative">
            <button type="button" aria-expanded={shown} aria-controls={`menu-${group.label}`} className={`rounded-md px-3 py-2 text-sm ${active || shown ? "bg-white/8 text-ink" : "text-muted hover:bg-white/8 hover:text-ink"}`} onClick={() => setOpen(shown ? null : group.label)}>{group.label}</button>
            {shown && <div id={`menu-${group.label}`} className={`absolute top-full z-50 mt-2 grid max-h-[70vh] w-[min(16rem,calc(100vw-2rem))] gap-1 overflow-auto rounded-xl border border-line bg-surface p-2 shadow-xl ${group.label === "Decisiones" ? "right-0" : "left-0"}`}>
              {group.links.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined} className={`rounded-md px-3 py-2 text-sm ${path === link.href ? "bg-white/8 text-ink" : "text-muted hover:bg-white/5 hover:text-ink"}`}>{link.label}</Link>)}
            </div>}
          </div>;
        })}
      </nav>
      <div className="flex items-center gap-3 sm:border-l sm:border-line sm:pl-5">
        <Status label="Jev" ok={health.jev.ok} detail={health.jev.detail} />
        <Status label="Laya" ok={health.laya.ok} detail={health.laya.detail} />
      </div>
    </div>
  </header>;
}

function Status({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  const pending = detail.startsWith("Comprobando") || detail.startsWith("Cargando");
  return <span title={detail} className="flex items-center gap-1.5 text-xs text-muted"><i aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: ok ? "var(--ok)" : pending ? "var(--warn)" : "var(--faint)" }} />{label}<span className="sr-only">: {detail}</span></span>;
}
