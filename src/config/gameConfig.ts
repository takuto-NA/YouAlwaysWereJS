/**
 * このファイルの役割: ゲーム全体の調整可能なパラメータを一元管理
 * ゲームバランス調整時はこのファイルのみを変更する
 */

// ゲームバランス調整用パラメータ（変更する可能性がある値）
export const GAME_CONFIG = {
  // グリッド設定
  GRID_SIZE: 10,

  // プレイヤー初期設定
  PLAYER_INITIAL_HEALTH: 100,
  PLAYER_INITIAL_SCORE: 0,
  PLAYER_INITIAL_POSITION: { x: 5, y: 5 },
  PLAYER_ATTACK_POWER: 20,

  // 敵設定
  ENEMY_INITIAL_HEALTH: 50,
  ENEMY_DAMAGE: 10,
  ENEMY_SPAWN_COUNT: 2,
  ENEMY_DEFEAT_SCORE: 50,

  // アイテム設定
  COIN_VALUE: 10,
  COIN_SPAWN_COUNT: 3,

  // UI設定
  HEALTH_BAR_WARNING_THRESHOLD: 30, // 体力バーが警告色になる閾値
  HEALTH_BAR_DANGER_THRESHOLD: 70, // 体力バーが緑色を維持する閾値
} as const;

// 算出される定数（調整不要・ゲーム内部で使用）
export const DERIVED_CONSTANTS = {
  MAX_GRID_INDEX: GAME_CONFIG.GRID_SIZE - 1,
  MIN_GRID_INDEX: 0,
  CENTER_POSITION: Math.floor(GAME_CONFIG.GRID_SIZE / 2),
} as const;

// ゲーム状態の種類（不変）
export const GAME_STATUS = {
  LOADING: "loading",
  PLAYING: "playing",
  PAUSED: "paused",
  GAME_OVER: "game_over",
  WON: "won",
} as const;

// セルタイプ（不変）
export const CELL_TYPE = {
  EMPTY: "empty",
  WALL: "wall",
  GOAL: "goal",
} as const;

// アイテムタイプ（不変）
export const ITEM_TYPE = {
  COIN: "coin",
  HEALTH: "health",
  POWER: "power",
} as const;

// 方向定義（不変）
export const DIRECTION = {
  UP: "up",
  DOWN: "down",
  LEFT: "left",
  RIGHT: "right",
} as const;

// アクションタイプ（不変）
export const ACTION_TYPE = {
  MOVE: "move",
  ATTACK: "attack",
  RESET: "reset",
} as const;
