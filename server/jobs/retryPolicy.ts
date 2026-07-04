export interface IntegrationJobRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
}

export const DEFAULT_RETRY_POLICY: IntegrationJobRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
  jitterMs: 250,
};

export function shouldRetryIntegrationJob(attemptsAfterFailure: number, policy: IntegrationJobRetryPolicy = DEFAULT_RETRY_POLICY): boolean {
  return attemptsAfterFailure < policy.maxAttempts;
}

export function nextRetryAt(
  attemptsAfterFailure: number,
  now: Date = new Date(),
  policy: IntegrationJobRetryPolicy = DEFAULT_RETRY_POLICY,
): Date {
  const exponentialDelay = policy.baseDelayMs * 2 ** Math.max(0, attemptsAfterFailure - 1);
  const jitter = policy.jitterMs > 0 ? Math.min(policy.jitterMs, attemptsAfterFailure * 37) : 0;
  const delayMs = Math.min(policy.maxDelayMs, exponentialDelay + jitter);
  return new Date(now.getTime() + delayMs);
}
