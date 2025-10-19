/**
 * OpenAI APIとの統合サービス
 * LangGraphとMCPを使用してAIとの対話を処理
 */

import { Message } from "../../types/chat";
import { mcpClient } from "../mcp/client";
import { logDebug, logError } from "../../utils/errorHandler";

const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-5";

export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAIResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

export class OpenAIService {
  private apiKey: string;
  private model: string;
  private temperature: number = 0.7;
  private maxTokens: number = 1000;

  constructor(apiKey?: string, model: string = DEFAULT_MODEL) {
    // 引数 > localStorage > 環境変数の順で優先
    this.apiKey = apiKey || import.meta.env.VITE_OPENAI_API_KEY || "";
    this.model = model;
  }

  /**
   * APIキーを設定
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * モデルを設定
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Temperatureを設定
   */
  setTemperature(temperature: number): void {
    this.temperature = temperature;
  }

  /**
   * 最大トークン数を設定
   */
  setMaxTokens(maxTokens: number): void {
    this.maxTokens = maxTokens;
  }

  /**
   * メッセージをOpenAI形式に変換
   */
  private convertToOpenAIMessages(messages: Message[]): OpenAIMessage[] {
    return messages.map(msg => ({
      role: msg.role === "system" ? "system" : msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));
  }

  /**
   * OpenAI APIを呼び出してレスポンスを取得
   */
  async chat(messages: Message[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OpenAI APIキーが設定されていません。.envファイルにVITE_OPENAI_API_KEYを設定してください。");
    }

    try {
      logDebug('OpenAI Service', 'Sending request to OpenAI', {
        messageCount: messages.length,
        model: this.model,
      });

      // MCP経由でコンテキストを送信
      await mcpClient.connect();
      await mcpClient.request('context_update', {
        messages: messages,
        timestamp: Date.now(),
      });

      const openAIMessages = this.convertToOpenAIMessages(messages);

      // モデルに応じてパラメータを調整
      const isGpt5 = this.model.startsWith('gpt-5');
      const isO1 = this.model.startsWith('o1');
      const isNewModel = isGpt5 || isO1;
      
      // トークンパラメータ名
      const tokensParam = isNewModel ? 'max_completion_tokens' : 'max_tokens';
      
      const requestBody: Record<string, unknown> = {
        model: this.model,
        messages: openAIMessages,
      };
      
      // o1シリーズとGPT-5シリーズはtemperatureが制限されている
      // デフォルト値(1.0)以外は使用できない場合がある
      if (!isO1 && !isGpt5) {
        // GPT-4以前のモデルのみtemperatureをカスタマイズ可能
        requestBody.temperature = this.temperature;
      }
      
      requestBody[tokensParam] = this.maxTokens;

      const response = await fetch(OPENAI_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data: OpenAIResponse = await response.json();
      const assistantMessage = data.choices[0]?.message?.content || "";

      logDebug('OpenAI Service', 'Received response from OpenAI', {
        responseLength: assistantMessage.length,
      });

      return assistantMessage;
    } catch (error) {
      logError('OpenAI Service', error, {
        attemptedAction: 'chat',
        messageCount: messages.length,
      });
      throw error;
    }
  }

  /**
   * MCPとLangGraphを使用した高度な対話処理（将来実装）
   */
  async chatWithWorkflow(messages: Message[]): Promise<string> {
    // 将来: LangGraphワークフローと統合
    // 現時点では通常のchat()を呼び出す
    return this.chat(messages);
  }
}

export const openAIService = new OpenAIService();

/**
 * カスタム設定でOpenAIServiceを作成
 */
export function createOpenAIService(
  apiKey: string,
  model: string,
  temperature?: number,
  maxTokens?: number
): OpenAIService {
  const service = new OpenAIService(apiKey, model);
  if (temperature !== undefined) {
    service.setTemperature(temperature);
  }
  if (maxTokens !== undefined) {
    service.setMaxTokens(maxTokens);
  }
  return service;
}

