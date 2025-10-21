/**
 * 個別のチャットメッセージコンポーネント
 * タイプライター効果で一文字ずつ表示
 * SF風モノトーンデザイン
 */
import { Message } from "../types/chat";
import { useTypewriter } from "../hooks/useTypewriter";
import { DEFAULT_TYPEWRITER_SPEED_MS } from "../constants/typewriter";

interface ChatMessageProps {
  message: Message;
  enableTypewriter?: boolean;
  showTimestamp?: boolean;
}

const ROLE_LABELS: Record<Exclude<Message["role"], "system">, string> = {
  user: "You",
  assistant: "AI",
};

function ChatMessage({ message, enableTypewriter = true, showTimestamp = false }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAssistant = message.role === "assistant";

  // AIの応答のみタイプライター効果を適用
  const shouldUseTypewriter = enableTypewriter && isAssistant && message.isTyping !== false;

  // 設定から速度を取得
  const typewriterSpeed =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("chat_app_settings") || "{}").typewriterSpeed ||
        DEFAULT_TYPEWRITER_SPEED_MS
      : DEFAULT_TYPEWRITER_SPEED_MS;

  const { displayedText, isTyping } = useTypewriter({
    text: message.content,
    speed: typewriterSpeed,
    enabled: shouldUseTypewriter,
  });

  const textToDisplay = shouldUseTypewriter ? displayedText : message.content;

  if (isSystem) {
    return (
      <div className="chat-message chat-message--system chat-message--enter">
        <p className="chat-message__system-text">{textToDisplay}</p>
        {showTimestamp && (
          <div className="chat-message__timestamp">
            {new Date(message.timestamp).toLocaleString()}
          </div>
        )}
      </div>
    );
  }

  const role = isUser ? "user" : "assistant";
  const label = ROLE_LABELS[role];

  return (
    <div className={`chat-message chat-message--${role} chat-message--enter`}>
      <div className="chat-message__inner">
        <div className="chat-message__header">
          <span className={`chat-message__label chat-message__label--${role}`}>{label}</span>
          {isTyping && (
            <div className="chat-message__typing" aria-hidden="true">
              <span className="chat-message__typing-dot" />
              <span className="chat-message__typing-dot" />
              <span className="chat-message__typing-dot" />
            </div>
          )}
        </div>

        <div className={`chat-message__body chat-message__body--${role}`}>
          {textToDisplay}
          {isTyping && <span className="chat-message__cursor" aria-hidden="true" />}
        </div>

        {showTimestamp && (
          <div className="chat-message__timestamp">
            {new Date(message.timestamp).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;
