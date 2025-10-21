/**
 * ローカルストレージを使用した設定の永続化
 * セキュアな方法でAPIキーなどを保存
 */
import { DEFAULT_TYPEWRITER_SPEED_MS } from "../constants/typewriter";
import { PromptSettings } from "../types/prompt";
import { DEFAULT_PROMPT_SETTINGS } from "../constants/prompts";
import { DisplayMode, DisplaySettings } from "../types/game";

const STORAGE_KEY = "chat_app_settings";
const PROMPT_STORAGE_KEY = "chat_app_prompts";
const DISPLAY_STORAGE_KEY = "chat_app_display";

export type AIProvider = "openai" | "gemini";

export interface AppSettings {
  aiProvider: AIProvider;
  openaiApiKey: string;
  openaiModel: string;
  customOpenAIEndpoint?: string; // LM Studio等のカスタムエンドポイント（オプション）
  geminiApiKey: string;
  geminiModel: string;
  typewriterSpeed: number;
  mcpEndpoint: string;
  theme?: "dark" | "light";
  autoScroll: boolean;
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: "openai",
  openaiApiKey: "",
  openaiModel: "gpt-4o",
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
  typewriterSpeed: DEFAULT_TYPEWRITER_SPEED_MS,
  mcpEndpoint: "ws://localhost:8080",
  theme: "dark",
  autoScroll: true,
  temperature: 0.7,
  maxTokens: 4000, // 長い応答に対応するため増やす
};

/**
 * 設定をローカルストレージに保存
 */
export function saveSettings(settings: Partial<AppSettings>): void {
  try {
    const currentSettings = loadSettings();
    const newSettings = { ...currentSettings, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("設定の保存に失敗しました:", errorMessage);
    
    // QuotaExceededError の場合は具体的なメッセージを提供
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new Error(
        "ストレージの容量制限に達しました。ブラウザのキャッシュをクリアしてください。"
      );
    }
    
    throw new Error(`設定の保存に失敗しました: ${errorMessage}`);
  }
}

/**
 * 設定をローカルストレージから読み込み
 */
export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(stored);
    
    // 保存されたデータの妥当性を検証
    if (typeof parsed !== "object" || parsed === null) {
      console.warn("無効な設定データが検出されました。デフォルト設定を使用します。");
      return DEFAULT_SETTINGS;
    }
    
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("設定の読み込みに失敗しました:", errorMessage);
    
    // JSON解析エラーの場合は設定をリセット
    if (error instanceof SyntaxError) {
      console.warn("設定データが破損しています。デフォルト設定を使用します。");
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // 無視
      }
    }
    
    return DEFAULT_SETTINGS;
  }
}

/**
 * 設定をリセット（デフォルトに戻す）
 */
export function resetSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("設定のリセットに失敗しました:", errorMessage);
    throw new Error(`設定のリセットに失敗しました: ${errorMessage}`);
  }
}

/**
 * 特定の設定項目を取得
 */
export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const settings = loadSettings();
  return settings[key];
}

/**
 * APIキーが設定されているか確認
 */
export function hasApiKey(): boolean {
  const settings = loadSettings();
  if (settings.aiProvider === "openai") {
    return settings.openaiApiKey.length > 0;
  } else if (settings.aiProvider === "gemini") {
    return settings.geminiApiKey.length > 0;
  }
  return false;
}

/**
 * 設定をエクスポート（バックアップ用）
 */
export function exportSettings(): string {
  const settings = loadSettings();
  return JSON.stringify(settings, null, 2);
}

/**
 * 設定をインポート（バックアップから復元）
 */
export function importSettings(json: string): void {
  try {
    const settings = JSON.parse(json);
    
    // インポートされた設定の妥当性を検証
    if (typeof settings !== "object" || settings === null) {
      throw new Error("設定データが正しい形式ではありません");
    }
    
    // 必須フィールドの存在を確認
    const requiredFields: (keyof AppSettings)[] = ["aiProvider", "openaiModel"];
    for (const field of requiredFields) {
      if (!(field in settings)) {
        throw new Error(`必須フィールド "${field}" が見つかりません`);
      }
    }
    
    saveSettings(settings);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("設定のインポートに失敗しました:", errorMessage);
    
    if (error instanceof SyntaxError) {
      throw new Error("設定ファイルのJSON形式が無効です");
    }
    
    throw new Error(`設定のインポートに失敗しました: ${errorMessage}`);
  }
}

/**
 * プロンプト設定をローカルストレージに保存
 */
export function savePromptSettings(settings: Partial<PromptSettings>): void {
  try {
    const currentSettings = loadPromptSettings();
    const newSettings = { ...currentSettings, ...settings };
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(newSettings));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("プロンプト設定の保存に失敗しました:", errorMessage);
    
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new Error(
        "ストレージの容量制限に達しました。プロンプトデータを削減するか、ブラウザのキャッシュをクリアしてください。"
      );
    }
    
    throw new Error(`プロンプト設定の保存に失敗しました: ${errorMessage}`);
  }
}

/**
 * プロンプト設定をローカルストレージから読み込み
 */
export function loadPromptSettings(): PromptSettings {
  try {
    const stored = localStorage.getItem(PROMPT_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_PROMPT_SETTINGS;
    }
    const parsed = JSON.parse(stored);
    
    // データの妥当性を検証
    if (typeof parsed !== "object" || parsed === null) {
      console.warn("無効なプロンプト設定データが検出されました。デフォルト設定を使用します。");
      return DEFAULT_PROMPT_SETTINGS;
    }
    
    return { ...DEFAULT_PROMPT_SETTINGS, ...parsed };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("プロンプト設定の読み込みに失敗しました:", errorMessage);
    
    // JSON解析エラーの場合は設定をリセット
    if (error instanceof SyntaxError) {
      console.warn("プロンプト設定データが破損しています。デフォルト設定を使用します。");
      try {
        localStorage.removeItem(PROMPT_STORAGE_KEY);
      } catch {
        // 無視
      }
    }
    
    return DEFAULT_PROMPT_SETTINGS;
  }
}

/**
 * プロンプト設定をリセット
 */
export function resetPromptSettings(): void {
  localStorage.removeItem(PROMPT_STORAGE_KEY);
}

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  mode: "normal",
  showTimestamps: false,
  showDebugInfo: false,
};

/**
 * 表示設定をローカルストレージに保存
 */
export function saveDisplaySettings(settings: Partial<DisplaySettings>): void {
  try {
    const currentSettings = loadDisplaySettings();
    const newSettings = { ...currentSettings, ...settings };
    localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(newSettings));
  } catch (error) {
    console.error("表示設定の保存に失敗しました:", error);
  }
}

/**
 * 表示設定をローカルストレージから読み込み
 */
export function loadDisplaySettings(): DisplaySettings {
  try {
    const stored = localStorage.getItem(DISPLAY_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_DISPLAY_SETTINGS;
    }
    return { ...DEFAULT_DISPLAY_SETTINGS, ...JSON.parse(stored) };
  } catch (error) {
    console.error("表示設定の読み込みに失敗しました:", error);
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

/**
 * 表示設定をリセット
 */
export function resetDisplaySettings(): void {
  localStorage.removeItem(DISPLAY_STORAGE_KEY);
}
