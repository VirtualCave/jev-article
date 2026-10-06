import { describe, expect, it } from "vitest";
import { clearLines, emptyBoard, WellEngine } from "../src/lib/tetris/engine";
import { listPlacements } from "../src/lib/tetris/candidates";
import { COLS, ROWS } from "../src/lib/tetris/types";
import { FlappyEngine } from "../src/lib/flappy/engine";
import { describeWorld, mapAction } from "../src/lib/flappy/policy";
import { median, singleCorrect, truthCount } from "../src/lib/strawberry/aggregate";
import { normalizeInput } from "../src/lib/strawberry/input";
import { batchRequest, fanoutRequest, singleRequest } from "../src/lib/strawberry/questions";
import { tickets } from "../src/lib/data/tickets";
import { injections } from "../src/lib/data/injections";
import { chatMessages } from "../src/lib/data/chat";
import { buildInput } from "../src/lib/bench/sets";
import { accuracy, auroc, brier, cascade, confusion, coverageCurve, ece, majorityBaseline, maxSustainableRate, meanAbsoluteError, percentile, recallAtFpr } from "../src/lib/bench/metrics";
import { describeRoad, RoadEngine } from "../src/lib/carretera/engine";
import { mapRoadAction } from "../src/lib/carretera/policy";
import { packAnswers } from "../src/lib/ai/http";
import { choiceConfidence, scoreConfidence, withTypesafeConfidence } from "../src/lib/ai/confidence";
import { byPilot, isModelPilot, MODEL_PILOTS } from "../src/lib/ai/pilots";

describe("Tetris", () => {
  it("deduplicates O placements by resulting board", () => {
    const placements = listPlacements(emptyBoard(), "O");
    expect(placements).toHaveLength(9);
    expect(new Set(placements.map(p => p.x)).size).toBe(9);
  });
  it("keeps current height when forcing a pose", () => {
    const engine = new WellEngine(1);
    engine.start();
    engine.active = { type: "T", rot: 0, x: 3, y: 5 };
    expect(engine.forcePose(1, 4)).toBe(true);
    expect(engine.active?.y).toBe(5);
  });
  it("clears a full row", () => {
    const board = emptyBoard();
    board[ROWS - 1] = Array(COLS).fill(1);
    const result = clearLines(board);
    expect(result.cleared).toBe(1);
    expect(result.board[ROWS - 1]).toEqual(Array(COLS).fill(0));
  });
});

describe("Flappy", () => {
  const facts = { bird_y: .5, aim_y: .6, gap_y: .4, vy: 0, pipe_dx: .3 };
  it("describes the gap and maps the safety rules", () => {
    expect(describeWorld(facts)).toBe("The bird is below the gap.");
    expect(mapAction({ relative_to_gap: { choice: "below", probabilities: { below: .7 } } }, facts).action).toBe("flap");
    expect(mapAction({}, { ...facts, bird_y: .9 }).reason).toBe("flap:ground");
    expect(mapAction({}, { ...facts, bird_y: .05 }).reason).toBe("glide:ceiling");
    expect(mapAction({}, { ...facts, vy: -.3 }).reason).toBe("glide:rising");
    expect(mapAction({ relative_to_gap: { choice: "below", probabilities: { below: .5 } } }, facts).action).toBe("glide");
  });
  it("uses the same fixed physics step at 30 and 144 fps", () => {
    const a = new FlappyEngine(() => .5), b = new FlappyEngine(() => .5);
    a.start("human"); b.start("human");
    for (let i = 0; i < 12; i++) a.step(1 / 30);
    for (let i = 0; i < 58; i++) b.step(1 / 144);
    b.step(.4 - 58 / 144);
    expect(a.bird.y).toBeCloseTo(b.bird.y, 6);
    expect(a.pipes[0].x).toBeCloseTo(b.pipes[0].x, 6);
  });
});

