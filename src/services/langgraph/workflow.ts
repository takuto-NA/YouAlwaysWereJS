/**
 * LangGraph Workflow Integration
 *
 * LangChainを使用してチャット対話を管理:
 * - ChatOpenAI / ChatGoogleGenerativeAI経由でのAPI呼び出し
 * - メッセージ形式の変換
 * - エラーハンドリング
 * - マルチプロバイダー対応
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { Message } from "../../types/chat";
import { logDebug, logError } from "../../utils/errorHandler";
import type { AIProvider } from "../../utils/storage";

/**
 * LangChainを使用したチャットワークフロー
 */
export class LangGraphChatWorkflow {
  private model: ChatOpenAI | ChatGoogleGenerativeAI;
  private provider: AIProvider;

  constructor(
    provider: AIProvider,
    apiKey: string,
    modelName: string = "gpt-4o",
    temperature?: number,
    maxTokens?: number,
    customEndpoint?: string
  ) {
    this.provider = provider;

    if (provider === "openai") {
      // OpenAIモデルの初期化
      const isGpt5 = modelName.startsWith("gpt-5");
      const isO1 = modelName.startsWith("o1");

      const modelConfig: Record<string, unknown> = {
        apiKey: apiKey,
        model: modelName,
      };

      // カスタムエンドポイントの設定（LM Studio等のローカルサーバー対応）
      if (customEndpoint) {
        modelConfig.configuration = {
          baseURL: customEndpoint,
        };
      }

      // GPT-4以前のモデルのみtemperatureをカスタマイズ可能
      if (!isO1 && !isGpt5 && temperature !== undefined) {
        modelConfig.temperature = temperature;
      }

      // トークン制限の設定
      if (maxTokens !== undefined) {
        modelConfig.maxTokens = maxTokens;
      }

      logDebug("LangChain", "ChatOpenAI初期化", {
        model: modelName,
        hasApiKey: !!apiKey,
        customEndpoint: customEndpoint || "default (api.openai.com)",
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens,
      });

      this.model = new ChatOpenAI(modelConfig);
    } else {
      // Geminiモデルの初期化
      const modelConfig: {
        apiKey: string;
        model: string;
        temperature?: number;
        maxOutputTokens?: number;
      } = {
        apiKey: apiKey,
        model: modelName,
      };

      if (temperature !== undefined) {
        modelConfig.temperature = temperature;
      }

      if (maxTokens !== undefined) {
        modelConfig.maxOutputTokens = maxTokens; // Geminiは maxOutputTokens を使用
      }

      logDebug("LangChain", "ChatGoogleGenerativeAI初期化", {
        model: modelName,
        hasApiKey: !!apiKey,
        temperature: modelConfig.temperature,
        maxOutputTokens: modelConfig.maxOutputTokens,
      });

      this.model = new ChatGoogleGenerativeAI(modelConfig);
    }
  }

  /**
   * メッセージをLangChain形式に変換
   */
  private convertToLangChainMessages(messages: Message[]): BaseMessage[] {
    if (this.provider === "gemini") {
      // Geminiは最初のシステムメッセージのみを許可
      // それ以外のシステムメッセージはユーザーメッセージに変換
      let hasSystemMessage = false;

      return messages.map((msg) => {
        const content = msg.content;

        if (msg.role === "system") {
          if (!hasSystemMessage) {
            hasSystemMessage = true;
            return new SystemMessage(content);
          } else {
            // 2つ目以降のシステムメッセージはユーザーメッセージとして扱う
            return new HumanMessage(`[System]: ${content}`);
          }
        } else if (msg.role === "user") {
          return new HumanMessage(content);
        } else {
          return new AIMessage(content);
        }
      });
    } else {
      // OpenAIは複数のシステムメッセージを許可
      return messages.map((msg) => {
        const content = msg.content;

        if (msg.role === "system") {
          return new SystemMessage(content);
        } else if (msg.role === "user") {
          return new HumanMessage(content);
        } else {
          return new AIMessage(content);
        }
      });
    }
  }

