import { useEffect } from "react";
import { GameState, GameAction } from "../types/game";

interface ActionPanelProps {
  gameState: GameState;
  onAction: (action: GameAction) => void;
}

function ActionPanel({ gameState, onAction }: ActionPanelProps) {
  const { status } = gameState;

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (status !== "playing") return;

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          onAction({ type: "move", direction: "up" });
          break;
        case "ArrowDown":
        case "s":
        case "S":
          onAction({ type: "move", direction: "down" });
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          onAction({ type: "move", direction: "left" });
          break;
        case "ArrowRight":
        case "d":
        case "D":
          onAction({ type: "move", direction: "right" });
          break;
        case " ":
        case "Enter":
          e.preventDefault();
          onAction({ type: "attack" });
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [status, onAction]);

  const isPlaying = status === "playing";

  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-white mb-4">コントロール</h2>

      <div className="space-y-4">
        <div className="text-center">
          <button
            className="btn-primary w-full"
            disabled={!isPlaying}
            onClick={() => onAction({ type: "move", direction: "up" })}
          >
            ↑ 上
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            className="btn-primary"
            disabled={!isPlaying}
            onClick={() => onAction({ type: "move", direction: "left" })}
          >
            ← 左
          </button>
          <button
            className="btn-secondary"
            disabled={!isPlaying}
            onClick={() => onAction({ type: "attack" })}
          >
            ⚔️ 攻撃
          </button>
          <button
            className="btn-primary"
            disabled={!isPlaying}
            onClick={() => onAction({ type: "move", direction: "right" })}
          >
            右 →
          </button>
        </div>

        <div className="text-center">
          <button
            className="btn-primary w-full"
            disabled={!isPlaying}
            onClick={() => onAction({ type: "move", direction: "down" })}
          >
            ↓ 下
          </button>
        </div>

        <div className="border-t border-gray-700 pt-4">
          <button
            className="btn-secondary w-full"
            onClick={() => onAction({ type: "reset" })}
          >
            🔄 リセット
          </button>
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <p>キーボード操作:</p>
          <p>• 矢印キー or WASD: 移動</p>
          <p>• スペース/Enter: 攻撃</p>
        </div>
      </div>
    </div>
  );
}

export default ActionPanel;



