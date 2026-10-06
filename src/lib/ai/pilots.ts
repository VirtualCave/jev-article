/** Model pilots in the order the web lists them. Jev and both Clef models answer from hosted APIs; Laya runs in a local sidecar. */
export const MODEL_PILOTS = ["jev", "clef", "clef-flash", "laya"] as const;
export type ModelPilot = (typeof MODEL_PILOTS)[number];

export const PILOT_LABEL: Record<ModelPilot, string> = { jev: "Jev", clef: "Clef", "clef-flash": "Clef-Flash", laya: "Laya" };
export const PILOT_COLOR: Record<ModelPilot, string> = { jev: "var(--accent-hi)", clef: "var(--clef)", "clef-flash": "var(--clef-flash)", laya: "var(--laya)" };
/** Requests in flight per dataset run: the local Laya sidecar answers one at a time. */
export const PILOT_CONCURRENCY: Record<ModelPilot, number> = { jev: 4, clef: 4, "clef-flash": 4, laya: 1 };

export const isModelPilot = (value: unknown): value is ModelPilot => typeof value === "string" && (MODEL_PILOTS as readonly string[]).includes(value);

export function byPilot<T>(make: (pilot: ModelPilot) => T): Record<ModelPilot, T> {
  return Object.fromEntries(MODEL_PILOTS.map(pilot => [pilot, make(pilot)])) as Record<ModelPilot, T>;
}
