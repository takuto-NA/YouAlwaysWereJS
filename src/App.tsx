/**
 * このファイルの役割: ゲーム全体のメインコンポーネント
 * プレイヤーのアクションを処理し、ゲーム状態を管理する
 */
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import GameBoard from "./components/GameBoard";
import StatusBar from "./components/StatusBar";
import ActionPanel from "./components/ActionPanel";
import { GameState, GameAction, Position, Enemy, Item } from "./types/game";
import { GAME_CONFIG, DERIVED_CONSTANTS } from "./config/gameConfig";
import { logError, logDebug } from "./utils/errorHandler";

/**
 * プレイヤーの新しい位置を計算
 * なぜ関数化: 単一責任の原則、移動ロジックを分離してテスト可能に
 */
function calculateNewPosition(
  currentPosition: Position,
  direction: "up" | "down" | "left" | "right"
): Position {
  const { x, y } = currentPosition;

  switch (direction) {
    case "up":
      return { x, y: Math.max(DERIVED_CONSTANTS.MIN_GRID_INDEX, y - 1) };
    case "down":
      return { x, y: Math.min(DERIVED_CONSTANTS.MAX_GRID_INDEX, y + 1) };
    case "left":
      return { x: Math.max(DERIVED_CONSTANTS.MIN_GRID_INDEX, x - 1), y };
    case "right":
      return { x: Math.min(DERIVED_CONSTANTS.MAX_GRID_INDEX, x + 1), y };
  }
}

/**
 * アイテム収集を処理
 * なぜ関数化: アイテム収集ロジックを分離、早期リターンで可読性向上
 */
function handleItemCollection(
  position: Position,
  items: Item[],
  currentScore: number,
  setMessage: (msg: string) => void
): { newItems: Item[]; newScore: number } {
  const itemIndex = items.findIndex(
    (item) => item.x === position.x && item.y === position.y
  );

  // 早期リターン: アイテムがない場合は何もしない
  if (itemIndex === -1) {
    return { newItems: items, newScore: currentScore };
  }

  const collectedItem = items[itemIndex];
  const newScore = currentScore + collectedItem.value;
  const newItems = [...items];
  newItems.splice(itemIndex, 1);

  setMessage(`コインを獲得！スコア: ${newScore}`);

  return { newItems, newScore };
}

/**
 * 敵との衝突を処理
 * なぜ関数化: 衝突ロジックを分離、早期リターンで可読性向上
 */
function handleEnemyCollision(
  position: Position,
  enemies: Enemy[],
  currentHealth: number,
  setMessage: (msg: string) => void
): { newHealth: number; isGameOver: boolean } {
  const enemy = enemies.find((e) => e.x === position.x && e.y === position.y);

  // 早期リターン: 敵がいない場合は何もしない
  if (!enemy) {
    return { newHealth: currentHealth, isGameOver: false };
  }

  const newHealth = Math.max(0, currentHealth - enemy.damage);
  const isGameOver = newHealth <= 0;

  if (isGameOver) {
    setMessage("ゲームオーバー！");
  } else {
    setMessage(`敵に遭遇！ダメージ: ${enemy.damage}`);
  }

  return { newHealth, isGameOver };
}

/**
 * 攻撃処理
 * なぜ関数化: 攻撃ロジックを分離、早期リターンで可読性向上
 */
function handleAttack(
  playerPosition: Position,
  enemies: Enemy[],
  currentScore: number,
  setMessage: (msg: string) => void
): { newEnemies: Enemy[]; newScore: number } {
  const { x, y } = playerPosition;
  const enemyIndex = enemies.findIndex(
    (e) => Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1
  );

  // 早期リターン: 攻撃範囲に敵がいない場合
  if (enemyIndex === -1) {
    setMessage("攻撃範囲に敵がいません。");
    return { newEnemies: enemies, newScore: currentScore };
  }

  const newEnemies = [...enemies];
  newEnemies[enemyIndex].health -= GAME_CONFIG.PLAYER_ATTACK_POWER;

  // 敵を倒した場合
  if (newEnemies[enemyIndex].health <= 0) {
    newEnemies.splice(enemyIndex, 1);
    const newScore = currentScore + GAME_CONFIG.ENEMY_DEFEAT_SCORE;
    setMessage(`敵を倒した！+${GAME_CONFIG.ENEMY_DEFEAT_SCORE}ポイント`);
    return { newEnemies, newScore };
  }

  // 敵を倒せなかった場合
  setMessage("敵を攻撃！");
  return { newEnemies, newScore: currentScore };
}

