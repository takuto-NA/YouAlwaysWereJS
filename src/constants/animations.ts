/**
 * アニメーション関連の定数
 *
 * UI全体で一貫したアニメーションタイミングを保つため、
 * 遅延時間を一箇所で管理
 */

export const ANIMATION_DELAYS = {
  NONE: "0s",
  SHORT: "0.1s",
  MEDIUM: "0.2s",
  LONG: "0.4s",
} as const;

export const SAVE_MESSAGE_TIMEOUT_MS = 1500;

export const SPLASH_DISPLAY_DURATION_MS = 1200;
export const SPLASH_FADE_DURATION_MS = 500;
export const SPLASH_TOTAL_DURATION_MS =
  SPLASH_DISPLAY_DURATION_MS + SPLASH_FADE_DURATION_MS;

export const SPLASH_SHELL_ENTER_MS = 600;
export const SPLASH_SHELL_EXIT_MS = 450;
export const SPLASH_CONTENT_ENTER_MS = 350;
export const SPLASH_CONTENT_EXIT_MS = 300;
