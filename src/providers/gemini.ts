import { CompletionRequest, CompletionResponse, LLMProvider } from './types.js';
import { extractAndParseJSON } from './json-parser.js';

export interface GeminiConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

export class GeminiProvider implements LLMProvider {
  public readonly name = 'gemini';
  public readonly defaultModel: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: GeminiConfig = {}) {
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || '';
    this.baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    this.defaultModel = config.defaultModel || process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    if (!this.apiKey) {
      throw new Error('Gemini API key missing. Set GEMINI_API_KEY environment variable or pass --api-key.');
    }
  }

  async generate(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model || this.defaultModel;
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    const generationConfig: Record<string, unknown> = {
      temperature: request.temperature ?? 0.2,
    };

    if (request.maxTokens) {
      generationConfig.maxOutputTokens = request.maxTokens;
    }

    if (request.responseFormat === 'json') {
      generationConfig.responseMimeType = 'application/json';
    }

    const body: Record<string, unknown> = {
      systemInstruction: {
        parts: [{ text: request.systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: request.userPrompt }],
        },
      ],
      generationConfig,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini API error (${res.status} ${res.statusText}): ${errText}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const parts = data.candidates?.[0]?.content?.parts || [];
    const content = parts.map((p) => p.text || '').join('\n');
    let parsedJson: unknown;

    if (request.responseFormat === 'json' && content) {
      parsedJson = extractAndParseJSON(content);
    }

    return {
      content,
      parsedJson,
      model,
      tokens: {
        prompt: data.usageMetadata?.promptTokenCount,
        completion: data.usageMetadata?.candidatesTokenCount,
        total: data.usageMetadata?.totalTokenCount,
      },
    };
  }
}
