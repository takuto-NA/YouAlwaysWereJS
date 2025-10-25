/**
 * Vite環境変数の型定義
 *
 * @description
 * Viteビルドツールが提供する環境変数とimport.metaオブジェクトの型定義。
 * 開発/本番環境の判定やモード取得に使用される。
 *
 * @see https://vitejs.dev/guide/env-and-mode.html
 */
/// <reference types="vite/client" />

/**
 * Vite環境変数インターフェース
 * import.meta.envを通じてアクセス可能な環境変数を定義
 */
interface ImportMetaEnv {
  /** 開発モードかどうか */
  readonly DEV: boolean;
  /** 本番モードかどうか */
  readonly PROD: boolean;
  /** 現在のビルドモード（development/production等） */
  readonly MODE: string;
}

/**
 * import.metaオブジェクトの拡張型定義
 */
interface ImportMeta {
  /** Vite環境変数オブジェクト */
  readonly env: ImportMetaEnv;
}
