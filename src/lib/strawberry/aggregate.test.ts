import { describe, expect, it } from "vitest";
import { buildVerdict, median, modeStats, percentile, singleCorrect, summarize, truthCount } from "./aggregate";
import type { BenchResult, Mode } from "./types";

function sample(mode: Mode, wallMs: number, inputTokens: number, correct = true, extras: Partial<BenchResult> = {}): BenchResult {
  return {
    ok: true,
    mode,
    word: "strawberry",
    letter: "r",
    model: "jev-latest",
    wallMs,
    calls: [],
    count: correct ? 3 : 1,
    truth: 3,
    correct,
    usage: { inputTokens, costUsd: inputTokens * 0.000000042 },
    ...extras,
  };
}

function pack(single: BenchResult[], batch: BenchResult[], fanout: BenchResult[]) {
  return { single, batch, fanout };
}

describe("strawberry aggregate", () => {
  it("counts letters and applies the five-or-more rule", () => {
    expect(truthCount("strawberry", "r")).toBe(3);
    expect(singleCorrect(5, 8)).toBe(true);
    expect(singleCorrect(4, 8)).toBe(false);
  });

  it("takes a median and interpolates percentiles", () => {
    expect(median([30, 10, 20])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
    expect(percentile([10, 20, 30], 0.25)).toBe(15);
    expect(percentile([10, 20, 30], 0.75)).toBe(25);
    expect(percentile([100], 0.25)).toBe(100);
  });

  it("summarizes time, tokens and spread", () => {
    const summary = summarize([
      { wallMs: 100, usage: { inputTokens: 40, costUsd: 1 } },
      { wallMs: 200, usage: { inputTokens: 60, costUsd: 3 } },
      { wallMs: 300, usage: { inputTokens: 50, costUsd: 2 } },
    ]);
    expect(summary.medianMs).toBe(200);
    expect(summary.minMs).toBe(100);
    expect(summary.maxMs).toBe(300);
    expect(summary.p25Ms).toBe(150);
    expect(summary.p75Ms).toBe(250);
    expect(summary.medianTokens).toBe(50);
    expect(summary.meanTokens).toBe(50);
    expect(modeStats([])).toBeNull();
  });

  it("writes a headline when grouping N questions is faster and cheaper", () => {
    const verdict = buildVerdict(pack(
      [sample("single", 100, 50), sample("single", 110, 50), sample("single", 120, 50)],
      [sample("batch", 200, 80), sample("batch", 210, 80), sample("batch", 220, 80)],
      [sample("fanout", 800, 400), sample("fanout", 840, 400), sample("fanout", 880, 400)],
    ));
    expect(verdict?.fastest).toEqual(["single"]);
    expect(verdict?.cheapest).toEqual(["single"]);
    expect(verdict?.accuracyTied).toBe(true);
    expect(verdict?.headline).toBe("Agrupar N preguntas en una consulta fue 4 veces más rápido que N consultas simultáneas y gastó 320 tokens menos, con el mismo acierto (3/3). En mediana, 1 consulta de recuento ganó en tiempo (110 ms) y en tokens (50). Las tres acertaron 3 de 3.");
    expect(verdict?.warnings).toEqual([]);
  });

  it("warns when accuracy differs and notes that counting is not equivalent", () => {
    const verdict = buildVerdict(pack(
      [sample("single", 100, 50, false), sample("single", 110, 50, false), sample("single", 120, 50, false)],
      [sample("batch", 200, 80), sample("batch", 210, 80), sample("batch", 220, 80)],
      [sample("fanout", 800, 400), sample("fanout", 840, 400), sample("fanout", 880, 400)],
    ));
    expect(verdict?.accuracyTied).toBe(false);
    expect(verdict?.mostAccurate).toEqual(["batch", "fanout"]);
    expect(verdict?.warnings[0]).toMatch(/acierto no es el mismo/);
    expect(verdict?.notes.some(note => note.includes("Descomponer por letra"))).toBe(true);
    expect(verdict?.headline).toContain("con acierto 3/3 en esas dos");
    expect(verdict?.headline).toContain("El mejor acierto lo compartieron");
  });

  it("notes a single round has no spread", () => {
    const verdict = buildVerdict(pack(
      [sample("single", 100, 40)],
      [sample("batch", 200, 80)],
      [sample("fanout", 900, 400)],
    ));
    expect(verdict?.notes.some(note => note.includes("una sola ronda"))).toBe(true);
  });

  it("notes overlapping time ranges when medians still differ", () => {
    const verdict = buildVerdict(pack(
      [sample("single", 80, 40), sample("single", 90, 40), sample("single", 100, 40)],
      [sample("batch", 200, 80), sample("batch", 300, 80), sample("batch", 400, 80)],
      [sample("fanout", 280, 400), sample("fanout", 350, 400), sample("fanout", 420, 400)],
    ));
    expect(verdict?.notes.some(note => note.includes("se solapan"))).toBe(true);
  });

  it("mentions the five-or-more scoring when truth is at least 5", () => {
    const verdict = buildVerdict(pack(
      [sample("single", 100, 40, true, { truth: 6, count: 5 })],
      [sample("batch", 200, 80, true, { truth: 6, count: 6 })],
      [sample("fanout", 800, 400, true, { truth: 6, count: 6 })],
    ));
    expect(verdict?.notes.some(note => note.includes("cinco o más"))).toBe(true);
  });
});
