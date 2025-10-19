/**
 * 設定モーダルコンポーネント
 * APIキーやアプリケーション設定を管理
 */
import { useState, useEffect } from "react";
import { AppSettings, loadSettings, saveSettings } from "../utils/storage";
import { logDebug } from "../utils/errorHandler";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
}

function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSettings(loadSettings());
      setSaveMessage("");
    }
  }, [isOpen]);

  const handleSave = () => {
    try {
      setIsSaving(true);
      saveSettings(settings);
      onSave(settings);
      setSaveMessage("✓ 設定を保存しました");
      logDebug('Settings', '設定を保存しました', {
        hasApiKey: settings.openaiApiKey.length > 0,
        typewriterSpeed: settings.typewriterSpeed,
        autoScroll: settings.autoScroll,
      });
      
      setTimeout(() => {
        setSaveMessage("");
        onClose();
      }, 1500);
    } catch (error) {
      setSaveMessage("✗ 保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setShowApiKey(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* モーダル本体 */}
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-black border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto text-left">
        {/* ヘッダー */}
        <div className="sticky top-0 bg-black border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙</span>
            <h2 className="text-xl font-light text-white uppercase tracking-widest">
              Settings
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-600 hover:text-white transition-colors text-2xl"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 space-y-6">
          {/* OpenAI API設定 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-white font-light uppercase tracking-wider text-sm">
                OpenAI API Key
              </label>
              <span className="text-xs text-gray-600 uppercase">
                (Required)
              </span>
            </div>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={settings.openaiApiKey}
                onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-black border border-gray-700 text-white px-4 py-3 pr-24 text-sm focus:outline-none focus:border-gray-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600 hover:text-white transition-colors px-2 py-1 border border-gray-700 uppercase tracking-wider"
              >
                {showApiKey ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">platform.openai.com</a>
            </p>
          </div>

          {/* モデル選択 */}
          <div className="space-y-3">
            <label className="text-white font-light uppercase tracking-wider text-sm">
              Model Selection
            </label>
            <select
              value={settings.openaiModel}
              onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
              className="w-full bg-black border border-gray-700 text-white px-4 py-3 text-sm focus:outline-none focus:border-gray-500"
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
            <p className="text-xs text-gray-500">
              💡 GPT-5: 標準版（推奨） / GPT-5-mini: 高速版 / GPT-5-pro: 最高性能
            </p>
          </div>

          {/* タイプライター速度 */}
          <div className="space-y-3">
            <label className="text-green-400 font-mono font-bold flex items-center gap-2">
              ⚡ タイプライター速度
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={settings.typewriterSpeed}
                onChange={(e) => setSettings({ ...settings, typewriterSpeed: Number(e.target.value) })}
                className="w-full accent-green-500"
              />
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>高速 (10ms)</span>
                <span className="text-green-400 font-mono font-bold">
                  {settings.typewriterSpeed}ms
                </span>
                <span>低速 (100ms)</span>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              💡 数値が小さいほど速く表示されます
            </p>
          </div>

          {/* MCP Endpoint */}
          <div className="space-y-3">
            <label className="text-green-400 font-mono font-bold flex items-center gap-2">
              🔌 MCP エンドポイント
              <span className="text-xs text-gray-500 font-normal">(オプション)</span>
            </label>
            <input
              type="text"
              value={settings.mcpEndpoint}
              onChange={(e) => setSettings({ ...settings, mcpEndpoint: e.target.value })}
              placeholder="ws://localhost:8080"
              className="w-full bg-black border border-green-900 text-green-400 px-4 py-3 font-mono text-sm focus:outline-none focus:border-green-500 rounded"
            />
            <p className="text-xs text-gray-500">
              💡 Model Context Protocol サーバーのWebSocketエンドポイント（将来実装予定）
            </p>
          </div>

          {/* 自動スクロール */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.autoScroll}
                onChange={(e) => setSettings({ ...settings, autoScroll: e.target.checked })}
                className="w-5 h-5 accent-green-500"
              />
              <span className="text-green-400 font-mono font-bold group-hover:text-green-300 transition-colors">
                📜 自動スクロール
              </span>
            </label>
            <p className="text-xs text-gray-500 ml-8">
              💡 新しいメッセージが表示されたら自動的にスクロールします
            </p>
          </div>

          {/* 詳細設定 */}
          <details className="border-t border-green-900 pt-4">
            <summary className="text-green-400 font-mono font-bold cursor-pointer hover:text-green-300 transition-colors">
              🔧 詳細設定（上級者向け）
            </summary>
            <div className="mt-4 space-y-4">
              {/* Temperature */}
              <div className="space-y-2">
                <label className="text-green-400 font-mono text-sm flex items-center gap-2">
                  🌡️ Temperature（創造性）
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.temperature || 0.7}
                  onChange={(e) => setSettings({ ...settings, temperature: Number(e.target.value) })}
                  className="w-full accent-green-500"
                />
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>保守的 (0.0)</span>
                  <span className="text-green-400 font-mono">{settings.temperature || 0.7}</span>
                  <span>創造的 (2.0)</span>
                </div>
                <p className="text-xs text-gray-500">
                  💡 GPT-4以前のモデルで有効。GPT-5/o1ではデフォルト値(1.0)固定
                </p>
              </div>

              {/* Max Tokens */}
              <div className="space-y-2">
                <label className="text-green-400 font-mono text-sm flex items-center gap-2">
                  📏 最大トークン数（max_completion_tokens）
                </label>
                <input
                  type="number"
                  min="100"
                  max="4000"
                  step="100"
                  value={settings.maxTokens || 1000}
                  onChange={(e) => setSettings({ ...settings, maxTokens: Number(e.target.value) })}
                  className="w-full bg-black border border-green-900 text-green-400 px-4 py-2 font-mono text-sm focus:outline-none focus:border-green-500 rounded"
                />
                <p className="text-xs text-gray-500">
                  💡 応答の最大長。GPT-5/o1では自動的にmax_completion_tokensを使用
                </p>
              </div>
            </div>
          </details>

          {/* 保存メッセージ */}
          {saveMessage && (
            <div className={`text-center py-2 rounded ${
              saveMessage.startsWith("✓") 
                ? "text-green-400 bg-green-900/20" 
                : "text-red-400 bg-red-900/20"
            }`}>
              {saveMessage}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="sticky bottom-0 bg-gray-900 border-t-2 border-green-500 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleClose}
            className="px-6 py-2 border border-gray-700 text-gray-400 hover:text-green-400 hover:border-green-500 transition-colors font-mono rounded"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !settings.openaiApiKey.trim()}
            className="px-8 py-2 bg-green-900 hover:bg-green-800 text-green-400 font-mono font-bold border border-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded"
          >
            {isSaving ? "保存中..." : "💾 保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;

