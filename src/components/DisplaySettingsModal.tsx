/**
 * 表示設定モーダルコンポーネント
 * 画面表示方式（通常モード、ノベルゲームモード、デバッグモード）の切り替え
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  RectangleStackIcon,
  XMarkIcon,
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  BookOpenIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";
import { DisplaySettings, DisplayMode } from "../types/game";
import { loadDisplaySettings, saveDisplaySettings } from "../utils/storage";
import { logDebug } from "../utils/errorHandler";
import { SAVE_MESSAGE_TIMEOUT_MS } from "../constants/animations";

interface DisplaySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: DisplaySettings) => void;
}

function DisplaySettingsModal({ isOpen, onClose, onSave }: DisplaySettingsModalProps) {
  const [settings, setSettings] = useState<DisplaySettings>(loadDisplaySettings());
  const [originalSettings, setOriginalSettings] = useState<DisplaySettings>(loadDisplaySettings());
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
      const loadedSettings = loadDisplaySettings();
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
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
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
        if (hasUnsavedChanges() && !showUnsavedWarning) {
          setShowUnsavedWarning(true);
          return;
        }
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
      saveDisplaySettings(settings);
      onSave(settings);
      setOriginalSettings(settings);
      setSaveMessage("SAVED");
      logDebug("DisplaySettings", "表示設定を保存しました", {
        mode: settings.mode,
        showTimestamps: settings.showTimestamps,
        showDebugInfo: settings.showDebugInfo,
      });

      // 保存完了メッセージを一定時間後に消去してモーダルを閉じる
      setTimeout(() => {
        setSaveMessage("");
        onClose();
      }, SAVE_MESSAGE_TIMEOUT_MS);
    } catch (error) {
      setSaveMessage("ERROR: Failed to save");
      logDebug("DisplaySettings", "表示設定の保存に失敗しました", { error });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges() && !showUnsavedWarning) {
      setShowUnsavedWarning(true);
      return;
    }
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

  const handleModeSelect = (mode: DisplayMode) => {
    setSettings({ ...settings, mode });
  };

  if (!isOpen) return null;

  const displayModes = [
    {
      id: "normal" as DisplayMode,
      name: "Normal Mode",
      description: "Standard chat display with full conversation history",
      icon: ChatBubbleLeftRightIcon,
      features: ["Full chat history", "Scrollable messages", "Timestamps (optional)"],
    },
    {
      id: "novel" as DisplayMode,
      name: "Novel Mode",
      description: "Visual novel style - only the latest AI response is shown",
      icon: BookOpenIcon,
      features: ["Latest message only", "Immersive reading", "Clean interface"],
    },
    {
      id: "debug" as DisplayMode,
      name: "Debug Mode",
      description: "Developer mode with debug logs and system information",
      icon: CodeBracketIcon,
      features: ["Console logs", "System info", "Error tracking"],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden touch-none animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="display-settings-modal-title"
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
        className="relative z-10 w-full max-w-4xl mx-4 bg-black border border-gray-700 shadow-2xl flex flex-col touch-auto animate-slideUp"
        style={{ maxHeight: "calc(100dvh - 2rem)" }}
      >
        {/* ヘッダー */}
        <div className="flex-shrink-0 bg-black border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RectangleStackIcon className="w-7 h-7 text-white" aria-hidden="true" />
            <h2
              id="display-settings-modal-title"
              className="text-xl font-light text-white uppercase tracking-widest"
            >
              Display Settings
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
                <XMarkIcon className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
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
                  className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white transition-colors duration-200 uppercase tracking-wider text-xs focus:outline-none focus:ring-2 focus:ring-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowUnsavedWarning(false);
                    onClose();
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white hover:bg-yellow-500 transition-colors duration-200 uppercase tracking-wider text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  Close Without Saving
                </button>
              </div>
            </div>
          )}

          {/* モード選択 */}
          <div className="space-y-4">
            <h3 className="text-white font-light uppercase tracking-wider text-sm">
              Select Display Mode
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {displayModes.map((mode) => {
                const Icon = mode.icon;
                const isSelected = settings.mode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => handleModeSelect(mode.id)}
                    className={`relative p-6 border transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-white ${
                      isSelected
                        ? "border-white bg-white/5"
                        : "border-gray-700 hover:border-gray-500 hover:bg-gray-900/30"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <CheckCircleIcon className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <Icon className={`w-8 h-8 mb-3 ${isSelected ? "text-white" : "text-gray-600"}`} />
                    <h4
                      className={`text-sm font-medium uppercase tracking-wider mb-2 ${isSelected ? "text-white" : "text-gray-400"}`}
                    >
                      {mode.name}
                    </h4>
                    <p className="text-xs text-gray-600 mb-3">{mode.description}</p>
                    <ul className="space-y-1">
                      {mode.features.map((feature, idx) => (
                        <li key={idx} className="text-xs text-gray-700 flex items-center gap-2">
                          <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 追加オプション */}
          <div className="space-y-4 border-t border-gray-800 pt-6">
            <h3 className="text-white font-light uppercase tracking-wider text-sm">
              Additional Options
            </h3>

            {/* タイムスタンプ表示 */}
            {settings.mode === "normal" && (
              <div className="space-y-2">
                <label
                  htmlFor="show-timestamps"
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    id="show-timestamps"
                    type="checkbox"
                    checked={settings.showTimestamps}
                    onChange={(e) => setSettings({ ...settings, showTimestamps: e.target.checked })}
                    className="w-5 h-5 accent-gray-400 focus:outline-none focus:ring-2 focus:ring-white"
                  />
                  <span className="text-white font-light text-sm group-hover:text-gray-400 transition-colors duration-200">
                    Show Timestamps
                  </span>
                </label>
                <p className="text-xs text-gray-600 ml-8">Display timestamp for each message</p>
              </div>
            )}

            {/* デバッグ情報表示 */}
            {settings.mode === "debug" && (
              <div className="space-y-2">
                <label
                  htmlFor="show-debug-info"
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    id="show-debug-info"
                    type="checkbox"
                    checked={settings.showDebugInfo}
                    onChange={(e) => setSettings({ ...settings, showDebugInfo: e.target.checked })}
                    className="w-5 h-5 accent-gray-400 focus:outline-none focus:ring-2 focus:ring-white"
                  />
                  <span className="text-white font-light text-sm group-hover:text-gray-400 transition-colors duration-200">
                    Show Debug Info
                  </span>
                </label>
                <p className="text-xs text-gray-600 ml-8">Display detailed system information</p>
              </div>
            )}
          </div>

          {/* 保存メッセージ */}
          {saveMessage && (
            <div
              className={`flex items-center justify-center gap-2 py-3 px-4 border animate-fadeIn ${
                saveMessage.startsWith("SAVED")
                  ? "bg-green-900/20 border-green-600/50 text-green-200"
                  : "bg-red-900/20 border-red-600/50 text-red-200"
              }`}
            >
              <CheckCircleIcon className="w-5 h-5" />
              <span className="uppercase tracking-wider text-sm font-light">{saveMessage}</span>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex-shrink-0 bg-black border-t border-gray-700 px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={handleClose}
            className="px-6 py-2.5 border border-gray-700 text-gray-600 hover:text-white hover:border-gray-500 transition-all duration-200 uppercase tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-2.5 bg-white text-black hover:bg-gray-200 border border-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DisplaySettingsModal;

