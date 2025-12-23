import type { BiosphereState } from './biosphere.js';

/**
 * Signals emitted by an environment tick (reality feedback).
 */
export interface EnvironmentSignal {
  thought: string;
  emittedBy?: string;
  inferredIntent?: string;
  inferredTags?: string[];
}

/**
 * BiosphereEnvironment: a generic "physics" layer.
 *
 * Framework-level only:
 * - no persistence
 * - no task-specific logic
 * - simply emits signals based on current state
 */
export interface BiosphereEnvironment {
  tick(state: BiosphereState): Promise<EnvironmentSignal[]>;
}

