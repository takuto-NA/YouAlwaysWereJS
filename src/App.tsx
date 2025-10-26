/**
 * AIチャットアプリケーションのメインコンポーネント
 *
 * @description
 * OpenAI互換API（OpenAI、Groq、Gemini、LM Studio等）と統合されたチャットインターフェース。
 * 複数のAIプロバイダーをサポートし、カスタマイズ可能なプロンプト、表示モード、
 * Kuzuグラフデータベースを用いた長期記憶機能を提供する。
 *
 * @features
 * - マルチプロバイダー対応（OpenAI、Groq、Gemini、LM Studio）
 * - リアルタイムタイプライターエフェクト
 * - カスタマイズ可能なシステムプロンプト
 * - 通常/ノベル/デバッグの3つの表示モード
 * - Kuzuグラフデータベースによる長期記憶管理
 *
 * @see SettingsModal - AI設定管理
 * @see PromptEditorModal - プロンプトカスタマイズ
 * @see DisplaySettingsModal - 表示モード切り替え
 * @see MemoryManagerModal - 記憶データ管理
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Cog6ToothIcon, SparklesIcon, RectangleStackIcon, CircleStackIcon, UserIcon } from "@heroicons/react/24/outline";
import ChatMessage from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import SettingsModal from "./components/SettingsModal";
import PromptEditorModal from "./components/PromptEditorModal";
import DisplaySettingsModal from "./components/DisplaySettingsModal";
import MemoryManagerModal from "./components/MemoryManagerModal";
import UserInfoModal from "./components/UserInfoModal";
import StartupSplash from "./components/StartupSplash";
import { Message, ChatState } from "./types/chat";
import { PromptSettings } from "./types/prompt";
import { DisplaySettings } from "./types/game";
// import { openAIService } from "./services/ai"; // 将来使用するため保持
import { logError, logDebug } from "./utils/errorHandler";
import { loadSettings, hasApiKey, AppSettings, loadPromptSettings, loadDisplaySettings } from "./utils/storage";
import { buildSystemPrompt } from "./utils/promptBuilder";
import { ANIMATION_DELAYS } from "./constants/animations";
import {
  MESSAGE_ID_PREFIX,
  INITIAL_SYSTEM_MESSAGE_ID,
  RESET_SYSTEM_MESSAGE_ID,
  SYSTEM_PROMPT_MESSAGE_ID,
  DISPLAY_MODE_LABELS,
  AI_PROVIDER_LABELS,
} from "./constants/app";

function App() {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isProcessing: false,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false);
  const [isMemoryManagerOpen, setIsMemoryManagerOpen] = useState(false);
  const [isUserInfoOpen, setIsUserInfoOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [promptSettings, setPromptSettings] = useState<PromptSettings>(loadPromptSettings());
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(loadDisplaySettings());
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // アプリ起動時にAPIキー設定状態を確認し、適切な初期メッセージを表示するため
  useEffect(() => {
    const savedSettings = loadSettings();
    setSettings(savedSettings);

    const hasKey = hasApiKey();

    const initialMessage: Message = {
      id: INITIAL_SYSTEM_MESSAGE_ID,
      role: "system",
      content: hasKey
        ? "システム起動完了。OpenAI互換API経由でMCPを使用した対話が可能です。"
        : "WARNING: OpenAI/Groq APIキーが設定されていません。右上の設定ボタンから設定してください。",
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

  /**
   * AI設定の保存処理
   * 新しい設定を適用し、保存成功のシステムメッセージを追加する
   */
  const handleSettingsSave = (newSettings: AppSettings) => {
    setSettings(newSettings);

    // ユーザーに設定保存の成功をフィードバックするため
    const successMessage: Message = {
      id: `${MESSAGE_ID_PREFIX.SYSTEM}-${Date.now()}`,
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

  /**
   * プロンプト設定の保存処理
   * カスタムシステムプロンプトを更新し、保存成功メッセージを表示する
   */
  const handlePromptSettingsSave = (newPromptSettings: PromptSettings) => {
    setPromptSettings(newPromptSettings);

    const successMessage: Message = {
      id: `${MESSAGE_ID_PREFIX.SYSTEM}-${Date.now()}`,
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

  /**
   * 表示設定の保存処理
   * 表示モード（通常/ノベル/デバッグ）を切り替え、変更内容を通知する
   */
  const handleDisplaySettingsSave = (newDisplaySettings: DisplaySettings) => {
    setDisplaySettings(newDisplaySettings);

    const modeLabel = DISPLAY_MODE_LABELS[newDisplaySettings.mode] || newDisplaySettings.mode;
    const successMessage: Message = {
      id: `${MESSAGE_ID_PREFIX.SYSTEM}-${Date.now()}`,
      role: "system",
      content: `SAVED: 表示モードを「${modeLabel}」に変更しました。`,
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

  /**
   * ユーザーメッセージ送信処理
   * APIキーの検証、メッセージ送信、AI応答の受信、エラーハンドリングを行う
   *
   * @param content - ユーザーが入力したメッセージ内容
   */
  const handleSendMessage = async (content: string) => {
    // 選択されたプロバイダーに応じて適切なAPIキーを使用するため
    const currentApiKey =
      settings.aiProvider === "openai" ? settings.openaiApiKey : settings.geminiApiKey;
    const providerName = AI_PROVIDER_LABELS[settings.aiProvider];

    // APIキー未設定時は早期リターンでエラーを明示し、不要なAPI呼び出しを防ぐため
    if (!currentApiKey) {
      const errorMessage: Message = {
        id: `${MESSAGE_ID_PREFIX.ERROR}-${Date.now()}`,
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

    const userMessage: Message = {
      id: `${MESSAGE_ID_PREFIX.USER}-${Date.now()}`,
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
      logDebug("Chat", "OpenAI互換APIにリクエスト送信中", {
        messageCount: chatState.messages.length + 1,
      });

      // 動的import: ビルドサイズ削減とコード分割のため必要時のみロード
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

      // LM Studioなどのローカル環境に接続できるようにするため
      if (settings.aiProvider === "openai" && settings.customOpenAIEndpoint) {
        customService.setCustomEndpoint(settings.customOpenAIEndpoint);
      }

      // LangGraph最大イテレーション回数を設定
      if (settings.maxToolIterations !== undefined) {
        customService.setMaxToolIterations(settings.maxToolIterations);
      }

      // プレースホルダーID用の変数（コールバックで使用）
      let currentPlaceholderId = "";

      // プログレスコールバックを設定して進捗を表示
      customService.setProgressCallback((progress) => {
        if (!currentPlaceholderId) return;

        setChatState((prev) => {
          const updatedMessages = prev.messages.map((msg) => {
            if (msg.id === currentPlaceholderId && msg.role === "assistant") {
              // 進捗履歴に追加（デバッグ用）
              const newHistoryEntry = {
                iteration: progress.iteration ?? 0,
                status: progress.status ?? "",
                currentTool: progress.currentTool,
              };

              const existingHistory = msg.progressHistory ?? [];

              return {
                ...msg,
                progress: {
                  iteration: progress.iteration,
                  maxIterations: progress.maxIterations,
                  currentTool: progress.currentTool,
                  status: progress.status,
                },
                progressHistory: [...existingHistory, newHistoryEntry],
              };
            }
            return msg;
          });
          return { ...prev, messages: updatedMessages };
        });
      });

      // OpenAIのみFunction Calling経由でKuzuツールにアクセス可能なため条件分岐
      const hasTools = settings.aiProvider === "openai";

      const systemPromptText = buildSystemPrompt(
        promptSettings,
        chatState.messages.length + 1,
        hasTools
      );

      const memoryToolInstructions = hasTools
        ? "\n\n[Memory Tools - CRITICAL]\nYou have access to a persistent graph database for long-term memory. You MUST use these tools EVERY TIME users ask about what you remember or to store information:\n\n- Use `kuzu_list_tables` to enumerate available graph tables\n- Use `kuzu_describe_table` to inspect schemas and review sample rows before modifying data\n- Use `kuzu_query` to read, insert, update, or delete data. Always include a reasonable LIMIT when reading\n\nWhen a user asks about memory (\"What do you remember?\", \"他にも?\", \"過去の会話を見て\", etc.), you MUST:\n1. Call `kuzu_list_tables` to see available tables\n2. Call `kuzu_describe_table` for relevant tables (e.g., UserProfile, ConversationLog)\n3. Call `kuzu_query` to retrieve the actual data\n\nCRITICAL RULES:\n- DO NOT rely on information from previous tool calls in this conversation - ALWAYS query fresh data\n- DO NOT say \"I will check the database\" without actually calling the tools\n- If you mention checking a table (e.g., \"会話ログテーブルを見てみます\"), you MUST call kuzu_describe_table and kuzu_query immediately\n- The database is the ONLY source of truth for long-term memory - your conversation context is NOT sufficient"
        : "";

      // AIに会話履歴とコンテキストを提供するため、システムプロンプトを先頭に配置
      const systemMessage: Message = {
        id: SYSTEM_PROMPT_MESSAGE_ID,
        role: "system",
        content: `${systemPromptText}${memoryToolInstructions}`,
        timestamp: Date.now(),
      };

      const messagesWithPrompt = [systemMessage, ...chatState.messages, userMessage];

      // プレースホルダーのアシスタントメッセージを追加（プログレス表示用）
      const placeholderId = `${MESSAGE_ID_PREFIX.ASSISTANT}-${Date.now()}`;
      currentPlaceholderId = placeholderId; // コールバックで使用するためにIDを保存

      const placeholderMessage: Message = {
        id: placeholderId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        progress: {
          iteration: 0,
          maxIterations: settings.maxToolIterations || 20,
          status: "Starting...",
        },
      };

      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, placeholderMessage],
      }));

      const response = await customService.chat(messagesWithPrompt, settings.aiProvider);

      // タイプライター効果でユーザー体験を向上させるため、isTypingフラグを有効化
      const assistantMessage: Message = {
        id: placeholderId,
        role: "assistant",
        content: response,
        timestamp: Date.now(),
        isTyping: true,
      };

      setChatState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) =>
          msg.id === placeholderId ? assistantMessage : msg
        ),
        isProcessing: false,
      }));

      logDebug("Chat", "AI応答を受信しました", {
        responseLength: response.length,
      });
    } catch (error) {
      logError("Chat", error, {
        attemptedAction: "handleSendMessage",
      });

      // ユーザーが問題を自己解決できるよう、エラー種別に応じた具体的なヒントを提供するため
      let errorText = "不明なエラーが発生しました";
      if (error instanceof Error) {
        errorText = error.message;

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
        id: `${MESSAGE_ID_PREFIX.ERROR}-${Date.now()}`,
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

  /**
   * 会話履歴のクリア処理
   * 全てのメッセージを削除し、リセット通知のシステムメッセージのみを残す
   */
  const handleClearHistory = () => {
    setChatState({
      messages: [
        {
          id: RESET_SYSTEM_MESSAGE_ID,
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

      <UserInfoModal
        isOpen={isUserInfoOpen}
        onClose={() => setIsUserInfoOpen(false)}
      />

      {/* ヘッダー */}
      <div className="bg-black border-b border-gray-800 px-6 py-3 flex items-center justify-end flex-shrink-0 animate-fadeIn">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsUserInfoOpen(true)}
            className="text-gray-600 transition-all duration-300 hover:scale-110 hover:text-white"
            aria-label="Open user info"
            title="User Info"
          >
            <UserIcon className="h-6 w-6" />
          </button>
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
