/**
 * 起動時のスプラッシュオーバーレイ
 * Edex UIを参考にしたスキャンラインとフラッシュトランジションを再現
 */
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { BoltIcon } from "@heroicons/react/24/outline";
import {
  SPLASH_DISPLAY_DURATION_MS,
  SPLASH_FADE_DURATION_MS,
  SPLASH_SHELL_ENTER_MS,
  SPLASH_SHELL_EXIT_MS,
  SPLASH_CONTENT_ENTER_MS,
  SPLASH_CONTENT_EXIT_MS,
} from "../constants/animations";

type CSSCustomProperties = CSSProperties & Record<`--${string}`, string | number>;

interface StartupSplashProps {
  onComplete?: () => void;
}

type SplashPhase = "enter" | "exit";

function StartupSplash({ onComplete }: StartupSplashProps) {
  const [phase, setPhase] = useState<SplashPhase>("enter");
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    const displayTimeout = window.setTimeout(() => {
      setPhase("exit");
    }, SPLASH_DISPLAY_DURATION_MS);

    return () => {
      window.clearTimeout(displayTimeout);
    };
  }, []);

  useEffect(() => {
    if (phase !== "exit") {
      return;
    }

    const exitTimeout = window.setTimeout(() => {
      setIsMounted(false);
      onComplete?.();
    }, SPLASH_FADE_DURATION_MS);

    return () => {
      window.clearTimeout(exitTimeout);
    };
  }, [phase, onComplete]);

  if (!isMounted) {
    return null;
  }

  const phaseClass = phase === "exit" ? "splash-shell-exit" : "splash-shell-enter";
  const contentPhaseClass = phase === "exit" ? "splash-content-exit" : "splash-content-enter";

  const animationVariables: CSSCustomProperties = {
    "--splash-shell-enter-ms": `${SPLASH_SHELL_ENTER_MS}ms`,
    "--splash-shell-exit-ms": `${SPLASH_SHELL_EXIT_MS}ms`,
    "--splash-content-enter-ms": `${SPLASH_CONTENT_ENTER_MS}ms`,
    "--splash-content-exit-ms": `${SPLASH_CONTENT_EXIT_MS}ms`,
  };

  return (
    <div className="splash-overlay" aria-label="System boot sequence">
      <div className="splash-stack" style={animationVariables}>
        <div className={`splash-shell ${phaseClass}`} aria-hidden>
          <div className="splash-backdrop" aria-hidden />
          <div className="splash-grid" aria-hidden />
          <div className="splash-scanline" aria-hidden />
        </div>
        <div className={`splash-content ${contentPhaseClass}`}>
          <div className="flex items-center justify-center gap-3 mb-4">
            <BoltIcon className="h-8 w-8 text-cyan-400 animate-pulse" />
            <span className="splash-header">SYSTEM INITIALIZING</span>
          </div>
          <h1 className="splash-title">AI INTERFACE</h1>
          <div className="splash-divider" aria-hidden />
          <p className="splash-subtitle">LANGGRAPH CORE · OPENAI LINKED</p>
        </div>
      </div>
    </div>
  );
}

export default StartupSplash;
