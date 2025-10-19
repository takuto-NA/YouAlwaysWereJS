export interface Position {
  x: number;
  y: number;
}

export interface Player {
  name: string;
  health: number;
  score: number;
  position: Position;
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  health: number;
  damage: number;
}

export interface Item {
  x: number;
  y: number;
  type: "coin" | "health" | "power";
  value: number;
}

export interface Cell {
  x: number;
  y: number;
  type: "empty" | "wall" | "goal";
  occupied?: boolean;
}

export interface GameState {
  status: "loading" | "playing" | "paused" | "game_over" | "won";
  player: Player;
  grid: Cell[][];
  enemies: Enemy[];
  items: Item[];
}

export type GameAction =
  | { type: "move"; direction: "up" | "down" | "left" | "right" }
  | { type: "attack" }
  | { type: "reset" };

// Future AI integration types
export interface AIContext {
  gameState: GameState;
  history: GameAction[];
}

export interface AISuggestion {
  action: GameAction;
  reasoning: string;
  confidence: number;
}

// Display mode types for chat interface
export type DisplayMode = "normal" | "novel" | "debug";

export interface DisplaySettings {
  mode: DisplayMode;
  showTimestamps: boolean;
  showDebugInfo: boolean;
}