describe("Strawberry", () => {
  it("validates and normalizes input", () => {
    expect(normalizeInput(" Strawberry ", "R")).toEqual({ word: "strawberry", letter: "r" });
    expect(normalizeInput("straw berry", "r")).toBeNull();
    expect(normalizeInput("word", "rr")).toBeNull();
  });
  it("builds one batch with N named questions", () => {
    expect(Object.keys(batchRequest("strawberry", "r").questions)).toEqual(Array.from({ length: 10 }, (_, i) => `pos_${i + 1}`));
    expect(singleRequest("strawberry", "r").questions.letter_count.type).toBe("choice");
    expect(fanoutRequest("strawberry", "r", 2).state).toEqual({ word: "strawberry", position: 3, character: "r" });
  });
  it("counts truth and takes a median", () => {
    expect(truthCount("strawberry", "r")).toBe(3);
    expect(median([30, 10, 20])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
    expect(singleCorrect(5, 8)).toBe(true);
  });
});

describe("New benchmarks", () => {
  it("keeps all editorial datasets complete and only accepts known IDs", () => {
    expect([tickets.length, injections.length, chatMessages.length]).toEqual([60, 60, 150]);
    expect(tickets.filter(ticket => ticket.churn)).toHaveLength(30);
    expect(buildInput("bandeja", { itemId: "ticket-1" })?.questions).toHaveProperty("churn");
    expect(buildInput("bandeja", { itemId: "missing" })).toBeNull();
    expect(buildInput("carretera", { facts: { lane: -1, distance: .2, speed: .1, nearestOffset: .2 } })).toBeNull();
  });
  it("knows the four model pilots and nothing else", () => {
    expect(MODEL_PILOTS).toEqual(["jev", "clef", "clef-flash", "laya"]);
    expect(["jev", "clef-flash", "laya"].every(isModelPilot)).toBe(true);
    expect(isModelPilot("human")).toBe(false);
    expect(Object.keys(byPilot(() => 0))).toEqual([...MODEL_PILOTS]);
  });
  it("rescales Clef's top probability to TypeSafe's confidence", () => {
    expect(choiceConfidence([.6, .3, .1])).toBeCloseTo(.4);
    expect(choiceConfidence([.6, .2, .2])).toBeCloseTo(.4);
    expect(scoreConfidence([0, .5, .5])).toBeCloseTo(.25);
    expect(scoreConfidence([.5, 0, .5])).toBeCloseTo(0);
    const answers = withTypesafeConfidence({ dept: { type: "choice", choice: "a", confidence: .5, probabilities: { a: .5, b: .5 } }, spam: { type: "noul", noul: .7 } });
    expect(answers.dept).toMatchObject({ choice: "a", confidence: 0 });
    expect(answers.spam).toEqual({ type: "noul", noul: .7 });
  });
  it("packs both existing Tetris and dataset answer shapes", () => {
    expect(packAnswers({ playable_well: { choice: "p0", confidence: .8, probabilities: { p0: .8 } } }).playable_well?.choice).toBe("p0");
    expect(packAnswers({ spam: { noul: .7 } }, { spam: { type: "noul" } }).spam).toEqual({ type: "noul", noul: .7 });
  });
  it("measures abstention, calibration, confusion and load", () => {
    const rows = [
      { predicted: true, truth: true, confidence: .9 },
      { predicted: false, truth: true, confidence: .6 },
      { predicted: false, truth: false, confidence: .8 },
    ];
    expect(accuracy(rows)).toBeCloseTo(2 / 3);
    expect(confusion(rows)).toEqual({ tp: 1, fp: 0, tn: 1, fn: 1 });
    expect(coverageCurve(rows).find(point => point.threshold === .75)).toMatchObject({ coverage: 2 / 3, accuracy: 1 });
    expect(ece(rows)).toBeGreaterThan(0);
    expect(percentile([100, 200, 300], .95)).toBe(290);
    expect(brier([{ probability: 1, positive: true }, { probability: 0, positive: false }])).toBe(0);
    expect(auroc([{ score: .9, positive: true }, { score: .1, positive: false }])).toBe(1);
    expect(recallAtFpr([{ score: .9, positive: true }, { score: .8, positive: true }, { score: .2, positive: false }], .05)).toBe(1);
    expect(meanAbsoluteError([{ predicted: 1, truth: 3 }, { predicted: 2, truth: 2 }])).toBe(1);
    expect(majorityBaseline(["a", "a", "b"])).toBeCloseTo(2 / 3);
    expect(maxSustainableRate([{ rate: 1, p95Ms: 500, pending: 0 }, { rate: 4, p95Ms: 2200, pending: 1 }])).toBe(1);
    expect(maxSustainableRate([{ rate: 1, p95Ms: 100, pending: 0 }, { rate: 4, p95Ms: 100, pending: 0, dropped: 2 }, { rate: 8, p95Ms: 100, pending: 0 }])).toBe(1);
  });
  it("escalates only uncertain cases and counts human review separately", () => {
    const result = cascade([
      { first: { predicted: "a", truth: "a", confidence: .9 }, firstMs: 100, firstCostUsd: .001 },
      { first: { predicted: "b", truth: "a", confidence: .4 }, jev: { predicted: "a", truth: "a", confidence: .8 }, firstMs: 100, firstCostUsd: .001, jevMs: 200, jevCostUsd: .01 },
      { first: { predicted: "b", truth: "a", confidence: .3 }, jev: { predicted: "b", truth: "a", confidence: .2 }, firstMs: 100, jevMs: 200 },
    ], .7, .7);
    expect([result.first, result.jev, result.human]).toEqual([1, 1, 1]);
    expect(result.automatedAccuracy).toBe(1);
    expect(result.meanModelLatencyMs).toBeCloseTo(700 / 3);
    expect(result.costUsd).toBeCloseTo(.012);
  });
  it("describes the road in words and lets only the model's answers pick the hop", () => {
    const road = new RoadEngine(); road.start(5);
    expect(road.facts().lane).toBe(0);
    const occupied = buildInput("carretera", { facts: { lane: 3, distance: 0, speed: .5, nearestOffset: 0, here: "danger" } });
    expect(occupied?.state).toContain("a car is on the crossing point right now");
    expect(occupied?.state).toContain("lane will reach it soon");
    expect(occupied?.state).not.toMatch(/\d/);
    expect(occupied?.questions).toHaveProperty("danger_here");
    expect(describeRoad({ lane: 0, distance: 9, speed: 0, nearestOffset: 1, here: "grass" })).toContain("No car can reach");
    expect(mapRoadAction({ ahead_safe: { type: "noul", noul: .4 } })).toBe("wait");
    expect(mapRoadAction({ ahead_safe: { type: "noul", noul: .9 } })).toBe("advance");
    road.step(.1); expect(road.elapsed).toBeCloseTo(.1);
  });
});
