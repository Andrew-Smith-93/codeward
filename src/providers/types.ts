export interface CompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  responseFormat?: 'json' | 'text';
}

export interface CompletionResponse {
  content: string;
  parsedJson?: unknown;
  model: string;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
}

export interface LLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  generate(request: CompletionRequest): Promise<CompletionResponse>;
}
