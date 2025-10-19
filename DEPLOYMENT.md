# Deployment Guide

## GitHub Pages へのデプロイ

このプロジェクトは GitHub Actions を使って自動的に GitHub Pages にデプロイされます。

### 🚀 自動デプロイ

**トリガー:**
- `main` ブランチへの push
- 手動実行（GitHub の Actions タブから）

**デプロイURL:**
```
https://[YOUR_USERNAME].github.io/YouAlwaysWereJS/
```

---

## 📋 セットアップ手順

### 1. GitHub Pages を有効化

1. GitHubリポジトリの **Settings** → **Pages** に移動
2. **Source** を **GitHub Actions** に設定
3. 保存

### 2. 初回デプロイ

```bash
# mainブランチにpush
git add .
git commit -m "feat: Add GitHub Pages deployment"
git push origin main
```

### 3. デプロイ状況の確認

1. GitHubリポジトリの **Actions** タブを開く
2. 最新のワークフロー実行を確認
3. ✅ 成功したら、GitHub Pages の URL にアクセス

---

## 🔧 ローカルでプレビュー

本番環境と同じビルドを確認:

```bash
# 本番ビルド
npm run build

# プレビューサーバー起動
npm run preview
```

**注意**: `vite preview` では base path が適用されないため、実際のGitHub Pagesとは若干動作が異なる場合があります。

---

## 📁 デプロイされるファイル

- `dist/` ディレクトリ内の全ファイル
- ビルド済みの HTML, CSS, JavaScript
- 静的アセット（画像、フォントなど）

---

## ⚙️ 設定ファイル

### `.github/workflows/deploy.yml`
GitHub Actions のワークフロー定義

**主な処理:**
1. Node.js セットアップ
2. 依存関係インストール (`npm ci`)
3. 型チェック (`npm run type-check`)
4. 本番ビルド (`npm run build`)
5. GitHub Pages へデプロイ

### `vite.config.ts`
Vite のビルド設定

**重要な設定:**
```typescript
base: process.env.NODE_ENV === 'production' 
  ? '/YouAlwaysWereJS/' 
  : '/'
```

- **開発時**: `/` (ローカルホスト)
- **本番時**: `/YouAlwaysWereJS/` (GitHub Pages)

---

## 🐛 トラブルシューティング

### デプロイは成功するがページが表示されない

**原因**: Base path が間違っている可能性

**確認:**
1. `vite.config.ts` の `base` 設定を確認
2. リポジトリ名と一致しているか確認

### CSSやJSが読み込まれない

**原因**: アセットパスが正しくない

**解決策:**
```typescript
// vite.config.tsでbaseを正しく設定
base: '/YouAlwaysWereJS/'
```

### ビルドエラーが発生

**確認事項:**
```bash
# ローカルで型チェック
npm run type-check

# ローカルでビルド
npm run build
```

### デプロイ後にAPIキーが必要

GitHub Pages版では、初回アクセス時に設定画面が表示されます。

**手順:**
1. ⚙ ボタンをクリック
2. OpenAI API キーを入力
3. モデルや速度を設定
4. Save をクリック

設定は localStorage に保存され、次回アクセス時も維持されます。

---

## 🔒 セキュリティ

### API キーの取り扱い

❌ **絶対にしないこと:**
- `.env` ファイルをコミット
- API キーをコードにハードコード
- GitHub Secrets にユーザーの API キーを保存

✅ **正しい方法:**
- ユーザーが設定画面で各自入力
- localStorage に暗号化せず保存（ブラウザのセキュリティに依存）
- 必要に応じて削除可能

---

## 📊 デプロイ状況の確認

### GitHub Actions バッジ

README.md に追加:

```markdown
![Deploy Status](https://github.com/[USERNAME]/YouAlwaysWereJS/workflows/Deploy%20to%20GitHub%20Pages/badge.svg)
```

### デプロイ履歴

GitHubリポジトリの **Environments** → **github-pages** で履歴を確認可能

---

## 🚀 Advanced: カスタムドメイン

### 独自ドメインを使用する場合

1. GitHub Settings → Pages → Custom domain
2. ドメインを入力（例: `youalwayswere.example.com`）
3. DNS設定で CNAMEレコードを追加:
   ```
   CNAME: [USERNAME].github.io
   ```

4. `public/CNAME` ファイルを作成:
   ```
   youalwayswere.example.com
   ```

---

## 📚 参考リンク

- [GitHub Pages Documentation](https://docs.github.com/pages)
- [Vite Static Deploy Guide](https://vitejs.dev/guide/static-deploy.html)
- [GitHub Actions for Pages](https://github.com/actions/deploy-pages)

---

**Happy Deploying!** 🎉

