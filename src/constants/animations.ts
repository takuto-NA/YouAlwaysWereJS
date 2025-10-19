/**
 * アニメーション関連の定数
 * 
 * UI全体で一貫したアニメーションタイミングを保つため、
 * 遅延時間を一箇所で管理
 */

export const ANIMATION_DELAYS = {
  NONE: '0s',
  SHORT: '0.1s',
  MEDIUM: '0.2s',
  LONG: '0.4s',
} as const;

export const SAVE_MESSAGE_TIMEOUT_MS = 1500;

