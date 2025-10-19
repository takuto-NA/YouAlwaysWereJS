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
    console.error("設定の保存に失敗しました:", error);
    throw new Error("設定の保存に失敗しました");
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
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    console.error("設定の読み込みに失敗しました:", error);
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
    console.error("設定のリセットに失敗しました:", error);
    throw new Error("設定のリセットに失敗しました");
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
    saveSettings(settings);
  } catch (error) {
    console.error("設定のインポートに失敗しました:", error);
    throw new Error("無効な設定ファイルです");
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
    console.error("プロンプト設定の保存に失敗しました:", error);
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
    return { ...DEFAULT_PROMPT_SETTINGS, ...JSON.parse(stored) };
  } catch (error) {
    console.error("プロンプト設定の読み込みに失敗しました:", error);
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
