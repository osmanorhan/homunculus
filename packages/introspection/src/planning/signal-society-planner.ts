import { defineOrganicAgent, type OrganicAgent } from '@homunculus-live/core';
import type { LLMClient } from '@homunculus-live/semantic-engine';

export interface SignalSocietyPlan {
  version: 'v1-signal';
  goal: string;
  agents: Array<{
    id: string;
    name: string;
    receptor_patterns: string[];
    threshold?: number;
    voice?: string;
  }>;
}

export interface SignalSocietyPlannerOptions {
  llm: LLMClient;
  maxAgents?: number;
  debug?: boolean;
}

/**
 * Signal-based society planner: emits JSON plan as a signal.
 */
export function createSignalSocietyPlanner(options: SignalSocietyPlannerOptions): OrganicAgent {
  const { llm, maxAgents = 5, debug = false } = options;
  const planned = new Set<string>();

  return defineOrganicAgent({
    id: 'signal-society-planner',
    name: 'Signal Society Planner',
    receptorField: {
      patterns: ['task', 'goal', 'scenario', 'analyzed-intent'],
    },
    systemPrompt: [
      'You are a society planner that designs organic agents for a signal-based biosphere.',
      'Given a goal, describe what specialized agents would help achieve it.',
      'For each agent, naturally explain:',
      '- The agent\'s name and role',
      '- What patterns/concerns they should respond to',
      '- Their expertise or perspective',
      '',
      'Then provide the technical specification as JSON at the end.',
      'Use kebab-case ids. Threshold should be 0.5-0.7 (default: 0.6).',
    ].join('\n'),
    async *emit(signal) {
      if (!signal) return;
      const goal = signal.thought.trim();
      if (!goal || planned.has(goal)) return;
      planned.add(goal);

      if (debug) {
        // eslint-disable-next-line no-console
        console.log('[signal-society-planner] planning for goal');
      }

      const prompt = [
        this.systemPrompt,
        '',
        `Goal: ${goal}`,
        `Max agents: ${maxAgents}`,
        '',
        'Schema:',
        JSON.stringify({
          version: 'v1-signal',
          goal: '...',
          agents: [
            {
              id: 'decision-weaver',
              name: 'Decision Weaver',
              receptor_patterns: ['recommendation', 'decision', 'analysis'],
              threshold: 0.55,
              voice: 'Make calls; if stuck, say what you need.',
            },
          ],
        }),
      ].join('\n');

      const response = await llm.chat([{ role: 'user', content: prompt }]);

      // Extract JSON from response (might be wrapped in natural language)
      let plan: SignalSocietyPlan | undefined;
      try {
        // Try to find JSON in the response
        const jsonMatch = response.match(/\{[\s\S]*?"version"[\s\S]*?\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : response;
        plan = JSON.parse(jsonString) as SignalSocietyPlan;
      } catch {
        if (debug) {
          // eslint-disable-next-line no-console
          console.log('[signal-society-planner] Could not parse plan from LLM response');
        }
        plan = {
          version: 'v1-signal',
          goal,
          agents: [],
        };
      }

      // Emit natural language explanation with embedded JSON for factory
      const agentNames = plan.agents.map(a => a.name).join(', ');
      const agentCount = plan.agents.length;

      if (agentCount === 0) {
        yield `I tried to design a society plan for "${goal}" but couldn't generate valid agents. The goal may need clarification.`;
      } else {
        yield `I've designed a society plan for the goal: "${plan.goal}". The plan includes ${agentCount} specialized agents: ${agentNames}. Technical specification: ${JSON.stringify(plan)}`;
      }
    },
    llm,
  });
}
