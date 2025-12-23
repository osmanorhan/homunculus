import { describe, expect, it, vi } from 'vitest';
import { calculateSemanticDistance } from './distance.js';
import { LLMError } from '../llm/client.js';
import { createEmitter, createReceptor } from '@homunculus-live/core';

class StubLLM {
  constructor(private readonly embedding: number[]) {}
  embed = vi.fn(async () => this.embedding);
}

describe('calculateSemanticDistance', () => {
  it('prefers matches with overlapping tags and close embeddings', async () => {
    const emitter = createEmitter({ intent: 'numbers', tags: ['data'], embedding: [1, 0] });
    const receptor = createReceptor({ desire: 'numbers', tags: ['data', 'stream'], embedding: [1, 0] });
    const llm = new StubLLM([0, 0]); // should not be used

    const distance = await calculateSemanticDistance(emitter, receptor, llm as any);

    expect(distance).toBeCloseTo(0.2, 3); // tag distance 0.5 * 0.4 weight = 0.2
    expect(llm.embed).not.toHaveBeenCalled();
  });

  it('falls back to embeddings when tags are empty', async () => {
    const emitter = createEmitter({ intent: 'data', tags: [] });
    const receptor = createReceptor({ desire: 'data', tags: [] });
    const llm = new StubLLM([1, 0]);

    const distance = await calculateSemanticDistance(emitter, receptor, llm as any, { tagWeight: 0.2 });

    expect(distance).toBeCloseTo(0.2, 5); // tagDistance 1 with tagWeight 0.2, embedding distance 0
    expect(llm.embed).toHaveBeenCalledTimes(2);
  });

  it('clamps weights and similarities into [0,1]', async () => {
    const emitter = createEmitter({ intent: 'a', tags: ['x'], embedding: [1, 0] });
    const receptor = createReceptor({ desire: 'b', tags: ['y'], embedding: [0, 1] });
    const llm = new StubLLM([1, 1]); // unused

    const distance = await calculateSemanticDistance(emitter, receptor, llm as any, { tagWeight: 5 });

    // tagDistance 1, embeddingDistance 1, weights clamp to 1 and 0 respectively -> distance 1
    expect(distance).toBe(1);
  });

  it('falls back to tag-only distance when embeddings are forbidden', async () => {
    const emitter = createEmitter({ intent: 'numbers', tags: ['data'] });
    const receptor = createReceptor({ desire: 'numbers', tags: ['data'] });
    const llm = {
      embed: vi.fn(async () => undefined),
    };

    const distance = await calculateSemanticDistance(emitter, receptor, llm as any, { tagWeight: 0.4 });

    expect(distance).toBeCloseTo(0.6); // tagDistance 0 -> 0, embeddingDistance treated as 1 with weight 0.6
    expect(llm.embed).toHaveBeenCalledTimes(2);
  });
});
