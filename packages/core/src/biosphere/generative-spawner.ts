import { defineOrganicAgent, type OrganicAgent } from '../signal/organic-agent.js';
import type { Signal } from '../signal/signal.js';

interface GenerativeSpawnerConfig {
  llm: {
    chat(messages: Array<{ role: string; content: string }>): Promise<string>;
  };
  maxAgents?: number;
}

interface AgentBlueprint {
  id: string;
  name: string;
  receptor_patterns: string[];
  threshold?: number;
  voice?: string;
  purpose?: string;
}

interface SeedPlan {
  agents: AgentBlueprint[];
}

/**
 * GenerativeSpawner asks the LLM what agents are needed and materializes them
 * as OrganicAgents. No hardcoded roles or prompts live here; the LLM invents
 * the society from the scenario/distress itself.
 */
export class GenerativeSpawner {
  private readonly llm: GenerativeSpawnerConfig['llm'];
  private readonly maxAgents: number;

  constructor(config: GenerativeSpawnerConfig) {
    this.llm = config.llm;
    this.maxAgents = config.maxAgents ?? 5;
  }

  /**
   * Propose an initial set of agents for a goal/scenario.
   *
   * TASK-AGNOSTIC: The LLM discovers what perspectives/roles are needed
   * from the scenario itself, not from hardcoded templates.
   */
  async seedFromGoal(goal: string, existingAgents: OrganicAgent[] = []): Promise<OrganicAgent[]> {
    const names = existingAgents.map(a => a.name).join(', ') || 'none';
    const response = await this.llm.chat([
      {
        role: 'system',
        content:
          'You design agent societies that naturally emerge from scenarios.\n\n' +
          'Given a scenario, discover:\n' +
          '- What perspectives/viewpoints would naturally form?\n' +
          '- What domains of knowledge matter here?\n' +
          '- Who would need to talk to whom?\n' +
          '- What tensions or contradictions exist?\n\n' +
          'Create agents as thinking entities with:\n' +
          '- receptor_patterns: natural language they resonate with\n' +
          '- voice: their persona, expertise, and how they think\n\n' +
          'Let agents express confusion/uncertainty naturally in their own voice.\n' +
          'No prescribed vocabulary - they speak as they would.\n\n' +
          'Return JSON only. Keep IDs kebab-case.',
      },
      {
        role: 'user',
        content: [
          `Scenario: ${goal}`,
          `Existing agents: ${names}`,
          `Max agents desired: ${this.maxAgents}`,
          '',
          'Return JSON exactly like:',
          JSON.stringify({
            agents: [
              {
                id: 'perspective-example',
                name: 'Example Perspective',
                receptor_patterns: ['pattern1', 'pattern2', 'pattern3'],
                threshold: 0.6,
                voice: 'Describe how this agent thinks, their domain expertise, and their natural way of expressing thoughts.',
              },
            ],
          }),
        ].join('\n'),
      },
    ]);

    const plan = this.parsePlan(response);
    const agents = await this.materialize(plan.agents, existingAgents);
    return agents;
  }

  /**
   * Spawn a helper in response to a distress signal.
   */
  async spawnHelperForDistress(
    distressSignal: Signal,
    existingAgents: OrganicAgent[] = [],
  ): Promise<OrganicAgent | null> {
    const response = await this.llm.chat([
      {
        role: 'system',
        content:
          'You are an agent architect. Given a distress signal, invent ONE helper agent that would resolve it. ' +
          'Do not describe actions; define the agent itself with receptor patterns and a short voice. ' +
          'Return JSON only.',
      },
      {
        role: 'user',
        content: [
          'Distress signal:',
          distressSignal.thought,
          '',
          'Existing agents:',
          existingAgents.map(a => `${a.id} (${a.name})`).join(', ') || 'none',
          '',
          'Respond with:',
          JSON.stringify({
            agent: {
              id: 'conflict-resolver',
              name: 'Conflict Resolver',
              receptor_patterns: ['stuck', 'cannot decide', 'conflicting', 'paralyzed'],
              threshold: 0.55,
              voice: 'You untangle contradictions and offer trade-off options.',
            },
          }),
        ].join('\n'),
      },
    ]);

    const blueprint = this.parseHelper(response);
    if (!blueprint) return null;
    const [agent] = await this.materialize([blueprint], existingAgents);
    return agent ?? null;
  }

  private async materialize(blueprints: AgentBlueprint[], existingAgents: OrganicAgent[]): Promise<OrganicAgent[]> {
    const existingIds = new Set(existingAgents.map(a => a.id));
    const existingNames = new Set(existingAgents.map(a => a.name.toLowerCase()));

    return blueprints
      .slice(0, this.maxAgents)
      .filter(b => b?.id && Array.isArray(b.receptor_patterns) && b.receptor_patterns.length > 0)
      .filter(b => !existingIds.has(b.id) && !existingNames.has(b.name.toLowerCase()))
      .map(bp => {
        const prompt = this.buildVoice(bp);
        return defineOrganicAgent({
          id: bp.id,
          name: bp.name,
          receptorField: {
            patterns: bp.receptor_patterns,
            threshold: bp.threshold ?? 0.6,
          },
          systemPrompt: prompt,
          llm: this.llm,
        });
      });
  }

  private parsePlan(text: string): SeedPlan {
    const extracted = extractJson(text);
    const parsed = JSON.parse(extracted) as SeedPlan;
    if (!parsed || !Array.isArray(parsed.agents)) {
      throw new Error('Invalid seed plan from LLM');
    }
    return parsed;
  }

  private parseHelper(text: string): AgentBlueprint | null {
    try {
      const extracted = extractJson(text);
      const parsed = JSON.parse(extracted) as { agent?: AgentBlueprint };
      return parsed.agent ?? null;
    } catch (error) {
      return null;
    }
  }

  private buildVoice(bp: AgentBlueprint): string {
    const persona = bp.voice ?? bp.purpose ?? `You are ${bp.name}.`;
    return [
      persona,
      '',
      'Guidelines:',
      '- Think and speak naturally (no JSON, no structured output)',
      '- Express uncertainty, confusion, or conflict in your own natural voice',
      '- When you need help or see contradictions, say so naturally',
      '- Keep responses concise (2-4 sentences)',
    ].join('\n');
  }

}

function extractJson(text: string): string {
  const fenced = text.match(/```json\\s*([\\s\\S]*?)\\s*```/i);
  if (fenced?.[1]) return fenced[1];

  const rawFence = text.match(/```\\s*([\\s\\S]*?)\\s*```/);
  if (rawFence?.[1]) return rawFence[1];

  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) return text.slice(first, last + 1);

  return text;
}
