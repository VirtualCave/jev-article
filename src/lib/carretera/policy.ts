import type { BenchAnswer } from "@/lib/bench/server";
import type { RoadAction, RoadFacts } from "./engine";

const yes = (answer: BenchAnswer | undefined) => answer?.type === "noul" ? answer.noul >= .5 : null;

/**
 * Only the model's answers choose the hop. The one rule from code: when the model says staying is
 * dangerous and a car already fills the space behind, retreating is impossible, so it hops ahead.
 */
export function mapRoadMove(answers: Record<string, BenchAnswer>, facts?: RoadFacts): RoadAction {
  if (yes(answers.ahead_safe)) return "advance";
  if (yes(answers.danger_here)) return facts?.back === "blocked" ? "advance" : "back";
  return "wait";
}

export function mapRoadAction(answers: Record<string, BenchAnswer>): "advance" | "wait" {
  return mapRoadMove(answers) === "advance" ? "advance" : "wait";
}
