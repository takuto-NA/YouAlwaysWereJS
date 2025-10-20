# LM Studio 利用ガイド

## 📘 概要

このアプリケーションは、LM StudioのOpenAI互換モードをサポートしています。これにより、完全にローカルで実行される大規模言語モデルを使用してチャットが可能です。

## 🎯 メリット

- **完全ローカル実行**: インターネット接続不要
- **プライバシー保護**: データが外部に送信されない
- **コスト削減**: OpenAI APIの利用料金が不要
- **カスタマイズ**: 独自のモデルを使用可能

## 📋 前提条件

1. **LM Studio**: [lmstudio.ai](https://lmstudio.ai/)からダウンロード・インストール
2. **モデル**: LM Studioで任意のモデルをダウンロード（例: Llama 3.2, Mistral, Phi等）
3. **十分なメモリ**: モデルサイズに応じたRAM（8GB以上推奨）

## 🚀 セットアップ手順

### 1. LM Studioでモデルをダウンロード

1. LM Studioを起動
2. 「Discover」タブからモデルを検索
3. **重要**: `lmstudio-community/` で提供される修正済みモデルを推奨
   - 推奨: `lmstudio-community/Llama-3.2-3B-Instruct` (軽量・高速)
   - コード生成: `lmstudio-community/Qwen2.5-Coder-7B-Instruct` (7B)
   - 高性能: `lmstudio-community/Llama-3.1-8B-Instruct` (8B)

**なぜlmstudio-community版を推奨？**
- プロンプトテンプレートが修正済み
- OpenAI API互換性が検証済み
- このアプリケーションとの動作が保証される

### 2. LM StudioでOpenAI互換サーバーを起動

1. LM Studioの「Local Server」タブを開く
2. ダウンロードしたモデルを選択
3. **重要**: 「CORS」設定を有効化
   - サーバー設定で「Enable CORS」をONにする
   - または「Allow origins」に `http://localhost:1420` を追加
4. 「Start Server」をクリック
5. サーバーが起動すると、エンドポイントURLが表示されます
   ```
   Server running at http://localhost:1234/v1
   ```

### 3. このアプリケーションで設定

1. アプリケーション右上の **≡** (ハンバーガーメニュー) をクリック
2. 設定モーダルを開く
3. 以下の項目を設定：

#### AIプロバイダー
- **AI Provider**: `OpenAI` を選択

#### APIキー
- **OpenAI API Key**: 任意の文字列を入力（例: `local-test`）
  - LM Studioはローカル実行なので、APIキーの検証は行われません
  - 空欄でない必要があるため、適当な文字列を入力してください

#### カスタムエンドポイント（重要）
- **Custom Endpoint (Optional)**: 以下のいずれかを入力

**オプション1: 直接接続**（LM StudioでCORS有効化が必要）
```
http://localhost:1234/v1
```

**オプション2: プロキシ経由**（推奨・CORS問題なし）
```
http://localhost:1420/api/lmstudio/v1
```

- ポート番号が異なる場合は適宜変更してください
- CORSエラーが出る場合は、オプション2のプロキシ経由を使用してください

#### モデル名
- **OpenAI Model Selection (Preset)**: プリセットから選択（OpenAI公式API用）
- **Or Enter Custom Model Name**: LM Studioで読み込んだモデル名を直接入力
  - LM Studioのサーバー画面で確認できるモデルIDを入力
  - 例: `llama-3.2-3b-instruct`, `mistral-7b-instruct-v0.3`, `phi-3-mini-128k-instruct`
  - 入力フィールドに直接タイプすると、プリセット選択より優先されます

4. **Save Settings** をクリック

## 💬 使用方法

設定後は通常通りチャットを開始できます：

1. メッセージを入力
2. 送信
3. LM Studioのローカルモデルが応答を生成

## 📱 スマホ・タブレットからのアクセス

### メリット
- 🛋️ ソファーや寝転びながら使える
- 📱 PCの前にいる必要なし
- 🏠 家中どこでも使える（Wi-Fi範囲内）
- 👥 複数デバイスから同時アクセス可能

### 設定方法

#### 1. PCで開発サーバーを起動
```bash
python dev.py
```

起動時に表示されるメッセージを確認：
```
Local:   http://localhost:1420/
Network: http://192.168.0.2:1420/
```

#### 2. スマホで同じWi-Fiに接続
PCと同じWi-Fiネットワークに接続してください。

#### 3. スマホのブラウザでアクセス
ブラウザ（Safari、Chrome等）で以下にアクセス：
```
http://192.168.0.2:1420
```
（IPアドレスは手順1で確認したものを使用）

#### 4. アプリの設定
設定画面（≡ボタン）で：
- **AI Provider**: `OpenAI`
- **Custom Endpoint**: `http://192.168.0.2:1420/api/lmstudio/v1`
- **API Key**: `local-test`
- **Or Enter Custom Model Name**: LM Studioのモデル名

#### 5. チャット開始
これでスマホからローカルPCのLM Studioが使えます！

### 注意点
- PCと同じWi-Fiネットワークに接続する必要があります
- PCの開発サーバーが起動している必要があります
- PCがスリープすると使えなくなります

### PWA（ホーム画面に追加）
スマホのブラウザで「ホーム画面に追加」すると、アプリのように使えます：
- **Safari（iPhone）**: 共有ボタン → ホーム画面に追加
- **Chrome（Android）**: メニュー → ホーム画面に追加

## 🔍 動作確認

### ブラウザコンソールで確認

1. F12 キーで開発者ツールを開く
2. 「Console」タブを選択
3. メッセージを送信
4. 以下のようなログが表示されることを確認：

```
🔵 [LangChain Debug]
Message: ChatOpenAI初期化
Data: {
  model: "llama-3.2-3b-instruct",
  hasApiKey: true,
  customEndpoint: "http://localhost:1234/v1",
  temperature: 0.7,
  maxTokens: 4000
}
```

`customEndpoint` が表示されていれば、LM Studioへの接続が有効になっています。

### LM Studioでのリクエスト確認

LM Studioの「Local Server」画面で、リクエストログを確認できます：
- リクエスト回数
- レスポンス時間
- トークン数

## ⚙️ 推奨設定

### 軽量・高速モデル（8GB RAM）
```
モデル: Llama-3.2-3B-Instruct
Temperature: 0.7
Max Tokens: 2000
```

### 高品質モデル（16GB+ RAM）
```
モデル: Llama-3.1-8B-Instruct
Temperature: 0.7
Max Tokens: 4000
```

### 創造的な応答が必要な場合
```
Temperature: 0.9～1.0
```

### 正確で一貫した応答が必要な場合
```
Temperature: 0.3～0.5
```

## 🐛 トラブルシューティング

### エラー: CORS policy error / Access-Control-Allow-Origin

**原因**: ブラウザのセキュリティ制限（CORS）によるブロック

**解決方法（優先順位順）**:

#### 1. エンドポイントURLに `/v1` を含める（最重要）
- ❌ 間違い: `http://localhost:1234`
- ✅ 正しい: `http://localhost:1234/v1`

**`/v1`を必ず含めてください！**これがないとエンドポイントが正しく解決されません。

#### 2. LM Studioの最新版を使用
LM Studio 0.2.9以降はCORSヘッダーをサポートしています。古いバージョンを使用している場合は更新してください。

#### 3. LM StudioのCORS設定を有効化（重要！）

**LM Studioでの設定手順**:
1. LM Studioの「Local Server」タブを開く
2. サーバー設定（歯車アイコン）をクリック
3. 「CORS」セクションを探す
4. 以下のいずれかを設定：
   - **オプション1**: 「Enable CORS」または「Allow all origins」を有効化（開発用）
   - **オプション2**: 「Allowed Origins」に `http://localhost:1420` を追加（より安全）
5. サーバーを再起動

**LM Studioのバージョンが古い場合**:
- LM Studio 0.2.9以降を推奨
- 古いバージョンはCORS設定がない可能性があります
- [lmstudio.ai](https://lmstudio.ai/)から最新版をダウンロード

#### 4. 開発サーバーを再起動
設定を変更した後は、開発サーバーを再起動してください：
```bash
# Ctrl+C で停止
python dev.py
```

#### 5. プロキシ経由でアクセス（推奨・確実）

LM StudioのCORS設定ができない場合の確実な方法：

**設定方法**:
1. 開発サーバーを再起動: `python dev.py`
2. 設定画面の「Custom Endpoint」に以下を入力：
   ```
   http://localhost:1420/api/lmstudio/v1
   ```
   ⚠️ **重要**: 完全なURLを指定してください。相対パス `/api/lmstudio/v1` ではエラーになります。
3. 保存して使用

**仕組み**:
```
ブラウザ → Viteプロキシ(localhost:1420) → LM Studio(127.0.0.1:1234)
```

Viteサーバーがプロキシとして機能するため、ブラウザから見ると同一オリジンになり、CORS制限を完全に回避できます。

**メリット**:
- ✅ CORS問題を完全に解決
- ✅ LM Studioの設定変更不要
- ✅ 古いLM Studioバージョンでも動作
- ✅ 設定が簡単

**注意**:
- 本番ビルド（`npm run build`）では使用できません
- 開発モード（`python dev.py`）専用です

### エラー: "Failed to fetch"

**原因**: LM Studioのサーバーが起動していない

**解決方法**:
1. LM Studioで「Start Server」をクリック
2. サーバーが起動するまで待つ（数秒～数十秒）
3. 緑色の "Server Running" 表示を確認

### エラー: "Connection refused"

**原因**: エンドポイントURLが間違っている

**解決方法**:
1. LM Studioのサーバー画面でURLを確認
2. ポート番号が `1234` であることを確認
3. 設定画面で正確なURLを入力

### エラー: "Error rendering prompt with jinja template"

**原因**: モデルのプロンプトテンプレートに問題がある（特にQwenモデル等）

**症状**:
```
Error rendering prompt with jinja template: "Unexpected character: ~"
```

**解決方法（優先順位順）**:

#### 1. lmstudio-community版を使用（最も簡単）
1. LM Studioの「Discover」タブを開く
2. `lmstudio-community/` で検索（例: `lmstudio-community/Qwen2.5-Coder`）
3. 修正済みバージョンをダウンロード
4. そのモデルでサーバーを起動

#### 2. プロンプトテンプレートを手動修正
1. LM Studioの「My Models」→ 対象モデルを選択
2. 設定（歯車）→「Prompt Template」
3. **Qwenモデルの場合**、以下のテンプレートを使用：
```jinja
{%- for message in messages %}
{%- if message['role'] == 'system' %}
<|im_start|>system
{{ message['content'] }}<|im_end|>
{%- elif message['role'] == 'user' %}
<|im_start|>user
{{ message['content'] }}<|im_end|>
{%- elif message['role'] == 'assistant' %}
<|im_start|>assistant
{{ message['content'] }}<|im_end|>
{%- endif %}
{%- endfor %}
<|im_start|>assistant
```
4. 保存してサーバーを再起動

#### 3. より軽量なモデルで試す
動作確認のため、まず軽量モデルで試すことを推奨：
- `lmstudio-community/Llama-3.2-3B-Instruct` (3B)
- `lmstudio-community/Qwen2.5-Coder-7B-Instruct` (7B)
- `lmstudio-community/Phi-3-mini-128k-instruct` (3.8B)

### エラー: "Model not found"

**原因**: モデル名が正しくない

**解決方法**:
1. LM Studioのサーバー画面で読み込まれているモデル名を確認
2. 設定画面の「Or Enter Custom Model Name」フィールドに正確なモデル名を入力
3. モデル名は大文字小文字を区別するため、正確にコピー＆ペーストを推奨

### 応答が遅い

**原因**: モデルサイズが大きすぎる、またはRAM不足

**解決方法**:
1. より軽量なモデルに変更（例: 3B → 1B）
2. LM Studioの設定で「GPU Acceleration」を有効化
3. 「Max Tokens」を減らす（4000 → 2000）

### 応答の質が低い

**原因**: モデルが小さすぎる、または設定が適切でない

**解決方法**:
1. より大きなモデルに変更（例: 3B → 8B）
2. Temperature を調整（0.7 前後を試す）
3. プロンプト設定を見直す（プロンプトエディタを使用）

## 📊 性能比較

| モデル | サイズ | RAM必要量 | 速度 | 品質 |
|--------|--------|-----------|------|------|
| Llama-3.2-1B | 1B | 4GB | 非常に速い | 基本的 |
| Llama-3.2-3B | 3B | 8GB | 速い | 良好 |
| Llama-3.1-8B | 8B | 16GB | 中程度 | 非常に良好 |
| Mistral-7B | 7B | 16GB | 中程度 | 優秀 |

## 🔐 セキュリティ

LM Studioを使用する場合：
- ✅ すべてのデータがローカルに保持される
- ✅ インターネット接続不要（モデルダウンロード後）
- ✅ プライバシーが完全に保護される
- ✅ 機密情報を安全に処理可能

## 🆚 OpenAI API vs LM Studio

| 項目 | OpenAI API | LM Studio |
|------|------------|-----------|
| **コスト** | 従量課金 | 無料（ハードウェアのみ） |
| **プライバシー** | データ送信あり | 完全ローカル |
| **品質** | 最高 | 良好～優秀 |
| **速度** | 速い | モデル依存 |
| **インターネット** | 必要 | 不要 |
| **セットアップ** | 簡単 | 中程度 |

## 🔄 OpenAI APIとの切り替え

設定を保存すれば、いつでも切り替え可能：

### LM Studioを使用する場合
1. Custom Endpoint に `http://localhost:1234/v1` を入力
2. Save Settings

### OpenAI APIを使用する場合
1. Custom Endpoint を空欄にする
2. 有効なOpenAI APIキーを入力
3. Save Settings

## 📚 参考リンク

- [LM Studio 公式サイト](https://lmstudio.ai/)
- [Llama モデル](https://huggingface.co/meta-llama)
- [Mistral モデル](https://huggingface.co/mistralai)
- [OpenAI API 互換性仕様](https://platform.openai.com/docs/api-reference)

## ❓ よくある質問

### Q: 複数のモデルを同時に使用できますか？
A: いいえ、LM Studioでは一度に1つのモデルのみ読み込めます。モデルを切り替える場合は、LM Studioで別のモデルを読み込んでください。

### Q: GPU は必要ですか？
A: 必須ではありませんが、GPUがあると大幅に高速化されます。LM Studioの設定で「GPU Acceleration」を有効にしてください。

### Q: Mac でも動作しますか？
A: はい、LM StudioはWindows、Mac、Linuxに対応しています。Macの場合、Apple Silicon (M1/M2/M3) で特に高速に動作します。

### Q: インターネット接続は不要ですか？
A: モデルを一度ダウンロードすれば、以降は完全にオフラインで動作します。

### Q: OpenAI APIと組み合わせて使えますか？
A: はい、設定で簡単に切り替えられます。Custom Endpointの有無で自動的に判別されます。

## 🎓 次のステップ

1. ✅ 基本的なLM Studioのセットアップを完了
2. ✅ 軽量モデルでチャット動作を確認
3. 📝 カスタムモデル名入力フィールドを活用して、様々なモデルを試す
4. 📝 プロンプト設定をカスタマイズ（プロンプトエディタ）
5. 🎨 表示設定を調整（ノベルモードなど）
6. 🚀 より高性能なモデルを試す

## 💡 便利なヒント

### モデル名の確認方法
LM Studioのサーバー画面で、モデル名をコピーして「Or Enter Custom Model Name」フィールドに直接ペーストするのが確実です。

### プリセットとカスタム入力の使い分け
- **OpenAI公式API使用時**: プリセット選択を使用
- **LM Studio使用時**: カスタム入力フィールドに直接モデル名を入力
- どちらも同じ設定項目で管理できるため、切り替えが簡単です

---

**注意**: この機能は実験的なものです。問題が発生した場合は、GitHub Issuesで報告してください。

