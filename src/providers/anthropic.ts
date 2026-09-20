import { CompletionRequest, CompletionResponse, LLMProvider } from './types.js';
import { extractAndParseJSON } from './json-parser.js';

export interface AnthropicConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

export class AnthropicProvider implements LLMProvider {
  public readonly name = 'anthropic';
  public readonly defaultModel: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: AnthropicConfig = {}) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl = (config.baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    this.defaultModel = config.defaultModel || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

    if (!this.apiKey) {
      throw new Error('Anthropic API key missing. Set ANTHROPIC_API_KEY environment variable or pass --api-key.');
    }
  }

  async generate(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model || this.defaultModel;
    const url = `${this.baseUrl}/messages`;

    let system = request.systemPrompt;
    if (request.responseFormat === 'json') {
      system += '\n\nIMPORTANT: You must return valid JSON ONLY. Do not wrap in extra prose.';
    }

    const body: Record<string, unknown> = {
      model,
      system,
      messages: [{ role: 'user', content: request.userPrompt }],
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature ?? 0.2,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Anthropic API error (${res.status} ${res.statusText}): ${errText}`);
    }

    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const textBlocks = data.content?.filter((b) => b.type === 'text') || [];
    const content = textBlocks.map((b) => b.text || '').join('\n');
    let parsedJson: unknown;

    if (request.responseFormat === 'json' && content) {
      parsedJson = extractAndParseJSON(content);
    }

    return {
      content,
      parsedJson,
      model,
      tokens: {
        prompt: data.usage?.input_tokens,
        completion: data.usage?.output_tokens,
        total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };
  }
}
