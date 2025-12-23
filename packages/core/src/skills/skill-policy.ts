import type { MotorSkill } from './motor-skill.js';

export interface SkillExecutionContext {
  agentId: string;
  agentName: string;
  skillId: string;
  input: unknown;
}

export interface SkillDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * SkillPolicy: framework-level gate for motor skill execution.
 *
 * Policies decide whether a given skill invocation is permitted,
 * without embedding task-specific logic here.
 */
export interface SkillPolicy {
  canExecute(context: SkillExecutionContext): Promise<SkillDecision> | SkillDecision;
}

/**
 * Wrap a motor skill with a policy guard.
 */
export function applySkillPolicy<Input, Output>(
  skill: MotorSkill<Input, Output>,
  policy: SkillPolicy,
  baseContext: Omit<SkillExecutionContext, 'skillId' | 'input'>,
): MotorSkill<Input, Output> {
  return {
    ...skill,
    async execute(input: Input): Promise<Output> {
      const decision = await policy.canExecute({
        ...baseContext,
        skillId: skill.id,
        input,
      });

      if (!decision.allowed) {
        const reason = decision.reason ? `: ${decision.reason}` : '';
        throw new Error(`Skill execution denied for "${skill.id}"${reason}`);
      }

      return skill.execute(input);
    },
  };
}
