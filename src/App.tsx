/**
 * チャットアプリケーションのメインコンポーネント
 * LangGraphとOpenAI APIを使用してMCP経由で対話
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Cog6ToothIcon, SparklesIcon, RectangleStackIcon, CircleStackIcon } from "@heroicons/react/24/outline";
import ChatMessage from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import SettingsModal from "./components/SettingsModal";
import PromptEditorModal from "./components/PromptEditorModal";
import DisplaySettingsModal from "./components/DisplaySettingsModal";
import MemoryManagerModal from "./components/MemoryManagerModal";
import StartupSplash from "./components/StartupSplash";
import { Message, ChatState } from "./types/chat";
import { PromptSettings } from "./types/prompt";
import { DisplaySettings } from "./types/game";
// import { openAIService } from "./services/ai"; // 将来使用するため保持
import { logError, logDebug } from "./utils/errorHandler";
import { loadSettings, hasApiKey, AppSettings, loadPromptSettings, loadDisplaySettings } from "./utils/storage";
import { buildSystemPrompt } from "./utils/promptBuilder";
import { ANIMATION_DELAYS } from "./constants/animations";

function App() {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isProcessing: false,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false);
  const [isMemoryManagerOpen, setIsMemoryManagerOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [promptSettings, setPromptSettings] = useState<PromptSettings>(loadPromptSettings());
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(loadDisplaySettings());
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初期化と設定チェック
  useEffect(() => {
    const savedSettings = loadSettings();
    setSettings(savedSettings);

    // APIキーが設定されているかチェック
    const hasKey = hasApiKey();

    const initialMessage: Message = {
      id: "system-1",
      role: "system",
      content: hasKey
        ? "システム起動完了。OpenAI API経由でMCPを使用した対話が可能です。"
        : "WARNING: OpenAI APIキーが設定されていません。右上の設定ボタンから設定してください。",
      timestamp: Date.now(),
      isTyping: false,
    };

    setChatState({
      messages: [initialMessage],
      isProcessing: false,
    });

    logDebug("App", "チャットアプリケーション初期化完了", {
      environment: import.meta.env.MODE,
      hasApiKey: hasKey,
      settings: savedSettings,
    });
  }, []);

  const handleSettingsSave = (newSettings: AppSettings) => {
    setSettings(newSettings);

    // APIキーが新たに設定された場合、メッセージを追加
    const successMessage: Message = {
      id: `system-${Date.now()}`,
      role: "system",
      content: "SAVED: 設定を保存しました。チャットを開始できます。",
      timestamp: Date.now(),
      isTyping: false,
    };

    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, successMessage],
    }));
  };

  const handlePromptSettingsSave = (newPromptSettings: PromptSettings) => {
    setPromptSettings(newPromptSettings);

    const successMessage: Message = {
      id: `system-${Date.now()}`,
      role: "system",
      content: "SAVED: プロンプト設定を保存しました。",
      timestamp: Date.now(),
      isTyping: false,
    };

    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, successMessage],
    }));
  };

  const handleDisplaySettingsSave = (newDisplaySettings: DisplaySettings) => {
    setDisplaySettings(newDisplaySettings);

    const successMessage: Message = {
      id: `system-${Date.now()}`,
      role: "system",
      content: `SAVED: 表示モードを「${newDisplaySettings.mode === "normal" ? "通常モード" : newDisplaySettings.mode === "novel" ? "ノベルモード" : "デバッグモード"}」に変更しました。`,
      timestamp: Date.now(),
      isTyping: false,
    };

    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, successMessage],
    }));
  };

  const scrollToBottom = useCallback(() => {
    if (settings.autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [settings.autoScroll]);

  useEffect(() => {
    scrollToBottom();
  }, [chatState.messages, scrollToBottom]);

  const handleSendMessage = async (content: string) => {
    // APIキーチェック（プロバイダーに応じて）
    const currentApiKey =
      settings.aiProvider === "openai" ? settings.openaiApiKey : settings.geminiApiKey;
    const providerName = settings.aiProvider === "openai" ? "OpenAI" : "Gemini";

    if (!currentApiKey) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "system",
        content: `WARNING: ${providerName} APIキーが設定されていません。右上の設定ボタンから設定してください。`,
        timestamp: Date.now(),
        isTyping: false,
      };
      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
      }));
      return;
    }

    // ユーザーメッセージを追加
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: Date.now(),
    };

    logDebug("Chat", "ユーザーメッセージ受信", {
      messageLength: content.length,
      totalMessages: chatState.messages.length + 1,
    });

    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isProcessing: true,
      error: undefined,
    }));

    try {
      logDebug("Chat", "OpenAI APIにリクエスト送信中", {
        messageCount: chatState.messages.length + 1,
      });

      // 設定からプロバイダー、APIキー、モデルを使用してAI APIを呼び出し
      const currentApiKey =
        settings.aiProvider === "openai" ? settings.openaiApiKey : settings.geminiApiKey;
      const currentModel =
        settings.aiProvider === "openai" ? settings.openaiModel : settings.geminiModel;

      const { createAIService } = await import("./services/ai/openai");
      const customService = createAIService(
        settings.aiProvider,
        currentApiKey,
        currentModel,
        settings.temperature,
        settings.maxTokens
      );

      // カスタムエンドポイントが設定されている場合は適用（LM Studio対応）
      if (settings.aiProvider === "openai" && settings.customOpenAIEndpoint) {
        customService.setCustomEndpoint(settings.customOpenAIEndpoint);
      }

      // システムプロンプトを構築
      const systemPromptText = buildSystemPrompt(
        promptSettings,
        chatState.messages.length + 1
      );

      const memoryToolInstructions =
        settings.aiProvider === "openai"
          ? "\n\n[Memory Tools]\n- Use `kuzu_list_tables` to enumerate available graph tables.\n- Use `kuzu_describe_table` to inspect schemas and review sample rows before modifying data.\n- Use `kuzu_query` to read, insert, update, or delete data. Always include a reasonable LIMIT when reading and never assume results without querying.\n- Treat the database as the source of truth for long-term memory."
          : "";

      // システムプロンプトをメッセージの最初に追加
      const systemMessage: Message = {
        id: "system-prompt",
        role: "system",
        content: `${systemPromptText}${memoryToolInstructions}`,
        timestamp: Date.now(),
      };

      // システムメッセージ + 会話履歴 + ユーザーメッセージ
      const messagesWithPrompt = [systemMessage, ...chatState.messages, userMessage];

      const response = await customService.chat(messagesWithPrompt, settings.aiProvider);

      // AIレスポンスを追加（タイプライター効果を有効化）
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response,
        timestamp: Date.now(),
        isTyping: true,
      };

      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isProcessing: false,
      }));

      logDebug("Chat", "AI応答を受信しました", {
        responseLength: response.length,
      });
    } catch (error) {
      logError("Chat", error, {
        attemptedAction: "handleSendMessage",
      });

      // エラーメッセージをより詳細に
      let errorText = "不明なエラーが発生しました";
      if (error instanceof Error) {
        errorText = error.message;
        
        // よくあるエラーパターンに対して具体的なアドバイスを追加
        if (errorText.includes("API key") || errorText.includes("APIキー")) {
          errorText += "\n\n💡 設定画面からAPIキーを確認してください。";
        } else if (errorText.includes("カスタムエンドポイント") || errorText.includes("接続に失敗")) {
          errorText += "\n\n💡 設定画面で接続先のエンドポイントとサーバーの起動状態を確認してください。";
        } else if (errorText.includes("network") || errorText.includes("fetch")) {
          errorText += "\n\n💡 インターネット接続を確認してください。";
        } else if (errorText.includes("rate limit") || errorText.includes("quota")) {
          errorText += "\n\n💡 APIの使用制限に達しています。しばらく待ってから再試行してください。";
        }
      }

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "system",
        content: `❌ エラー: ${errorText}`,
        timestamp: Date.now(),
        isTyping: false,
      };

      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isProcessing: false,
        error: error instanceof Error ? error.message : "不明なエラー",
      }));
    }
  };

  const handleClearHistory = () => {
    setChatState({
      messages: [
        {
          id: "system-reset",
          role: "system",
          content: "会話履歴がクリアされました。",
          timestamp: Date.now(),
          isTyping: false,
        },
      ],
      isProcessing: false,
    });
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col touch-none">
      {isSplashVisible && <StartupSplash onComplete={() => setIsSplashVisible(false)} />}

      {/* 設定モーダル */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSettingsSave}
      />

      <PromptEditorModal
        isOpen={isPromptEditorOpen}
        onClose={() => setIsPromptEditorOpen(false)}
        onSave={handlePromptSettingsSave}
      />

      <DisplaySettingsModal
        isOpen={isDisplaySettingsOpen}
        onClose={() => setIsDisplaySettingsOpen(false)}
        onSave={handleDisplaySettingsSave}
      />

      <MemoryManagerModal
        isOpen={isMemoryManagerOpen}
        onClose={() => setIsMemoryManagerOpen(false)}
      />

      {/* ヘッダー - シンプルなSF風 */}
      <div className="bg-black border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0 animate-fadeIn">
        <div className="text-white text-lg font-light tracking-widest">AI INTERFACE</div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMemoryManagerOpen(true)}
            className="text-gray-600 transition-all duration-300 hover:scale-110 hover:text-white"
            aria-label="Open memory manager"
            title="Memory Manager"
          >
            <CircleStackIcon className="h-6 w-6" />
          </button>
          <button
            onClick={() => setIsPromptEditorOpen(true)}
            className="text-gray-600 transition-all duration-300 hover:scale-110 hover:text-white"
            aria-label="Open prompt editor"
            title="Prompt Editor"
          >
            <SparklesIcon className="h-6 w-6" />
          </button>
          <button
            onClick={() => setIsDisplaySettingsOpen(true)}
            className="text-gray-600 transition-all duration-300 hover:scale-110 hover:text-white"
            aria-label="Open display settings"
            title="Display Settings"
          >
            <RectangleStackIcon className="h-6 w-6" />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-gray-600 transition-all duration-300 hover:scale-110 hover:text-white"
            aria-label="Open settings"
            title="Settings"
          >
            <Cog6ToothIcon className="h-6 w-6" />
          </button>
          <button
            onClick={handleClearHistory}
            className="text-xs uppercase tracking-wider text-gray-600 transition-colors hover:text-white"
          >
            Clear
          </button>
        </div>
      </div>

      {/* メインチャットエリア */}
      <div className="flex-1 flex flex-col overflow-hidden touch-auto">
        {/* メッセージエリア */}
        <div className="flex-1 overflow-y-auto px-8 py-6 overscroll-contain touch-pan-y">
          <div className="max-w-5xl">
            {/* 通常モード: 全てのメッセージを表示 */}
            {displaySettings.mode === "normal" &&
              chatState.messages.map((message) => (
                <ChatMessage 
                  key={message.id} 
                  message={message} 
                  showTimestamp={displaySettings.showTimestamps}
                />
              ))}

            {/* ノベルモード: 最新のアシスタントメッセージのみ表示 */}
            {displaySettings.mode === "novel" && (() => {
              // 最新のアシスタントメッセージを取得
              const latestAssistantMessage = [...chatState.messages]
                .reverse()
                .find((msg) => msg.role === "assistant");
              
              return latestAssistantMessage ? (
                <div className="flex flex-col items-center justify-center min-h-full">
                  <div className="w-full max-w-3xl">
                    <ChatMessage 
                      key={latestAssistantMessage.id} 
                      message={latestAssistantMessage}
                      showTimestamp={false}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center min-h-full">
                  <p className="text-gray-600 text-sm uppercase tracking-wider">
                    Waiting for response...
                  </p>
                </div>
              );
            })()}

            {/* デバッグモード: 全メッセージ + デバッグ情報 */}
            {displaySettings.mode === "debug" &&
              chatState.messages.map((message) => (
                <div key={message.id} className="space-y-2 mb-4">
                  <ChatMessage 
                    message={message}
                    showTimestamp={true}
                  />
                  {displaySettings.showDebugInfo && (
                    <div className="bg-gray-900/50 border border-gray-800 p-3 text-xs font-mono space-y-1">
                      <div className="text-gray-500">
                        <span className="text-gray-600">ID:</span> {message.id}
                      </div>
                      <div className="text-gray-500">
                        <span className="text-gray-600">Role:</span> {message.role}
                      </div>
                      <div className="text-gray-500">
                        <span className="text-gray-600">Timestamp:</span>{" "}
                        {new Date(message.timestamp).toISOString()}
                      </div>
                      <div className="text-gray-500">
                        <span className="text-gray-600">Length:</span> {message.content.length} chars
                      </div>
                      {message.isTyping !== undefined && (
                        <div className="text-gray-500">
                          <span className="text-gray-600">Typing:</span>{" "}
                          {message.isTyping ? "true" : "false"}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

            {chatState.isProcessing && (
              <div className="text-gray-500 text-sm animate-pulse flex items-center gap-2 my-4">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                  style={{ animationDelay: ANIMATION_DELAYS.SHORT }}
                ></div>
                <div
                  className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                  style={{ animationDelay: ANIMATION_DELAYS.MEDIUM }}
                ></div>
                <span className="ml-2">処理中</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 入力エリア */}
        <div className="flex-shrink-0">
          <ChatInput onSend={handleSendMessage} disabled={chatState.isProcessing} />
        </div>
      </div>

      {/* ステータスバー - ミニマル */}
      <div className="bg-black border-t border-gray-800 px-6 py-2 text-xs text-gray-600 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-6">
          <span className="uppercase tracking-wider">Messages: {chatState.messages.length}</span>
          <span
            className={`flex items-center gap-2 ${chatState.isProcessing ? "text-gray-400" : "text-gray-500"}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${chatState.isProcessing ? "bg-gray-400 animate-pulse" : "bg-gray-600"}`}
            ></span>
            {chatState.isProcessing ? "Processing" : "Ready"}
          </span>
          {displaySettings.mode === "debug" && (
            <>
              <span className="uppercase tracking-wider">
                Mode: {displaySettings.mode.toUpperCase()}
              </span>
              <span className="uppercase tracking-wider">
                Provider: {settings.aiProvider.toUpperCase()}
              </span>
              <span className="uppercase tracking-wider">
                Model: {settings.aiProvider === "openai" ? settings.openaiModel : settings.geminiModel}
              </span>
            </>
          )}
        </div>
        <div className="uppercase tracking-wider">{chatState.error ? "Error" : "Online"}</div>
      </div>
    </div>
  );
}

export default App;
