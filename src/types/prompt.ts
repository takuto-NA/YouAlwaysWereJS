/**
 * プロンプト設定の型定義
 */

/**
 * 動的変数の種類
 */
export type DynamicVariable =
  | "currentTime"
  | "currentDate"
  | "userLanguage"
  | "conversationLength";

/**
 * プロンプトプリセット
 */
export interface PromptPreset {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  dynamicVariables: DynamicVariable[];
}

/**
 * ユーザーのプロンプト設定
 */
export interface PromptSettings {
  // 選択中のプリセットID
  selectedPresetId: string;
  // カスタムシステムプロンプト
  customSystemPrompt: string;
  // 有効な動的変数
  enabledDynamicVariables: DynamicVariable[];
  // カスタムプリセット（ユーザーが保存したもの）
  customPresets: PromptPreset[];
}

/**
 * 動的変数の情報
 */
export interface DynamicVariableInfo {
  key: DynamicVariable;
  label: string;
  description: string;
  getValue: () => string;
}

