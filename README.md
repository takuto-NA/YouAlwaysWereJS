# LangGraph + OpenAI Chat Interface

LangGraphとOpenAI APIを使用したMCP対話型チャットアプリケーション（React + TypeScript + Tauri + TailwindCSS）

## 概要

このアプリケーションは、以下の技術を統合した対話型チャットインターフェースです：
- **OpenAI API**: GPT-5など最新モデルを使用した自然言語処理
- **LangGraph**: 意思決定フローの管理（将来実装予定）
- **MCP (Model Context Protocol)**: AIモデル間の通信プロトコル（将来実装予定）
- **Tauri**: クロスプラットフォームデスクトップアプリ

## クイックスタート

### 1. 環境設定（オプション）

**推奨**: アプリ内の設定画面から設定できるため、`.env`ファイルは不要です。

もし環境変数で設定したい場合は、`.env`ファイルを作成：

```bash
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

> **注意**: OpenAI APIキーは[OpenAI Platform](https://platform.openai.com/api-keys)から取得できます。
> 
> **推奨方法**: アプリ起動後、右上の **≡** ボタンから設定画面を開いて入力

### 2. 依存関係のインストール

```bash
npm install
```

### 3. アプリケーション起動

#### 方法1: Pythonスクリプト（推奨）

```bash
# Web版（ブラウザ自動起動）
python dev.py

# Tauri版（デスクトップアプリ）
python dev.py --tauri
```

#### 方法2: npm コマンド

```bash
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
│   ├── App.tsx              # メインチャットアプリケーション
│   ├── components/          # UI コンポーネント
│   │   ├── ChatMessage.tsx  # メッセージ表示
│   │   └── ChatInput.tsx    # メッセージ入力
│   ├── services/            # サービス層
│   │   ├── ai/              # AI統合
│   │   │   ├── index.ts     # AIサービスエントリーポイント
│   │   │   └── openai.ts    # OpenAI API統合
│   │   ├── langgraph/       # LangGraphワークフロー
│   │   └── mcp/             # MCPクライアント
│   ├── types/               # TypeScript 型定義
│   │   ├── chat.ts          # チャット関連の型
│   │   └── game.ts          # ゲーム関連の型（レガシー）
│   └── utils/               # ユーティリティ関数
├── index.html               # エントリーポイント
└── [設定ファイル群]         # 詳細は CONFIG_GUIDE.md 参照
```

## 機能

### 実装済み
- ✅ ターミナル風UIデザイン
- ✅ リアルタイムチャット機能
- ✅ OpenAI API統合
- ✅ メッセージ履歴管理
- ✅ エラーハンドリング
- ✅ タイムスタンプ表示
- ✅ 処理中インジケーター
- ✅ **タイプライター効果（一文字ずつ表示）**
- ✅ **設定画面（ハンバーガーメニュー）**
- ✅ **ローカルストレージで設定を永続化**

### 将来実装予定
- ⏳ LangGraphによる複雑なワークフロー
- ⏳ MCP経由のモデル間通信
- ⏳ チャット履歴の永続化
- ⏳ マルチモーダル対応（画像、音声）
- ⏳ カスタムプロンプト設定

## コーディングルール

詳細なチェックリストとベストプラクティスは [CODING_RULES.md](CODING_RULES.md) を参照してください。

**クイックチェック:**
- ✅ エラーは `logError()` で記録
- ✅ マジックナンバー禁止
- ✅ DRY原則遵守
- ✅ 完全な変数名
- ✅ 早期リターン
- ✅ 1関数1責務

## 環境変数（オプション）

アプリ内の設定画面（≡ボタン）から設定することを推奨します。

環境変数で設定する場合:

| 変数名 | 説明 | 必須 | デフォルト値 |
|--------|------|------|-------------|
| `VITE_OPENAI_API_KEY` | OpenAI APIキー | ❌ 設定画面で入力可 | なし |
| `VITE_MCP_ENDPOINT` | MCPサーバーエンドポイント | ❌ いいえ | `ws://localhost:8080` |

> 💡 **推奨**: 環境変数より設定画面を使用してください（より安全で使いやすい）

