import { defineOrganicAgent, type OrganicAgent } from '@homunculus/core';
import type { LLMClient } from '@homunculus/semantic-engine';

export interface SignalIntentAnalysis {
  actionableGoal: string;
  observations: string;
  context: string;
  keywords: string[];
}

export interface SignalIntentAnalyzerOptions {
  llm: LLMClient;
  debug?: boolean;
}

/**
 * Signal-based intent analyzer: consumes raw signals (thought text) and emits a clarified intent signal.
 */
export function createSignalIntentAnalyzer(options: SignalIntentAnalyzerOptions): OrganicAgent {
  const { llm, debug = false } = options;
  const analyzed = new Set<string>();

  return defineOrganicAgent({
    id: 'signal-intent-analyzer',
    name: 'Signal Intent Analyzer',
    receptorField: {
      patterns: ['task', 'goal', 'scenario', 'question', 'problem'],
    },
    systemPrompt: [
      'You are an intent analyzer for an autonomous multi-agent system.',
      'Given a user signal (thought), extract and clarify the TRUE actionable goal.',
      'Respond in 2-3 sentences of natural language that summarizes:',
      '- What is the core actionable goal?',
      '- What are the key observations or constraints?',
      '- What is the relevant context?',
      '',
      'Example:',
      'Input: "We need to launch but there is a security issue"',
      'Output: "I\'ve analyzed the signal. The actionable goal is to decide whether to proceed with launch despite a security issue. Key observations: there is tension between business urgency and security risk. Context: time-sensitive decision under conflicting constraints."',
      '',
      'Respond ONLY in natural language, no JSON.',
    ].join('\n'),
    async *emit(signal) {
      if (!signal) return;
      const raw = signal.thought.trim();
      if (!raw) return;
      if (analyzed.has(raw)) return;
      analyzed.add(raw);

      if (debug) {
        // eslint-disable-next-line no-console
        console.log('[signal-intent-analyzer] analyzing signal');
      }

      const response = await llm.chat([
        { role: 'user', content: `${this.systemPrompt}\n\nUser signal:\n${raw}` },
      ]);

      // Emit the LLM's natural language analysis directly
      yield response.trim();
    },
    llm,
  });
}
