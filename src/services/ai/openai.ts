/**
 * OpenAI APIとの統合サービス
 * LangGraphを使用してAIとの対話を処理
 */

import type { StructuredToolInterface } from "@langchain/core/tools";
import { Message } from "../../types/chat";
import { mcpClient } from "../mcp/client";
import { logDebug, logError } from "../../utils/errorHandler";
import { createChatWorkflow, LangGraphChatWorkflow, ProgressCallback } from "../langgraph/workflow";
import { createKuzuMemoryTools } from "../langgraph/kuzuTools";

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
  private customEndpoint?: string;
  private maxToolIterations?: number;
  private progressCallback?: ProgressCallback;
  private workflow: LangGraphChatWorkflow | null = null;
  private memoryTools: StructuredToolInterface[] | null = null;

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
   * カスタムエンドポイントを設定（LM Studio等のローカルサーバー用）
   */
  setCustomEndpoint(customEndpoint?: string): void {
    this.customEndpoint = customEndpoint;
    this.workflow = null; // エンドポイント変更時にワークフローをリセット
  }

  /**
   * 最大ツールイテレーション回数を設定
   */
  setMaxToolIterations(maxToolIterations?: number): void {
    this.maxToolIterations = maxToolIterations;
    this.workflow = null; // パラメータ変更時にワークフローをリセット
  }

  /**
   * プログレスコールバックを設定
   */
  setProgressCallback(callback?: ProgressCallback): void {
    this.progressCallback = callback;
    this.workflow = null; // パラメータ変更時にワークフローをリセット
  }

  private resolveTools(provider: "openai" | "gemini"): StructuredToolInterface[] | undefined {
    if (provider !== "openai") {
      return undefined;
    }

    if (!this.memoryTools) {
      this.memoryTools = createKuzuMemoryTools();
    }

    return this.memoryTools;
  }

  /**
   * LangGraphワークフローを初期化
   */
  private initializeWorkflow(provider: "openai" | "gemini", apiKey: string, model: string): void {
    if (!this.workflow) {
      this.workflow = createChatWorkflow(
        provider,
        apiKey,
        model,
        this.temperature,
        this.maxTokens,
        this.customEndpoint,
        this.resolveTools(provider),
        this.maxToolIterations,
        this.progressCallback
      );
    }
  }

  /**
   * LangGraphを使用してAI APIを呼び出す（マルチプロバイダー対応）
   */
  async chat(messages: Message[], provider: "openai" | "gemini" = "openai"): Promise<string> {
    const providerName = provider === "openai" ? "OpenAI" : "Gemini";
    
    // APIキーの検証
    if (!this.apiKey) {
      throw new Error(
        `${providerName} APIキーが設定されていません。\n\n` +
        `💡 設定画面（歯車アイコン）からAPIキーを入力してください。`
      );
    }

    // メッセージが空でないことを確認
    if (!messages || messages.length === 0) {
      throw new Error("送信するメッセージがありません。");
    }

    try {
      logDebug("AI Service", `LangGraph経由で${providerName}にリクエスト送信`, {
        provider: provider,
        messageCount: messages.length,
        model: this.model,
      });

      // MCP経由でコンテキストを送信（オプション機能）
      try {
        await mcpClient.connect();
        await mcpClient.request("context_update", {
          messages: messages,
          timestamp: Date.now(),
        });
      } catch (mcpError) {
        // MCPエラーは警告として記録し、処理は続行
        const mcpErrorMessage = mcpError instanceof Error ? mcpError.message : String(mcpError);
        logDebug("AI Service", "MCP接続スキップ（オプション機能）", { 
          error: mcpErrorMessage 
        });
      }

      // LangGraphワークフローを初期化
      this.initializeWorkflow(provider, this.apiKey, this.model);

      if (!this.workflow) {
        throw new Error("ワークフローの初期化に失敗しました。");
      }

      // LangGraphワークフローを実行
      const response = await this.workflow.execute(messages);

      // レスポンスの妥当性を検証
      if (!response || typeof response !== "string") {
        throw new Error(
          `${providerName}からの応答が不正です。サーバーの状態を確認してください。`
        );
      }

      if (response.length === 0) {
        throw new Error(
          `${providerName}から空の応答が返されました。プロンプトを変更してみてください。`
        );
      }

      logDebug("AI Service", `LangGraphから応答を受信 (${providerName})`, {
        provider: provider,
        responseLength: response.length,
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logError("AI Service", error, {
        provider: provider,
        attemptedAction: "chat",
        messageCount: messages.length,
        model: this.model,
      });
      
      // エラーメッセージをより詳細に
      if (errorMessage.includes("fetch") || errorMessage.includes("network")) {
        throw new Error(
          `ネットワークエラー: ${providerName}への接続に失敗しました。\n` +
          `インターネット接続を確認してください。\n\n` +
          `詳細: ${errorMessage}`
        );
      }
      
      // 元のエラーをそのまま投げる（すでに詳細なメッセージが含まれている場合）
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
 * カスタム設定でOpenAIServiceを作成（マルチプロバイダー対応）
 */
export function createAIService(
  provider: "openai" | "gemini",
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

// 後方互換性のためのエイリアス
export const createOpenAIService = createAIService;
