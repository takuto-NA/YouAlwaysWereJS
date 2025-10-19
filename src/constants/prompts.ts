/**
 * プロンプトプリセットと動的変数の定義
 */
import { PromptPreset, DynamicVariableInfo, DynamicVariable } from "../types/prompt";

/**
 * 動的変数の情報
 */
export const DYNAMIC_VARIABLES: Record<string, DynamicVariableInfo> = {
  currentTime: {
    key: "currentTime",
    label: "現在時刻",
    description: "現在の時刻（HH:MM:SS形式）",
    getValue: () => {
      const now = new Date();
      return now.toLocaleTimeString("ja-JP");
    },
  },
  currentDate: {
    key: "currentDate",
    label: "現在日付",
    description: "現在の日付（YYYY-MM-DD形式）",
    getValue: () => {
      const now = new Date();
      return now.toISOString().split("T")[0];
    },
  },
  userLanguage: {
    key: "userLanguage",
    label: "ユーザー言語",
    description: "ユーザーのブラウザ言語設定",
    getValue: () => {
      return navigator.language || "ja-JP";
    },
  },
  conversationLength: {
    key: "conversationLength",
    label: "会話履歴数",
    description: "現在の会話メッセージ数",
    getValue: () => {
      // この値は実行時に動的に渡される
      return "{{conversationLength}}";
    },
  },
};

/**
 * プロンプトプリセット
 */
export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "default",
    name: "デフォルトアシスタント",
    description: "親切で知識豊富な汎用AIアシスタント",
    systemPrompt: `あなたは親切で知識豊富なAIアシスタントです。
ユーザーの質問に正確かつ分かりやすく答えてください。
必要に応じて具体例を示し、理解しやすい説明を心がけてください。`,
    dynamicVariables: ["currentDate", "userLanguage"],
  },
  {
    id: "technical",
    name: "技術アシスタント",
    description: "プログラミングと技術的な質問に特化",
    systemPrompt: `あなたは技術に詳しいプログラミングアシスタントです。
以下の点を心がけてください：
- コードの説明は具体的で分かりやすく
- ベストプラクティスを推奨
- セキュリティとパフォーマンスを考慮
- 実用的なコード例を提供`,
    dynamicVariables: ["currentDate", "userLanguage"],
  },
  {
    id: "creative",
    name: "クリエイティブライター",
    description: "創造的な文章作成をサポート",
    systemPrompt: `あなたは創造的なライティングアシスタントです。
以下のスタイルで対応してください：
- 想像力豊かで魅力的な表現
- ストーリーテリングを重視
- 感情的な深みを持つ文章
- ユーザーのアイデアを発展させる`,
    dynamicVariables: ["currentDate"],
  },
  {
    id: "game-master",
    name: "ゲームマスター",
    description: "SF世界のインタラクティブストーリー",
    systemPrompt: `あなたはSF世界のゲームマスターです。
以下のルールで物語を進めてください：
- 近未来のサイバーパンク的な世界観
- ユーザーの選択が物語に影響
- 緊張感のある展開を作る
- 適度な謎と驚きを提供
- 現在の状況を常に明確に`,
    dynamicVariables: ["currentTime", "conversationLength"],
  },
  {
    id: "concise",
    name: "簡潔モード",
    description: "短く要点を絞った回答",
    systemPrompt: `あなたは簡潔なコミュニケーションを重視するアシスタントです。
以下のルールを守ってください：
- 回答は短く要点を絞る
- 箇条書きを活用
- 冗長な説明は避ける
- 必要最小限の情報のみ提供`,
    dynamicVariables: ["currentTime"],
  },
  {
    id: "teacher",
    name: "教育アシスタント",
    description: "学習をサポートする丁寧な説明",
    systemPrompt: `あなたは教育的なアシスタントです。
以下の点を重視してください：
- 段階的で分かりやすい説明
- 初心者にも理解できる言葉遣い
- 具体例と比喩を使用
- 理解度を確認しながら進める
- 励ましとポジティブなフィードバック`,
    dynamicVariables: ["currentDate", "userLanguage"],
  },
];

/**
 * デフォルトのプロンプト設定
 */
export const DEFAULT_PROMPT_SETTINGS = {
  selectedPresetId: "default",
  customSystemPrompt: "",
  enabledDynamicVariables: ["currentDate", "userLanguage"] as DynamicVariable[],
  customPresets: [],
};

