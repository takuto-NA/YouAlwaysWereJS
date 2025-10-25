/**
 * エラーハンドリングとロギングのユーティリティ
 *
 * @description
 * アプリケーション全体で一貫したエラー処理とロギングを提供する。
 * すべてのエラーをこのユーティリティ経由で処理することで、
 * デバッグ情報の統一フォーマット化とトレース追跡を容易にする。
 *
 * @why
 * - エラー情報を構造化し、デバッグ効率を大幅に向上
 * - 開発/本番環境で適切なログレベルを自動切り替え
 * - 型安全なエラー処理により、実行時エラーを防ぐ
 * - Tauri特有のエラーを適切にハンドリング
 */
/* eslint-disable no-console */

/**
 * エラー情報をコンソールに出力
 *
 * @param context - エラーが発生した処理の名前
 * @param error - キャッチされたエラーオブジェクト
 * @param additionalData - エラーに関連する追加情報（オプション）
 *
 * @why 開発環境では詳細なスタックトレースを、本番環境ではコンパクトな形式でログ出力し、
 *      デバッグ効率とパフォーマンスを両立するため
 */
export function logError(
  context: string,
  error: unknown,
  additionalData?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // 開発環境ではグループ化とビジュアルで問題の特定を容易にするため
  if (import.meta.env.DEV) {
    console.group(`🔴 [${context} Error]`);
    console.error("Message:", errorMessage);
    if (errorStack) {
      console.error("Stack:", errorStack);
    }
    if (additionalData && Object.keys(additionalData).length > 0) {
      console.error("Additional Data:", additionalData);
    }
    console.error("Timestamp:", new Date().toISOString());
    console.error("Full Error Object:", error);
    console.groupEnd();
  } else {
    // 本番環境ではコンソールのノイズを減らし、必要な情報のみ記録するため
    console.error(`[${context} Error]`, {
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
      ...additionalData,
    });
  }
}

/**
 * 警告情報をコンソールに出力
 *
 * @param context - 警告が発生した処理の名前
 * @param message - 警告メッセージ
 * @param data - 警告に関連するデータ（オプション）
 *
 * @why エラーではないが注意が必要な状況（破損データ、非推奨API使用等）を記録し、
 *      本番環境での異常状態を早期に発見するため
 */
export function logWarning(context: string, message: string, data?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.group(`⚠️ [${context} Warning]`);
    console.warn("Message:", message);
    if (data && Object.keys(data).length > 0) {
      console.warn("Data:", data);
    }
    console.warn("Timestamp:", new Date().toISOString());
    console.groupEnd();
  } else {
    console.warn(`[${context} Warning]`, {
      message,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }
}

/**
 * デバッグ情報をコンソールに出力
 *
 * @param context - デバッグ対象の処理名
 * @param message - デバッグメッセージ
 * @param data - デバッグデータ（オプション）
 *
 * @why 開発中の動作確認用ログを出力し、本番環境では自動的に無効化することで
 *      パフォーマンスへの影響を防ぐため
 */
export function logDebug(context: string, message: string, data?: Record<string, unknown>): void {
  // 本番ビルドではTree Shakingにより完全に削除されるため、パフォーマンスへの影響なし
  if (import.meta.env.DEV) {
    console.group(`🔵 [${context} Debug]`);
    console.log("Message:", message);
    if (data && Object.keys(data).length > 0) {
      console.log("Data:", data);
    }
    console.log("Timestamp:", new Date().toISOString());
    console.groupEnd();
  }
}

/**
 * エラーオブジェクトから安全にメッセージを抽出
 *
 * @param error - エラーオブジェクト
 * @returns エラーメッセージ文字列
 *
 * @why unknown型のエラーを型安全に処理し、どんな値がthrowされても
 *      文字列メッセージを確実に取得できるようにするため
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error occurred";
}

/**
 * Tauri APIエラーを処理
 *
 * @param error - Tauri APIから返されたエラー
 * @param fallbackMessage - フォールバック時のメッセージ
 * @returns ユーザーに表示するエラーメッセージ
 *
 * @why 開発サーバーでブラウザから直接アクセスした場合など、Tauri APIが
 *      利用できない環境でもアプリを継続動作させるため
 */
export function handleTauriError(error: unknown, fallbackMessage: string): string {
  const errorMessage = getErrorMessage(error);

  // Tauriバックエンドなしで実行されている場合は警告のみでフォールバック
  if (errorMessage.includes("__TAURI_INTERNALS__")) {
    logWarning("Tauri API", "Running without Tauri backend", { fallbackMessage });
    return fallbackMessage;
  }

  logError("Tauri API", error);
  return `処理に失敗しました: ${errorMessage}`;
}
