/**
 * このファイルの役割: ゲームステータス表示コンポーネント
 * プレイヤーの体力、スコア、位置情報などを表示
 */
import { GameState } from "../types/game";
import { GAME_CONFIG } from "../config/gameConfig";

interface StatusBarProps {
  gameState: GameState;
}

function StatusBar({ gameState }: StatusBarProps) {
  const { player, status } = gameState;

  /**
   * 体力に応じた色を返す
   * なぜ閾値を使用するか: プレイヤーに危険度を視覚的に伝えるため
   */
  const getHealthColor = () => {
    if (player.health > GAME_CONFIG.HEALTH_BAR_DANGER_THRESHOLD) {
      return "text-green-400";
    }
    if (player.health > GAME_CONFIG.HEALTH_BAR_WARNING_THRESHOLD) {
      return "text-yellow-400";
    }
    return "text-red-400";
  };

  const getHealthBar = () => {
    const barLength = 20;
    const filledBars = Math.floor((player.health / 100) * barLength);
    const emptyBars = barLength - filledBars;
    return "[" + "█".repeat(filledBars) + "░".repeat(emptyBars) + "]";
  };

  const getStatusSymbol = () => {
    const symbols = {
      loading: "[...]",
      playing: "[RUN]",
      paused: "[---]",
      game_over: "[ERR]",
      won: "[OK!]",
    };
    return symbols[status];
  };

  return (
    <div className="p-4 border-b border-green-900 font-mono">
      <div className="text-green-400 text-xs mb-3 border-b border-green-900 pb-2">
        === SYSTEM STATUS ===
      </div>

      <div className="space-y-2 text-xs">
        {/* ステータス */}
        <div className="flex items-center gap-2">
          <span className="text-green-600">$</span>
          <span className="text-gray-500">status:</span>
          <span className="text-green-400">{getStatusSymbol()}</span>
        </div>

        {/* プレイヤー名 */}
        <div className="flex items-center gap-2">
          <span className="text-green-600">$</span>
          <span className="text-gray-500">player:</span>
          <span className="text-green-400">{player.name}</span>
        </div>

        {/* 体力 */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-green-600">$</span>
            <span className="text-gray-500">health:</span>
            <span className={getHealthColor()}>{player.health}/100</span>
          </div>
          <div className={`ml-4 ${getHealthColor()}`}>
            {getHealthBar()}
          </div>
        </div>

        {/* スコア */}
        <div className="flex items-center gap-2">
          <span className="text-green-600">$</span>
          <span className="text-gray-500">score:</span>
          <span className="text-yellow-400">{player.score}</span>
        </div>

        {/* 位置 */}
        <div className="flex items-center gap-2">
          <span className="text-green-600">$</span>
          <span className="text-gray-500">pos:</span>
          <span className="text-green-400">
            ({player.position.x},{player.position.y})
          </span>
        </div>
      </div>
    </div>
  );
}

export default StatusBar;

