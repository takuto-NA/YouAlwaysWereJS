/**
 * プロンプトエディタモーダルコンポーネント
 * システムプロンプトと動的変数を管理
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { SparklesIcon, XMarkIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { PromptSettings, DynamicVariable } from "../types/prompt";
import { loadPromptSettings, savePromptSettings } from "../utils/storage";
import { PROMPT_PRESETS, DYNAMIC_VARIABLES } from "../constants/prompts";
import { logDebug } from "../utils/errorHandler";
import { SAVE_MESSAGE_TIMEOUT_MS } from "../constants/animations";

interface PromptEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: PromptSettings) => void;
}

function PromptEditorModal({ isOpen, onClose, onSave }: PromptEditorModalProps) {
  const [settings, setSettings] = useState<PromptSettings>(loadPromptSettings());
  const [originalSettings, setOriginalSettings] = useState<PromptSettings>(loadPromptSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [activeTab, setActiveTab] = useState<"presets" | "custom">("presets");
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // 選択中のプリセットを取得
  const selectedPreset =
    [...PROMPT_PRESETS, ...settings.customPresets].find(
      (p) => p.id === settings.selectedPresetId
    ) || PROMPT_PRESETS[0];

  // 設定が変更されたかどうかを確認
  const hasUnsavedChanges = useCallback(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  // モーダルが開いている時の処理
  useEffect(() => {
    if (isOpen) {
      const loadedSettings = loadPromptSettings();
      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
      setSaveMessage("");
      setShowUnsavedWarning(false);
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";

      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
    } else {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    }

    return () => {
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
      savePromptSettings(settings);
      onSave(settings);
      setOriginalSettings(settings);
      setSaveMessage("SAVED");
      logDebug("Prompt Editor", "プロンプト設定を保存しました", {
        selectedPresetId: settings.selectedPresetId,
        enabledVariablesCount: settings.enabledDynamicVariables.length,
      });

      setTimeout(() => {
        setSaveMessage("");
        onClose();
      }, SAVE_MESSAGE_TIMEOUT_MS);
    } catch (error) {
      setSaveMessage("ERROR: Failed to save");
      logDebug("Prompt Editor", "プロンプト設定の保存に失敗しました", { error });
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

  const toggleDynamicVariable = (variable: DynamicVariable) => {
    setSettings((prev) => ({
      ...prev,
      enabledDynamicVariables: prev.enabledDynamicVariables.includes(variable)
        ? prev.enabledDynamicVariables.filter((v) => v !== variable)
        : [...prev.enabledDynamicVariables, variable],
    }));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden touch-none animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-editor-modal-title"
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
            <SparklesIcon className="w-7 h-7 text-white" aria-hidden="true" />
            <h2
              id="prompt-editor-modal-title"
              className="text-xl font-light text-white uppercase tracking-widest"
            >
              Prompt Editor
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
                    onClose();
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white hover:bg-yellow-500 transition-colors duration-200 uppercase tracking-wider text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-black"
                >
                  Close Without Saving
                </button>
              </div>
            </div>
          )}

          {/* タブ切り替え */}
          <div className="flex gap-2 border-b border-gray-800">
            <button
              onClick={() => setActiveTab("presets")}
              className={`px-6 py-3 uppercase tracking-wider text-sm transition-colors duration-200 focus:outline-none ${
                activeTab === "presets"
                  ? "text-white border-b-2 border-white"
                  : "text-gray-600 hover:text-gray-400"
              }`}
            >
              Presets
            </button>
            <button
              onClick={() => setActiveTab("custom")}
              className={`px-6 py-3 uppercase tracking-wider text-sm transition-colors duration-200 focus:outline-none ${
                activeTab === "custom"
                  ? "text-white border-b-2 border-white"
                  : "text-gray-600 hover:text-gray-400"
              }`}
            >
              Custom Prompt
            </button>
          </div>

          {/* プリセットタブ */}
          {activeTab === "presets" && (
            <div className="space-y-4">
              {PROMPT_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className={`p-4 border transition-all duration-200 cursor-pointer ${
                    settings.selectedPresetId === preset.id
                      ? "border-white bg-white/5"
                      : "border-gray-700 hover:border-gray-500"
                  }`}
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      selectedPresetId: preset.id,
                      enabledDynamicVariables: preset.dynamicVariables,
                    }))
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-white font-light uppercase tracking-wider text-sm">
                        {preset.name}
                      </h3>
                      <p className="text-gray-500 text-xs mt-1">{preset.description}</p>
                      <p className="text-gray-600 text-xs mt-3 leading-relaxed whitespace-pre-wrap">
                        {preset.systemPrompt}
                      </p>
                    </div>
                    {settings.selectedPresetId === preset.id && (
                      <CheckCircleIcon className="w-5 h-5 text-white flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* カスタムプロンプトタブ */}
          {activeTab === "custom" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label
                  htmlFor="custom-system-prompt"
                  className="text-white font-light uppercase tracking-wider text-sm block"
                >
                  Custom System Prompt
                </label>
                <textarea
                  id="custom-system-prompt"
                  value={settings.customSystemPrompt}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      customSystemPrompt: e.target.value,
                      selectedPresetId: "custom",
                    }))
                  }
                  placeholder="Enter your custom system prompt here..."
                  rows={10}
                  className="w-full bg-black border border-gray-700 text-white px-4 py-3 text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white transition-all duration-200 resize-y"
                />
                <p className="text-xs text-gray-600">
                  Define how the AI should behave and respond to your queries
                </p>
              </div>
            </div>
          )}

          {/* 動的変数設定 */}
          <div className="space-y-4 border-t border-gray-800 pt-6">
            <h3 className="text-white font-light uppercase tracking-wider text-sm">
              Dynamic Variables
            </h3>
            <p className="text-xs text-gray-600">
              These variables will be automatically included in the prompt
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.values(DYNAMIC_VARIABLES).map((variable) => (
                <label
                  key={variable.key}
                  className="flex items-start gap-3 p-3 border border-gray-700 cursor-pointer hover:border-gray-500 transition-colors duration-200"
                >
                  <input
                    type="checkbox"
                    checked={settings.enabledDynamicVariables.includes(variable.key)}
                    onChange={() => toggleDynamicVariable(variable.key)}
                    className="w-5 h-5 accent-gray-400 mt-0.5 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
                  />
                  <div className="flex-1">
                    <span className="text-white font-light text-sm">{variable.label}</span>
                    <p className="text-gray-600 text-xs mt-1">{variable.description}</p>
                    <p className="text-gray-500 text-xs mt-1 font-mono">
                      Value: {variable.getValue()}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* プレビュー */}
          <div className="space-y-3 border-t border-gray-800 pt-6">
            <h3 className="text-white font-light uppercase tracking-wider text-sm">
              Prompt Preview
            </h3>
            <div className="p-4 bg-gray-900/50 border border-gray-800 text-sm text-gray-400 whitespace-pre-wrap max-h-60 overflow-y-auto">
              {activeTab === "presets" ? selectedPreset.systemPrompt : settings.customSystemPrompt || "(No custom prompt defined)"}
              {settings.enabledDynamicVariables.length > 0 && (
                <>
                  {"\n\n"}
                  <span className="text-gray-600">--- Dynamic Context ---</span>
                  {"\n"}
                  {settings.enabledDynamicVariables
                    .map(
                      (key) =>
                        `${DYNAMIC_VARIABLES[key].label}: ${DYNAMIC_VARIABLES[key].getValue()}`
                    )
                    .join("\n")}
                </>
              )}
            </div>
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
            disabled={isSaving}
            className="px-8 py-2.5 bg-white text-black hover:bg-gray-200 border border-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white uppercase tracking-wider text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PromptEditorModal;

