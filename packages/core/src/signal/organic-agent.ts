/**
 * Organic Agent: Agents that think naturally
 *
 * Unlike traditional agents that exchange typed messages,
 * organic agents:
 * - Perceive signals as natural language
 * - Process thoughts in their context window
 * - Emit stream of consciousness
 * - Communicate via semantic resonance, not schemas
 */

import type { Signal, ReceptorField } from './signal.js';
import { cosineSimilarity } from './semantic-utils.js';

/**
 * OrganicAgent: The natural thinking primitive.
 *
 * This is radically different from typed message-passing agents:
 *
 * Traditional Agent:
 * - receive(message: TypedMessage): TypedMessage
 * - Must parse, validate, transform
 * - Errors on schema mismatch
 *
 * Organic Agent:
 * - perceive(signal: Signal): void
 * - Accumulates context naturally
 * - emit(): AsyncGenerator<string>
 * - Expresses thoughts naturally
 */
export interface OrganicAgent {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * What patterns does this agent care about?
   *
   * This defines the "receptor field" - the semantic space
   * this agent resonates with.
   *
   * Example (CEO Agent):
   * - "I need guidance"
   * - "What should we do?"
   * - "Help me make a decision"
   *
   * When a signal's embedding is similar to this field,
   * the agent will perceive it.
   */
  receptorField: ReceptorField;

  /**
   * Perceive an incoming signal.
   *
   * This injects the signal's thought into the agent's context.
   * The agent doesn't "process" it immediately - it accumulates
   * context and emits when it has something to say.
   *
   * @param signal - The incoming thought
   */
  perceive(signal: Signal): Promise<void>;

  /**
   * Emit thoughts as stream of consciousness.
   *
   * The agent processes its accumulated context and emits
   * natural language expressing what it's thinking/feeling.
   *
   * This could be:
   * - A recommendation
   * - A question
   * - Confusion
   * - A decision
   * - A request for help
   *
   * @returns AsyncGenerator of thoughts (strings)
   */
  emit(signal?: Signal): AsyncGenerator<string>;

  /**
   * Optional: Get the agent's current context.
   *
   * Useful for debugging - see what the agent has perceived.
   */
  getContext?(): string[];
}

/**
 * Create an organic agent powered by LLM.
 *
 * The agent:
 * - Accumulates perceived signals in a context buffer
 * - When emit() is called, sends context to LLM
 * - LLM responds naturally (no schema)
 * - Yields the response as thought
 */
export interface OrganicAgentConfig {
  id: string;
  name: string;
  receptorField: ReceptorField;
  systemPrompt: string;
  llm: {
    chat(messages: Array<{ role: string; content: string }>): Promise<string>;
  };
  emit?: (signal?: Signal) => AsyncGenerator<string>;
}

export function defineOrganicAgent(config: OrganicAgentConfig): OrganicAgent {
  const context: string[] = [];
  let lastEmitContextLength = 0;
  let lastPerceivedSignal: Signal | undefined;

  return {
    id: config.id,
    name: config.name,
    receptorField: config.receptorField,

    async perceive(signal: Signal): Promise<void> {
      // Inject signal into context
      const contextEntry = `[Signal from ${signal.emittedBy} at ${new Date(signal.timestamp).toISOString()}]:\n${signal.thought}`;
      context.push(contextEntry);
      // Store the last signal for custom emit functions that need it
      lastPerceivedSignal = signal;
    },

    async *emit(signal?: Signal): AsyncGenerator<string> {
      if (typeof config.emit === 'function') {
        // Custom emit function: pass the last perceived signal if no signal provided
        const signalToUse = signal ?? lastPerceivedSignal;
        for await (const thought of config.emit.call(this, signalToUse)) {
          yield thought;
        }
        // Clear the last signal after processing (for signal-based agents)
        lastPerceivedSignal = undefined;
        return;
      }

      // Calculate new context accumulated since last emission
      const newContextCount = context.length - lastEmitContextLength;

      // If no new context, agent has nothing new to say
      // This implements Minsky's "Difference Engine": agents react to CHANGES
      if (context.length === 0 || newContextCount === 0) {
        return;
      }

      // Build prompt with all accumulated context
      const messages = [
        {
          role: 'system' as const,
          content: config.systemPrompt,
        },
        {
          role: 'user' as const,
          content: context.join('\n\n'),
        },
      ];

      // LLM generates natural response
      const thought = await config.llm.chat(messages);

      // Update emission watermark
      lastEmitContextLength = context.length;

      // Yield the thought
      yield thought;
    },

    getContext() {
      return [...context];
    },
  };
}

