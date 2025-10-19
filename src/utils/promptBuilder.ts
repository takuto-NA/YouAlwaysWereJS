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
  // 選択されたプリセットまたはカスタムプロンプトを取得
  let basePrompt = "";

  if (promptSettings.selectedPresetId === "custom") {
    basePrompt = promptSettings.customSystemPrompt;
  } else {
    const preset =
      [...PROMPT_PRESETS, ...promptSettings.customPresets].find(
        (p) => p.id === promptSettings.selectedPresetId
      ) || PROMPT_PRESETS[0];
    basePrompt = preset.systemPrompt;
  }

  // 動的変数を追加
  if (promptSettings.enabledDynamicVariables.length > 0) {
    const dynamicContext = promptSettings.enabledDynamicVariables
      .map((key) => {
        let value = DYNAMIC_VARIABLES[key].getValue();

        // 会話履歴数は実行時に渡される値を使用
        if (key === "conversationLength" && conversationLength !== undefined) {
          value = conversationLength.toString();
        }

        return `${DYNAMIC_VARIABLES[key].label}: ${value}`;
      })
      .join("\n");

    return `${basePrompt}\n\n--- Current Context ---\n${dynamicContext}`;
  }

  return basePrompt;
}