## デバッグ方法

### ブラウザコンソールでのデバッグ（F12）

開発中のエラーやログは、ブラウザの開発者コンソール（F12）で確認できます。

**コンソールの開き方:**
- **Windows/Linux**: F12 または Ctrl + Shift + I
- **Mac**: Cmd + Option + I

**ログの種類:**
- 🔴 **エラーログ**: 重大なエラー（詳細情報付き）
- ⚠️ **警告ログ**: 注意が必要な状況
- 🔵 **デバッグログ**: 開発中の動作確認（開発環境のみ）

詳細は [DEV_CONSOLE_GUIDE.md](DEV_CONSOLE_GUIDE.md) を参照してください。

### タイプライター効果

AIの応答メッセージは一文字ずつ表示されます。

**特徴:**
- AIメッセージのみ適用（ユーザー・システムメッセージは即座に表示）
- タイプ中は`[入力中...]`と点滅カーソル（▋）を表示
- カスタマイズ可能な表示速度

詳細は [TYPEWRITER_EFFECT.md](TYPEWRITER_EFFECT.md) を参照してください。

### 設定画面

画面右上の **≡**（ハンバーガーメニュー）ボタンから設定画面を開けます。

**設定可能な項目:**
- 🤖 **OpenAI API キー**: 必須。OpenAI APIにアクセスするためのキー
- 🤖 **モデル選択**: 
  - **GPT-5シリーズ**: GPT-5（推奨）、GPT-5-mini、GPT-5-nano、GPT-5-pro、GPT-5-thinking
  - **o1シリーズ**: o1、o1-mini
  - **GPT-4シリーズ**: GPT-4o、GPT-4o-mini、GPT-4 Turbo
  - **その他**: GPT-3.5 Turbo
- ⚡ **タイプライター速度**: 文字表示速度（10-100ms）
- 🔌 **MCP エンドポイント**: オプション。将来実装予定
- 📜 **自動スクロール**: 新しいメッセージで自動スクロール
- 🔧 **詳細設定**: Temperature（創造性）、最大トークン数

**特徴:**
- ローカルストレージに保存（再入力不要）
- APIキーは表示/非表示を切り替え可能
- 最新のGPT-5をデフォルトで使用
- 用途に応じて最適なモデルを選択可能（標準、mini、nano、pro、thinking）

詳細は [SETTINGS_GUIDE.md](SETTINGS_GUIDE.md) を参照してください。

### ログの例

```
🔵 [App Debug]
  Message: チャットアプリケーション初期化完了
  Data: { environment: "development", hasApiKey: true }
  Timestamp: 2024-01-01T12:00:00.000Z

🔴 [OpenAI Service Error]
  Message: OpenAI APIキーが設定されていません
  Stack: Error: OpenAI APIキーが設定されていません...
  Full Error Object: Error { ... }
```

## トラブルシューティング

### OpenAI APIエラー

```
エラー: OpenAI APIキーが設定されていません
```

**解決方法**: `.env`ファイルに`VITE_OPENAI_API_KEY`を設定してください。

### MCPクライアント接続エラー

MCPクライアントは現在プレースホルダー実装です。将来のバージョンで実装予定です。

## 便利コマンド

```bash
# 型チェック
npm run type-check

# コード品質チェック
bash scripts/check-code-quality.sh

# console.log検索（本番前削除）
grep -rn "console\.log" src/

# 省略変数名検索（3文字以下）
grep -rn -E "(const|let|var)\s+[a-z]{1,3}\s*=" src/
```

## エラーハンドラー

統一されたエラー処理は `src/utils/errorHandler.ts` で管理。

```typescript
logError(context, error, additionalData);  // エラー
logDebug(context, message, data);          // デバッグ
logWarning(context, message, data);        // 警告
```

## 開発フロー

1. `npm run dev` で開発サーバー起動
2. ブラウザで開く
3. 右上の **≡** ボタンから設定画面を開く
4. OpenAI APIキーを入力して保存
5. チャットを開始
6. コード変更時はHMRで自動リロード
7. `npm run type-check` で型チェック
8. Git コミット前に品質チェック実行

## ライセンス

MIT
