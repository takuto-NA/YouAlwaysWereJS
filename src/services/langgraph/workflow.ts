/**
 * LangGraph Workflow Integration
 *
 * Migrated from direct LangChain invocations to a StateGraph-based workflow:
 * - Wraps provider-specific chat models
 * - Converts frontend messages into LangChain BaseMessages
 * - Centralizes error handling and response extraction
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";

import { Message } from "../../types/chat";
import { logDebug, logError } from "../../utils/errorHandler";
import type { AIProvider } from "../../utils/storage";

const ChatStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[], BaseMessage | BaseMessage[]>({
    reducer: (existing: BaseMessage[], update: BaseMessage | BaseMessage[]) => {
      const updates = Array.isArray(update) ? update : [update];
      return [...existing, ...updates];
    },
    default: () => [],
  }),
  response: Annotation<string>({
    reducer: (_current: string, next: string) => next,
    default: () => "",
  }),
});

type ChatGraphState = typeof ChatStateAnnotation.State;

type ChatModel = ChatOpenAI | ChatGoogleGenerativeAI;

export class LangGraphChatWorkflow {
  private readonly provider: AIProvider;
  private readonly model: ChatModel;
  private readonly compiledGraph: ReturnType<LangGraphChatWorkflow["createGraph"]>;

  constructor(
    provider: AIProvider,
    apiKey: string,
    modelName: string = "gpt-4o",
    temperature?: number,
    maxTokens?: number,
    customEndpoint?: string
  ) {
    this.provider = provider;
    this.model = this.createModel(provider, apiKey, modelName, temperature, maxTokens, customEndpoint);
    this.compiledGraph = this.createGraph();
  }

  /**
   * Execute the compiled LangGraph workflow with the provided chat history.
   */
  async execute(messages: Message[]): Promise<string> {
    const providerName = this.provider === "openai" ? "OpenAI" : "Gemini";

    if (!messages || messages.length === 0) {
      throw new Error("有効なメッセージ履歴が見つかりません。");
    }

    const langchainMessages = this.convertToLangChainMessages(messages);

    logDebug("LangGraph", `ワークフロー実行開始 (${providerName})`, {
      provider: this.provider,
      messageCount: messages.length,
    });

    try {
      const finalState = await this.compiledGraph.invoke({
        messages: langchainMessages,
        response: "",
      });

      const aiResponse = finalState.response ?? "";

      if (!aiResponse) {
        throw new Error(`${providerName}から返された応答が空です。設定を確認して再試行してください。`);
      }

      logDebug("LangGraph", `ワークフロー実行完了 (${providerName})`, {
        provider: this.provider,
        responseLength: aiResponse.length,
      });

      return aiResponse;
    } catch (error) {
      logError("LangGraph", error, {
        provider: this.provider,
        attemptedAction: "execute",
        messageCount: messages.length,
      });
      throw error;
    }
  }

  /**
   * Build the provider-specific chat model.
   */
  private createModel(
    provider: AIProvider,
    apiKey: string,
    modelName: string,
    temperature?: number,
    maxTokens?: number,
    customEndpoint?: string
  ): ChatModel {
    if (provider === "openai") {
      const isGpt5 = modelName.startsWith("gpt-5");
      const isO1 = modelName.startsWith("o1");

      const modelConfig: Record<string, unknown> = {
        apiKey,
        model: modelName,
      };

      if (customEndpoint) {
        modelConfig.configuration = {
          baseURL: customEndpoint,
        };
      }

      if (!isO1 && !isGpt5 && temperature !== undefined) {
        modelConfig.temperature = temperature;
      }

      if (maxTokens !== undefined) {
        modelConfig.maxTokens = maxTokens;
      }

      logDebug("LangGraph", "ChatOpenAI初期化", {
        model: modelName,
        hasApiKey: !!apiKey,
        customEndpoint: customEndpoint || "default (api.openai.com)",
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens,
      });

      return new ChatOpenAI(modelConfig);
    }

    const modelConfig: {
      apiKey: string;
      model: string;
      temperature?: number;
      maxOutputTokens?: number;
    } = {
      apiKey,
      model: modelName,
    };

    if (temperature !== undefined) {
      modelConfig.temperature = temperature;
    }

    if (maxTokens !== undefined) {
      modelConfig.maxOutputTokens = maxTokens;
    }

    logDebug("LangGraph", "ChatGoogleGenerativeAI初期化", {
      model: modelName,
      hasApiKey: !!apiKey,
      temperature: modelConfig.temperature,
      maxOutputTokens: modelConfig.maxOutputTokens,
    });

    return new ChatGoogleGenerativeAI(modelConfig);
  }

  /**
   * Compile a LangGraph StateGraph that delegates response generation to the chat model.
   */
  private createGraph() {
    const graphBuilder = new StateGraph(ChatStateAnnotation)
      .addNode("invoke-model", async (state: ChatGraphState) => {
        const modelResponse = await this.callModel(state.messages);
        const assistantMessage = new AIMessage(modelResponse);

        return {
          messages: assistantMessage,
          response: modelResponse,
        };
      })
      .addEdge(START, "invoke-model")
      .addEdge("invoke-model", END);

    return graphBuilder.compile({
      name: "chat_workflow",
      description: "Single-step chat workflow powered by LangGraph",
    });
  }

  /**
   * Convert application-specific messages into LangChain BaseMessages for the model.
   */
  private convertToLangChainMessages(messages: Message[]): BaseMessage[] {
    if (this.provider === "gemini") {
      let hasSystemMessage = false;

      return messages.map((msg) => {
        const content = msg.content;

        if (msg.role === "system") {
          if (!hasSystemMessage) {
            hasSystemMessage = true;
            return new SystemMessage(content);
          }

          return new HumanMessage(`[System]: ${content}`);
        }

        if (msg.role === "user") {
          return new HumanMessage(content);
        }

        return new AIMessage(content);
      });
    }

    return messages.map((msg) => {
      const content = msg.content;

      if (msg.role === "system") {
        return new SystemMessage(content);
      }

      if (msg.role === "user") {
        return new HumanMessage(content);
      }

      return new AIMessage(content);
    });
  }

  /**
   * Invoke the configured chat model with LangChain-formatted messages and extract the response text.
   */
  private async callModel(messages: BaseMessage[]): Promise<string> {
    const providerName = this.provider === "openai" ? "OpenAI" : "Gemini";

    let response: BaseMessage;
    try {
      response = await this.model.invoke(messages);
    } catch (invokeError: unknown) {
      let errorMessage = invokeError instanceof Error ? invokeError.message : String(invokeError);
      let errorDetails = "";

      if (invokeError && typeof invokeError === "object") {
        const errObj = invokeError as Record<string, unknown>;

        if (errObj.cause) {
          errorDetails += `\n原因: ${JSON.stringify(errObj.cause)}`;
        }

        if (errObj.status) {
          errorDetails += `\nHTTPステータス: ${errObj.status}`;
        }

        if (errObj.response) {
          errorDetails += `\nレスポンス: ${JSON.stringify(errObj.response)}`;
        }
      }

      if (this.provider === "openai" && this.model instanceof ChatOpenAI) {
        const config = (this.model as ChatOpenAI).lc_kwargs as { configuration?: { baseURL?: string } };
        const baseURL = config?.configuration?.baseURL;

        if (baseURL && baseURL !== "https://api.openai.com/v1") {
          if (errorMessage.includes("Cannot read properties of undefined")) {
            errorMessage = "サーバーからの応答形式が不正です。LM Studioが正しく稼働しているか確認してください。";
          }

          throw new Error(
            `カスタムエンドポイント (${baseURL}) への接続に失敗しました。\n` +
              `エラー: ${errorMessage}${errorDetails}\n\n` +
              `確認事項:\n` +
              `1. LM Studioが起動しているか\n` +
              `2. モデルがロードされているか\n` +
              `3. エンドポイントURL (${baseURL}) が正しいか\n` +
              `4. ネットワーク接続が正常か (${baseURL.includes("192.168") ? "ローカルネットワーク" : ""})`
          );
        }
      }

      throw new Error(`${providerName} API呼び出しエラー: ${errorMessage}${errorDetails}`);
    }

    if (!response) {
      throw new Error(`${providerName} APIからのレスポンスが空です。サーバーが正しく起動しているか確認してください。`);
    }

    if (!response.content) {
      throw new Error(`${providerName} APIのレスポンスにcontentが含まれていません。レスポンス: ${JSON.stringify(response)}`);
    }

    logDebug("LangGraph", `レスポンス型確認 (${providerName})`, {
      provider: this.provider,
      contentType: typeof response.content,
      isArray: Array.isArray(response.content),
      content: response.content,
    });

    let content: string;
    if (typeof response.content === "string") {
      content = response.content;
    } else if (Array.isArray(response.content)) {
      content = response.content
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (item && typeof item === "object" && "text" in item) {
            return (item as { text?: string }).text ?? "";
          }
          return JSON.stringify(item);
        })
        .join("");
    } else if (response.content && typeof response.content === "object") {
      content = (response.content as { text?: string }).text || JSON.stringify(response.content);
    } else {
      content = String(response.content);
    }

    logDebug("LangGraph", `レスポンス受信完了 (${providerName})`, {
      provider: this.provider,
      responseLength: content.length,
    });

    return content;
  }
}

/**
 * LangGraphチャットワークフローのインスタンスを作成
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

