import { describe, expect, it } from 'vitest';
import { createSeeAgent } from './see-agent.js';
import { createMolecule } from '@homunculus/core';

describe('createSeeAgent', () => {
  it('emits perception molecules when stimulated', async () => {
    const agent = createSeeAgent({ tags: ['input'] });
    const emissions = [];
    for await (const emitted of agent.metabolize?.(
      createMolecule({
        signature: { intent: 'input', tags: ['input'] },
        payload: 'hello',
        emittedBy: 'tester',
      }),
    ) ?? []) {
      emissions.push(emitted);
    }

    expect(emissions).toHaveLength(1);
    expect(emissions[0]?.signature.intent).toBe('perception');
    expect((emissions[0]?.payload as any).content).toBe('hello');
  });
});