/**
 * A special organic agent: The MetaObserver.
 *
 * This agent listens for TRUE distress signals (inability to proceed) and spawns helpers.
 *
 * TASK-AGNOSTIC DESIGN:
 * - Starts with minimal seed patterns (uncertainty, inability, contradiction)
 * - Learns what "distress" feels like from experience
 * - Does NOT prescribe specific vocabulary
 * - Adapts to different domains (business, music, dreams, science, etc.)
 *
 * Distress = inability to proceed, NOT intensity or urgency
 * Examples across domains:
 * - Business: "These recommendations contradict each other"
 * - Music: "This progression doesn't resolve, it feels suspended"
 * - Dreams: "The symbols blur together, I can't make meaning"
 * - Science: "The data doesn't support either hypothesis"
 */
export function defineMetaObserver(config: {
  llm: {
    chat(messages: Array<{ role: string; content: string }>): Promise<string>;
    embed(text: string): Promise<number[]>;
  };
}): OrganicAgent {
  const distressSignals: Signal[] = [];
  const lastProcessedVector: number[] = [];

  return {
    id: 'meta-observer',
    name: 'MetaObserver',

    receptorField: {
      patterns: [
        // Minimal seed patterns - system learns from here
        'uncertainty',
        'confusion',
        'contradiction',
        'unable',
        'cannot',
        'stuck',
        'conflicting',
        'unclear',
      ],
      threshold: 0.50, // Lower threshold - catch more signals, let LLM filter
    },

    async perceive(signal: Signal): Promise<void> {
      // Signal decay: Ignore if we just processed something very similar
      if (lastProcessedVector.length > 0) {
        const similarity = cosineSimilarity(signal.pheromone, lastProcessedVector);
        if (similarity > 0.90) {
          console.log(
            `MetaObserver: Ignoring similar signal (similarity: ${similarity.toFixed(2)}) - olfactory fatigue`,
          );
          return;
        }
      }

      console.log(`\nMetaObserver: Distress signal detected from ${signal.emittedBy}`);
      console.log(`   Content: ${signal.thought.slice(0, 150)}...`);
      distressSignals.push(signal);

      // Remember this vector for decay
      lastProcessedVector.length = 0;
      lastProcessedVector.push(...signal.pheromone);
    },

    async *emit(): AsyncGenerator<string> {
      if (distressSignals.length === 0) return;

      const latestDistress = distressSignals[distressSignals.length - 1];
      if (!latestDistress) return;

      console.log(`\nMetaObserver: Analyzing signal for distress pattern...`);

      // Ask LLM: Is this inability to proceed? What perspective would help?
      // TASK-AGNOSTIC: Works for any domain (business, music, dreams, science)
      const analysis = await config.llm.chat([
        {
          role: 'system',
          content:
            'You are a meta-observer that senses when systems cannot proceed.\n\n' +
            'Distress = inability to move forward (stuck, contradictory, unclear)\n' +
            'NOT distress = intensity, urgency, or completed decisions\n\n' +
            'Examples of TRUE distress across domains:\n' +
            '- Business: "These recommendations contradict each other"\n' +
            '- Music: "This chord progression feels unresolved"\n' +
            '- Dreams: "The symbols blur together, no clear meaning"\n' +
            '- Science: "Data doesn\'t support either hypothesis"\n\n' +
            'If you detect inability to proceed:\n' +
            '1. Describe what perspective/capability would help\n' +
            '2. Explain the gap naturally\n' +
            'Respond in 1-2 sentences, naturally.\n\n' +
            'If this is NOT distress (just intensity/urgency), respond: "no distress detected"',
        },
        {
          role: 'user',
          content: `Signal from ${latestDistress.emittedBy}:\n\n"${latestDistress.thought}"\n\nWhat do you sense?`,
        },
      ]);

      // Check if LLM said this isn't distress (semantic similarity check)
      const responseVector = await config.llm.embed(analysis.trim());
      const noDistressVector = await config.llm.embed('no distress detected, no problem found, this is not distress');
      const isNoDistress = cosineSimilarity(responseVector, noDistressVector) > 0.8;

      if (isNoDistress) {
        console.log(`MetaObserver: No distress detected - this is intensity or decision`);
        distressSignals.length = 0;
        return;
      }

      console.log(`\nMetaObserver: Distress sensed, suggesting helper perspective`);

      // Emit natural language thought about what helper is needed
      // The biosphere will detect spawn intent from semantic content
      yield `I sense ${latestDistress.emittedBy} cannot proceed. ${analysis}. Perhaps spawning a helper perspective would resolve this.`;

      // Clear distress buffer
      distressSignals.length = 0;
    },

    getContext() {
      return distressSignals.map(s => s.thought);
    },
  };
}
