# You Always Were JS

グリッドベースのゲームプロトタイプ（React + TypeScript + Tauri + TailwindCSS）

## クイックスタート

### 方法1: Pythonスクリプト（推奨）

```bash
# 初回のみ
npm install

# 開発サーバー起動（ブラウザ自動起動）
python dev.py

# Tauri版（デスクトップアプリ）
python dev.py --tauri
```

### 方法2: npm コマンド

```bash
npm install
npm run dev          # Web版（http://localhost:1420）
npm run tauri:dev    # デスクトップ版
```

## Pythonスクリプト一覧

| スクリプト | 用途 | 使い方 |
|-----------|------|--------|
| **dev.py** | 開発サーバー起動 | `python dev.py` |
| **build.py** | ビルド実行 | `python build.py` |
| **check.py** | コード品質チェック | `python check.py` |

### 詳細な使い方

```bash
# 開発サーバー起動（Web版、ブラウザ自動起動）
python dev.py

# Tauri版起動
python dev.py --tauri

# ヘルプ表示
python dev.py --help

# ビルド実行（型チェック → ビルド）
python build.py

# Tauri版ビルド
python build.py --tauri

# 型チェックのみ
python build.py --check-only

# コード品質チェック
python check.py

# 高速チェック（型チェックのみ）
python check.py --quick
```

## プロジェクト構成

```
YouAlwaysWereJS/
├── src/
│   ├── App.tsx              # メインゲームロジック
│   ├── components/          # UI コンポーネント
│   ├── config/              # ゲーム設定
│   ├── types/               # TypeScript 型定義
│   └── utils/               # ユーティリティ関数
├── index.html               # エントリーポイント
└── [設定ファイル群]         # 詳細は CONFIG_GUIDE.md 参照
```

## コーディングルール

### ✅ チェックリスト

- [ ] エラーは `logError()` でコンソール出力（コンテキスト含む）
- [ ] マジックナンバー禁止 → `GAME_CONFIG` で定数化
- [ ] DRY原則遵守（重複コード禁止）
- [ ] 変数名・関数名は省略せず完全な単語を使用
- [ ] 早期リターンでネスト削減
- [ ] 1関数1責務（30行以内目安）

### ❌ Bad / ✅ Good

```typescript
// ❌ Bad - マジックナンバー・省略・ネスト
function move(pos: {x: number, y: number}) {
  if (pos.x < 9) {
    if (pos.y > 0) {
      // 処理...
    }
  }
}

// ✅ Good - 定数・完全な名前・早期リターン
function movePlayer(position: Position) {
  if (position.x >= GAME_CONFIG.MAX_GRID_INDEX) {
    return position;
  }
  if (position.y <= DERIVED_CONSTANTS.MIN_GRID_INDEX) {
    return position;
  }
  // 正常系の処理...
}
```

### エラー処理

```typescript
// ✅ Good - コンテキスト付きエラーログ
try {
  await initializeGame();
} catch (error) {
  logError('Game Initialization', error, {
    playerId: player.id,
    attemptCount: retryCount
  });
}
```

### 早期リターン

```typescript
// ✅ Good - 異常系を先に処理
function handleItemCollection(position: Position, items: Item[]) {
  const itemIndex = items.findIndex(i => isSamePosition(i, position));

  // 早期リターン: アイテムがない
  if (itemIndex === -1) {
    return { items, scoreChange: 0 };
  }

  // 正常系: アイテムがある場合の処理
  const collectedItem = items[itemIndex];
  const newItems = [...items];
  newItems.splice(itemIndex, 1);
  return { items: newItems, scoreChange: collectedItem.value };
}
```

## 便利コマンド

```bash
# 型チェック
npm run type-check

# コード品質チェック
bash scripts/check-code-quality.sh

# マジックナンバー検索
grep -rn --include="*.ts" --include="*.tsx" -E "[^a-zA-Z_][0-9]{2,}" src/

# console.log検索（本番前削除）
grep -rn "console\.log" src/

# 省略変数名検索（3文字以下）
grep -rn -E "(const|let|var)\s+[a-z]{1,3}\s*=" src/
```

## ゲーム設定

全てのゲームパラメータは `src/config/gameConfig.ts` で一元管理。

```typescript
export const GAME_CONFIG = {
  GRID_SIZE: 10,
  PLAYER_INITIAL_HEALTH: 100,
  PLAYER_ATTACK_POWER: 20,
  ENEMY_DAMAGE: 10,
  COIN_VALUE: 10,
} as const;
```

## エラーハンドラー

統一されたエラー処理は `src/utils/errorHandler.ts` で管理。

```typescript
logError(context, error, additionalData);  // エラー
logDebug(context, message, data);          // デバッグ
logWarning(context, message, data);        // 警告
```

## 設定ファイル説明

各設定ファイルの詳細は [CONFIG_GUIDE.md](CONFIG_GUIDE.md) を参照。

| ファイル | 役割 | 削除可否 |
|---------|------|---------|
| package.json | npm設定 | ❌ ルート必須 |
| tsconfig.json | TypeScript設定 | ❌ ルート必須 |
| vite.config.ts | Vite設定 | ❌ ルート必須 |
| tailwind.config.js | TailwindCSS設定 | ❌ ルート必須 |
| postcss.config.js | PostCSS設定 | ❌ ルート必須 |

**設定ファイルの数は、モダンWeb開発の標準構成です。これ以上減らせません。**

## 開発フロー

1. `npm run dev` で開発サーバー起動
2. コード変更（HMRで自動リロード）
3. `npm run type-check` で型チェック
4. Git コミット前に品質チェック実行

## ライセンス

MIT
