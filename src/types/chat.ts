/**
 * チャットアプリケーションの型定義
 */

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isTyping?: boolean;
  /** LangGraphの処理進捗情報 */
  progress?: {
    /** 現在のイテレーション回数 */
    iteration?: number;
    /** 最大イテレーション回数 */
    maxIterations?: number;
    /** 現在実行中のツール名 */
    currentTool?: string;
    /** 処理中の説明 */
    status?: string;
  };
}

export interface ChatState {
  messages: Message[];
  isProcessing: boolean;
  error?: string;
}

export interface ChatAction {
  type: "send_message" | "clear_history" | "set_processing" | "add_message" | "set_error";
  payload?: unknown;
}