function App() {
  const [gameState, setGameState] = useState<GameState>({
    status: "loading",
    player: {
      name: "Player",
      health: GAME_CONFIG.PLAYER_INITIAL_HEALTH,
      score: GAME_CONFIG.PLAYER_INITIAL_SCORE,
      position: GAME_CONFIG.PLAYER_INITIAL_POSITION,
    },
    grid: [],
    enemies: [],
    items: [],
  });

  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = async () => {
    try {
      const response = await invoke<string>("get_game_state");
      const state = JSON.parse(response);

      // Initialize game grid
      const grid = Array(GAME_CONFIG.GRID_SIZE).fill(null).map((_, rowIndex) =>
        Array(GAME_CONFIG.GRID_SIZE).fill(null).map((_, columnIndex) => ({
          x: columnIndex,
          y: rowIndex,
          type: "empty" as const,
          occupied: columnIndex === GAME_CONFIG.PLAYER_INITIAL_POSITION.x &&
                    rowIndex === GAME_CONFIG.PLAYER_INITIAL_POSITION.y,
        }))
      );

      // Add random items (coins)
      const items = [];
      for (let itemIndex = 0; itemIndex < GAME_CONFIG.COIN_SPAWN_COUNT; itemIndex++) {
        const randomXPosition = Math.floor(Math.random() * GAME_CONFIG.GRID_SIZE);
        const randomYPosition = Math.floor(Math.random() * GAME_CONFIG.GRID_SIZE);

        // プレイヤーの初期位置と重ならないようにする
        const isPlayerPosition = randomXPosition === GAME_CONFIG.PLAYER_INITIAL_POSITION.x &&
                                 randomYPosition === GAME_CONFIG.PLAYER_INITIAL_POSITION.y;

        if (!isPlayerPosition) {
          items.push({
            x: randomXPosition,
            y: randomYPosition,
            type: "coin",
            value: GAME_CONFIG.COIN_VALUE
          });
        }
      }

      // Add random enemies
      const enemies = [];
      for (let enemyIndex = 0; enemyIndex < GAME_CONFIG.ENEMY_SPAWN_COUNT; enemyIndex++) {
        const randomXPosition = Math.floor(Math.random() * GAME_CONFIG.GRID_SIZE);
        const randomYPosition = Math.floor(Math.random() * GAME_CONFIG.GRID_SIZE);

        // プレイヤーの初期位置と重ならないようにする
        const isPlayerPosition = randomXPosition === GAME_CONFIG.PLAYER_INITIAL_POSITION.x &&
                                 randomYPosition === GAME_CONFIG.PLAYER_INITIAL_POSITION.y;

        if (!isPlayerPosition) {
          enemies.push({
            id: `enemy-${enemyIndex}`,
            x: randomXPosition,
            y: randomYPosition,
            health: GAME_CONFIG.ENEMY_INITIAL_HEALTH,
            damage: GAME_CONFIG.ENEMY_DAMAGE
          });
        }
      }

      setGameState({
        ...state,
        status: "playing",
        player: {
          ...state.player,
          position: GAME_CONFIG.PLAYER_INITIAL_POSITION,
        },
        grid,
        enemies,
        items,
      });
      setMessage("ゲーム開始！アイテムを集めて敵を避けましょう。");
    } catch (error) {
      logError('Game Initialization', error, {
        attemptedAction: 'initializeGame',
      });
      setMessage("ゲームの初期化に失敗しました。");
    }
  };

  const handleAction = async (action: GameAction) => {
    // 早期リターン: プレイ中でない場合は何もしない
    if (gameState.status !== "playing") {
      return;
    }

    try {
      // Send action to backend (future: AI decision making)
      await invoke<string>("update_game_state", { action: action.type });

      // リセットアクションの早期リターン
      if (action.type === "reset") {
        await initializeGame();
        return;
      }

      const newState = { ...gameState };
      const { player } = newState;

      // 移動アクション
      if (action.type === "move") {
        const newPosition = calculateNewPosition(player.position, action.direction);

        // アイテム収集処理
        const { newItems, newScore } = handleItemCollection(
          newPosition,
          newState.items,
          player.score,
          setMessage
        );
        newState.items = newItems;
        player.score = newScore;

        // 敵との衝突処理
        const { newHealth, isGameOver } = handleEnemyCollision(
          newPosition,
          newState.enemies,
          player.health,
          setMessage
        );
        player.health = newHealth;

        if (isGameOver) {
          newState.status = "game_over";
        }

        player.position = newPosition;
      }

      // 攻撃アクション
      if (action.type === "attack") {
        const { newEnemies, newScore } = handleAttack(
          player.position,
          newState.enemies,
          player.score,
          setMessage
        );
        newState.enemies = newEnemies;
        player.score = newScore;
      }

      // 勝利条件チェック
      if (newState.items.length === 0 && newState.enemies.length === 0) {
        newState.status = "won";
        setMessage("クリア！おめでとうございます！");
      }

      setGameState(newState);
    } catch (error) {
      logError('Game Action', error, {
        action: action.type,
        playerPosition: gameState.player.position,
      });
      setMessage("アクションの実行に失敗しました。");
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-black font-mono flex flex-col">
      {/* ターミナルヘッダー */}
      <div className="bg-gray-900 border-b border-green-500 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <div className="text-green-400 text-sm">
          terminal@game:~$ you-always-were-js
        </div>
        <div className="text-green-400 text-sm">
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* メインコンテンツ - スクロールなし */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左側: ゲームボードとメッセージ */}
        <div className="flex-1 flex flex-col p-4 gap-4">
          {/* タイトル */}
          <div className="text-green-400 text-2xl font-bold border-b border-green-900 pb-2">
            &gt; YOU ALWAYS WERE JS
          </div>

          {/* ゲームボード */}
          <div className="flex-1 flex items-center justify-center">
            <GameBoard
              gameState={gameState}
              onCellClick={(xPosition, yPosition) => {
                logDebug('Cell Click', 'User clicked on cell', {
                  x: xPosition,
                  y: yPosition,
                });
              }}
            />
          </div>

          {/* メッセージエリア - コンソール風 */}
          <div className="bg-gray-900 border border-green-900 p-3 h-20">
            <div className="text-green-400 font-mono text-sm">
              <span className="text-green-600">&gt;</span> {message}
              <span className="animate-pulse">_</span>
            </div>
          </div>
        </div>

        {/* 右側: ステータスとコントロール */}
        <div className="w-80 bg-gray-900 border-l border-green-900 flex flex-col overflow-hidden">
          <StatusBar gameState={gameState} />
          <ActionPanel
            gameState={gameState}
            onAction={handleAction}
          />
        </div>
      </div>
    </div>
  );
}

export default App;

