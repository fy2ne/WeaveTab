export interface ActionMemory {
  tool: string;
  targetId?: string;
  targetLabel?: string;
  targetUrl?: string;
  textTyped?: string;
  keyDispatched?: string;
  timestamp: string;
}

export const memory = {
  lastAction: null as ActionMemory | null,

  recordAction(action: Omit<ActionMemory, "timestamp">) {
    this.lastAction = {
      ...action,
      timestamp: new Date().toISOString(),
    };
  }
};
