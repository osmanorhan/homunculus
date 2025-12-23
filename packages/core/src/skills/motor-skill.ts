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

export interface MotorSkill<Input = unknown, Output = unknown> {
  /**
   * Stable identifier (kebab-case recommended).
   * Used for matching against frame requirements.
   */
  id: string;

  /**
   * Human-friendly name (display/UI).
   */
  name: string;

  /**
   * Natural language description of what this skill can do.
   */
  description: string;

  /**
   * Deterministic execution.
   */
  execute(input: Input): Promise<Output>;
}

