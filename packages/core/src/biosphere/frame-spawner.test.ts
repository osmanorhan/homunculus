import { describe, expect, it } from 'vitest';
import {
  FrameRegistry,
  FrameSpawner,
  MotorSkillRegistry,
  defineOrganicAgent,
  type MotorSkill,
} from '@homunculus/core';

const llm = {
  async chat(_messages: Array<{ role: string; content: string }>) {
    return 'ok';
  },
};

function createToyEmbedder() {
  return async (text: string): Promise<number[]> => {
    const t = text.toLowerCase();
    return [t.includes('debug') ? 1 : 0, t.includes('spec') ? 1 : 0, t.includes('docs') ? 1 : 0];
  };
}

const readSkill: MotorSkill<string, string> = {
  id: 'file-read',
  name: 'File Read',
  description: 'Reads a file.',
  async execute(input) {
    return input;
  },
};

describe('FrameSpawner', () => {
  it('spawns an agent from the best matching frame', async () => {
    const frameRegistry = new FrameRegistry({ embed: createToyEmbedder(), minSimilarity: 0.1 });
    await frameRegistry.register({
      id: 'frame-debugger',
      description: 'Used when tests fail',
      systemPromptTemplate: 'You are a debugger.',
      receptorPatterns: ['error', 'fail'],
      requiredMotorSkills: ['file-read'],
    });

    const skillRegistry = new MotorSkillRegistry();
    skillRegistry.register(readSkill);

    const spawner = new FrameSpawner({
      llm,
      frameRegistry,
      skillRegistry,
    });

    const agent = await spawner.spawnHelperForDistress(
      {
        id: 'signal-1',
        thought: 'debug failing tests',
        emittedBy: 'user',
        pheromone: [1, 0, 0],
        timestamp: Date.now(),
      },
      [],
    );

    expect(agent).not.toBeNull();
    expect(agent?.motorSkills).toHaveLength(1);
    expect(agent?.motorSkills[0]?.id).toBe('file-read');
  });

  it('falls back when required skills are missing', async () => {
    const frameRegistry = new FrameRegistry({ embed: createToyEmbedder(), minSimilarity: 0.1 });
    await frameRegistry.register({
      id: 'frame-debugger',
      description: 'Used when tests fail',
      systemPromptTemplate: 'You are a debugger.',
      receptorPatterns: ['error', 'fail'],
      requiredMotorSkills: ['file-read'],
    });

    const fallbackAgent = defineOrganicAgent({
      id: 'fallback',
      name: 'Fallback',
      receptorField: { patterns: ['fallback'] },
      systemPrompt: 'Fallback agent.',
      llm,
    });

    const spawner = new FrameSpawner({
      llm,
      frameRegistry,
      requireAllSkills: true,
      fallbackSpawner: {
        async spawnHelperForDistress() {
          return fallbackAgent;
        },
      },
    });

    const agent = await spawner.spawnHelperForDistress(
      {
        id: 'signal-1',
        thought: 'debug failing tests',
        emittedBy: 'user',
        pheromone: [1, 0, 0],
        timestamp: Date.now(),
      },
      [],
    );

    expect(agent?.id).toBe('fallback');
  });
});
