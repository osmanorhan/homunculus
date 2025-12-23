import { cosineSimilarity, filterBySimilarity } from '../signal/semantic-utils.js';
import type { AgentFrame } from './agent-frame.js';

export interface FrameMatch {
  frame: AgentFrame;
  similarity: number;
}

export interface FrameRegistryOptions {
  embed(text: string): Promise<number[]>;
  /**
   * Minimum similarity required for a frame to match.
   * Default: 0.55 (slightly below typical 0.6 receptor thresholds).
   */
  minSimilarity?: number;
}

/**
 * In-memory registry for agent frames with semantic retrieval.
 *
 * No persistence is provided here by design; callers may load frames
 * from any source and register them at runtime.
 */
export class FrameRegistry {
  private readonly embed: FrameRegistryOptions['embed'];
  private readonly minSimilarity: number;
  private readonly frames = new Map<string, AgentFrame>();
  private readonly vectors = new Map<string, number[]>();

  constructor(options: FrameRegistryOptions) {
    this.embed = options.embed;
    this.minSimilarity = options.minSimilarity ?? 0.55;
  }

  list(): AgentFrame[] {
    return Array.from(this.frames.values());
  }

  get(id: string): AgentFrame | undefined {
    return this.frames.get(id);
  }

  has(id: string): boolean {
    return this.frames.has(id);
  }

  /**
   * Register (or replace) a frame and cache its embedding.
   */
  async register(frame: AgentFrame): Promise<void> {
    this.frames.set(frame.id, frame);
    const vector = await this.embed(frameToEmbeddingText(frame));
    this.vectors.set(frame.id, vector);
  }

  async registerMany(frames: AgentFrame[]): Promise<void> {
    await Promise.all(frames.map(frame => this.register(frame)));
  }

  /**
   * Query frames by semantic similarity.
   */
  async query(
    queryText: string,
    options?: { topK?: number; minSimilarity?: number },
  ): Promise<FrameMatch[]> {
    const normalized = queryText.trim();
    if (!normalized) return [];

    const queryVector = await this.embed(normalized);
    const candidates: Array<{ vector: number[]; data: AgentFrame }> = [];

    for (const frame of this.frames.values()) {
      const vector = this.vectors.get(frame.id);
      if (!vector) continue;
      candidates.push({ vector, data: frame });
    }

    const threshold = options?.minSimilarity ?? this.minSimilarity;
    const matches = filterBySimilarity(queryVector, candidates, threshold).map(m => ({
      frame: m.data,
      similarity: m.similarity,
    }));

    const topK = options?.topK ?? 5;
    return matches.slice(0, topK);
  }

  /**
   * Get the best matching frame, or null.
   */
  async best(queryText: string, options?: { minSimilarity?: number }): Promise<FrameMatch | null> {
    const matches = await this.query(queryText, { topK: 1, minSimilarity: options?.minSimilarity });
    return matches[0] ?? null;
  }

  /**
   * Utility for callers who want a raw similarity to a specific frame.
   */
  async similarity(queryText: string, frameId: string): Promise<number> {
    const frame = this.frames.get(frameId);
    const frameVector = this.vectors.get(frameId);
    const normalized = queryText.trim();
    if (!frame || !frameVector || !normalized) return 0;

    const queryVector = await this.embed(normalized);
    return cosineSimilarity(queryVector, frameVector);
  }
}

function frameToEmbeddingText(frame: AgentFrame): string {
  const slotNames = frame.slots ? Object.keys(frame.slots) : [];
  const requiredSkills = frame.requiredMotorSkills ?? [];

  return [
    `frame:${frame.id}`,
    frame.description,
    `receptors:${frame.receptorPatterns.join(', ')}`,
    `skills:${requiredSkills.join(', ')}`,
    `slots:${slotNames.join(', ')}`,
    frame.systemPromptTemplate,
  ]
    .filter(Boolean)
    .join('\n');
}

