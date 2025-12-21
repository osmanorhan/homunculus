/**
 * SignalSynapse: Adaptive coupling between organic agents
 *
 * Neuroscientific approach:
 * - Synaptic strength grows with Hebbian learning (neurons that fire together, wire together)
 * - Confidence emerges from activation frequency and success rate
 * - No discrete conditionals - continuous mathematical functions
 * - Plasticity: synapses strengthen or weaken based on utility
 */

import type { Signal } from '../signal/signal.js';

/**
 * Synaptic strength metrics (continuous, not discrete)
 */
export interface SynapticStrength {
  /**
   * Semantic similarity between agents (0-1)
   * Like spatial distance between neurons
   */
  baseSimilarity: number;

  /**
   * Activation count (how many times signal passed through)
   * Like long-term potentiation in biological synapses
   */
  activations: number;

  /**
   * Success rate (successful transmissions / total attempts)
   * Like synaptic efficacy
   */
  efficacy: number;

  /**
   * Confidence (0-1, derived from activations and efficacy)
   * Emerges from: σ(log(activations) * efficacy)
   */
  confidence: number;

  /**
   * Average signal transmission time (ms)
   * Like conduction velocity
   */
  conductionTime: number;

  /**
   * Last activation timestamp
   * For synaptic decay (unused synapses weaken)
   */
  lastFiring: number;
}

/**
 * SignalSynapse: Transforms signals between agents
 *
 * Biological metaphor:
 * - Axon terminal (from agent) → Synapse → Dendrite (to agent)
 * - Neurotransmitter = transformed signal
 * - Plasticity = learning through use
 */
export interface SignalSynapse {
  id: string;
  from: string;
  to: string;

  /**
   * Synaptic strength (continuous metrics)
   */
  strength: SynapticStrength;

  /**
   * Transform signal (like neurotransmitter release)
   */
  transform(signal: Signal): Promise<Signal>;

  /**
   * Calculate current synaptic weight
   * Higher weight = stronger connection
   *
   * Weight = baseSimilarity * (1 + log(activations + 1)) * efficacy
   */
  getWeight(): number;

  /**
   * Check if synapse should be pruned (synaptic decay)
   * Unused synapses weaken and eventually die
   */
  shouldPrune(now: number, pruneThreshold: number): boolean;
}

export interface SignalSynapseConfig {
  from: string;
  to: string;
  baseSimilarity: number;
  fromContext: string[];
  toContext: string[];
  llm: {
    chat(messages: Array<{ role: string; content: string }>): Promise<string>;
  };
}

/**
 * Sigmoid function for smooth confidence growth
 * Maps activations → [0, 1] smoothly
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Calculate confidence from activations and efficacy
 *
 * Properties:
 * - Starts low (near 0) with few activations
 * - Grows logarithmically (diminishing returns)
 * - Multiplied by efficacy (only successful synapses gain confidence)
 * - Asymptotes to 1.0
 *
 * Formula: σ(log(activations + 1) - 2) * efficacy
 * - The "-2" shifts sigmoid left (confidence starts low)
 * - log(activations + 1) prevents log(0)
 */
function calculateConfidence(activations: number, efficacy: number): number {
  if (activations === 0) return 0;
  const logActivations = Math.log(activations + 1);
  return sigmoid(logActivations - 2) * efficacy;
}

/**
 * Create a learning signal synapse
 */
export function createSignalSynapse(config: SignalSynapseConfig): SignalSynapse {
  const { from, to, baseSimilarity, fromContext, toContext, llm } = config;

  const strength: SynapticStrength = {
    baseSimilarity,
    activations: 0,
    efficacy: 1.0, // Start optimistic (will adjust with failures)
    confidence: 0,
    conductionTime: 0,
    lastFiring: 0,
  };

  // Hebbian learning: cache successful transformations
  const synapticMemory = new Map<string, string>();

  const synapse: SignalSynapse = {
    id: `${from}→${to}`,
    from,
    to,
    strength,

    async transform(signal: Signal): Promise<Signal> {
      const firingStart = Date.now();

      // Check synaptic memory (cached transformations)
      const cached = synapticMemory.get(signal.thought);
      if (cached) {
        // Memory recall is instant
        strength.activations++;
        strength.lastFiring = Date.now();
        strength.confidence = calculateConfidence(strength.activations, strength.efficacy);

        return {
          ...signal,
          thought: cached,
          emittedBy: from,
        };
      }

      // LLM transformation (like neurotransmitter synthesis)
      try {
        const transformed = await llm.chat([
          {
            role: 'system',
            content: [
              'You adapt signals between agents with different vocabularies.',
              '',
              `Source context: ${fromContext.join(', ')}`,
              `Target context: ${toContext.join(', ')}`,
              '',
              'Reformulate to resonate with target while preserving meaning.',
              'Natural, concise (2-4 sentences).',
            ].join('\n'),
          },
          {
            role: 'user',
            content: `Transform: "${signal.thought}"`,
          },
        ]);

        // Successful transmission
        const firingTime = Date.now() - firingStart;

        strength.activations++;
        strength.efficacy = (strength.efficacy * (strength.activations - 1) + 1.0) / strength.activations;
        strength.conductionTime =
          (strength.conductionTime * (strength.activations - 1) + firingTime) / strength.activations;
        strength.lastFiring = Date.now();
        strength.confidence = calculateConfidence(strength.activations, strength.efficacy);

        // Store in synaptic memory
        synapticMemory.set(signal.thought, transformed);

        return {
          ...signal,
          thought: transformed,
          emittedBy: from,
        };
      } catch (error) {
        // Transmission failure (like failed neurotransmitter release)
        strength.activations++;
        strength.efficacy = (strength.efficacy * (strength.activations - 1) + 0.0) / strength.activations;
        strength.confidence = calculateConfidence(strength.activations, strength.efficacy);

        // Failed transmission: pass through unchanged
        return signal;
      }
    },

    getWeight(): number {
      // Synaptic weight = similarity × potentiation × efficacy
      // log(activations + 1) = long-term potentiation
      const potentiation = 1 + Math.log(strength.activations + 1);
      return strength.baseSimilarity * potentiation * strength.efficacy;
    },

    shouldPrune(now: number, pruneThreshold: number): boolean {
      // Synaptic pruning: unused synapses decay
      if (strength.activations === 0) return true;

      const timeSinceLastFiring = now - strength.lastFiring;
      const decayTime = pruneThreshold; // ms

      // Prune if: unused for too long AND low efficacy
      return timeSinceLastFiring > decayTime && strength.efficacy < 0.3;
    },
  };

  return synapse;
}
