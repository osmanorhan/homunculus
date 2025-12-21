/**
 * Signal: The Natural Communication Primitive
 *
 * Unlike Molecule (structured), Signal carries raw thought as natural language.
 * This is the Pheromone Protocol - agents communicate via semantic osmosis,
 * not JSON exchange.
 *
 * Philosophy:
 * - Biological neurons don't exchange JSON, they exchange action potentials
 * - Meaning isn't in the format, it's in the resonance
 * - Agents radiate thoughts, the biosphere routes via semantic similarity
 */

/**
 * A Signal is emitted by an agent as natural language thought.
 *
 * The Biosphere:
 * 1. Embeds the thought into a vector (the "pheromone")
 * 2. Finds agents whose receptor field resonates
 * 3. Injects the thought directly into their context
 *
 * No parsing, no schemas, no errors - just semantic diffusion.
 */
export interface Signal {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Raw thought expressed in natural language.
   *
   * This is unstructured - the agent says what it's thinking/feeling.
   * Examples:
   * - "I am confused by this input"
   * - "I recommend delaying the launch"
   * - "I need help resolving a contradiction"
   */
  thought: string;

  /**
   * Which agent emitted this signal
   */
  emittedBy: string;

  /**
   * The semantic embedding of the thought (the "pheromone").
   *
   * This is how the biosphere routes signals - via vector similarity.
   * Agents whose receptor fields resonate with this vector will receive it.
   */
  pheromone: number[];

  /**
   * When this signal was emitted
   */
  timestamp: number;

  /**
   * Optional: Inferred semantic intent.
   *
   * The biosphere can analyze the thought and infer what kind of signal
   * this is (e.g., "distress", "recommendation", "question").
   * This is emergent, not required.
   */
  inferredIntent?: string;

  /**
   * Optional: Semantic tags inferred from the thought.
   *
   * E.g., ["confusion", "needs-help", "format-mismatch"]
   */
  inferredTags?: string[];
}

/**
 * Create a Signal from raw thought.
 *
 * Note: The pheromone (embedding) is added by the Biosphere during propagation.
 */
export function createSignal(config: {
  thought: string;
  emittedBy: string;
  inferredIntent?: string;
  inferredTags?: string[];
}): Omit<Signal, 'pheromone'> {
  return {
    id: generateId(),
    thought: config.thought,
    emittedBy: config.emittedBy,
    timestamp: Date.now(),
    inferredIntent: config.inferredIntent,
    inferredTags: config.inferredTags,
  };
}

/**
 * ReceptorField: What an agent cares about.
 *
 * Instead of typed receptors (desire: string, tags: string[]),
 * agents have a receptor field - natural language patterns they resonate with.
 *
 * Example:
 * CEO Agent:
 * - "I need guidance"
 * - "What should we do?"
 * - "Help me decide"
 * - "I'm facing a choice"
 *
 * Risk Analyst Agent:
 * - "I am stuck"
 * - "I cannot decide"
 * - "Conflicting constraints"
 * - "Binary choice"
 */
export interface ReceptorField {
  /**
   * Natural language patterns this agent cares about.
   *
   * When a signal's pheromone (embedding) is semantically similar
   * to this field, the agent will receive it.
   */
  patterns: string[];

  /**
   * Optional: Resonance threshold (0-1).
   * Default: 0.6
   *
   * Cosine similarity must exceed this for signal to be received.
   */
  threshold?: number;
}

/**
 * Check if a signal resonates with a receptor field.
 *
 * @param signalPheromone - The signal's embedding vector
 * @param receptorField - The agent's receptor field
 * @param receptorFieldEmbedding - Pre-computed embedding of the receptor field
 * @returns true if cosine similarity exceeds threshold
 */
export function resonates(
  signalPheromone: number[],
  receptorField: ReceptorField,
  receptorFieldEmbedding: number[],
): boolean {
  const threshold = receptorField.threshold ?? 0.6;
  const similarity = cosineSimilarity(signalPheromone, receptorFieldEmbedding);
  return similarity > threshold;
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Generate a unique ID for signals.
 */
function generateId(): string {
  return `signal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
