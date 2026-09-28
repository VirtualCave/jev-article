import type { Mode } from "./types";

export const MODES: Mode[] = ["single", "batch", "fanout"];

export const MODE_META: Record<Mode, { number: string; title: string; blurb: string; why: string; calls: (n: number) => string }> = {
  single: {
    number: "01",
    title: "1 consulta de recuento",
    blurb: "Una petición con una pregunta sobre el total.",
    why: "Pide el total en una ida y vuelta. Es el suelo de latencia y de tokens; si el modelo falla al contar, ese ahorro no equivale a una respuesta correcta.",
    calls: () => "1 llamada",
  },
  batch: {
    number: "02",
    title: "1 consulta con N preguntas",
    blurb: "Una petición, una pregunta por cada posición.",
    why: "Mete un juicio por letra en la misma petición. Mide si descomponer sube el acierto sin pagar N viajes de red, a costa de más tokens que el recuento.",
    calls: () => "1 llamada",
  },
  fanout: {
    number: "03",
    title: "N consultas simultáneas",
    blurb: "Una petición por letra, lanzadas a la vez.",
    why: "Lanza una petición por letra en paralelo. El reloj espera a la más lenta y los tokens crecen con N; es el tope de paralelismo frente a agrupar.",
    calls: n => `${n} llamadas`,
  },
};

export const MODE_BAR: Record<Mode, string> = {
  single: "bg-accent-hi",
  batch: "bg-laya",
  fanout: "bg-white/55",
};
