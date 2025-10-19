/**
 * TailwindCSS設定ファイル - CSSフレームワークの設定
 *
 * なぜ必要:
 * - どのファイルでTailwindクラスを使用するか指定（content設定）
 * - 使用されていないCSSクラスを自動削除（Tree Shaking）してファイルサイズ削減
 * - カスタムカラーやテーマの定義
 *
 * 動作原理:
 * 1. content内の全ファイルをスキャン
 * 2. 使用されているTailwindクラス（例: "bg-blue-500"）を検出
 * 3. 未使用のクラスをビルド時に削除
 * 4. 最終的なCSSファイルサイズを大幅に削減（数MBから数KB）
 *
 * ルート必須: TailwindCSSがルートから tailwind.config.js を自動検索
 */

/** @type {import('tailwindcss').Config} */
export default {
  // スキャン対象ファイル: これらのファイルで使用されているクラスのみを含める
  content: [
    "./index.html",                   // HTMLファイル
    "./src/**/*.{js,ts,jsx,tsx}",     // src配下の全JavaScriptファイル
  ],

  theme: {
    extend: {
      // カスタムカラーパレット: primary-500などで使用可能
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',  // メインカラー（bg-primary-500）
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
    },
  },

  plugins: [], // 追加プラグインなし（必要に応じてフォーム、タイポグラフィなど追加可能）
}

