/**
 * チャットアプリケーションの型定義
 */

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isTyping?: boolean;
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
