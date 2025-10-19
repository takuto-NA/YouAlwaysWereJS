/**
 * PostCSS設定ファイル - CSS処理パイプライン
 *
 * なぜ必要:
 * - TailwindCSSを処理してCSSを生成
 * - Autoprefixerでベンダープレフィックスを自動追加（ブラウザ互換性）
 *
 * 処理の流れ:
 * 1. あなたが書くCSS
 *    @tailwind base;
 *    @tailwind components;
 *    @tailwind utilities;
 *
 * 2. TailwindCSSプラグインが処理
 *    → 実際のCSSクラスに展開
 *
 * 3. Autoprefixerが処理
 *    display: flex;
 *    → display: -webkit-box;
 *      display: -ms-flexbox;
 *      display: flex;
 *
 * 4. 最終的なCSS（すべてのブラウザで動作）
 *
 * ルート必須: PostCSSがルートから postcss.config.js を自動検索
 */

export default {
  plugins: {
    tailwindcss: {},    // TailwindCSSを処理
    autoprefixer: {},   // ベンダープレフィックス自動追加（Chrome/Safari/Firefox対応）
  },
}
