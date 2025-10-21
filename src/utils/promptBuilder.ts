/**
 * システムプロンプトを構築するユーティリティ
 */
import { PromptSettings } from "../types/prompt";
import { PROMPT_PRESETS, DYNAMIC_VARIABLES } from "../constants/prompts";

/**
 * プロンプト設定から完全なシステムプロンプトを構築
 */
export function buildSystemPrompt(
  promptSettings: PromptSettings,
  conversationLength?: number
): string {
  try {
    // 入力の妥当性を検証
    if (!promptSettings) {
      throw new Error("プロンプト設定が指定されていません");
    }

    // 選択されたプリセットまたはカスタムプロンプトを取得
    let basePrompt = "";

    if (promptSettings.selectedPresetId === "custom") {
      basePrompt = promptSettings.customSystemPrompt;
      
      if (!basePrompt || basePrompt.trim().length === 0) {
        throw new Error("カスタムプロンプトが空です。プロンプトを入力してください。");
      }
    } else {
      const preset =
        [...PROMPT_PRESETS, ...promptSettings.customPresets].find(
          (p) => p.id === promptSettings.selectedPresetId
        ) || PROMPT_PRESETS[0];
      
      if (!preset) {
        throw new Error("選択されたプロンプトプリセットが見つかりません");
      }
      
      basePrompt = preset.systemPrompt;
    }

    // 動的変数を追加
    if (promptSettings.enabledDynamicVariables && promptSettings.enabledDynamicVariables.length > 0) {
      try {
        const dynamicContext = promptSettings.enabledDynamicVariables
          .map((key) => {
            if (!DYNAMIC_VARIABLES[key]) {
              console.warn(`未知の動的変数: ${key}`);
              return null;
            }

            let value = DYNAMIC_VARIABLES[key].getValue();

            // 会話履歴数は実行時に渡される値を使用
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
        // エラーが発生しても基本プロンプトは返す
      }
    }

    return basePrompt;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("プロンプトの構築中にエラーが発生しました:", errorMessage);
    
    // フォールバック: デフォルトプロンプトを返す
    return PROMPT_PRESETS[0]?.systemPrompt || "You are a helpful assistant.";
  }
}
