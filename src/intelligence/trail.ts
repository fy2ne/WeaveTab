export type SemanticType = string;

export type TrailEntry = {
  timestamp: string;
  tool: string;
  input: Record<string, unknown>;
  result: {
    success: boolean;
    pageChanged: boolean;
    urlBefore: string;
    urlAfter: string;
    pageTypeBefore: string;
    pageTypeAfter: string;
    elementClicked?: {
      id: string;
      type: SemanticType;
      label: string;
      href?: string;
    };
  };
};

let trail: TrailEntry[] = [];

export function recordAction(entry: TrailEntry): void {
  trail.push(entry);
  if (trail.length > 20) {
    trail.shift();
  }
}

export function getLastAction(): TrailEntry | null {
  return trail.length > 0 ? trail[trail.length - 1] : null;
}

export function getTrail(): TrailEntry[] {
  return [...trail];
}

export function clearTrail(): void {
  trail = [];
}
