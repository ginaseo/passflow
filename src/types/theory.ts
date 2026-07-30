export interface TheoryEntry {
  tag: string | null;
  name: string;
  page: number;
  subject: string;
}

export type TheoryMap = Record<string, TheoryEntry>;

export interface TheoryLink {
  label: string;
  page: number;
}