  /**
   * LangChain経由でチャット応答を取得
   */
  async execute(messages: Message[]): Promise<string> {
    try {
      const providerName = this.provider === "openai" ? "OpenAI" : "Gemini";

      logDebug("LangChain", `メッセージ送信開始 (${providerName})`, {
        provider: this.provider,
        messageCount: messages.length,
      });

      const langchainMessages = this.convertToLangChainMessages(messages);

      // プロバイダーに応じたモデルでレスポンスを取得
      let response;
      try {
        response = await this.model.invoke(langchainMessages);
      } catch (invokeError: unknown) {
        // API呼び出しエラーの詳細な処理
        let errorMessage = invokeError instanceof Error ? invokeError.message : String(invokeError);
        let errorDetails = "";
        
        // エラーオブジェクトから追加情報を抽出
        if (invokeError && typeof invokeError === "object") {
          const errObj = invokeError as Record<string, unknown>;
          
          // fetchエラーやネットワークエラーの場合
          if (errObj.cause) {
            errorDetails += `\n原因: ${JSON.stringify(errObj.cause)}`;
          }
          
          // HTTPステータスコードがある場合
          if (errObj.status) {
            errorDetails += `\nHTTPステータス: ${errObj.status}`;
          }
          
          // レスポンスボディがある場合
          if (errObj.response) {
            errorDetails += `\nレスポンス: ${JSON.stringify(errObj.response)}`;
          }
        }
        
        // カスタムエンドポイント使用時のエラーメッセージを改善
        if (this.provider === "openai" && this.model instanceof ChatOpenAI) {
          const config = (this.model as ChatOpenAI).lc_kwargs as { configuration?: { baseURL?: string } };
          const baseURL = config?.configuration?.baseURL;
          
          if (baseURL && baseURL !== "https://api.openai.com/v1") {
            // "Cannot read properties of undefined" エラーの場合、より詳細な説明を追加
            if (errorMessage.includes("Cannot read properties of undefined")) {
              errorMessage = "サーバーからの応答が不正な形式です。LM Studioが正しく起動していない可能性があります。";
            }
            
            throw new Error(
              `カスタムエンドポイント (${baseURL}) への接続に失敗しました。\n` +
              `エラー: ${errorMessage}${errorDetails}\n\n` +
              `確認事項:\n` +
              `1. LM Studioが起動しているか\n` +
              `2. モデルがロードされているか\n` +
              `3. エンドポイントURL (${baseURL}) が正しいか\n` +
              `4. ネットワーク接続が正常か (${baseURL.includes('192.168') ? 'ローカルネットワーク' : ''})`
            );
          }
        }
        
        throw new Error(`${providerName} API呼び出しエラー: ${errorMessage}${errorDetails}`);
      }

      // レスポンスの検証
      if (!response) {
        throw new Error(`${providerName} APIからのレスポンスが空です。サーバーが正しく起動しているか確認してください。`);
      }

      if (!response.content) {
        throw new Error(`${providerName} APIのレスポンスにcontentが含まれていません。レスポンス: ${JSON.stringify(response)}`);
      }

      // レスポンスの型を確認してログ出力
      logDebug("LangChain", `レスポンス型確認 (${providerName})`, {
        provider: this.provider,
        contentType: typeof response.content,
        isArray: Array.isArray(response.content),
        content: response.content,
      });

      // コンテンツの適切な抽出
      let content: string;
      if (typeof response.content === "string") {
        content = response.content;
      } else if (Array.isArray(response.content)) {
        // 配列の場合、各要素からテキストを抽出して結合
        content = response.content
          .map((item) => {
            if (typeof item === "string") {
              return item;
            } else if (item && typeof item === "object" && "text" in item) {
              return item.text;
            }
            return JSON.stringify(item);
          })
          .join("");
      } else if (response.content && typeof response.content === "object") {
        // オブジェクトの場合、textプロパティがあればそれを使用
        content = (response.content as { text?: string }).text || JSON.stringify(response.content);
      } else {
        content = String(response.content);
      }

      logDebug("LangChain", `レスポンス受信完了 (${providerName})`, {
        provider: this.provider,
        responseLength: content.length,
      });

      return content;
    } catch (error) {
      logError("LangChain", error, {
        provider: this.provider,
        attemptedAction: "execute",
        messageCount: messages.length,
      });
      throw error;
    }
  }
}

/**
 * LangGraphワークフローのインスタンスを作成
 */
export function createChatWorkflow(
  provider: AIProvider,
  apiKey: string,
  model: string = "gpt-4o",
  temperature?: number,
  maxTokens?: number,
  customEndpoint?: string
): LangGraphChatWorkflow {
  return new LangGraphChatWorkflow(provider, apiKey, model, temperature, maxTokens, customEndpoint);
}
