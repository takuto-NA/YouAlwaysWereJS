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
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import type { StructuredToolInterface } from "@langchain/core/tools";

import { Message } from "../../types/chat";
import { logDebug, logError, logWarning } from "../../utils/errorHandler";
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

const MAX_TOOL_ITERATIONS = 20;
const JSON_INDENT_SPACES = 2;

interface ModelCallResult {
  responseText: string;
  newMessages: BaseMessage[];
}

export interface ProgressUpdate {
  iteration: number;
  maxIterations: number;
  currentTool?: string;
  status: string;
}

export type ProgressCallback = (progress: ProgressUpdate) => void;

export class LangGraphChatWorkflow {
  private readonly provider: AIProvider;
  private readonly model: ChatModel;
  private readonly compiledGraph: ReturnType<LangGraphChatWorkflow["createGraph"]>;
  private readonly tools: StructuredToolInterface[];
  private readonly toolMap: Map<string, StructuredToolInterface>;
  private readonly maxToolIterations: number;
  private progressCallback?: ProgressCallback;

  constructor(
    provider: AIProvider,
    apiKey: string,
    modelName: string = "gpt-4o",
    temperature?: number,
    maxTokens?: number,
    customEndpoint?: string,
    tools?: StructuredToolInterface[],
    maxToolIterations?: number,
    progressCallback?: ProgressCallback
  ) {
    this.provider = provider;
    this.tools = tools?.length ? tools : [];
    this.toolMap = new Map(this.tools.map((tool) => [tool.name, tool]));
    this.maxToolIterations = maxToolIterations ?? MAX_TOOL_ITERATIONS;
    this.progressCallback = progressCallback;
    this.model = this.createModel(
      provider,
      apiKey,
      modelName,
      temperature,
      maxTokens,
      customEndpoint,
      this.tools
    );
    this.compiledGraph = this.createGraph();
  }

  /**
   * Log debug message with LangGraph context.
   */
  private logDebug(message: string, context?: Record<string, unknown>): void {
    logDebug("LangGraph", message, context);
  }

  /**
   * Log error message with LangGraph context.
   */
  private logError(error: unknown, context?: Record<string, unknown>): void {
    logError("LangGraph", error, context);
  }

  /**
   * Log warning message with LangGraph context.
   */
  private logWarning(message: string, context?: Record<string, unknown>): void {
    logWarning("LangGraph", message, context);
  }

  /**
   * Get the human-readable provider name.
   */
  private getProviderName(): string {
    return this.provider === "openai" ? "OpenAI" : "Gemini";
  }

  /**
   * Check if the current provider is OpenAI.
   */
  private isOpenAI(): boolean {
    return this.provider === "openai" && this.model instanceof ChatOpenAI;
  }

