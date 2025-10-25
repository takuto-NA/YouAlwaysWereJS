/**
 * システムプロンプトを構築するユーティリティ
 *
 * @description
 * プロンプト設定から完全なシステムプロンプトテキストを生成する。
 * プリセット選択、カスタムプロンプト、動的変数の組み合わせをサポート。
 *
 * @why
 * - AIの振る舞いをユーザーがカスタマイズできるようにするため
 * - 現在時刻や会話履歴数などの動的情報をプロンプトに注入するため
 * - エラー時もフォールバックプロンプトで動作を継続させるため
 */
import { PromptSettings } from "../types/prompt";
import { PROMPT_PRESETS, DYNAMIC_VARIABLES } from "../constants/prompts";

/**
 * プロンプト設定から完全なシステムプロンプトを構築
 *
 * @param promptSettings - ユーザーのプロンプト設定
 * @param conversationLength - 現在の会話履歴の長さ（動的変数として使用）
 * @returns 構築されたシステムプロンプト文字列
 *
 * @why 動的変数を含む柔軟なプロンプト生成と、エラー時の安全なフォールバックを両立
 */
export function buildSystemPrompt(
  promptSettings: PromptSettings,
  conversationLength?: number
): string {
  try {
    // 早期リターンで不正な入力を防ぎ、以降の処理を安全にするため
    if (!promptSettings) {
      throw new Error("プロンプト設定が指定されていません");
    }

    let basePrompt = "";

    // カスタムプロンプトとプリセットを明確に分離し、処理を単純化
    if (promptSettings.selectedPresetId === "custom") {
      basePrompt = promptSettings.customSystemPrompt;

      if (!basePrompt || basePrompt.trim().length === 0) {
        throw new Error("カスタムプロンプトが空です。プロンプトを入力してください。");
      }
    } else {
      // ユーザー定義プリセットと組み込みプリセットの両方を検索
      const preset =
        [...PROMPT_PRESETS, ...promptSettings.customPresets].find(
          (p) => p.id === promptSettings.selectedPresetId
        ) || PROMPT_PRESETS[0];

      if (!preset) {
        throw new Error("選択されたプロンプトプリセットが見つかりません");
      }

      basePrompt = preset.systemPrompt;
    }

    // 現在時刻や会話履歴数などの動的情報をAIに提供するため
    if (promptSettings.enabledDynamicVariables && promptSettings.enabledDynamicVariables.length > 0) {
      try {
        const dynamicContext = promptSettings.enabledDynamicVariables
          .map((key) => {
            if (!DYNAMIC_VARIABLES[key]) {
              console.warn(`未知の動的変数: ${key}`);
              return null;
            }

            let value = DYNAMIC_VARIABLES[key].getValue();

            // 会話履歴数は各リクエスト時に動的に変わるため、実行時の値を使用
            if (key === "conversationLength" && conversationLength !== undefined) {
              value = conversationLength.toString();
            }

            return `${DYNAMIC_VARIABLES[key].label}: ${value}`;
          })
          .filter((item): item is string => item !== null)
          .join("\n");

        if (dynamicContext) {
          return `${basePrompt}\n\n--- Current Context ---\n${dynamicContext}`;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn("動的変数の処理中にエラーが発生しました:", errorMessage);
        // 動的変数のエラーでプロンプト全体を失敗させないため、基本プロンプトのみ返す
      }
    }

    return basePrompt;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("プロンプトの構築中にエラーが発生しました:", errorMessage);

    // フォールバック: デフォルトプロンプトを返してアプリの動作を継続
    return PROMPT_PRESETS[0]?.systemPrompt || "You are a helpful assistant.";
  }
}
