# 開発者コンソールでのデバッグガイド

このドキュメントでは、ブラウザの開発者コンソール（F12）を使用してアプリケーションのデバッグを行う方法を説明します。

## コンソールを開く

### Windows / Linux
- **F12** キー
- または **Ctrl + Shift + I**
- または **Ctrl + Shift + J** (Chrome)

### Mac
- **Cmd + Option + I**
- または **Cmd + Option + J** (Chrome)

## ログの種類

アプリケーションは以下の3種類のログを出力します：

### 🔴 エラーログ（Error）
重大なエラーが発生した時に出力されます。

```
🔴 [Chat Error]
  Message: OpenAI APIキーが設定されていません
  Stack: Error: OpenAI APIキーが設定されていません...
  Additional Data: { ... }
  Timestamp: 2024-01-01T12:00:00.000Z
  Full Error Object: Error { ... }
```

**表示内容:**
- エラーメッセージ
- スタックトレース（エラーの発生場所）
- 追加データ（エラーに関連する情報）
- タイムスタンプ
- 完全なエラーオブジェクト

### ⚠️ 警告ログ（Warning）
注意が必要な状況で出力されます。

```
⚠️ [MCP Client Warning]
  Message: MCP Client not connected
  Data: { endpoint: "ws://localhost:8080" }
  Timestamp: 2024-01-01T12:00:00.000Z
```

**表示内容:**
- 警告メッセージ
- 関連データ
- タイムスタンプ

### 🔵 デバッグログ（Debug）
開発中の動作確認用。開発環境でのみ表示されます。

```
🔵 [App Debug]
  Message: チャットアプリケーション初期化完了
  Data: {
    environment: "development",
    hasApiKey: true
  }
  Timestamp: 2024-01-01T12:00:00.000Z
```

**表示内容:**
- デバッグメッセージ
- 関連データ
- タイムスタンプ

## よくあるエラーと対処法

### 1. OpenAI APIキーエラー

```
🔴 [OpenAI Service Error]
  Message: OpenAI APIキーが設定されていません
```

**対処法:**
1. プロジェクトルートに `.env` ファイルを作成
2. 以下を追加:
   ```
   VITE_OPENAI_API_KEY=your_api_key_here
   ```
3. 開発サーバーを再起動

### 2. MCP接続エラー

```
⚠️ [MCP Client Warning]
  Message: MCP Client not connected
```

**対処法:**
- これは正常な挙動です（MCP統合は将来実装予定）
- 無視しても問題ありません

### 3. Tauri APIエラー

```
🔴 [Tauri API Error]
  Message: __TAURI_INTERNALS__ is not defined
```

**対処法:**
- ブラウザで直接アクセスしている場合は正常です
- デスクトップアプリとして動作させるには `npm run tauri:dev` を使用

## ログのフィルタリング

コンソールでログをフィルタリングできます：

### エラーのみ表示
コンソールのフィルターで「Error」を選択

### 特定のコンテキストのみ表示
検索ボックスで以下を入力:
- `[Chat`  - チャット関連
- `[OpenAI` - OpenAI関連
- `[MCP` - MCP関連
- `[App` - アプリケーション全般

## 開発中のログ活用

### 1. メッセージ送信のフロー確認

```
🔵 [Chat Debug] ユーザーメッセージ受信
🔵 [Chat Debug] OpenAI APIにリクエスト送信中
🔵 [OpenAI Service Debug] Sending request to OpenAI
🔵 [OpenAI Service Debug] Received response from OpenAI
🔵 [Chat Debug] Received AI response
```

### 2. エラー発生時の詳細確認

エラーログの「Full Error Object」を展開すると、
エラーオブジェクトの全プロパティを確認できます。

### 3. パフォーマンス計測

タイムスタンプを比較することで、処理時間を計測できます。

## コンソールでの直接操作

コンソールから直接、ログ関数を呼び出すこともできます：

```javascript
// テストエラーを出力
window.logError('Test', new Error('テストエラー'), { test: true });

// テスト警告を出力
window.logWarning('Test', 'テスト警告', { test: true });

// テストデバッグログを出力
window.logDebug('Test', 'テストデバッグ', { test: true });
```

**注意:** これらの関数は開発環境でのみ使用可能です。

## 本番環境との違い

### 開発環境（DEV）
- 詳細なログが `console.group()` で整形されて表示
- デバッグログが表示される
- エラーオブジェクトの完全な詳細が表示

### 本番環境（PRODUCTION）
- シンプルなログ形式
- デバッグログは出力されない
- エラーとワーニングのみ

## トラブルシューティング

### コンソールにログが表示されない

1. **開発サーバーが起動しているか確認**
   ```bash
   npm run dev
   ```

2. **コンソールのログレベルを確認**
   - 「All levels」または「Verbose」が選択されているか確認

3. **ブラウザのキャッシュをクリア**
   - Ctrl + Shift + Delete（Windows/Linux）
   - Cmd + Shift + Delete（Mac）

4. **ハードリフレッシュ**
   - Ctrl + F5（Windows/Linux）
   - Cmd + Shift + R（Mac）

## より詳細なデバッグ

### React Developer Tools
1. Chrome/Edgeの拡張機能をインストール
2. F12 → "Components" タブ
3. コンポーネントの状態を確認

### Network タブ
1. F12 → "Network" タブ
2. OpenAI APIへのリクエストを確認
3. リクエスト/レスポンスの内容を確認

### Source タブ
1. F12 → "Source" タブ
2. ブレークポイントを設置
3. ステップ実行でデバッグ

## 参考リンク

- [Chrome DevTools 公式ドキュメント](https://developer.chrome.com/docs/devtools/)
- [Firefox Developer Tools](https://firefox-source-docs.mozilla.org/devtools-user/)
- [React Developer Tools](https://react.dev/learn/react-developer-tools)

