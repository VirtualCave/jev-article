import { describe, expect, it } from "vitest";
import type { BenchAnswer } from "@/lib/bench/server";
import { bumperGaps, CAR_HIT, colToX, describeRoad, hitsPlayer, IDLE_LIMIT_S, laneIsCrossable, PLAYER_WIDTH, RoadEngine, SOON_S, wrapDelta, type RoadFacts } from "./engine";
import { mapRoadMove } from "./policy";

const noul = (value: number): BenchAnswer => ({ type: "noul", noul: value });

/** Reads the same facts the models get and answers the three questions perfectly. */
function oracle(facts: RoadFacts): Record<string, BenchAnswer> {
  return {
    ahead_safe: noul(facts.distance > SOON_S ? 1 : 0),
    danger_here: noul(facts.here === "danger" ? 1 : 0),
  };
}

function firstRoad(road: RoadEngine) {
  let row = 0;
  while (road.rowAt(row).kind !== "road") row++;
  return row;
}

describe("carretera engine", () => {
  it("builds an endless, reproducible road that starts on grass", () => {
    const a = new RoadEngine(), b = new RoadEngine();
    a.start(42); b.start(42);
    a.ensure(400); b.ensure(400);
    expect(a.rows.slice(0, 2).every(row => row.kind === "grass")).toBe(true);
    expect(a.rows.map(row => row.kind)).toEqual(b.rows.map(row => row.kind));
    expect(a.rows[120].cars.map(car => car.x)).toEqual(b.rows[120].cars.map(car => car.x));
    expect(a.rows.filter(row => row.kind === "road").length).toBeGreaterThan(200);
    for (const row of a.rows) if (row.kind === "road") {
      expect(laneIsCrossable(row.cars)).toBe(true);
      expect(Math.max(...bumperGaps(row.cars))).toBeGreaterThan(PLAYER_WIDTH);
    }
    const early = a.rows.filter(row => row.road >= 0 && row.road < 10).map(row => row.cars[0].speed);
    const late = a.rows.filter(row => row.road >= 150).map(row => row.cars[0].speed);
    expect(Math.min(...late)).toBeGreaterThan(Math.max(...early) * .9);
  });

  it("uses wrap-aware boxes so a visual overlap is a hit and a near miss is not", () => {
    expect(hitsPlayer(.5, { x: .5, speed: .1, length: .1 })).toBe(true);
    expect(hitsPlayer(.5, { x: .5 + CAR_HIT + .02, speed: .1, length: .1 })).toBe(false);
    expect(hitsPlayer(colToX(0), { x: .98, speed: .1, length: .12 })).toBe(true);
    expect(Math.abs(wrapDelta(.99, .02))).toBeCloseTo(.03);
  });

  it("ends the run on the first hit and keeps the best row", () => {
    const road = new RoadEngine(); road.start(7);
    const row = firstRoad(road);
    while (road.row < row - 1) road.act("advance");
    road.rows[row].cars = [{ x: road.playerX(), speed: 0, length: .1 }];
    road.act("advance");
    expect(road.running).toBe(false);
    expect(road.over).toBe("hit");
    expect(road.best).toBe(row);
    expect(road.crossed).toBe(0);
  });

  it("ends the run when the chicken stops making progress", () => {
    const road = new RoadEngine(); road.start(9);
    for (let t = 0; t < IDLE_LIMIT_S + 1; t += .25) road.step(.25);
    expect(road.over).toBe("idle");
  });

  it("moves on four directions and clamps the edges", () => {
    const road = new RoadEngine(); road.start(11);
    road.act("left"); expect(road.col).toBe(3);
    road.col = 0; road.act("left"); expect(road.col).toBe(0);
    road.col = 8; road.act("right"); expect(road.col).toBe(8);
    road.act("advance"); expect(road.row).toBe(1);
    road.act("back"); road.act("back"); expect(road.row).toBe(0);
  });

  it("describes both the lane ahead and the lane underfoot", () => {
    expect(describeRoad({ lane: 0, distance: 9, speed: 0, nearestOffset: 1, here: "grass" })).toContain("stands on grass");
    expect(describeRoad({ lane: 2, distance: .4, speed: .2, nearestOffset: .2, here: "danger" })).toContain("a car will reach it soon");
    expect(describeRoad({ lane: 2, distance: 3, speed: .2, nearestOffset: .4, here: "safe" })).toContain("none will reach it soon");
  });

  it("maps only the model's answers, never a hidden safety check", () => {
    const facts: RoadFacts = { lane: 1, distance: 1, speed: .1, nearestOffset: .4, here: "safe", ahead: "clear", left: "clear", right: "clear", back: "clear" };
    expect(mapRoadMove({ ahead_safe: noul(.2), danger_here: noul(.1) }, facts)).toBe("wait");
    expect(mapRoadMove({ ahead_safe: noul(.9) }, facts)).toBe("advance");
    expect(mapRoadMove({ ahead_safe: noul(.2), danger_here: noul(.9) }, facts)).toBe("back");
    expect(mapRoadMove({ ahead_safe: noul(.2), danger_here: noul(.9) }, { ...facts, back: "blocked" })).toBe("advance");
  });

  it("is playable: perfect perception with a model-like delay goes far", () => {
    const reached: number[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const road = new RoadEngine(); road.start(seed);
      while (road.running && road.elapsed < 240) {
        const facts = road.facts();
        const move = mapRoadMove(oracle(facts), facts);
        for (let t = 0; t < .3 && road.running; t += .05) road.step(.05);
        if (road.running) road.act(move);
      }
      reached.push(road.crossed);
    }
    expect(Math.min(...reached)).toBeGreaterThan(5);
    expect(reached.reduce((a, b) => a + b, 0) / reached.length).toBeGreaterThan(20);
  });
});
