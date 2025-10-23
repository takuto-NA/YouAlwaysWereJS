/**
 * Provides typed wrappers around localStorage for application, prompt, and display settings.
 * Why it matters: centralised persistence keeps side effects consistent and logging rich, making
 * quota issues or corrupt JSON easy to diagnose without scattering storage logic.
 */
import { DEFAULT_PROMPT_SETTINGS } from "../constants/prompts";
import { DEFAULT_TYPEWRITER_SPEED_MS } from "../constants/typewriter";
import { DisplaySettings } from "../types/game";
import { PromptSettings } from "../types/prompt";
import { getErrorMessage, logError, logWarning } from "./errorHandler";

const STORAGE_KEY = "chat_app_settings";
const PROMPT_STORAGE_KEY = "chat_app_prompts";
const DISPLAY_STORAGE_KEY = "chat_app_display";

const SETTINGS_CONTEXT = "AppSettingsStorage";
const PROMPT_CONTEXT = "PromptSettingsStorage";
const DISPLAY_CONTEXT = "DisplaySettingsStorage";

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

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4000;

export type AIProvider = "openai" | "gemini";

export interface AppSettings {
  aiProvider: AIProvider;
  openaiApiKey: string;
  openaiModel: string;
  customOpenAIEndpoint?: string;
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

export function resetSettings(): void {
  safeRemoveItem(STORAGE_KEY, SETTINGS_CONTEXT, SETTINGS_RESET_FAILURE);
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const settings = loadSettings();
  return settings[key];
}

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

export function importSettings(fileContent: string): void {
  try {
    const parsed = JSON.parse(fileContent);
    if (!isRecord(parsed)) {
      throw new Error("Settings data has an invalid structure.");
    }

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

export function resetPromptSettings(): void {
  safeRemoveItem(PROMPT_STORAGE_KEY, PROMPT_CONTEXT);
}

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  mode: "normal",
  showTimestamps: false,
  showDebugInfo: false,
};

export function saveDisplaySettings(settings: Partial<DisplaySettings>): void {
  try {
    const currentSettings = loadDisplaySettings();
    const mergedSettings = { ...currentSettings, ...settings };
    writeJson(DISPLAY_STORAGE_KEY, mergedSettings, {
      context: DISPLAY_CONTEXT,
      failureMessage: DISPLAY_SAVE_FAILURE,
    });
  } catch (error) {
    // display settings are optional, so surface the error only in logs
    logError(DISPLAY_CONTEXT, error, { operation: "save", key: DISPLAY_STORAGE_KEY });
  }
}

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

export function resetDisplaySettings(): void {
  safeRemoveItem(DISPLAY_STORAGE_KEY, DISPLAY_CONTEXT);
}

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
    if (options.quotaMessage && isQuotaExceededError(error)) {
      logError(options.context, error, { operation: "save", key, reason: "QuotaExceeded" });
      throw new Error(options.quotaMessage);
    }

    const message = getErrorMessage(error);
    logError(options.context, error, { operation: "save", key });
    throw new Error(`${options.failureMessage}: ${message}`);
  }
}

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
    if (error instanceof SyntaxError) {
      const warningMessage = options.corruptWarning ?? options.warningMessage;
      logWarning(options.context, warningMessage, { key });
      safeRemoveItem(key, options.context);
    }
    return null;
  }
}

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

function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && error.name === QUOTA_EXCEEDED_ERROR_NAME;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
