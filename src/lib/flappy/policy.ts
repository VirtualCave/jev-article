import type { Facts } from "./engine";

export const QUESTIONS = { relative_to_gap: { type: "choice" as const, instructions: "Where is the bird relative to the gap?", criteria: { below: "the bird is below the gap", above: "the bird is above the gap" } } };
export type FlightAnswers = { relative_to_gap?: { choice?: string; probabilities?: Record<string, number> } };

export function describeWorld(facts: Facts) {
  return facts.aim_y > facts.gap_y ? "The bird is below the gap." : "The bird is above the gap.";
}

export function mapAction(answers: FlightAnswers, facts: Facts): { action: "flap" | "glide"; reason: string } {
  const relative = answers.relative_to_gap;
  const below = Number(relative?.probabilities?.below ?? 0);
  if (facts.bird_y > .84) return { action: "flap", reason: "flap:ground" };
  if (facts.bird_y < .10) return { action: "glide", reason: "glide:ceiling" };
  if (facts.vy < -.18) return { action: "glide", reason: "glide:rising" };
  if (relative?.choice === "below" && below >= .55) return { action: "flap", reason: "flap:below" };
  return { action: "glide", reason: "glide:above" };
}
