/**
 * チャット入力コンポーネント
 */
import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  // テキストエリアの高さを自動調整
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  return (
    <div className="chat-input-bar">
      <div className="chat-input-bar__inner">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? "処理中..." : "メッセージを入力"}
          className="chat-input-bar__field"
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="chat-input-bar__send"
          aria-label="送信"
        >
          <PaperAirplaneIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="chat-input-bar__hint">Enter: 送信 | Shift+Enter: 改行</div>
    </div>
  );
}

export default ChatInput;
