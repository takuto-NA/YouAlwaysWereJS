/**
 * LangGraph Workflow Integration
 * 
 * LangChainを使用してチャット対話を管理:
 * - ChatOpenAI経由でのAPI呼び出し
 * - メッセージ形式の変換
 * - エラーハンドリング
 */

import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { Message } from "../../types/chat";
import { logDebug, logError } from "../../utils/errorHandler";

/**
 * LangChainを使用したチャットワークフロー
 */
export class LangGraphChatWorkflow {
  private model: ChatOpenAI;

  constructor(apiKey: string, modelName: string = "gpt-4o", temperature?: number, maxTokens?: number) {
    // モデルに応じてパラメータを調整
    const isGpt5 = modelName.startsWith('gpt-5');
    const isO1 = modelName.startsWith('o1');
    
    // LangChainのChatOpenAIは apiKey または openAIApiKey を受け付ける
    const modelConfig: Record<string, unknown> = {
      apiKey: apiKey,  // LangChain v0.3以降は apiKey を推奨
      model: modelName,  // modelName の代わりに model を使用
    };

    // GPT-4以前のモデルのみtemperatureをカスタマイズ可能
    if (!isO1 && !isGpt5 && temperature !== undefined) {
      modelConfig.temperature = temperature;
    }

    // トークン制限の設定
    if (maxTokens !== undefined) {
      modelConfig.maxTokens = maxTokens;
    }

    logDebug('LangChain', 'ChatOpenAI初期化', {
      model: modelName,
      hasApiKey: !!apiKey,
      temperature: modelConfig.temperature,
      maxTokens: modelConfig.maxTokens,
    });

    this.model = new ChatOpenAI(modelConfig);
  }

  /**
   * メッセージをLangChain形式に変換
   */
  private convertToLangChainMessages(messages: Message[]): BaseMessage[] {
    return messages.map(msg => {
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

  /**
   * LangChain経由でチャット応答を取得
   */
  async execute(messages: Message[]): Promise<string> {
    try {
      logDebug('LangChain', 'メッセージ送信開始', {
        messageCount: messages.length,
      });

      const langchainMessages = this.convertToLangChainMessages(messages);

      // ChatOpenAIを使用してレスポンスを取得
      const response = await this.model.invoke(langchainMessages);

      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);

      logDebug('LangChain', 'レスポンス受信完了', {
        responseLength: content.length,
      });

      return content;
    } catch (error) {
      logError('LangChain', error, {
        attemptedAction: 'execute',
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
  apiKey: string,
  model: string = "gpt-4o",
  temperature?: number,
  maxTokens?: number
): LangGraphChatWorkflow {
  return new LangGraphChatWorkflow(apiKey, model, temperature, maxTokens);
}
