/**
 * localStorageへの型安全なアクセスを提供するストレージユーティリティ
 *
 * @description
 * アプリケーション設定、プロンプト設定、表示設定をlocalStorageに永続化する。
 * 一元化されたストレージ管理により、quota超過や不正なJSONなどのエラーを
 * 適切にログ記録し、診断を容易にする。
 *
 * @why
 * - ストレージロジックを一箇所に集約することでDRY原則を守る
 * - エラーハンドリングとロギングを統一し、デバッグを容易にする
 * - 型安全性により実行時エラーを防ぐ
 * - デフォルト値の一貫性を保証する
 */
import { DEFAULT_PROMPT_SETTINGS } from "../constants/prompts";
import { DEFAULT_TYPEWRITER_SPEED_MS } from "../constants/typewriter";
import { DisplaySettings } from "../types/game";
import { PromptSettings } from "../types/prompt";
import { getErrorMessage, logError, logWarning } from "./errorHandler";

/**
 * localStorageキー定数
 * キーの変更時の影響範囲を最小限に抑えるため一箇所で管理
 */
const STORAGE_KEY = "chat_app_settings";
const PROMPT_STORAGE_KEY = "chat_app_prompts";
const DISPLAY_STORAGE_KEY = "chat_app_display";

/**
 * ログコンテキスト識別子
 * エラーログでどの設定タイプの処理で問題が発生したか特定するため
 */
const SETTINGS_CONTEXT = "AppSettingsStorage";
const PROMPT_CONTEXT = "PromptSettingsStorage";
const DISPLAY_CONTEXT = "DisplaySettingsStorage";

/**
 * エラーメッセージ定数
 * ユーザーフレンドリーなエラーメッセージを一元管理し、多言語化を容易にするため
 */
const QUOTA_EXCEEDED_ERROR_NAME = "QuotaExceededError";
const STORAGE_QUOTA_ERROR_MESSAGE =
  "Storage quota exceeded. Clear your browser storage and try again.";
const PROMPT_QUOTA_ERROR_MESSAGE =
  "Prompt storage quota exceeded. Remove large prompts or clear browser storage.";

const SETTINGS_SAVE_FAILURE = "Failed to save settings";
const SETTINGS_RESET_FAILURE = "Failed to reset settings";
const SETTINGS_IMPORT_FAILURE = "Failed to import settings";
const PROMPT_SAVE_FAILURE = "Failed to save prompt settings";
const DISPLAY_SAVE_FAILURE = "Failed to save display settings";

const INVALID_SETTINGS_WARNING = "Invalid settings payload detected; using defaults.";
const INVALID_PROMPT_WARNING = "Invalid prompt payload detected; using defaults.";
const CORRUPT_SETTINGS_WARNING = "Stored settings JSON was corrupt. Clearing entry.";
const CORRUPT_PROMPT_WARNING = "Stored prompt settings JSON was corrupt. Clearing entry.";

/**
 * AI設定のデフォルト値
 * バランスの取れた推論品質とコスト効率を実現するため
 */
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4000;

/** サポートされているAIプロバイダー */
export type AIProvider = "openai" | "gemini";

/**
 * アプリケーション全体の設定インターフェース
 */
export interface AppSettings {
  /** 使用するAIプロバイダー */
  aiProvider: AIProvider;
  /** OpenAI/Groq APIキー */
  openaiApiKey: string;
  /** OpenAI/Groqモデル名 */
  openaiModel: string;
  /** LM Studioなど、カスタムOpenAI互換エンドポイント */
  customOpenAIEndpoint?: string;
  /** Gemini APIキー */
  geminiApiKey: string;
  /** Geminiモデル名 */
  geminiModel: string;
  /** タイプライター効果の速度（ミリ秒） */
  typewriterSpeed: number;
  /** MCPサーバーのWebSocketエンドポイント */
  mcpEndpoint: string;
  /** UIテーマ */
  theme?: "dark" | "light";
  /** メッセージ追加時に自動スクロールするか */
  autoScroll: boolean;
  /** AI応答のランダム性（0.0-2.0） */
  temperature?: number;
  /** AI応答の最大トークン数 */
  maxTokens?: number;
}

/**
 * デフォルト設定値
 * 初回起動時や設定リセット時に使用
 */
const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: "openai",
  openaiApiKey: "",
  openaiModel: "groq/compound",
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
  typewriterSpeed: DEFAULT_TYPEWRITER_SPEED_MS,
  mcpEndpoint: "ws://localhost:8080",
  theme: "dark",
  autoScroll: true,
  temperature: DEFAULT_TEMPERATURE,
  maxTokens: DEFAULT_MAX_TOKENS,
};

/**
 * アプリケーション設定を保存
 *
 * @param settings - 保存する設定（部分更新可能）
 * @throws {Error} ストレージquota超過時またはJSON書き込み失敗時
 *
 * @why 既存設定とマージすることで、部分更新を可能にし使いやすさを向上
 */
