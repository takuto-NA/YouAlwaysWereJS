import { GameState } from "../types/game";

interface GameBoardProps {
  gameState: GameState;
  onCellClick: (x: number, y: number) => void;
}

function GameBoard({ gameState, onCellClick }: GameBoardProps) {
  const { grid, player, enemies, items } = gameState;

  const getCellContent = (x: number, y: number) => {
    if (player.position.x === x && player.position.y === y) {
      return "🎮";
    }
    
    const enemy = enemies.find((e) => e.x === x && e.y === y);
    if (enemy) {
      return "👾";
    }

    const item = items.find((i) => i.x === x && i.y === y);
    if (item) {
      return item.type === "coin" ? "🪙" : "❤️";
    }

    return "";
  };

  const getCellClass = (x: number, y: number) => {
    const baseClass = "w-12 h-12 flex items-center justify-center text-2xl border border-gray-700 transition-all duration-200 cursor-pointer";
    
    if (player.position.x === x && player.position.y === y) {
      return `${baseClass} bg-primary-600 hover:bg-primary-500`;
    }

    const enemy = enemies.find((e) => e.x === x && e.y === y);
    if (enemy) {
      return `${baseClass} bg-red-900 hover:bg-red-800`;
    }

    const item = items.find((i) => i.x === x && i.y === y);
    if (item) {
      return `${baseClass} bg-yellow-900 hover:bg-yellow-800`;
    }

    return `${baseClass} bg-gray-800 hover:bg-gray-700`;
  };

  return (
    <div className="card">
      <div className="inline-block">
        {grid.map((row, y) => (
          <div key={y} className="flex">
            {row.map((cell, x) => (
              <div
                key={`${x}-${y}`}
                className={getCellClass(x, y)}
                onClick={() => onCellClick(x, y)}
              >
                {getCellContent(x, y)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default GameBoard;

