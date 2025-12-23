/**
 * AgentFrame: a dormant recipe (stereotype) for instantiating an agent.
 *
 * Inspired by Minsky's Frame Theory:
 * - frames provide defaults and expectations for a situation
 * - "terminals" (slots) are filled from context at instantiation time
 *
 * This is framework-level only:
 * - no persistence format (JSON, DB, vector store) is assumed here
 * - no slot-filling strategy is assumed here
 */

export interface FrameSlotDefinition<T = unknown> {
  /**
   * What this slot represents (for slot-fillers).
   */
  description: string;

  /**
   * Default value when unknown.
   */
  defaultValue?: T;

  /**
   * Whether the slot must be filled to instantiate.
   */
  required?: boolean;
}

export type FrameSlots = Record<string, FrameSlotDefinition>;

export interface AgentFrame {
  /**
   * Stable identifier (kebab-case recommended).
   */
  id: string;

  /**
   * When this frame should be used.
   */
  description: string;

  /**
   * Natural language prompt template for the instantiated agent.
   *
   * Slot fillers may interpolate `${slotName}` or another convention externally.
   */
  systemPromptTemplate: string;

  /**
   * What patterns should resonate with this agent.
   */
  receptorPatterns: string[];

  /**
   * Required motor skills by id (capabilities, not agents).
   */
  requiredMotorSkills?: string[];

  /**
   * Minsky terminals: slots to be filled from context.
   */
  slots?: FrameSlots;
}

