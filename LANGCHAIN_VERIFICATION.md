# LangChain動作確認ガイド

## 🔍 確認方法

### 1. 開発サーバー起動

```bash
npm run dev
```

### 2. ブラウザで開発者ツールを開く

- **Chrome/Edge**: F12 または Ctrl+Shift+I
- **Firefox**: F12
- **Safari**: Cmd+Option+I

### 3. コンソールタブを開く

### 4. APIキーを設定してメッセージを送信

### 5. 以下のログが表示されることを確認

#### ✅ LangChain経由で動いている場合のログ

```
🔵 [OpenAI Service Debug]
Message: LangGraph経由でOpenAIにリクエスト送信
Data: {
  messageCount: 2,
  model: "gpt-4o"
}
Timestamp: 2025-10-19T...

🔵 [LangChain Debug]
Message: メッセージ送信開始
Data: {
  messageCount: 2
}
Timestamp: 2025-10-19T...

🔵 [LangChain Debug]
Message: レスポンス受信完了
Data: {
  responseLength: 123
}
Timestamp: 2025-10-19T...

🔵 [OpenAI Service Debug]
Message: LangGraphから応答を受信
Data: {
  responseLength: 123
}
Timestamp: 2025-10-19T...
```

#### ❌ 直接API呼び出しの場合（旧実装）のログ

```
🔵 [OpenAI Service Debug]
Message: Sending request to OpenAI
Data: {...}

# "LangChain" というテキストは一切表示されない
```

---

## 🧪 詳細な動作確認

### A. ネットワークタブで確認

1. 開発者ツールの「Network」タブを開く
2. メッセージを送信
3. `api.openai.com` へのリクエストを確認
4. Request Headers に以下が含まれていることを確認：
   - `User-Agent` に `langchain` が含まれる（LangChainのデフォルト）

### B. エラーメッセージで確認

意図的に無効なAPIキーを設定すると、エラーログに以下が表示されます：

```
🔴 [LangChain Error]
Message: ...
```

「LangChain」というコンテキストがエラーに含まれていれば、LangChain経由で動作しています。

---

## 📊 実装の違い

### 旧実装（直接fetch）
```typescript
const response = await fetch(OPENAI_API_ENDPOINT, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${this.apiKey}`,
  },
  body: JSON.stringify(requestBody),
});
```

### 新実装（LangChain経由）
```typescript
const workflow = createChatWorkflow(apiKey, model, temperature, maxTokens);
const response = await workflow.execute(messages);

// 内部的に:
const langchainMessages = convertToLangChainMessages(messages);
const response = await this.model.invoke(langchainMessages);
```

---

## ✨ LangChainのメリット

1. **統一されたインターフェース**
   - 将来的に他のモデル（Anthropic, Google）への切り替えが容易

2. **エラーハンドリング**
   - LangChainがリトライ、タイムアウトなどを自動処理

3. **メッセージ管理**
   - BaseMessage型でメッセージを型安全に管理

4. **拡張性**
   - 将来的にLangGraphでワークフローを実装可能
   - エージェント機能、ツール呼び出しなども追加可能

---

## 🐛 トラブルシューティング

### LangChainのログが表示されない場合

1. **開発モードで起動しているか確認**
   ```bash
   npm run dev
   ```
   本番ビルド（`npm run build`）ではログは無効化されます

2. **ブラウザのコンソールフィルターを確認**
   - 「Debug」や「LangChain」でフィルタ

3. **コードが最新か確認**
   ```bash
   git status
   git log --oneline -5
   ```

### エラーが発生する場合

1. **依存関係を再インストール**
   ```bash
   npm install
   ```

2. **型チェックを実行**
   ```bash
   npm run type-check
   ```

3. **ブラウザのキャッシュをクリア**
   - Ctrl+Shift+Delete または Cmd+Shift+Delete

