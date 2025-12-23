import { defineOrganicAgent, type OrganicAgent } from '@homunculus-live/core';
import type { LLMClient } from '@homunculus-live/semantic-engine';
import type { SignalSocietyPlan } from './signal-society-planner.js';

export interface SignalAgentFactoryOptions {
  llm: LLMClient;
  birth: (agent: OrganicAgent) => void;
  debug?: boolean;
}

/**
 * Signal-based agent factory: materializes organic agents from a plan signal.
 */
export function createSignalAgentFactory(options: SignalAgentFactoryOptions): OrganicAgent {
  const { llm, birth, debug = false } = options;
  const spawned = new Set<string>();

  return defineOrganicAgent({
    id: 'signal-agent-factory',
    name: 'Signal Agent Factory',
    receptorField: {
      patterns: ['agent-plan', 'society plan', 'plan', 'specialized agents', 'designed'],
    },
    systemPrompt: [
      'You are an agent factory. When you perceive a society plan or agent specification,',
      'extract the agent details and report what you will spawn.',
      'Look for: agent names, their concerns/patterns, and expertise.',
      'If you cannot find valid specifications, explain what is missing.',
    ].join('\n'),
    async *emit(signal) {
      if (!signal) return;

      if (debug) {
        // eslint-disable-next-line no-console
        console.log('[signal-agent-factory] Processing signal for agent specifications...');
      }

      // Ask LLM to extract plan from the signal (semantic extraction)
      const extractionPrompt = [
        'Extract agent spawn specifications from this signal.',
        'Look for descriptions of specialized agents to create.',
        'Return ONLY a JSON object with this structure:',
        '{ "version": "v1-signal", "goal": "brief goal", "agents": [',
        '  {"id": "kebab-case-id", "name": "Agent Name", "receptor_patterns": ["pattern1", "pattern2"], "threshold": 0.6, "voice": "brief persona"}',
        ']}',
        '',
        'If you cannot find agent specifications, return: {"version": "v1-signal", "goal": "", "agents": []}',
        '',
        `Signal to analyze:\n${signal.thought}`,
      ].join('\n');

      let planResponse: string;
      try {
        planResponse = await llm.chat([{ role: 'user', content: extractionPrompt }]);
      } catch (error) {
        console.error('[signal-agent-factory] LLM call failed:', error);
        yield `I tried to extract agent specifications but the LLM call failed: ${error}`;
        return;
      }

      // Parse the extracted plan
      let plan: SignalSocietyPlan;
      try {
        // Extract JSON (might be wrapped in markdown code blocks)
        let jsonString = planResponse.trim();
        const codeBlockMatch = jsonString.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonString = codeBlockMatch[1];
        } else {
          const jsonMatch = jsonString.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            jsonString = jsonMatch[0];
          }
        }

        plan = JSON.parse(jsonString) as SignalSocietyPlan;
      } catch (error) {
        console.error('[signal-agent-factory] Failed to parse plan from LLM response:', error);
        console.error('[signal-agent-factory] LLM response was:', planResponse.slice(0, 300));
        yield `I received a plan signal but could not parse the agent specifications. The format was invalid. Original signal: "${signal.thought.slice(0, 100)}..."`;
        return;
      }

      // Validate plan structure
      if (!plan.version || plan.version !== 'v1-signal') {
        console.warn('[signal-agent-factory] Invalid plan version:', plan.version);
        yield `I received a plan but it has an invalid version. Expected "v1-signal" but got "${plan.version || 'none'}".`;
        return;
      }

      if (!Array.isArray(plan.agents)) {
        console.warn('[signal-agent-factory] Plan agents field is not an array');
        yield `I received a plan but the agents field is malformed.`;
        return;
      }

      if (plan.agents.length === 0) {
        if (debug) {
          // eslint-disable-next-line no-console
          console.log('[signal-agent-factory] No agents found in plan');
        }
        yield `I analyzed the signal but could not identify any agents to spawn. The plan appears empty.`;
        return;
      }

      // Check if already spawned
      const planKey = plan.goal || signal.thought.slice(0, 50);
      if (spawned.has(planKey)) {
        if (debug) {
          // eslint-disable-next-line no-console
          console.log(`[signal-agent-factory] Already spawned agents for: ${planKey}`);
        }
        return;
      }

      spawned.add(planKey);

      console.log(`\n[signal-agent-factory] ✨ Spawning ${plan.agents.length} agents${plan.goal ? ` for: ${plan.goal}` : ''}`);

      // Spawn each agent
      let spawnedCount = 0;
      for (const spec of plan.agents) {
        try {
          // Validate spec
          if (!spec.id || !spec.name || !Array.isArray(spec.receptor_patterns)) {
            console.warn(`[signal-agent-factory] Invalid agent spec, skipping:`, spec);
            continue;
          }

          const agent = defineOrganicAgent({
            id: spec.id,
            name: spec.name,
            receptorField: {
              patterns: spec.receptor_patterns,
              threshold: spec.threshold ?? 0.6,
            },
            systemPrompt:
              spec.voice ??
              `You are ${spec.name}. Speak naturally and thoughtfully. When you encounter uncertainty or need specific expertise you don't have, clearly state what information or perspective would help you proceed.`,
            llm,
          });
          birth(agent);
          spawnedCount++;
        } catch (error) {
          console.error(`[signal-agent-factory] Failed to spawn agent ${spec.name}:`, error);
        }
      }

      // Emit natural language confirmation
      const agentNames = plan.agents.map(a => a.name).join(', ');
      yield `I've successfully spawned ${spawnedCount} agents: ${agentNames}. They are now active and ready to contribute.`;
    },
    llm,
  });
}