  /**
   * Execute the compiled LangGraph workflow with the provided chat history.
   */
  async execute(messages: Message[]): Promise<string> {
    const providerName = this.getProviderName();

    if (!messages || messages.length === 0) {
      throw new Error("有効なメッセージ履歴が見つかりません。");
    }

    const langchainMessages = this.convertToLangChainMessages(messages);

    this.logDebug(`ワークフロー実行開始 (${providerName})`, {
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

      this.logDebug(`ワークフロー実行完了 (${providerName})`, {
        provider: this.provider,
        responseLength: aiResponse.length,
      });

      return aiResponse;
    } catch (error) {
      this.logError(error, {
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
    customEndpoint?: string,
    tools?: StructuredToolInterface[]
  ): ChatModel {
    if (provider === "openai") {
      return this.createOpenAIModel(apiKey, modelName, temperature, maxTokens, customEndpoint, tools);
    }
    return this.createGeminiModel(apiKey, modelName, temperature, maxTokens);
  }

  /**
   * Create OpenAI chat model with configuration.
   */
  private createOpenAIModel(
    apiKey: string,
    modelName: string,
    temperature?: number,
    maxTokens?: number,
    customEndpoint?: string,
    tools?: StructuredToolInterface[]
  ): ChatOpenAI {
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

    if (tools && tools.length > 0) {
      modelConfig.tools = tools;
    }

    if (!isO1 && !isGpt5 && temperature !== undefined) {
      modelConfig.temperature = temperature;
    }

    if (maxTokens !== undefined) {
      modelConfig.maxTokens = maxTokens;
    }

    this.logDebug("ChatOpenAI初期化", {
      model: modelName,
      hasApiKey: !!apiKey,
      customEndpoint: customEndpoint || "default (api.openai.com)",
      temperature: modelConfig.temperature,
      maxTokens: modelConfig.maxTokens,
    });

    return new ChatOpenAI(modelConfig);
  }

  /**
   * Create Gemini chat model with configuration.
   */
  private createGeminiModel(
    apiKey: string,
    modelName: string,
    temperature?: number,
    maxTokens?: number
  ): ChatGoogleGenerativeAI {
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

    this.logDebug("ChatGoogleGenerativeAI初期化", {
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
        const result = await this.callModel(state.messages);
        return {
          messages: result.newMessages,
          response: result.responseText,
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
  /**
   * Invoke the configured chat model with LangGraph-formatted messages and extract the response text.
   */
  private async callModel(messages: BaseMessage[]): Promise<ModelCallResult> {
    const providerName = this.getProviderName();
    const shouldUseTools = this.tools.length > 0 && this.isOpenAI();

    if (shouldUseTools) {
      return this.callModelWithTools(messages, providerName);
    }

    const response = await this.invokeChatModel(messages, providerName);
    const content = this.extractContentFromResponse(response, providerName);

    return {
      responseText: content,
      newMessages: [response instanceof AIMessage ? response : new AIMessage(content)],
    };
  }

  private async callModelWithTools(
    initialMessages: BaseMessage[],
    providerName: string
  ): Promise<ModelCallResult> {
    const conversation: BaseMessage[] = [...initialMessages];
    const appended: BaseMessage[] = [];

    for (let iteration = 0; iteration < this.maxToolIterations; iteration += 1) {
      // プログレス通知: AI思考中
      this.progressCallback?.({
        iteration: iteration + 1,
        maxIterations: this.maxToolIterations,
        status: `Thinking... (${iteration + 1}/${this.maxToolIterations})`,
      });

      const response = await this.invokeChatModel(conversation, providerName);
      const aiMessage = response;
      appended.push(aiMessage);
      conversation.push(aiMessage);

      const toolCalls = Array.isArray(aiMessage.tool_calls) ? aiMessage.tool_calls : [];

      if (toolCalls.length === 0) {
        const content = this.extractContentFromResponse(aiMessage, providerName);
        // プログレス通知: 完了
        this.progressCallback?.({
          iteration: iteration + 1,
          maxIterations: this.maxToolIterations,
          status: "Completed",
        });
        return {
          responseText: content,
          newMessages: appended,
        };
      }

      await this.executeToolCalls(toolCalls, conversation, appended, iteration);
    }

    throw new Error(
      `Tool interaction exceeded ${this.maxToolIterations} iterations without producing a final response.`
    );
  }

  /**
   * Execute tool calls and add results to conversation.
   */
  private async executeToolCalls(
    toolCalls: any[],
    conversation: BaseMessage[],
    appended: BaseMessage[],
    iteration: number
  ): Promise<void> {
    for (const call of toolCalls) {
      const toolName = call.name ?? call.id ?? "unknown_tool";

      // プログレス通知: ツール実行中
      this.progressCallback?.({
        iteration: iteration + 1,
        maxIterations: this.maxToolIterations,
        currentTool: toolName,
        status: `Executing tool: ${toolName}`,
      });

      const tool = this.toolMap.get(toolName);

      if (!tool) {
        const missingToolMessage = new ToolMessage({
          content: `ERROR: Requested tool "${toolName}" is not available.`,
          status: "error",
          tool_call_id: call.id ?? toolName,
        });
        appended.push(missingToolMessage);
        conversation.push(missingToolMessage);
        continue;
      }

      const args = this.parseToolArgs(call.args ?? {}, toolName);
      await this.executeSingleTool(tool, args, call, toolName, iteration, conversation, appended);
    }
  }

  /**
   * Parse tool arguments from string or object.
   */
  private parseToolArgs(args: any, toolName: string): any {
    if (typeof args === "string") {
      try {
        return JSON.parse(args);
      } catch (parseError) {
        this.logWarning("Failed to parse tool args, passing raw string", {
          tool: toolName,
          args,
          error: parseError,
        });
        return args;
      }
    }
    return args;
  }

  /**
   * Execute a single tool and handle the result.
   */
  private async executeSingleTool(
    tool: StructuredToolInterface,
    args: any,
    call: any,
    toolName: string,
    iteration: number,
    conversation: BaseMessage[],
    appended: BaseMessage[]
  ): Promise<void> {
    try {
      this.logDebug("Invoking tool", { tool: toolName, iteration, args });
      const result = await tool.invoke(args);
      const stringResult = this.serializeToolResult(result);
      const toolMessage = new ToolMessage(
        {
          content: stringResult,
          status: "success",
          tool_call_id: call.id ?? toolName,
        },
        call.id ?? toolName,
        toolName
      );
      appended.push(toolMessage);
      conversation.push(toolMessage);
    } catch (toolError) {
      this.logError(toolError, { tool: toolName, args });
      const errorMessage = toolError instanceof Error ? toolError.message : String(toolError);
      const errorToolMessage = new ToolMessage({
        content: `Tool "${toolName}" failed: ${errorMessage}`,
        status: "error",
        tool_call_id: call.id ?? toolName,
      });
      appended.push(errorToolMessage);
      conversation.push(errorToolMessage);
    }
  }

  /**
   * Serialize tool result to string.
   */
  private serializeToolResult(result: any): string {
    if (typeof result === "string") {
      return result;
    }
    try {
      return JSON.stringify(result, null, JSON_INDENT_SPACES);
    } catch {
      return String(result);
    }
  }

  private async invokeChatModel(
    messages: BaseMessage[],
    providerName: string
  ): Promise<AIMessage> {
    try {
      const response =
        this.tools.length > 0 && this.isOpenAI()
          ? await this.model.bindTools(this.tools, { tool_choice: "auto" }).invoke(messages)
          : await this.model.invoke(messages);
      if (response instanceof AIMessage) {
        return response;
      }
      return new AIMessage(response.content ?? "");
    } catch (invokeError: unknown) {
      let errorMessage = invokeError instanceof Error ? invokeError.message : String(invokeError);
      let errorDetails = "";

      if (invokeError && typeof invokeError === "object") {
        const errObj = invokeError as Record<string, unknown>;

        if (errObj.cause) {
          errorDetails += `
原因: ${JSON.stringify(errObj.cause)}`;
        }

        if (errObj.status) {
          errorDetails += `
HTTPステータス: ${errObj.status}`;
        }

        if (errObj.response) {
          errorDetails += `
レスポンス: ${JSON.stringify(errObj.response)}`;
        }
      }

      if (this.isOpenAI()) {
        const config = (this.model as ChatOpenAI).lc_kwargs as { configuration?: { baseURL?: string } };
        const baseURL = config?.configuration?.baseURL;

        if (baseURL && baseURL !== "https://api.openai.com/v1") {
          if (errorMessage.includes("Cannot read properties of undefined")) {
            errorMessage =
              "サーバーからの応答形式が不正です。LM Studioが正しく稼働しているか確認してください。";
          }

          throw new Error(
            `カスタムエンドポイント (${baseURL}) への接続に失敗しました。
` +
              `エラー: ${errorMessage}${errorDetails}

` +
              `確認事項:
` +
              `1. LM Studioが起動しているか
` +
              `2. モデルがロードされているか
` +
              `3. エンドポイントURL (${baseURL}) が正しいか
` +
              `4. ネットワーク接続が正常か${baseURL.includes("192.168") ? "（ローカルネットワーク）" : ""}`
          );
        }
      }

      throw new Error(`${providerName} API呼び出しエラー: ${errorMessage}${errorDetails}`);
    }
  }

  private extractContentFromResponse(response: BaseMessage, providerName: string): string {
    if (!response) {
      throw new Error(`${providerName} APIからのレスポンスが空です。サーバーが正しく起動しているか確認してください。`);
    }

    if (!response.content) {
      throw new Error(
        `${providerName} APIのレスポンスにcontentが含まれていません。レスポンス: ${JSON.stringify(response)}`
      );
    }

    this.logDebug(`レスポンス型確認 (${providerName})`, {
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

    this.logDebug(`レスポンス受信完了 (${providerName})`, {
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
  customEndpoint?: string,
  tools?: StructuredToolInterface[],
  maxToolIterations?: number,
  progressCallback?: ProgressCallback
): LangGraphChatWorkflow {
  return new LangGraphChatWorkflow(provider, apiKey, model, temperature, maxTokens, customEndpoint, tools, maxToolIterations, progressCallback);
}