export function saveSettings(settings: Partial<AppSettings>): void {
  try {
    const currentSettings = loadSettings();
    const mergedSettings = { ...currentSettings, ...settings };
    writeJson(STORAGE_KEY, mergedSettings, {
      context: SETTINGS_CONTEXT,
      quotaMessage: STORAGE_QUOTA_ERROR_MESSAGE,
      failureMessage: SETTINGS_SAVE_FAILURE,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`${SETTINGS_SAVE_FAILURE}: ${getErrorMessage(error)}`);
  }
}

/**
 * アプリケーション設定を読み込み
 *
 * @returns 保存された設定、または存在しない場合はデフォルト設定
 *
 * @why デフォルト値とマージすることで、新しい設定項目追加時の後方互換性を保証
 */
export function loadSettings(): AppSettings {
  const stored = readJsonRecord(STORAGE_KEY, {
    context: SETTINGS_CONTEXT,
    warningMessage: INVALID_SETTINGS_WARNING,
    corruptWarning: CORRUPT_SETTINGS_WARNING,
  });
  if (!stored) {
    return DEFAULT_SETTINGS;
  }
  return { ...DEFAULT_SETTINGS, ...stored };
}

/**
 * 設定をデフォルトにリセット
 * localStorageから設定エントリを削除する
 */
export function resetSettings(): void {
  safeRemoveItem(STORAGE_KEY, SETTINGS_CONTEXT, SETTINGS_RESET_FAILURE);
}

/**
 * 特定の設定値を取得
 *
 * @param key - 取得する設定のキー
 * @returns 指定された設定値
 *
 * @why 型安全なアクセスを提供し、存在しないキーへのアクセスをコンパイル時に防ぐ
 */
export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const settings = loadSettings();
  return settings[key];
}

/**
 * 選択されたプロバイダーのAPIキーが設定されているか確認
 *
 * @returns APIキーが設定されている場合true
 *
 * @why アプリ起動時やメッセージ送信前に、APIキー未設定エラーを防ぐため
 */
export function hasApiKey(): boolean {
  const settings = loadSettings();
  switch (settings.aiProvider) {
    case "openai":
      return settings.openaiApiKey.length > 0;
    case "gemini":
      return settings.geminiApiKey.length > 0;
    default:
      return false;
  }
}

/**
 * ファイルから設定をインポート
 *
 * @param fileContent - インポートするJSON文字列
 * @throws {Error} JSON解析エラー、必須フィールド欠損、または保存失敗時
 *
 * @why 設定のバックアップ/復元機能を提供し、環境移行や設定共有を容易にするため
 */
export function importSettings(fileContent: string): void {
  try {
    const parsed = JSON.parse(fileContent);
    if (!isRecord(parsed)) {
      throw new Error("Settings data has an invalid structure.");
    }

    // 最低限必要なフィールドの存在を検証し、破損したファイルの読み込みを防ぐ
    const requiredFields: Array<keyof AppSettings> = ["aiProvider", "openaiModel"];
    for (const field of requiredFields) {
      if (!(field in parsed)) {
        throw new Error(`Missing required settings field: ${field}`);
      }
    }

    saveSettings(parsed as Partial<AppSettings>);
  } catch (error) {
    const message = getErrorMessage(error);
    logError(SETTINGS_CONTEXT, error, { operation: "import" });
    if (error instanceof SyntaxError) {
      throw new Error("Settings file contains invalid JSON.");
    }
    throw new Error(`${SETTINGS_IMPORT_FAILURE}: ${message}`);
  }
}

/**
 * プロンプト設定を保存
 *
 * @param settings - 保存するプロンプト設定（部分更新可能）
 * @throws {Error} ストレージquota超過時またはJSON書き込み失敗時
 */
export function savePromptSettings(settings: Partial<PromptSettings>): void {
  try {
    const currentSettings = loadPromptSettings();
    const mergedSettings = { ...currentSettings, ...settings };
    writeJson(PROMPT_STORAGE_KEY, mergedSettings, {
      context: PROMPT_CONTEXT,
      quotaMessage: PROMPT_QUOTA_ERROR_MESSAGE,
      failureMessage: PROMPT_SAVE_FAILURE,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`${PROMPT_SAVE_FAILURE}: ${getErrorMessage(error)}`);
  }
}

/**
 * プロンプト設定を読み込み
 *
 * @returns 保存されたプロンプト設定、または存在しない場合はデフォルト
 */
export function loadPromptSettings(): PromptSettings {
  const stored = readJsonRecord(PROMPT_STORAGE_KEY, {
    context: PROMPT_CONTEXT,
    warningMessage: INVALID_PROMPT_WARNING,
    corruptWarning: CORRUPT_PROMPT_WARNING,
  });
  if (!stored) {
    return DEFAULT_PROMPT_SETTINGS;
  }
  return { ...DEFAULT_PROMPT_SETTINGS, ...stored };
}

/**
 * プロンプト設定をデフォルトにリセット
 */
export function resetPromptSettings(): void {
  safeRemoveItem(PROMPT_STORAGE_KEY, PROMPT_CONTEXT);
}

/**
 * 表示設定のデフォルト値
 */
const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  mode: "normal",
  showTimestamps: false,
  showDebugInfo: false,
};

