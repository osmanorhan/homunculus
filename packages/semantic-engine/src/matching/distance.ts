import type { LLMClient } from '../llm/client.js';
import { LLMError } from '../llm/client.js';

const DEFAULT_TAG_WEIGHT = 0.4;
const DEFAULT_EMBEDDING_WEIGHT = 0.6;

export interface SemanticSignature {
  intent: string;
  tags: string[];
  embedding?: number[];
}

export interface EmitterLike {
  signature: SemanticSignature;
}

export interface ReceptorLike {
  desire: string;
  tags: string[];
  embedding?: number[];
}

export interface DistanceOptions {
  tagWeight?: number;
  /**
   * When true, skip embedding generation and use tag-only matching.
   * This aligns with Hofstadter's vision: tags represent "felt" semantic categories,
   * while embeddings are expensive vector calculations.
   * Default: false (for backward compatibility, but recommended: true)
   */
  skipEmbeddings?: boolean;
}

export async function calculateSemanticDistance(
  emitter: EmitterLike,
  receptor: ReceptorLike,
  llm: LLMClient,
  options: DistanceOptions = {},
): Promise<number> {
  const emitterSignature = emitter.signature;
  const receptorSig: SemanticSignature = {
    intent: receptor.desire,
    tags: receptor.tags,
    embedding: receptor.embedding,
  };

  const tagDistance = calculateTagDistance(emitterSignature.tags, receptorSig.tags);

  // Skip expensive embedding generation when skipEmbeddings is true
  // This aligns with the philosophy: tags are "felt" categories, embeddings are optional nuance
  if (options.skipEmbeddings === true) {
    return clamp01(tagDistance);
  }

  const [emitterEmbedding, receptorEmbedding] = await ensureEmbeddings(emitterSignature, receptorSig, llm);

  const embeddingDistance =
    emitterEmbedding && receptorEmbedding
      ? 1 - cosineSimilarity(emitterEmbedding, receptorEmbedding)
      : 1;

  const tagWeight = normalizeWeight(options.tagWeight);
  const embeddingWeight = 1 - tagWeight;

  const distance = tagDistance * tagWeight + embeddingDistance * embeddingWeight;
  return clamp01(distance);
}

/**
 * Normalize tag for fuzzy matching
 * Handles variations like "ml" vs "machine-learning" vs "machine_learning"
 */
function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/[-_\s]/g, '');
}

function calculateTagDistance(emitterTags: string[], receptorTags: string[]): number {
  const union = new Set([...emitterTags, ...receptorTags]);
  if (union.size === 0) {
    return 1;
  }

  // Normalize tags for fuzzy matching
  const normalizedReceptorTags = receptorTags.map(normalizeTag);
  const overlap = emitterTags.filter(tag =>
    normalizedReceptorTags.includes(normalizeTag(tag))
  );

  const similarity = overlap.length / union.size;
  return 1 - similarity;
}

async function ensureEmbeddings(
  emitterSignature: { intent: string; tags: string[]; embedding?: number[] },
  receptorSignature: { intent: string; tags: string[]; embedding?: number[] },
  llm: LLMClient,
): Promise<[number[] | undefined, number[] | undefined]> {
  const fetchOrUndefined = async (signature: { intent: string; tags: string[]; embedding?: number[] }) => {
    if (signature.embedding) return signature.embedding;
    const embedding = await llm.embed(buildEmbeddingInput(signature)).catch(() => undefined);
    if (embedding) {
      signature.embedding = embedding;
    }
    return embedding;
  };

  const [emitterEmbedding, receptorEmbedding] = await Promise.all([
    fetchOrUndefined(emitterSignature),
    fetchOrUndefined(receptorSignature),
  ]);
  return [emitterEmbedding, receptorEmbedding];
}

function buildEmbeddingInput(signature: { intent: string; tags: string[] }): string {
  const tags = signature.tags.length ? ` tags: ${signature.tags.join(', ')}` : '';
  return `${signature.intent}${tags}`;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalizeWeight(weight?: number): number {
  if (typeof weight !== 'number' || Number.isNaN(weight)) {
    return DEFAULT_TAG_WEIGHT;
  }
  return clamp01(weight);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
