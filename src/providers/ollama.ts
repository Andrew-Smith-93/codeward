import { CompletionRequest, CompletionResponse, LLMProvider } from './types.js';
import { extractAndParseJSON } from './json-parser.js';

export interface OllamaConfig {
  baseUrl?: string;
  defaultModel?: string;
}

export class OllamaProvider implements LLMProvider {
  public readonly name = 'ollama';
  public readonly defaultModel: string;
  private baseUrl: string;

  constructor(config: OllamaConfig = {}) {
    const rawHost = config.baseUrl || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
    this.baseUrl = rawHost.startsWith('http') ? rawHost.replace(/\/+$/, '') : `http://${rawHost.replace(/\/+$/, '')}`;
    this.defaultModel = config.defaultModel || process.env.OLLAMA_MODEL || 'deepseek-coder:6.7b';
  }

  async generate(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model || this.defaultModel;
    const url = `${this.baseUrl}/api/chat`;

    const body: Record<string, unknown> = {
      model,
      stream: false,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      options: {
        temperature: request.temperature ?? 0.2,
      },
    };

    if (request.responseFormat === 'json') {
      body.format = 'json';
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Ollama error (${res.status} ${res.statusText}): ${errText}`);
      }

      const data = (await res.json()) as {
        message?: { content?: string };
        prompt_eval_count?: number;
        eval_count?: number;
      };

      const content = data.message?.content || '';
      let parsedJson: unknown;

      if (request.responseFormat === 'json' && content) {
        parsedJson = extractAndParseJSON(content);
      }

      return {
        content,
        parsedJson,
        model,
        tokens: {
          prompt: data.prompt_eval_count,
          completion: data.eval_count,
          total: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('ECONNREFUSED')) {
        throw new Error(`Cannot connect to Ollama at ${this.baseUrl}. Is Ollama running? (ollama serve)`);
      }
      throw err;
    }
  }
}
