import { describe, expect, it, vi } from 'vitest';
import { LLMClient, LLMError } from './client.js';

const okResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

describe('LLMClient', () => {
  it('sends embed requests with auth header and uses embeddingModel override', async () => {
    const fetchMock = vi.fn(async () => okResponse({ data: [{ embedding: [0.1, 0.2] }] }));
    const client = new LLMClient({
      baseURL: 'https://api.example.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
      embeddingModel: 'embed-model',
      fetch: fetchMock as unknown as typeof fetch,
    });

    const embedding = await client.embed('hello world');

    expect(embedding).toEqual([0.1, 0.2]);
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/v1/embeddings', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
    }));
    expect((client as any).config.embeddingModel).toBe('embed-model');
  });

  it('calls chat under transform and surfaces content', async () => {
    const fetchMock = vi.fn(async () =>
      okResponse({
        choices: [{ message: { content: 'transformed-result' } }],
      }),
    );
    const client = new LLMClient({
      baseURL: 'https://api.example.com',
      model: 'test-model',
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await client.transform('Summarize', { foo: 'bar' });

    expect(result).toBe('transformed-result');
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body).toMatchObject({
      model: 'test-model',
      messages: [{ role: 'user', content: expect.stringContaining('Summarize') }],
    });
  });

  it('throws LLMError on non-ok responses', async () => {
    const fetchMock = vi.fn(async () => new Response('bad', { status: 500 }));
    const client = new LLMClient({
      baseURL: 'https://api.example.com',
      model: 'test-model',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(client.embed('text')).rejects.toBeInstanceOf(LLMError);
  });
});
