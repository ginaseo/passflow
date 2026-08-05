import type { Mode } from "./progress";

export type TimeoutBehavior = "wrong" | "warn" | "ignore";
export type ReviewOrder = "sequential" | "random";

export interface Settings {
  autoSaveWrongNotes: boolean;
  defaultMode: Mode;
  timeoutBehavior: TimeoutBehavior;
  reviewOrder: ReviewOrder;
}

export const DEFAULT_SETTINGS: Settings = {
  autoSaveWrongNotes: true,
  defaultMode: "study",
  timeoutBehavior: "wrong",
  reviewOrder: "sequential",
};
