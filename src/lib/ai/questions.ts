import type { Board, PieceType, Placement } from "../tetris/types";
import { clip, describePlacement, describeWell, pieceWords } from "./verbalize";

export type DecisionState = {
  falling_piece: string;
  next_piece: string;
  current_well: string;
  candidate_wells: Record<string, string>;
};

export type DecisionQuestions = {
  playable_well: {
    type: "choice";
    instructions: string;
    criteria: Record<string, string>;
  };
  stack_danger: {
    type: "score";
    instructions: string;
    criteria: [string, string, string, string];
  };
  clear_is_available: {
    type: "noul";
    instructions: string;
    criteria: { true: string; false: string };
  };
  burial_is_avoidable: {
    type: "noul";
    instructions: string;
    criteria: { true: string; false: string };
  };
};

export type TaggedPlacement = Placement & { id: string };

export function tagPlacements(list: Placement[]): TaggedPlacement[] {
  return list.map((p, i) => ({
    ...p,
    id: `p${i}`,
    description: describePlacement(p),
  }));
}

export function buildDecisionInput(
  board: Board,
  falling: PieceType,
  next: PieceType,
  candidates: TaggedPlacement[],
): { state: DecisionState; questions: DecisionQuestions } {
  const candidate_wells: Record<string, string> = {};
  for (const p of candidates) {
    candidate_wells[p.id] = clip(p.description);
  }

  const state: DecisionState = {
    falling_piece: pieceWords(falling),
    next_piece: pieceWords(next),
    current_well: describeWell(board),
    candidate_wells,
  };

  const questions: DecisionQuestions = {
    playable_well: {
      type: "choice",
      instructions:
        "Which well in `candidate_wells` is most playable? Prefer an even floor, no buried cells, and a lower stack. A full row helps when it keeps the floor even.",
      criteria: candidate_wells,
    },
    stack_danger: {
      type: "score",
      instructions: "How close is `current_well` to topping out?",
      criteria: [
        "The stack is low. Plenty of room.",
        "The stack is mid-height. Comfortable.",
        "The stack is high. Mistakes are costly.",
        "The stack is near the top. The next few drops may end the game.",
      ],
    },
    clear_is_available: {
      type: "noul",
      instructions: "Does at least one well in `candidate_wells` complete a full row?",
      criteria: {
        true: "At least one candidate completes a full row.",
        false: "No candidate completes a full row.",
      },
    },
    burial_is_avoidable: {
      type: "noul",
      instructions: "Does at least one well in `candidate_wells` avoid burying empty cells?",
      criteria: {
        true: "A placement exists that does not bury empty cells.",
        false: "Every placement buries empty cells.",
      },
    },
  };

  return { state, questions };
}
