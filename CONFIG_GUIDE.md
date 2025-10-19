# 設定ファイル説明書

**このファイルの役割**: ルートディレクトリにある各設定ファイルが何をしているか、なぜ必要なのかを説明する

---

## 📦 package.json
**何をしている**: npmプロジェクトの定義ファイル。依存関係とスクリプトを管理
**なぜ必要**:
- npmが自動的にこのファイルをルートから検索する（Node.jsの標準仕様）
- `npm install`でインストールするパッケージのバージョンを記録
- `npm run dev`などのコマンドを定義

**主要セクション**:
```json
"type": "module"          // ESモジュール形式を使用（import/export構文のため）
"scripts": {...}          // npm run コマンドの定義
"dependencies": {...}     // 本番環境で必要なパッケージ（React等）
"devDependencies": {...}  // 開発時のみ必要（TypeScript, Vite等）
```

**移動不可**: npm/Node.jsの仕様でルート固定

---

## 🔒 package-lock.json
**何をしている**: 依存関係の正確なバージョンをロックする
**なぜ必要**:
- チーム全員が同じバージョンのパッケージを使用するため
- `npm install`時にバージョンの不一致を防ぐ
- セキュリティ脆弱性の追跡に使用

**自動生成**: `npm install`実行時に自動作成・更新される
**移動不可**: npmの仕様でルート固定
**Git管理**: コミットすべき（チームで同じ環境を保証）

---

## ⚙️ tsconfig.json
**何をしている**: TypeScriptコンパイラの設定
**なぜ必要**:
- TypeScriptをJavaScriptに変換する際のルールを定義
- 型チェックの厳格さを設定
- インポートパスの解決方法を指定

**主要設定**:
```json
"target": "ES2020"              // 変換後のJavaScriptバージョン
"jsx": "react-jsx"              // ReactのJSX記法をサポート
"strict": true                  // 厳格な型チェック
"noUnusedLocals": false         // 未使用変数を許可（MVP開発中）
```

**なぜルート**: TypeScriptコンパイラ（tsc）がルートから検索する
**移動不可**: TypeScript公式仕様

---

## 🛠️ tsconfig.node.json
**何をしている**: Viteのビルドツール用TypeScript設定
**なぜ必要**:
- `vite.config.ts`をTypeScriptで書くための設定
- ブラウザ用（tsconfig.json）とビルドツール用で設定を分離

**なぜ分離**:
- ビルドツールはNode.js環境で動作（ブラウザとは異なる）
- 異なるモジュール解決方法が必要

**移動不可**: Viteが`tsconfig.node.json`という名前でルートから検索

---

## ⚡ vite.config.ts
**何をしている**: Vite（開発サーバー・ビルドツール）の設定
**なぜ必要**:
- ホットリロード（HMR）の設定
- Reactプラグインの有効化
- ポート番号の指定（1420番）
- ビルド最適化の設定

**主要設定**:
```typescript
plugins: [react()]           // ReactのJSXを処理
clearScreen: false           // Tauriとの統合のため画面クリアを無効化
server: { port: 1420 }       // 開発サーバーのポート
```

**なぜルート**: Viteが`vite.config.ts`をルートから自動検索
**移動不可**: Vite公式仕様

---

## 🎨 tailwind.config.js
**何をしている**: TailwindCSS（CSSフレームワーク）の設定
**なぜ必要**:
- どのファイルでTailwindを使用するか指定（`content`設定）
- カスタムカラーの定義
- 使用していないCSSクラスを自動削除（Tree Shaking）

**主要設定**:
```javascript
content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]
// ↑ これらのファイルをスキャンしてTailwindクラスを検出
// 使用されていないクラスはビルド時に削除される（ファイルサイズ削減）
```

**なぜルート**: TailwindCSSがルートから自動検索
**移動不可**: Tailwind公式仕様

---

## 🔧 postcss.config.js
**何をしている**: PostCSS（CSSプロセッサ）の設定
**なぜ必要**:
- TailwindCSSを処理するため
- Autoprefixer（ベンダープレフィックス自動付与）を有効化

**処理の流れ**:
```
あなたが書いたCSS
  ↓ TailwindCSS処理
@tailwind → 実際のCSSクラス展開
  ↓ Autoprefixer
display: flex → -webkit-box, -ms-flexbox, display: flex
  ↓ 最終CSS
```

**なぜ必要**: ブラウザ互換性の確保
**なぜルート**: PostCSSがルートから自動検索
**移動不可**: PostCSS公式仕様

---

## 🌐 index.html
**何をしている**: アプリのエントリーポイント（最初に読み込まれるHTML）
**なぜ必要**:
- ブラウザが最初に読み込むファイル
- Reactアプリをマウントする`<div id="root">`を定義
- `src/main.tsx`をインポート（TypeScript/Reactの起動）

**なぜルート**: Viteの仕様でルート配置が標準
**移動可能**: Vite設定で変更可能だが、標準に従うべき

---

## 🚫 .gitignore
**何をしている**: Gitで管理しないファイル・ディレクトリを指定
**なぜ必要**:
- `node_modules/`（100MB超）をコミットしない
- ビルド成果物（`dist/`）をコミットしない
- 環境固有ファイル（`.env`）を除外

**なぜルート**: Gitがルートから`.gitignore`を検索
**移動不可**: Git公式仕様

---

## 📂 構造まとめ

```
YouAlwaysWereJS/
├── package.json          ← npm/Node.jsが要求（ルート固定）
├── package-lock.json     ← npmが自動生成（ルート固定）
├── tsconfig.json         ← TypeScriptが要求（ルート固定）
├── tsconfig.node.json    ← Viteが要求（ルート固定）
├── vite.config.ts        ← Viteが要求（ルート固定）
├── tailwind.config.js    ← TailwindCSSが要求（ルート固定）
├── postcss.config.js     ← PostCSSが要求（ルート固定）
├── index.html            ← Viteの標準（ルート推奨）
├── .gitignore            ← Gitが要求（ルート固定）
└── src/                  ← ソースコード
```

## ❓ なぜこんなに設定ファイルが多いのか

**答え**: モダンなフロントエンド開発は複数のツールを組み合わせているため

| ツール | 役割 | 設定ファイル |
|--------|------|--------------|
| npm/Node.js | パッケージ管理 | package.json, package-lock.json |
| TypeScript | 型安全なJavaScript | tsconfig.json, tsconfig.node.json |
| Vite | 開発サーバー・ビルド | vite.config.ts |
| TailwindCSS | CSSフレームワーク | tailwind.config.js |
| PostCSS | CSS処理 | postcss.config.js |
| Git | バージョン管理 | .gitignore |

**各ツールが独立しているため、それぞれに設定ファイルが必要です。**

---

## 🎯 MVPとして削減できるもの

設定ファイルは削減不可（各ツールの要求）。
**削減すべきは以下**:

- ❌ `src/services/` - 未実装のAI/MCP/LangGraphコード
- ❌ `CODING_RULES.md`, `CODE_REVIEW_CHECKLIST.md`, `QUICK_CHECK.md` - 過剰なドキュメント
- ❌ `scripts/check-code-quality.sh` - MVP不要

**設定ファイルはモダンWeb開発の標準構成です。これ以上減らせません。**
