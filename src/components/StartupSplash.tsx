/**
 * 起動時のスプラッシュオーバーレイ
 * Edex UIを参考にしたスキャンラインとフラッシュトランジションを再現
 */
import { useEffect, useState } from "react";
import {
  SPLASH_DISPLAY_DURATION_MS,
  SPLASH_FADE_DURATION_MS,
} from "../constants/animations";

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

  return (
    <div className="splash-overlay" aria-label="System boot sequence">
      <div className="splash-stack">
        <div className={`splash-shell ${phaseClass}`} aria-hidden>
          <div className="splash-backdrop" aria-hidden />
          <div className="splash-grid" aria-hidden />
          <div className="splash-scanline" aria-hidden />
        </div>
        <div className={`splash-content ${contentPhaseClass}`}>
          <span className="splash-header">SYSTEM INITIALIZING</span>
          <h1 className="splash-title">AI INTERFACE</h1>
          <div className="splash-divider" aria-hidden />
          <p className="splash-subtitle">LANGGRAPH CORE · OPENAI LINKED</p>
        </div>
      </div>
    </div>
  );
}

export default StartupSplash;
