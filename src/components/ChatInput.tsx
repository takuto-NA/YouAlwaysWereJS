/**
 * チャット入力コンポーネント
 */
import { useState, KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-input-bar">
      <div className="chat-input-bar__inner">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? "処理中..." : "メッセージを入力"}
          className="chat-input-bar__field"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="chat-input-bar__send"
        >
          送信
        </button>
      </div>
      <div className="chat-input-bar__hint">Enter: 送信</div>
    </div>
  );
}

export default ChatInput;
