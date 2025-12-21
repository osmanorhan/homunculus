export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

export interface LLMClientConfig {
  baseURL: string;
  apiKey?: string;
  model: string;
  embeddingModel?: string;
  fetch?: typeof fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

interface EmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
}

export class LLMClient {
  private readonly fetchImpl: typeof fetch;
  private readonly config: Required<Pick<LLMClientConfig, 'baseURL' | 'model'>> &
    Omit<LLMClientConfig, 'baseURL' | 'model'>;

  constructor(config: LLMClientConfig) {
    this.config = {
      ...config,
      embeddingModel: config.embeddingModel ?? config.model,
    };
    this.fetchImpl = config.fetch ?? globalThis.fetch?.bind(globalThis);
    if (!this.fetchImpl) {
      throw new LLMError('Fetch implementation is required');
    }
  }

  async embed(text: string, options: RequestOptions = {}): Promise<number[]> {
    const model = this.config.embeddingModel ?? this.config.model;
    const response = await this.postJSON<EmbeddingResponse>(
      '/embeddings',
      {
        model,
        input: text,
      },
      options.signal,
    );

    const embedding = response.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      throw new LLMError('Embedding response missing embedding vector');
    }
    return embedding;
  }

  async transform(prompt: string, data: unknown, options: RequestOptions = {}): Promise<unknown> {
    const rendered = `${prompt}\n\nData:\n${typeof data === 'string' ? data : JSON.stringify(data)}`;
    const content = await this.chat([{ role: 'user', content: rendered }], options);
    return content;
  }

  async chat(messages: ChatMessage[], options: RequestOptions = {}): Promise<string> {
    const response = await this.postJSON<ChatCompletionResponse>(
      '/chat/completions',
      {
        model: this.config.model,
        messages,
      },
      options.signal,
    );

    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new LLMError('Chat response missing content');
    }
    return content;
  }

  private async postJSON<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const url = this.buildURL(path);
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const text = await safeReadText(response);
      throw new LLMError(`LLM request failed with status ${response.status}: ${text}`, response.status);
    }

    return response.json() as Promise<T>;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  private buildURL(path: string): string {
    const base = this.config.baseURL.replace(/\/+$/, '');
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${base}${suffix}`;
  }
}

export class LLMError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'LLMError';
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return `unable to read response body: ${String(error)}`;
  }
}
