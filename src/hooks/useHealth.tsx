"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { fetchHealth, type Health } from "@/lib/ai/client";

const initial: Health = {
  jev: { ok: false, detail: "Comprobando Jev" },
  laya: { ok: false, detail: "Comprobando Laya" },
};
const Context = createContext<Health>(initial);

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [health, setHealth] = useState(initial);
  useEffect(() => {
    let live = true;
    const load = async () => { const result = await fetchHealth(); if (live) setHealth(result); };
    void load();
    const timer = window.setInterval(load, 10_000);
    return () => { live = false; window.clearInterval(timer); };
  }, []);
  return <Context.Provider value={health}>{children}</Context.Provider>;
}

export const useHealth = () => useContext(Context);
