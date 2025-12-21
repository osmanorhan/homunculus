export interface SynapseMetrics {
  successCount: number;
  failureCount: number;
  averageLatencyMs: number;
  lastError?: string;
}

export function createMetrics(): SynapseMetrics {
  return {
    successCount: 0,
    failureCount: 0,
    averageLatencyMs: 0,
  };
}

export function recordSuccess(metrics: SynapseMetrics, latencyMs: number): SynapseMetrics {
  const totalLatency = metrics.averageLatencyMs * metrics.successCount + latencyMs;
  const successCount = metrics.successCount + 1;
  return {
    ...metrics,
    successCount,
    averageLatencyMs: totalLatency / successCount,
  };
}

export function recordFailure(metrics: SynapseMetrics, error: unknown): SynapseMetrics {
  return {
    ...metrics,
    failureCount: metrics.failureCount + 1,
    lastError: error instanceof Error ? error.message : String(error),
  };
}
