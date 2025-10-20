/**
 * Vite設定ファイル - 開発サーバーとビルドツールの設定
 *
 * なぜ必要:
 * - 開発時のホットリロード（HMR: Hot Module Replacement）を実現
 * - ReactのJSXを処理するプラグインを有効化
 * - 開発サーバーのポート・ホスト設定
 * - Tauriデスクトップアプリとの統合
 *
 * ルート必須: Viteが自動的にルートから vite.config.ts を検索する
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri開発時のホスト設定（Tauriから環境変数で渡される）
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()], // ReactプラグインでJSXを処理

  // GitHub Pagesデプロイ時のベースパス
  // 本番環境ではリポジトリ名をベースパスに設定
  base: process.env.NODE_ENV === 'production' ? '/YouAlwaysWereJS/' : '/',

  // Tauriとの統合: ターミナル画面をクリアしない（Tauriのログを保持）
  clearScreen: false,

  server: {
    // ホスト設定: 0.0.0.0で外部デバイス（スマホ等）からのアクセスを許可
    host: host || '0.0.0.0',

    // ポート番号: 1420番固定（Tauri推奨ポート）
    port: 1420,
    strictPort: true, // ポートが使用中ならエラー（別ポートに変更しない）

    // HMR（ホットモジュールリプレースメント）設定
    // なぜ必要: コード変更時に自動リロードしてブラウザを更新
    hmr: host
      ? {
          protocol: "ws", // WebSocket通信
          host: host,
          port: 1430, // HMR専用ポート（開発サーバーとは別）
        }
      : undefined, // Tauri未使用時はデフォルト設定

    // プロキシ設定: LM StudioなどのローカルサーバーへのCORS回避
    // なぜ必要: ブラウザのCORS制限を回避してローカルAIサーバーにアクセス
    proxy: {
      '/api/lmstudio': {
        target: 'http://127.0.0.1:1234',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lmstudio/, ''),
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('Proxying request:', req.method, req.url);
          });
        }
      }
    }
  },
});

