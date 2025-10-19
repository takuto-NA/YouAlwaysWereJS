/**
 * OpenAI APIとの統合サービス
 * LangGraphを使用してAIとの対話を処理
 */

import { Message } from "../../types/chat";
import { mcpClient } from "../mcp/client";
import { logDebug, logError } from "../../utils/errorHandler";
import { createChatWorkflow, LangGraphChatWorkflow } from "../langgraph/workflow";

const DEFAULT_MODEL = "gpt-4o";

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
  private workflow: LangGraphChatWorkflow | null = null;

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
    this.workflow = null; // APIキー変更時にワークフローをリセット
  }

  /**
   * モデルを設定
   */
  setModel(model: string): void {
    this.model = model;
    this.workflow = null; // モデル変更時にワークフローをリセット
  }

  /**
   * Temperatureを設定
   */
  setTemperature(temperature: number): void {
    this.temperature = temperature;
    this.workflow = null; // パラメータ変更時にワークフローをリセット
  }

  /**
   * 最大トークン数を設定
   */
  setMaxTokens(maxTokens: number): void {
    this.maxTokens = maxTokens;
    this.workflow = null; // パラメータ変更時にワークフローをリセット
  }

  /**
   * LangGraphワークフローを初期化
   */
  private initializeWorkflow(): void {
    if (!this.workflow) {
      this.workflow = createChatWorkflow(
        this.apiKey,
        this.model,
        this.temperature,
        this.maxTokens
      );
    }
  }

  /**
   * LangGraphを使用してOpenAI APIを呼び出す
   */
  async chat(messages: Message[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OpenAI APIキーが設定されていません。設定から入力してください。");
    }

    try {
      logDebug('OpenAI Service', 'LangGraph経由でOpenAIにリクエスト送信', {
        messageCount: messages.length,
        model: this.model,
      });

      // MCP経由でコンテキストを送信
      try {
        await mcpClient.connect();
        await mcpClient.request('context_update', {
          messages: messages,
          timestamp: Date.now(),
        });
      } catch (mcpError) {
        // MCPエラーは警告として記録し、処理は続行
        logDebug('OpenAI Service', 'MCP接続スキップ（オプション機能）', { mcpError });
      }

      // LangGraphワークフローを初期化
      this.initializeWorkflow();

      // LangGraphワークフローを実行
      const response = await this.workflow!.execute(messages);

      logDebug('OpenAI Service', 'LangGraphから応答を受信', {
        responseLength: response.length,
      });

      return response;
    } catch (error) {
      logError('OpenAI Service', error, {
        attemptedAction: 'chat',
        messageCount: messages.length,
      });
      throw error;
    }
  }

  /**
   * LangGraphを使用した高度な対話処理
   */
  async chatWithWorkflow(messages: Message[]): Promise<string> {
    // 現在はchat()がLangGraphを使用しているので、同じ処理を呼び出す
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

