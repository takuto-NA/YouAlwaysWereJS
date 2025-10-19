/**
 * タイプライター効果を実現するカスタムフック
 * 文字列を一文字ずつ表示するアニメーション
 */
import { useState, useEffect } from "react";
import { HOOK_DEFAULT_SPEED_MS } from "../constants/typewriter";

interface UseTypewriterOptions {
  text: string;
  speed?: number;
  enabled?: boolean;
  onComplete?: () => void;
  onProgress?: () => void;
}

export function useTypewriter({
  text,
  speed = HOOK_DEFAULT_SPEED_MS,
  enabled = true,
  onComplete,
  onProgress,
}: UseTypewriterOptions) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // タイプライター効果が無効の場合は全文を表示
    if (!enabled) {
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    // テキストが空の場合は何もしない
    if (!text) {
      setDisplayedText("");
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    setDisplayedText("");

    let currentIndex = 0;
    const intervalId = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
        if (onProgress) {
          onProgress();
        }
      } else {
        setIsTyping(false);
        clearInterval(intervalId);
        if (onComplete) {
          onComplete();
        }
      }
    }, speed);

    return () => {
      clearInterval(intervalId);
      setIsTyping(false);
    };
  }, [text, speed, enabled, onComplete, onProgress]);

  return {
    displayedText,
    isTyping,
  };
}

