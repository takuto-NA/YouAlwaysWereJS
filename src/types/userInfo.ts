/**
 * ユーザー情報の型定義
 */

/**
 * ユーザー情報
 */
export interface UserInfo {
  // 基本情報
  name: string;
  // 追加のカスタム情報
  customNotes: string;
}

/**
 * デフォルトのユーザー情報
 */
export const DEFAULT_USER_INFO: UserInfo = {
  name: "",
  customNotes: "",
};
