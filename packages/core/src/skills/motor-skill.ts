/**
 * MotorSkill: deterministic "organs" an agent can possess.
 *
 * A MotorSkill does not think; it acts. It is a capability surface for
 * touching the world (filesystem, shell, network, UI, etc.).
 *
 * This is framework-level only:
 * - no persistence
 * - no task-specific skill implementations
 */

export interface MotorSkillParameters {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: unknown[];
  }>;
  required?: string[];
}

export interface MotorSkill<Input = unknown, Output = unknown> {
  /**
   * Stable identifier (kebab-case recommended).
   * Used for matching against frame requirements and tool calling.
   */
  id: string;

  /**
   * Human-friendly name (display/UI).
   */
  name: string;

  /**
   * Natural language description of what this skill can do.
   * Used in LLM tool definitions.
   */
  description: string;

  /**
   * JSON Schema for parameters (OpenAI tool format).
   * Optional - if not provided, skill takes no structured parameters.
   */
  parameters?: MotorSkillParameters;

  /**
   * Deterministic execution.
   * Input will be parsed from tool call arguments if using function calling.
   */
  execute(input: Input): Promise<Output>;
}

