/**
 * タイプライター効果の定数
 *
 * テキスト表示速度のデフォルト値を管理
 */

// ユーザー設定がない場合のデフォルト速度（ミリ秒）
export const DEFAULT_TYPEWRITER_SPEED_MS = 20;

// useTypewriterフックの内部デフォルト速度（ミリ秒）
// storageの設定よりも遅めに設定し、より読みやすい速度にする
export const HOOK_DEFAULT_SPEED_MS = 30;