/**
 * 表示設定を保存
 *
 * @param settings - 保存する表示設定（部分更新可能）
 *
 * @why 表示設定はオプショナルなため、エラー時もアプリを継続動作させる
 */
export function saveDisplaySettings(settings: Partial<DisplaySettings>): void {
  try {
    const currentSettings = loadDisplaySettings();
    const mergedSettings = { ...currentSettings, ...settings };
    writeJson(DISPLAY_STORAGE_KEY, mergedSettings, {
      context: DISPLAY_CONTEXT,
      failureMessage: DISPLAY_SAVE_FAILURE,
    });
  } catch (error) {
    // 表示設定はオプショナルなため、エラーをログに記録するのみで例外をスローしない
    logError(DISPLAY_CONTEXT, error, { operation: "save", key: DISPLAY_STORAGE_KEY });
  }
}

/**
 * 表示設定を読み込み
 *
 * @returns 保存された表示設定、または存在しない場合はデフォルト
 */
export function loadDisplaySettings(): DisplaySettings {
  const stored = readJsonRecord(DISPLAY_STORAGE_KEY, {
    context: DISPLAY_CONTEXT,
    warningMessage: "Invalid display settings payload detected; using defaults.",
  });
  if (!stored) {
    return DEFAULT_DISPLAY_SETTINGS;
  }

  return {
    ...DEFAULT_DISPLAY_SETTINGS,
    ...stored,
  };
}

/**
 * 表示設定をデフォルトにリセット
 */
export function resetDisplaySettings(): void {
  safeRemoveItem(DISPLAY_STORAGE_KEY, DISPLAY_CONTEXT);
}

/**
 * JSONをlocalStorageに書き込む内部ヘルパー
 *
 * @param key - localStorageキー
 * @param value - 保存する値
 * @param options - エラーメッセージとコンテキスト設定
 * @throws {Error} quota超過またはJSON変換エラー時
 *
 * @why quota超過エラーを個別に処理し、ユーザーに具体的な対処法を提示するため
 */
function writeJson(
  key: string,
  value: unknown,
  options: {
    context: string;
    quotaMessage?: string;
    failureMessage: string;
  }
): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // quota超過エラーには専用メッセージを表示し、ユーザーに対処法を明示
    if (options.quotaMessage && isQuotaExceededError(error)) {
      logError(options.context, error, { operation: "save", key, reason: "QuotaExceeded" });
      throw new Error(options.quotaMessage);
    }

    const message = getErrorMessage(error);
    logError(options.context, error, { operation: "save", key });
    throw new Error(`${options.failureMessage}: ${message}`);
  }
}

/**
 * localStorageからJSONを読み込む内部ヘルパー
 *
 * @param key - localStorageキー
 * @param options - 警告メッセージとコンテキスト設定
 * @returns パースされたオブジェクト、または存在しない/不正な場合null
 *
 * @why 破損したJSONを自動削除することで、次回起動時の問題を防ぐ
 */
function readJsonRecord(
  key: string,
  options: {
    context: string;
    warningMessage: string;
    corruptWarning?: string;
  }
): Record<string, unknown> | null {
  try {
    const storedValue = localStorage.getItem(key);
    if (!storedValue) {
      return null;
    }

    const parsed = JSON.parse(storedValue);
    if (!isRecord(parsed)) {
      logWarning(options.context, options.warningMessage, { key });
      return null;
    }

    return parsed;
  } catch (error) {
    logError(options.context, error, { operation: "load", key });
    // SyntaxErrorの場合は破損したデータとみなし、自動削除して再発を防ぐ
    if (error instanceof SyntaxError) {
      const warningMessage = options.corruptWarning ?? options.warningMessage;
      logWarning(options.context, warningMessage, { key });
      safeRemoveItem(key, options.context);
    }
    return null;
  }
}

/**
 * localStorageから安全にアイテムを削除する内部ヘルパー
 *
 * @param key - localStorageキー
 * @param context - ログ用コンテキスト
 * @param failureMessage - オプショナルなエラーメッセージ
 * @throws {Error} failureMessageが指定されている場合のみ
 *
 * @why 削除失敗時もログを記録し、診断情報を保持するため
 */
function safeRemoveItem(key: string, context: string, failureMessage?: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    const message = getErrorMessage(error);
    logError(context, error, { operation: "remove", key });
    if (failureMessage) {
      throw new Error(`${failureMessage}: ${message}`);
    }
  }
}

/**
 * エラーがストレージquota超過かどうかを判定
 *
 * @param error - 判定対象のエラー
 * @returns quota超過エラーの場合true
 *
 * @why DOMExceptionの名前チェックにより、ブラウザ間で一貫した判定を実現
 */
function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && error.name === QUOTA_EXCEEDED_ERROR_NAME;
}

/**
 * 値がRecord型（プレーンオブジェクト）かどうかを判定
 *
 * @param value - 判定対象の値
 * @returns Recordの場合true
 *
 * @why 型ガードにより、以降のコードでRecord型として安全にアクセス可能
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
