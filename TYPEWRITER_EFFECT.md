# タイプライター効果の実装

チャットメッセージを一文字ずつ表示するタイプライター効果を実装しています。

## 機能概要

- AIの応答メッセージが一文字ずつ表示されます
- ユーザーメッセージとシステムメッセージは即座に表示されます
- タイプ中は「[入力中...]」と点滅するカーソル（▋）が表示されます

## 実装の詳細

### カスタムフック: `useTypewriter`

`src/hooks/useTypewriter.ts`

```typescript
const { displayedText, isTyping } = useTypewriter({
  text: message.content,
  speed: 20,              // ミリ秒単位の速度（20ms = 1文字あたり0.02秒）
  enabled: true,          // タイプライター効果の有効/無効
  onComplete: () => {},   // 完了時のコールバック
  onProgress: () => {},   // 1文字表示ごとのコールバック
});
```

**パラメータ:**
- `text`: 表示する文字列
- `speed`: 1文字あたりの表示速度（ミリ秒）
  - デフォルト: 30ms
  - 現在の設定: 20ms（速め）
- `enabled`: タイプライター効果を有効にするか
- `onComplete`: 全文字の表示完了時に実行される関数
- `onProgress`: 1文字表示するたびに実行される関数

**返り値:**
- `displayedText`: 現在表示中のテキスト
- `isTyping`: タイプ中かどうか（true/false）

### 適用ルール

```typescript
// AIの応答のみタイプライター効果を適用
const shouldUseTypewriter = 
  enableTypewriter &&           // コンポーネント側で有効化
  isAssistant &&                // AIメッセージのみ
  message.isTyping !== false;   // メッセージ側で無効化されていない
```

### メッセージタイプ別の動作

| メッセージタイプ | タイプライター効果 | 表示方法 |
|--------------|---------------|---------|
| ユーザーメッセージ | ❌ なし | 即座に表示 |
| AIメッセージ | ✅ あり | 一文字ずつ |
| システムメッセージ | ❌ なし | 即座に表示 |

## 視覚効果

### タイプ中の表示

```
[AI] [入力中...]
こんにちは！お手伝いできることは▋
```

- `[入力中...]`: 点滅するラベル
- `▋`: 点滅するカーソル（文字の後ろ）

### 完了後の表示

```
[AI]
こんにちは！お手伝いできることはありますか？
```

## カスタマイズ方法

### 速度の変更

`src/components/ChatMessage.tsx` の速度パラメータを変更:

```typescript
const { displayedText, isTyping } = useTypewriter({
  text: message.content,
  speed: 50,  // ← ここを変更（大きいほど遅い）
  enabled: shouldUseTypewriter,
});
```

**推奨値:**
- 超高速: 10ms
- 高速: 20ms（現在の設定）
- 標準: 30-40ms
- 遅い: 50-70ms
- 超遅い: 100ms以上

### タイプライター効果の無効化

#### 特定のメッセージで無効化

```typescript
const message: Message = {
  id: "msg-1",
  role: "assistant",
  content: "これは即座に表示されます",
  timestamp: Date.now(),
  isTyping: false,  // ← これを追加
};
```

#### コンポーネント全体で無効化

```typescript
<ChatMessage 
  message={message} 
  enableTypewriter={false}  // ← これを追加
/>
```

#### グローバルに無効化

`src/components/ChatMessage.tsx` のデフォルト値を変更:

```typescript
function ChatMessage({ 
  message, 
  enableTypewriter = false  // ← true を false に変更
}: ChatMessageProps) {
```

## パフォーマンス考慮事項

### メモリ効率

- `setInterval`を使用しているため、メモリ効率は高い
- コンポーネントのアンマウント時に自動的にクリーンアップされる

### 長文の処理

長文（1000文字以上）の場合:

```typescript
// 速度を動的に調整
const speed = message.content.length > 1000 ? 10 : 20;

const { displayedText, isTyping } = useTypewriter({
  text: message.content,
  speed: speed,
  enabled: shouldUseTypewriter,
});
```

### スクロール追従

タイプライター効果中も自動スクロールが機能するように、
`App.tsx`で`useEffect`がメッセージ変更を監視しています:

```typescript
useEffect(() => {
  scrollToBottom();
}, [chatState.messages]);
```

## トラブルシューティング

### タイプライター効果が動作しない

1. **メッセージの`isTyping`プロパティを確認**
   ```typescript
   // ✅ 正しい
   { isTyping: true }
   
   // ❌ 間違い
   { isTyping: false }
   ```

2. **メッセージロールを確認**
   - `role: "assistant"` である必要があります

3. **開発者コンソールで確認**
   ```javascript
   // 最新メッセージを確認
   console.log(chatState.messages[chatState.messages.length - 1]);
   ```

### タイプが遅すぎる/速すぎる

`ChatMessage.tsx`の`speed`パラメータを調整してください。

### カーソルが表示されない

CSSのアニメーションが機能しているか確認:

```tsx
<span className="inline-block ml-1 animate-pulse">▋</span>
```

## 今後の拡張案

### ストリーミング対応

OpenAI APIのストリーミングモードと組み合わせて、
リアルタイムで文字を受信しながら表示:

```typescript
// 将来の実装例
async function* streamResponse(messages: Message[]) {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: messages,
    stream: true,
  });
  
  for await (const chunk of response) {
    yield chunk.choices[0]?.delta?.content || "";
  }
}
```

### 音声効果

タイプ音を追加:

```typescript
const { displayedText, isTyping } = useTypewriter({
  text: message.content,
  speed: 20,
  onProgress: () => {
    // タイプ音を再生
    playTypeSound();
  },
});
```

### 一時停止/スキップ機能

```typescript
const [isPaused, setIsPaused] = useState(false);
const [shouldSkip, setShouldSkip] = useState(false);

// ユーザーがクリックしたら即座に全文表示
const handleClick = () => {
  setShouldSkip(true);
};
```

## 参考

- [React Hooks 公式ドキュメント](https://react.dev/reference/react)
- [useEffect クリーンアップ関数](https://react.dev/reference/react/useEffect#cleanup-function)
- [setInterval の使い方](https://developer.mozilla.org/ja/docs/Web/API/setInterval)

