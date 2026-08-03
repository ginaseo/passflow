import type { Mode } from "./progress";

export type TimeoutBehavior = "wrong" | "warn" | "ignore";

export interface Settings {
  autoSaveWrongNotes: boolean;
  defaultMode: Mode;
  timeoutBehavior: TimeoutBehavior;
}

export const DEFAULT_SETTINGS: Settings = {
  autoSaveWrongNotes: true,
  defaultMode: "study",
  timeoutBehavior: "wrong",
};
