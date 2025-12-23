import type { OrganicSpawner } from './biosphere.js';
import type { Signal } from '../signal/signal.js';
import { defineOrganicAgent, type OrganicAgent } from '../signal/organic-agent.js';
import { generateId } from '../utils/id.js';
import type { AgentFrame } from '../frames/agent-frame.js';
import { FrameRegistry } from '../frames/frame-registry.js';
import { MotorSkillRegistry } from '../skills/motor-skill-registry.js';
import type { MotorSkill } from '../skills/motor-skill.js';
import { applySkillPolicy, type SkillPolicy } from '../skills/skill-policy.js';

export interface FrameSpawnerContext {
  goal?: string;
  distressSignal?: Signal;
  existingAgents?: OrganicAgent[];
}

export interface FrameSpawnerOptions {
  llm: {
    chat(messages: Array<{ role: string; content: string }>): Promise<string>;
  };
  frameRegistry: FrameRegistry;
  skillRegistry?: MotorSkillRegistry;
  skillPolicy?: SkillPolicy;
  fillSlots?: (frame: AgentFrame, context: FrameSpawnerContext) => Promise<Record<string, unknown>> | Record<string, unknown>;
  minSimilarity?: number;
  requireAllSkills?: boolean;
  allowDuplicateFrames?: boolean;
  fallbackSpawner?: OrganicSpawner;
}

/**
 * Frame-aware spawner:
 * - Retrieves a frame by semantic match
 * - Fills slots (if configured)
 * - Instantiates an agent with required motor skills
 *
 * Framework-level only: no persistence, no task-specific frames.
 */
export class FrameSpawner implements OrganicSpawner {
  private readonly llm: FrameSpawnerOptions['llm'];
  private readonly frameRegistry: FrameRegistry;
  private readonly skillRegistry?: MotorSkillRegistry;
  private readonly fillSlots?: FrameSpawnerOptions['fillSlots'];
  private readonly skillPolicy?: SkillPolicy;
  private readonly minSimilarity?: number;
  private readonly requireAllSkills: boolean;
  private readonly allowDuplicateFrames: boolean;
  private readonly fallbackSpawner?: OrganicSpawner;

  constructor(options: FrameSpawnerOptions) {
    this.llm = options.llm;
    this.frameRegistry = options.frameRegistry;
    this.skillRegistry = options.skillRegistry;
    this.fillSlots = options.fillSlots;
    this.skillPolicy = options.skillPolicy;
    this.minSimilarity = options.minSimilarity;
    this.requireAllSkills = options.requireAllSkills ?? true;
    this.allowDuplicateFrames = options.allowDuplicateFrames ?? false;
    this.fallbackSpawner = options.fallbackSpawner;
  }

  async seedFromGoal(goal: string, existingAgents: OrganicAgent[] = []): Promise<OrganicAgent[]> {
    const match = await this.frameRegistry.best(goal, { minSimilarity: this.minSimilarity });
    if (!match) {
      return this.fallbackSpawner?.seedFromGoal
        ? this.fallbackSpawner.seedFromGoal(goal, existingAgents)
        : [];
    }

    const agent = await this.materialize(match.frame, { goal, existingAgents });
    if (!agent) {
      return this.fallbackSpawner?.seedFromGoal
        ? this.fallbackSpawner.seedFromGoal(goal, existingAgents)
        : [];
    }

    return [agent];
  }

  async spawnHelperForDistress(
    distressSignal: Signal,
    existingAgents: OrganicAgent[] = [],
  ): Promise<OrganicAgent | null> {
    const match = await this.frameRegistry.best(distressSignal.thought, { minSimilarity: this.minSimilarity });
    if (!match) {
      return this.fallbackSpawner?.spawnHelperForDistress
        ? this.fallbackSpawner.spawnHelperForDistress(distressSignal, existingAgents)
        : null;
    }

    const agent = await this.materialize(match.frame, { distressSignal, existingAgents });
    if (!agent) {
      return this.fallbackSpawner?.spawnHelperForDistress
        ? this.fallbackSpawner.spawnHelperForDistress(distressSignal, existingAgents)
        : null;
    }

    return agent;
  }

  private async materialize(frame: AgentFrame, context: FrameSpawnerContext): Promise<OrganicAgent | null> {
    if (!this.allowDuplicateFrames && this.hasFrameInstance(frame, context.existingAgents ?? [])) {
      return null;
    }

    const slotValues = await this.resolveSlots(frame, context);
    if (slotValues === null) return null;

    const motorSkills = this.resolveSkills(frame);
    if (motorSkills === null) return null;

    const systemPrompt = applySlots(frame.systemPromptTemplate, slotValues);
    const agentId = `${frame.id}-${generateId().slice(0, 6)}`;
    const agentName = frame.id;

    const guardedSkills = this.skillPolicy
      ? motorSkills.map(skill => applySkillPolicy(skill, this.skillPolicy!, { agentId, agentName }))
      : motorSkills;

    return defineOrganicAgent({
      id: agentId,
      name: agentName,
      receptorField: { patterns: frame.receptorPatterns },
      systemPrompt,
      motorSkills: guardedSkills,
      llm: this.llm,
    });
  }

  private async resolveSlots(frame: AgentFrame, context: FrameSpawnerContext): Promise<Record<string, unknown> | null> {
    const slots = frame.slots ?? {};
    const defaults: Record<string, unknown> = {};

    for (const [key, definition] of Object.entries(slots)) {
      defaults[key] = definition.defaultValue ?? null;
    }

    const filled = this.fillSlots ? await this.fillSlots(frame, context) : {};
    const merged = { ...defaults, ...filled };

    for (const [key, definition] of Object.entries(slots)) {
      if (definition.required && (merged[key] === null || merged[key] === undefined || merged[key] === '')) {
        return null;
      }
    }

    return merged;
  }

  private resolveSkills(frame: AgentFrame): MotorSkill[] | null {
    const required = frame.requiredMotorSkills ?? [];
    if (required.length === 0) return [];
    if (!this.skillRegistry) return this.requireAllSkills ? null : [];

    const resolved = this.skillRegistry.resolve(required);
    if (this.requireAllSkills && resolved.length !== required.length) {
      return null;
    }

    return resolved;
  }

  private hasFrameInstance(frame: AgentFrame, existingAgents: OrganicAgent[]): boolean {
    return existingAgents.some(agent => agent.id === frame.id || agent.name === frame.id);
  }
}

function applySlots(template: string, slots: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}|\$\{([\w.-]+)\}/g, (_, a, b) => {
    const key = a ?? b;
    const value = slots[key];
    return value === null || value === undefined ? '' : String(value);
  });
}
