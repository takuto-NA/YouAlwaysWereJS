/**
 * 個別のチャットメッセージコンポーネント
 * タイプライター効果で一文字ずつ表示
 * SF風モノトーンデザイン
 */
import { Message } from "../types/chat";
import { useTypewriter } from "../hooks/useTypewriter";
import { DEFAULT_TYPEWRITER_SPEED_MS } from "../constants/typewriter";
import { ANIMATION_DELAYS } from "../constants/animations";

interface ChatMessageProps {
  message: Message;
  enableTypewriter?: boolean;
}

function ChatMessage({ message, enableTypewriter = true }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAssistant = message.role === "assistant";

  // AIの応答のみタイプライター効果を適用
  const shouldUseTypewriter = enableTypewriter && isAssistant && message.isTyping !== false;

  // 設定から速度を取得
  // localStorageから取得できない場合はデフォルト値を使用
  const typewriterSpeed = typeof window !== 'undefined' 
    ? JSON.parse(localStorage.getItem('chat_app_settings') || '{}').typewriterSpeed || DEFAULT_TYPEWRITER_SPEED_MS
    : DEFAULT_TYPEWRITER_SPEED_MS;

  const { displayedText, isTyping } = useTypewriter({
    text: message.content,
    speed: typewriterSpeed,
    enabled: shouldUseTypewriter,
  });

  // 表示するテキスト（タイプライター効果適用済み）
  const textToDisplay = shouldUseTypewriter ? displayedText : message.content;

  if (isSystem) {
    return (
      <div className="py-3 mb-4 border-l-2 border-gray-700 pl-4 animate-slideIn">
        <div className="text-gray-500 text-sm uppercase tracking-wider">
          {textToDisplay}
        </div>
      </div>
    );
  }

  return (
    <div className={`py-4 mb-4 animate-slideIn ${isUser ? 'opacity-90' : ''}`}>
      <div className="flex flex-col gap-2">
        {/* ロールラベル */}
        <div className="flex items-center gap-3">
          <div className={`text-xs uppercase tracking-widest font-light ${
            isUser ? 'text-gray-400' : 'text-white'
          }`}>
            {isUser ? 'You' : 'AI'}
          </div>
             {isTyping && (
               <div className="flex items-center gap-1">
                 <div className="w-1 h-1 bg-gray-500 rounded-full animate-pulse"></div>
                 <div className="w-1 h-1 bg-gray-500 rounded-full animate-pulse" style={{animationDelay: ANIMATION_DELAYS.MEDIUM}}></div>
                 <div className="w-1 h-1 bg-gray-500 rounded-full animate-pulse" style={{animationDelay: ANIMATION_DELAYS.LONG}}></div>
               </div>
             )}
        </div>
        
        {/* メッセージ本文 */}
        <div className={`text-base leading-relaxed whitespace-pre-wrap ${
          isUser ? 'text-gray-300' : 'text-white'
        }`}>
          {textToDisplay}
          {isTyping && (
            <span className="inline-block ml-1 w-2 h-5 bg-white animate-blink"></span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatMessage;

