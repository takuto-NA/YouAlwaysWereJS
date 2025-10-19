/**
 * 設定モーダルコンポーネント
 * APIキーやアプリケーション設定を管理
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Cog6ToothIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { AppSettings, loadSettings, saveSettings } from "../utils/storage";
import { logDebug } from "../utils/errorHandler";
import { SAVE_MESSAGE_TIMEOUT_MS } from "../constants/animations";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
}

function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [originalSettings, setOriginalSettings] = useState<AppSettings>(loadSettings());
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // 設定が変更されたかどうかを確認
  const hasUnsavedChanges = useCallback(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  // モーダルが開いている時にbodyのスクロールを防ぐ
  useEffect(() => {
    if (isOpen) {
      const loadedSettings = loadSettings();
      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
      setSaveMessage("");
      setShowUnsavedWarning(false);
      // bodyのスクロールを無効化
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";

      // フォーカスをモーダルに移動
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
    } else {
      // bodyのスクロールを復元
      document.body.style.overflow = "hidden"; // 元々hiddenなのでhiddenに戻す
      document.body.style.touchAction = "none"; // 元々noneなのでnoneに戻す
    }

    return () => {
      // クリーンアップ
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    };
  }, [isOpen]);

  // Escキーでモーダルを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        // 未保存の変更があるか確認
        if (hasUnsavedChanges() && !showUnsavedWarning) {
          setShowUnsavedWarning(true);
          return;
        }
        setShowApiKey(false);
        setShowUnsavedWarning(false);
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, hasUnsavedChanges, showUnsavedWarning, onClose]);

  // フォーカストラップ
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener("keydown", handleTabKey);
    return () => {
      modal.removeEventListener("keydown", handleTabKey);
    };
  }, [isOpen]);

  const handleSave = () => {
    try {
      setIsSaving(true);
      saveSettings(settings);
      onSave(settings);
      setOriginalSettings(settings);
      setSaveMessage("SAVED");
      logDebug("Settings", "設定を保存しました", {
        hasApiKey: settings.openaiApiKey.length > 0,
        typewriterSpeed: settings.typewriterSpeed,
        autoScroll: settings.autoScroll,
      });

      // 保存完了メッセージを一定時間後に消去してモーダルを閉じる
      setTimeout(() => {
        setSaveMessage("");
        setShowApiKey(false);
        onClose();
      }, SAVE_MESSAGE_TIMEOUT_MS);
    } catch (error) {
      setSaveMessage("ERROR: Failed to save");
      logDebug("Settings", "設定の保存に失敗しました", { error });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges() && !showUnsavedWarning) {
      setShowUnsavedWarning(true);
      return;
    }
    setShowApiKey(false);
    setShowUnsavedWarning(false);
    onClose();
  }, [hasUnsavedChanges, showUnsavedWarning, onClose]);

  const handleOverlayClick = () => {
    if (hasUnsavedChanges() && !showUnsavedWarning) {
      setShowUnsavedWarning(true);
      return;
    }
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden touch-none animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleOverlayClick}
        onTouchMove={(e) => e.preventDefault()}
        aria-hidden="true"
      />

      {/* モーダル本体 */}
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-2xl mx-4 bg-black border border-gray-700 shadow-2xl flex flex-col touch-auto animate-slideUp"
        style={{ maxHeight: "calc(100dvh - 2rem)" }}
      >
        {/* ヘッダー */}
        <div className="flex-shrink-0 bg-black border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cog6ToothIcon className="w-7 h-7 text-white" aria-hidden="true" />
            <h2
              id="settings-modal-title"
              className="text-xl font-light text-white uppercase tracking-widest"
            >
              Settings
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="text-gray-600 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black rounded p-1"
            aria-label="閉じる"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6 touch-pan-y">
          {/* 未保存の変更警告 */}
          {showUnsavedWarning && (
            <div className="bg-yellow-900/20 border border-yellow-600/50 p-4 space-y-3 animate-fadeIn">
              <div className="flex items-start gap-3">
                <XCircleIcon className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-yellow-200 text-sm font-light uppercase tracking-wider">
                    Unsaved Changes
                  </p>
                  <p className="text-yellow-300/80 text-xs mt-1">
                    You have unsaved changes. Do you want to close without saving?
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowUnsavedWarning(false)}
                  className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white transition-colors duration-200 uppercase tracking-wider text-xs focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowUnsavedWarning(false);
                    setShowApiKey(false);
                    onClose();
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white hover:bg-yellow-500 transition-colors duration-200 uppercase tracking-wider text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-black"
                >
                  Close Without Saving
                </button>
              </div>
            </div>
          )}

          {/* AI Provider選択 */}
          <div className="space-y-3">
            <label
              htmlFor="ai-provider-select"
              className="text-white font-light uppercase tracking-wider text-sm block"
            >
              AI Provider
            </label>
            <select
              id="ai-provider-select"
              value={settings.aiProvider}
              onChange={(e) =>
                setSettings({ ...settings, aiProvider: e.target.value as "openai" | "gemini" })
              }
              className="w-full bg-black border border-gray-700 text-white px-4 py-3 text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white transition-all duration-200"
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
            </select>
            <p className="text-xs text-gray-600">Choose your preferred AI provider</p>
          </div>

          {/* OpenAI API設定 */}
          {settings.aiProvider === "openai" && (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="openai-api-key"
                    className="text-white font-light uppercase tracking-wider text-sm"
                  >
                    OpenAI API Key
                  </label>
                  <span className="text-xs text-gray-600 uppercase">(Required)</span>
                </div>
                <div className="relative">
                  <input
                    id="openai-api-key"
                    type={showApiKey ? "text" : "password"}
                    value={settings.openaiApiKey}
                    onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full bg-black border border-gray-700 text-white px-4 py-3 pr-24 text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white transition-all duration-200"
                    aria-required="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600 hover:text-white transition-colors duration-200 px-2 py-1 border border-gray-700 hover:border-gray-500 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-white"
                    aria-label={showApiKey ? "Hide API key" : "Show API key"}
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="text-xs text-gray-600">
                  Get your key from{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors duration-200 underline decoration-gray-700 hover:decoration-white"
                  >
                    platform.openai.com
                  </a>
                </p>
              </div>

              {/* OpenAI モデル選択 */}
              <div className="space-y-3">
                <label
                  htmlFor="openai-model-select"
                  className="text-white font-light uppercase tracking-wider text-sm block"
                >
                  OpenAI Model Selection
                </label>
                <select
                  id="openai-model-select"
                  value={settings.openaiModel}
                  onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
                  className="w-full bg-black border border-gray-700 text-white px-4 py-3 text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white transition-all duration-200"
                >
                  <optgroup label="GPT-5シリーズ（最新）">
                    <option value="gpt-5">GPT-5 ⭐ (最新・推奨)</option>
                    <option value="gpt-5-mini">GPT-5-mini (高速・効率的)</option>
                    <option value="gpt-5-nano">GPT-5-nano (超軽量)</option>
                    <option value="gpt-5-pro">GPT-5-pro (最高性能)</option>
                    <option value="gpt-5-thinking">GPT-5-thinking (深い推論)</option>
                  </optgroup>
                  <optgroup label="推論特化（o1シリーズ）">
                    <option value="o1">o1 (高度な推論)</option>
                    <option value="o1-mini">o1-mini (推論・低コスト)</option>
                  </optgroup>
                  <optgroup label="GPT-4シリーズ">
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o-mini</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  </optgroup>
                  <optgroup label="その他">
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (低コスト)</option>
                  </optgroup>
                </select>
                <p className="text-xs text-gray-600">
                  GPT-5: Standard / GPT-5-mini: Fast / GPT-5-pro: Maximum Performance
                </p>
              </div>
            </>
          )}

          {/* Gemini API設定 */}
          {settings.aiProvider === "gemini" && (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="gemini-api-key"
                    className="text-white font-light uppercase tracking-wider text-sm"
                  >
                    Google Gemini API Key
                  </label>
                  <span className="text-xs text-gray-600 uppercase">(Required)</span>
                </div>
                <div className="relative">
                  <input
                    id="gemini-api-key"
                    type={showApiKey ? "text" : "password"}
                    value={settings.geminiApiKey}
                    onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                    placeholder="AIza..."
                    className="w-full bg-black border border-gray-700 text-white px-4 py-3 pr-24 text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white transition-all duration-200"
                    aria-required="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600 hover:text-white transition-colors duration-200 px-2 py-1 border border-gray-700 hover:border-gray-500 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-white"
                    aria-label={showApiKey ? "Hide API key" : "Show API key"}
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="text-xs text-gray-600">
                  Get your key from{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors duration-200 underline decoration-gray-700 hover:decoration-white"
                  >
                    aistudio.google.com
                  </a>
                </p>
              </div>

              {/* Gemini モデル選択 */}
              <div className="space-y-3">
                <label
                  htmlFor="gemini-model-select"
                  className="text-white font-light uppercase tracking-wider text-sm block"
                >
                  Gemini Model Selection
                </label>
                <select
                  id="gemini-model-select"
                  value={settings.geminiModel}
                  onChange={(e) => setSettings({ ...settings, geminiModel: e.target.value })}
                  className="w-full bg-black border border-gray-700 text-white px-4 py-3 text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white transition-all duration-200"
                >
                  <optgroup label="Gemini 2.5 (Latest)">
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash ⭐ (Latest)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (Premium)</option>
                  </optgroup>
                  <optgroup label="Gemini 2.0">
                    <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</option>
                  </optgroup>
                  <optgroup label="Gemini 1.5">
                    <option value="gemini-1.5-pro-latest">Gemini 1.5 Pro (Latest)</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash (Latest)</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    <option value="gemini-1.5-flash-8b-latest">Gemini 1.5 Flash-8B (Latest)</option>
                    <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash-8B</option>
                  </optgroup>
                </select>
                <p className="text-xs text-gray-600">
                  2.5 Flash: Latest & balanced (無料枠: RPM 10) / 2.5 Pro: Premium quality (無料枠:
                  RPM 2) / 1.5 Flash: Fast (無料枠: RPM 15)
                </p>
              </div>
            </>
          )}

          {/* タイプライター速度 */}
          <div className="space-y-3">
            <label
              htmlFor="typewriter-speed"
              className="text-white font-light uppercase tracking-wider text-sm block"
            >
              Typewriter Speed
            </label>
            <div className="space-y-2">
              <input
                id="typewriter-speed"
                type="range"
                min="10"
                max="100"
                step="5"
                value={settings.typewriterSpeed}
                onChange={(e) =>
                  setSettings({ ...settings, typewriterSpeed: Number(e.target.value) })
                }
                className="w-full accent-gray-400 focus:outline-none focus:ring-2 focus:ring-white"
                aria-valuemin={10}
                aria-valuemax={100}
                aria-valuenow={settings.typewriterSpeed}
                aria-label="Typewriter speed in milliseconds"
              />
              <div className="flex items-center justify-between text-xs text-gray-600 uppercase tracking-wider">
                <span>Fast (10ms)</span>
                <span className="text-white font-medium">{settings.typewriterSpeed}ms</span>
                <span>Slow (100ms)</span>
              </div>
            </div>
            <p className="text-xs text-gray-600">Lower values = faster display</p>
          </div>

          {/* MCP Endpoint */}
          <div className="space-y-3">
            <label
              htmlFor="mcp-endpoint"
              className="text-white font-light uppercase tracking-wider text-sm block"
            >
              MCP Endpoint
              <span className="text-xs text-gray-600 normal-case ml-2">(Optional)</span>
            </label>
            <input
              id="mcp-endpoint"
              type="text"
              value={settings.mcpEndpoint}
              onChange={(e) => setSettings({ ...settings, mcpEndpoint: e.target.value })}
              placeholder="ws://localhost:8080"
              className="w-full bg-black border border-gray-700 text-white px-4 py-3 text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white transition-all duration-200"
            />
            <p className="text-xs text-gray-600">
              Model Context Protocol WebSocket endpoint (future implementation)
            </p>
          </div>

          {/* 自動スクロール */}
          <div className="space-y-3">
            <label
              htmlFor="auto-scroll-checkbox"
              className="flex items-center gap-3 cursor-pointer group"
            >
              <input
                id="auto-scroll-checkbox"
                type="checkbox"
                checked={settings.autoScroll}
                onChange={(e) => setSettings({ ...settings, autoScroll: e.target.checked })}
                className="w-5 h-5 accent-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
              />
              <span className="text-white font-light uppercase tracking-wider text-sm group-hover:text-gray-400 transition-colors duration-200">
                Auto Scroll
              </span>
            </label>
            <p className="text-xs text-gray-600 ml-8">
              Automatically scroll when new messages appear
            </p>
          </div>

          {/* 詳細設定 */}
          <details className="border-t border-gray-800 pt-4">
            <summary className="text-white font-light uppercase tracking-wider text-sm cursor-pointer hover:text-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black rounded px-2 py-1 -mx-2">
              Advanced Settings
            </summary>
            <div className="mt-4 space-y-4">
              {/* Temperature */}
              <div className="space-y-2">
                <label
                  htmlFor="temperature-slider"
                  className="text-white font-light uppercase tracking-wider text-sm block"
                >
                  Temperature (Creativity)
                </label>
                <input
                  id="temperature-slider"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.temperature || 0.7}
                  onChange={(e) =>
                    setSettings({ ...settings, temperature: Number(e.target.value) })
                  }
                  className="w-full accent-gray-400 focus:outline-none focus:ring-2 focus:ring-white"
                  aria-valuemin={0}
                  aria-valuemax={2}
                  aria-valuenow={settings.temperature || 0.7}
                  aria-label="Temperature creativity setting"
                />
                <div className="flex items-center justify-between text-xs text-gray-600 uppercase tracking-wider">
                  <span>Conservative (0.0)</span>
                  <span className="text-white font-medium">{settings.temperature || 0.7}</span>
                  <span>Creative (2.0)</span>
                </div>
                <p className="text-xs text-gray-600">
                  Only for GPT-4 and earlier. GPT-5/o1 use default (1.0)
                </p>
              </div>

              {/* Max Tokens */}
              <div className="space-y-2">
                <label
                  htmlFor="max-tokens-input"
                  className="text-white font-light uppercase tracking-wider text-sm block"
                >
                  Max Tokens (max_completion_tokens)
                </label>
                <input
                  id="max-tokens-input"
                  type="number"
                  min="100"
                  max="8192"
                  step="100"
                  value={settings.maxTokens || 4000}
                  onChange={(e) => setSettings({ ...settings, maxTokens: Number(e.target.value) })}
                  className="w-full bg-black border border-gray-700 text-white px-4 py-2 text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white transition-all duration-200"
                />
                <p className="text-xs text-gray-600">
                  Maximum response length. OpenAI: 4000, Gemini: 8192. Uses max_completion_tokens
                  for GPT-5/o1, maxOutputTokens for Gemini
                </p>
              </div>
            </div>
          </details>

          {/* 保存メッセージ */}
          {saveMessage && (
            <div
              className={`flex items-center justify-center gap-2 py-3 px-4 border animate-fadeIn ${
                saveMessage.startsWith("SAVED")
                  ? "bg-green-900/20 border-green-600/50 text-green-200"
                  : "bg-red-900/20 border-red-600/50 text-red-200"
              }`}
            >
              {saveMessage.startsWith("SAVED") ? (
                <CheckCircleIcon className="w-5 h-5" />
              ) : (
                <XCircleIcon className="w-5 h-5" />
              )}
              <span className="uppercase tracking-wider text-sm font-light">{saveMessage}</span>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex-shrink-0 bg-black border-t border-gray-700 px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={handleClose}
            className="px-6 py-2.5 border border-gray-700 text-gray-600 hover:text-white hover:border-gray-500 transition-all duration-200 uppercase tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={
              isSaving ||
              (settings.aiProvider === "openai"
                ? !settings.openaiApiKey.trim()
                : !settings.geminiApiKey.trim())
            }
            className="px-8 py-2.5 bg-white text-black hover:bg-gray-200 border border-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white uppercase tracking-wider text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
