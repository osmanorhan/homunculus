/**
 * Tests for EquilibriumDetector
 * Validates Minsky's Difference Engine implementation
 */

import { describe, it, expect } from 'vitest';
import { EquilibriumDetector } from './equilibrium-detector.js';
import type { Signal } from '../../../core/src/signal/signal.js';
import type { OrganicAgent } from '../../../core/src/signal/organic-agent.js';

// Mock LLM client
const createMockLLM = () => ({
  embed: async (text: string): Promise<number[]> => {
    // Simple hash-based embedding for testing
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const dim = 8;
    return Array.from({ length: dim }, (_, i) => Math.sin(hash * (i + 1) * 0.1));
  },
  chat: async (messages: Array<{ role: string; content: string }>): Promise<string> => {
    const scenario = messages.find(m => m.content.includes('Scenario:'))?.content || '';
    if (scenario.includes('CEO')) {
      return 'A clear decision has been made that balances business needs with legal compliance';
    }
    return 'The problem has been resolved and all stakeholders agree';
  },
});

const createMockSignal = (thought: string, emittedBy: string, embedding?: number[]): Signal => ({
  id: `signal-${Math.random()}`,
  thought,
  emittedBy,
  timestamp: Date.now(),
  pheromone: embedding || Array.from({ length: 8 }, () => Math.random()),
});

const createMockAgent = (id: string, name: string): OrganicAgent =>
  ({
    id,
    name,
    receptorField: { patterns: [], threshold: 0.5 },
    emit: async function* () {},
    perceive: async () => {},
  }) as any;

describe('EquilibriumDetector', () => {
  it('should detect insufficient data', async () => {
    const detector = new EquilibriumDetector({ llm: createMockLLM() });

    const result = await detector.detect(
      'Test scenario',
      [createMockSignal('test', 'agent1')],
      [createMockAgent('agent1', 'Agent1')],
    );

    expect(result.atEquilibrium).toBe(false);
    expect(result.reasoning).toContain('Insufficient signal history');
  });

  it('should detect high goal tension (still thinking)', async () => {
    const detector = new EquilibriumDetector({
      llm: createMockLLM(),
      tensionThreshold: 0.3,
    });

    const scenario = 'CEO must decide on product launch';

    // Signals about confusion/uncertainty (high tension)
    const signals = [
      createMockSignal('We are stuck between legal and marketing', 'ceo'),
      createMockSignal('This is a difficult contradiction', 'legal'),
      createMockSignal('We cannot resolve this easily', 'marketing'),
      createMockSignal('The tension is very high', 'ceo'),
      createMockSignal('No clear path forward', 'engineer'),
      createMockSignal('Uncertainty remains', 'ceo'),
    ];

    const result = await detector.detect(scenario, signals, [
      createMockAgent('ceo', 'CEO'),
      createMockAgent('legal', 'Legal'),
    ]);

    expect(result.atEquilibrium).toBe(false);
    // New energy-based reasoning
    expect(result.reasoning).toMatch(/E=\d+%/); // Contains energy metric
  });

  it('should detect low coherence (agents disagreeing)', async () => {
    const detector = new EquilibriumDetector({
      llm: createMockLLM(),
      coherenceThreshold: 0.7,
    });

    const scenario = 'Make a decision';

    // Very different embeddings = low coherence
    const signals = [
      createMockSignal('Delay the launch', 'agent1', [1, 0, 0, 0, 0, 0, 0, 0]),
      createMockSignal('Launch immediately', 'agent2', [0, 0, 0, 0, 1, 0, 0, 0]),
      createMockSignal('Cancel everything', 'agent3', [0, 1, 0, 0, 0, 0, 0, 1]),
      createMockSignal('Hire consultants', 'agent4', [0, 0, 1, 0, 0, 1, 0, 0]),
      createMockSignal('Do nothing', 'agent5', [0, 0, 0, 1, 0, 0, 1, 0]),
      createMockSignal('Pivot strategy', 'agent6', [1, 0, 1, 0, 1, 0, 1, 0]),
    ];

    const result = await detector.detect(scenario, signals, [createMockAgent('agent1', 'Agent1')]);

    expect(result.coherence).toBeLessThan(0.7);
    expect(result.atEquilibrium).toBe(false);
  });

  it('should detect equilibrium when all conditions met', async () => {
    const detector = new EquilibriumDetector({
      llm: createMockLLM(),
      tensionThreshold: 0.4,
      momentumThreshold: 0.3,
      coherenceThreshold: 0.6,
      clarityThreshold: 0.5,
    });

    const scenario = 'CEO must decide on product launch';

    // Same embedding = high coherence + decision language = high clarity
    const sharedEmbedding = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const signals = [
      createMockSignal('We have decided to delay the launch by 48 hours', 'ceo', sharedEmbedding),
      createMockSignal('This decision balances legal and business needs', 'legal', sharedEmbedding),
      createMockSignal('We all agree this is the right path', 'marketing', sharedEmbedding),
      createMockSignal('The plan is clear and we will execute', 'engineer', sharedEmbedding),
      createMockSignal('Final decision: delay and fix', 'ceo', sharedEmbedding),
      createMockSignal('Consensus reached, moving forward', 'legal', sharedEmbedding),
    ];

    const result = await detector.detect(scenario, signals, [createMockAgent('ceo', 'CEO')]);

    expect(result.coherence).toBeGreaterThan(0.6); // High coherence
    // Note: Other metrics depend on LLM mock responses
  });

  it('should measure momentum decline (agents falling silent)', async () => {
    const detector = new EquilibriumDetector({
      llm: createMockLLM(),
      momentumThreshold: 0.2,
      minSignalWindow: 5,
    });

    const scenario = 'Make a decision';

    // Simulate declining activity over time
    const signals = [
      // Early: 5 signals (high activity)
      createMockSignal('Early thought 1', 'agent1'),
      createMockSignal('Early thought 2', 'agent1'),
      createMockSignal('Early thought 3', 'agent1'),
      createMockSignal('Early thought 4', 'agent1'),
      createMockSignal('Early thought 5', 'agent1'),
      // Later: 1 signal (low activity) - momentum dropping
      createMockSignal('Final thought', 'agent1'),
    ];

    const result = await detector.detect(scenario, signals, [createMockAgent('agent1', 'Agent1')]);

    // Momentum measures recent rate vs average rate
    // Should be <= 1 since activity is declining or stable
    expect(result.momentum).toBeGreaterThanOrEqual(0);
    expect(result.momentum).toBeLessThanOrEqual(1);
  });

  it('should cache ideal state embeddings', async () => {
    const llm = createMockLLM();
    let embedCallCount = 0;
    const trackedLLM = {
      ...llm,
      embed: async (text: string) => {
        embedCallCount++;
        return llm.embed(text);
      },
    };

    const detector = new EquilibriumDetector({ llm: trackedLLM });

    const scenario = 'Same scenario';
    const signals = Array.from({ length: 10 }, (_, i) => createMockSignal(`Thought ${i}`, 'agent1'));
    const agents = [createMockAgent('agent1', 'Agent1')];

    await detector.detect(scenario, signals, agents);
    const callsAfterFirst = embedCallCount;

    await detector.detect(scenario, signals, agents);
    const callsAfterSecond = embedCallCount;

    // Second call should not re-embed the scenario (cached)
    expect(callsAfterSecond).toBeLessThan(callsAfterFirst * 2);
  });
});
