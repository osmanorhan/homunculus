/**
 * Semantic utilities for vector-based operations
 *
 * Pure mathematical functions for working with embeddings.
 * Domain-agnostic, reusable across the framework.
 */

/**
 * Calculate cosine similarity between two embedding vectors
 *
 * Returns a value between 0 (completely different) and 1 (identical).
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Similarity score (0-1)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    magnitudeA += a[i]! * a[i]!;
    magnitudeB += b[i]! * b[i]!;
  }

  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Find the most similar vector from a list of candidates
 *
 * @param query - The query vector
 * @param candidates - List of candidate vectors with metadata
 * @returns The most similar candidate, or null if none found
 */
export function findMostSimilar<T>(
  query: number[],
  candidates: Array<{ vector: number[]; data: T }>,
): { similarity: number; data: T } | null {
  let bestMatch: { similarity: number; data: T } | null = null;

  for (const candidate of candidates) {
    const similarity = cosineSimilarity(query, candidate.vector);

    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = { similarity, data: candidate.data };
    }
  }

  return bestMatch;
}

/**
 * Filter candidates by minimum similarity threshold
 *
 * @param query - The query vector
 * @param candidates - List of candidate vectors with metadata
 * @param threshold - Minimum similarity (0-1)
 * @returns Filtered candidates above threshold
 */
export function filterBySimilarity<T>(
  query: number[],
  candidates: Array<{ vector: number[]; data: T }>,
  threshold: number,
): Array<{ similarity: number; data: T }> {
  return candidates
    .map(candidate => ({
      similarity: cosineSimilarity(query, candidate.vector),
      data: candidate.data,
    }))
    .filter(result => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}
