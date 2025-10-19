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
    <div className="border-t border-gray-800 bg-black px-8 py-4">
      <div className="flex gap-3 max-w-5xl">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? "処理中..." : "メッセージを入力"}
          className="flex-1 bg-black border border-gray-800 text-white px-4 py-3 text-base focus:outline-none focus:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="px-8 py-3 bg-white text-black text-sm uppercase tracking-wider hover:bg-gray-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white font-medium"
        >
          送信
        </button>
      </div>
      <div className="mt-2 text-xs text-gray-700 uppercase tracking-wider max-w-5xl">
        Enter: 送信
      </div>
    </div>
  );
}

export default ChatInput;
