/**
 * アプリケーションのエントリーポイント
 *
 * @description
 * Reactアプリケーションのルートレンダリングを担当。
 * URLハッシュに基づいて、メインアプリ（App）またはKuzuデモを条件分岐で表示する。
 *
 * @example
 * - 通常アクセス: メインのAIチャットアプリケーション（App）を表示
 * - #kuzu-demo: Kuzuグラフデータベースのデモ画面を表示
 *
 * @see App - メインのAIチャットインターフェース
 * @see KuzuPersistentDemo - Kuzuデータベースのデモコンポーネント
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import KuzuPersistentDemo from "./components/KuzuPersistentDemo";
import { ROUTES } from "./constants/app";
import "./index.css";

/**
 * ルートコンポーネント
 * URLハッシュに応じて表示するコンポーネントを切り替える
 */
const Root = (): JSX.Element => {
  const isKuzuDemo = typeof window !== "undefined" && window.location.hash === ROUTES.KUZU_DEMO_HASH;

  if (isKuzuDemo) {
    return <KuzuPersistentDemo />;
  }

  return <App />;
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
