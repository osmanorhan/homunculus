import { describe, expect, it } from 'vitest';
import { FrameRegistry, type AgentFrame } from '@homunculus/core';

function createToyEmbedder() {
  return async (text: string): Promise<number[]> => {
    const t = text.toLowerCase();
    const has = (s: string) => (t.includes(s) ? 1 : 0);
    return [
      has('debug') + has('stack') + has('fail') + has('test'),
      has('spec') + has('require') + has('clarify') + has('scope'),
      has('research') + has('docs') + has('unknown') + has('api'),
    ];
  };
}

describe('FrameRegistry', () => {
  it('returns the best matching frame', async () => {
    const registry = new FrameRegistry({ embed: createToyEmbedder(), minSimilarity: 0.1 });

    const frames: AgentFrame[] = [
      {
        id: 'frame-debugger',
        description: 'Used when tests are failing and logs are cryptic',
        systemPromptTemplate: 'You are a debugger.',
        receptorPatterns: ['error', 'fail', 'stacktrace'],
        requiredMotorSkills: ['file-read', 'grep', 'test-run'],
        slots: {
          target_file: { description: 'File to investigate', defaultValue: null },
          error_message: { description: 'Observed error output', defaultValue: null },
        },
      },
      {
        id: 'frame-specifier',
        description: 'Used at the start of tasks to clarify requirements',
        systemPromptTemplate: 'You are a pedantic specifier.',
        receptorPatterns: ['requirements', 'clarify', 'acceptance criteria'],
        requiredMotorSkills: [],
      },
      {
        id: 'frame-librarian',
        description: 'Used when an API is unknown or documentation is needed',
        systemPromptTemplate: 'You are a careful researcher.',
        receptorPatterns: ['docs', 'api', 'reference'],
        requiredMotorSkills: ['doc-read'],
      },
    ];

    await registry.registerMany(frames);

    const best = await registry.best('stacktrace: tests fail after upgrade');
    expect(best?.frame.id).toBe('frame-debugger');
    expect(best?.similarity).toBeGreaterThan(0);
  });

  it('supports topK queries sorted by similarity', async () => {
    const registry = new FrameRegistry({ embed: createToyEmbedder(), minSimilarity: 0 });

    await registry.registerMany([
      {
        id: 'frame-a',
        description: 'debug fail stack',
        systemPromptTemplate: 'A',
        receptorPatterns: ['debug'],
      },
      {
        id: 'frame-b',
        description: 'docs research api',
        systemPromptTemplate: 'B',
        receptorPatterns: ['docs'],
      },
      {
        id: 'frame-c',
        description: 'spec clarify require',
        systemPromptTemplate: 'C',
        receptorPatterns: ['spec'],
      },
    ]);

    const matches = await registry.query('need docs for unknown api', { topK: 2, minSimilarity: 0 });
    expect(matches).toHaveLength(2);
    expect(matches[0]!.similarity).toBeGreaterThanOrEqual(matches[1]!.similarity);
    expect(matches[0]!.frame.id).toBe('frame-b');
  });
});
