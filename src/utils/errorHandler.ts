/**
 * このファイルの役割: エラー処理を統一し、デバッグ効率を向上させる
 * すべてのエラーはこのユーティリティを通じてログ出力することで、
 * コンソールでの追跡が容易になる
 */

/**
 * エラー情報をコンソールに出力する
 *
 * なぜこの関数が必要か:
 * - エラーの発生場所（コンテキスト）を明確にする
 * - スタックトレース、タイムスタンプなど、デバッグに必要な情報を統一フォーマットで出力
 * - エラーの型安全な処理を提供
 *
 * @param context - エラーが発生した処理の名前（例: "Game Initialization", "Player Movement"）
 * @param error - キャッチされたエラーオブジェクト
 * @param additionalData - エラーに関連する追加情報（オプション）
 */
export function logError(
  context: string,
  error: unknown,
  additionalData?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[${context} Error]`, {
    message: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
    ...additionalData,
  });
}

/**
 * 警告情報をコンソールに出力する
 *
 * なぜwarningレベルが必要か:
 * - エラーではないが注意が必要な状況を記録
 * - 本番環境で発生する可能性がある異常な状態を早期発見
 *
 * @param context - 警告が発生した処理の名前
 * @param message - 警告メッセージ
 * @param data - 警告に関連するデータ（オプション）
 */
export function logWarning(
  context: string,
  message: string,
  data?: Record<string, unknown>
): void {
  console.warn(`[${context} Warning]`, {
    message,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * デバッグ情報をコンソールに出力する
 *
 * なぜdebugレベルが必要か:
 * - 開発中の動作確認に使用
 * - 本番環境では環境変数で無効化可能にする
 *
 * @param context - デバッグ対象の処理名
 * @param message - デバッグメッセージ
 * @param data - デバッグデータ（オプション）
 */
export function logDebug(
  context: string,
  message: string,
  data?: Record<string, unknown>
): void {
  // 開発環境でのみ出力（本番では無効化）
  if (import.meta.env.DEV) {
    console.log(`[${context} Debug]`, {
      message,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }
}

/**
 * エラーオブジェクトから安全にメッセージを抽出する
 *
 * なぜこの関数が必要か:
 * - unknown型のエラーを型安全に処理
 * - エラーメッセージの一貫性を保証
 *
 * @param error - エラーオブジェクト
 * @returns エラーメッセージ文字列
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Tauri APIエラーを処理する
 *
 * なぜこの関数が必要か:
 * - Tauri APIが利用できない環境（ブラウザ直接アクセス）でのフォールバック処理
 * - エラーメッセージをユーザーフレンドリーに変換
 *
 * @param error - Tauri APIから返されたエラー
 * @param fallbackMessage - フォールバック時のメッセージ
 * @returns ユーザーに表示するエラーメッセージ
 */
export function handleTauriError(error: unknown, fallbackMessage: string): string {
  const errorMessage = getErrorMessage(error);

  // Tauri APIが利用できない場合（開発サーバーで直接ブラウザアクセスした場合）
  if (errorMessage.includes('__TAURI_INTERNALS__')) {
    logWarning('Tauri API', 'Running without Tauri backend', { fallbackMessage });
    return fallbackMessage;
  }

  // その他のTauri APIエラー
  logError('Tauri API', error);
  return `処理に失敗しました: ${errorMessage}`;
}
