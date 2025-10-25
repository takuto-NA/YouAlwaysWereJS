/**
 * アプリケーション全体で使用される定数
 *
 * @description
 * マジックナンバーやマジック文字列を排除し、
 * 一箇所で値を管理することで保守性を向上させる
 */

/**
 * URLルーティング関連の定数
 */
export const ROUTES = {
  /** Kuzuデモ画面を表示するためのURLハッシュ */
  KUZU_DEMO_HASH: "#kuzu-demo",
} as const;

/**
 * システムメッセージID接頭辞
 */
export const MESSAGE_ID_PREFIX = {
  SYSTEM: "system",
  USER: "user",
  ASSISTANT: "assistant",
  ERROR: "error",
} as const;

/**
 * 初期システムメッセージのID
 */
export const INITIAL_SYSTEM_MESSAGE_ID = "system-1";

/**
 * リセット時のシステムメッセージID
 */
export const RESET_SYSTEM_MESSAGE_ID = "system-reset";

/**
 * システムプロンプトのメッセージID
 */
export const SYSTEM_PROMPT_MESSAGE_ID = "system-prompt";

/**
 * 表示モード名（日本語）
 */
export const DISPLAY_MODE_LABELS = {
  normal: "通常モード",
  novel: "ノベルモード",
  debug: "デバッグモード",
} as const;

/**
 * AIプロバイダー名（表示用）
 */
export const AI_PROVIDER_LABELS = {
  openai: "OpenAI/Groq",
  gemini: "Gemini",
} as const;
