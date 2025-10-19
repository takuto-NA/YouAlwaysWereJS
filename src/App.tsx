/**
 * チャットアプリケーションのメインコンポーネント
 * LangGraphとOpenAI APIを使用してMCP経由で対話
 */
import { useState, useRef, useEffect } from "react";
import { Cog6ToothIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import ChatMessage from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import SettingsModal from "./components/SettingsModal";
import { Message, ChatState } from "./types/chat";
import { openAIService } from "./services/ai";
import { logError, logDebug } from "./utils/errorHandler";
import { loadSettings, hasApiKey, AppSettings } from "./utils/storage";
import { ANIMATION_DELAYS } from "./constants/animations";

function App() {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isProcessing: false,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
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

    logDebug('App', 'チャットアプリケーション初期化完了', {
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

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, successMessage],
    }));
  };

  const scrollToBottom = () => {
    if (settings.autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatState.messages, settings.autoScroll]);

  const handleSendMessage = async (content: string) => {
    // APIキーチェック
    if (!settings.openaiApiKey) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "system",
        content: "WARNING: OpenAI APIキーが設定されていません。右上の設定ボタンから設定してください。",
        timestamp: Date.now(),
        isTyping: false,
      };
      setChatState(prev => ({
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

    logDebug('Chat', 'ユーザーメッセージ受信', {
      messageLength: content.length,
      totalMessages: chatState.messages.length + 1,
    });

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isProcessing: true,
      error: undefined,
    }));

    try {
      logDebug('Chat', 'OpenAI APIにリクエスト送信中', {
        messageCount: chatState.messages.length + 1,
      });

      // 設定からAPIキーとモデルを使用してOpenAI APIを呼び出し
      const { createOpenAIService } = await import("./services/ai/openai");
      const customService = createOpenAIService(
        settings.openaiApiKey,
        settings.openaiModel,
        settings.temperature,
        settings.maxTokens
      );
      
      const response = await customService.chat([
        ...chatState.messages,
        userMessage,
      ]);

      // AIレスポンスを追加（タイプライター効果を有効化）
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response,
        timestamp: Date.now(),
        isTyping: true,
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isProcessing: false,
      }));

      logDebug('Chat', 'AI応答を受信しました', {
        responseLength: response.length,
      });
    } catch (error) {
      logError('Chat', error, {
        attemptedAction: 'handleSendMessage',
      });

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "system",
        content: `エラー: ${error instanceof Error ? error.message : '不明なエラーが発生しました'}`,
        timestamp: Date.now(),
        isTyping: false,
      };

      setChatState(prev => ({
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
      {/* 設定モーダル */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSettingsSave}
      />

      {/* ヘッダー - シンプルなSF風 */}
      <div className="bg-black border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0 animate-fadeIn">
        <div className="text-white text-lg font-light tracking-widest">
          AI INTERFACE
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-gray-600 hover:text-white transition-all duration-300 hover:scale-110"
            aria-label="設定を開く"
            title="設定"
          >
            <Cog6ToothIcon className="w-6 h-6" />
          </button>
          <button
            onClick={handleClearHistory}
            className="text-xs text-gray-600 hover:text-white transition-colors uppercase tracking-wider"
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
            {chatState.messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
               {chatState.isProcessing && (
                 <div className="text-gray-500 text-sm animate-pulse flex items-center gap-2 my-4">
                   <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                   <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: ANIMATION_DELAYS.SHORT}}></div>
                   <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: ANIMATION_DELAYS.MEDIUM}}></div>
                   <span className="ml-2">処理中</span>
          </div>
               )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 入力エリア */}
        <div className="flex-shrink-0">
          <ChatInput
            onSend={handleSendMessage}
            disabled={chatState.isProcessing}
          />
        </div>
      </div>

      {/* ステータスバー - ミニマル */}
      <div className="bg-black border-t border-gray-800 px-6 py-2 text-xs text-gray-600 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-6">
          <span className="uppercase tracking-wider">Messages: {chatState.messages.length}</span>
          <span className={`flex items-center gap-2 ${chatState.isProcessing ? "text-gray-400" : "text-gray-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${chatState.isProcessing ? "bg-gray-400 animate-pulse" : "bg-gray-600"}`}></span>
            {chatState.isProcessing ? "Processing" : "Ready"}
          </span>
        </div>
        <div className="uppercase tracking-wider">
          {chatState.error ? "Error" : "Online"}
        </div>
      </div>
    </div>
  );
}

export default App;
