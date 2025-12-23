import { describe, expect, it } from 'vitest';
import { defineMetaObserver } from '@homunculus/core';

describe('defineMetaObserver', () => {
  it('respects shouldConsiderSignal filter', async () => {
    const observer = defineMetaObserver({
      llm: {
        async chat() {
          return 'no distress detected';
        },
        async embed() {
          return [0];
        },
      },
      shouldConsiderSignal() {
        return false;
      },
    });

    await observer.perceive({
      id: 'signal-1',
      thought: 'stuck and cannot proceed',
      emittedBy: 'user',
      pheromone: [1],
      timestamp: Date.now(),
    });

    expect(observer.getContext?.()).toEqual([]);
  });
});

