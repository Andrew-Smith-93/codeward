import { LLMProvider } from './types.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GeminiProvider } from './gemini.js';
import { OllamaProvider } from './ollama.js';
import { MockProvider } from './mock.js';
import { ReviewOptions } from '../types/index.js';

export function resolveProvider(options: ReviewOptions = {}): LLMProvider {
  const chosen = options.provider?.toLowerCase();

  if (chosen === 'mock') {
    return new MockProvider();
  }

  if (chosen === 'openai') {
    return new OpenAIProvider({
      apiKey: options.apiKey,
      baseUrl: options.apiUrl,
      defaultModel: options.model,
    });
  }

  if (chosen === 'anthropic') {
    return new AnthropicProvider({
      apiKey: options.apiKey,
      baseUrl: options.apiUrl,
      defaultModel: options.model,
    });
  }

  if (chosen === 'gemini') {
    return new GeminiProvider({
      apiKey: options.apiKey,
      baseUrl: options.apiUrl,
      defaultModel: options.model,
    });
  }

  if (chosen === 'ollama') {
    return new OllamaProvider({
      baseUrl: options.apiUrl,
      defaultModel: options.model,
    });
  }

  // Auto-detection based on environment variables
  if (options.apiKey || process.env.OPENAI_API_KEY) {
    return new OpenAIProvider({
      apiKey: options.apiKey,
      baseUrl: options.apiUrl,
      defaultModel: options.model,
    });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider({
      apiKey: options.apiKey,
      baseUrl: options.apiUrl,
      defaultModel: options.model,
    });
  }

  if (process.env.GEMINI_API_KEY) {
    return new GeminiProvider({
      apiKey: options.apiKey,
      baseUrl: options.apiUrl,
      defaultModel: options.model,
    });
  }

  if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST) {
    return new OllamaProvider({
      baseUrl: options.apiUrl,
      defaultModel: options.model,
    });
  }

  throw new Error(
    'No LLM provider configured!\n' +
    'Please set one of the following environment variables:\n' +
    '  - OPENAI_API_KEY\n' +
    '  - ANTHROPIC_API_KEY\n' +
    '  - GEMINI_API_KEY\n' +
    '  - OLLAMA_BASE_URL / OLLAMA_HOST (for local models)\n\n' +
    'Or pass --provider <openai|anthropic|gemini|ollama|mock> --api-key <key>\n' +
    'For offline dry-runs and testing, you can use: codeward review --provider mock'
  );
}
