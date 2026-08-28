import { NetworkProviderConfig } from "./registry";

export interface FallbackResult<T> {
  result: T | null;
  providerUsed: string | null;
  errors: Array<{ provider: string; error: string }>;
}

/**
 * Try each provider in priority order (enabled ones only).
 * Returns the first successful result.
 * fn receives the provider config and should throw on failure.
 */
export async function callWithFallback<T>(
  chain: NetworkProviderConfig[],
  fn: (cfg: NetworkProviderConfig) => Promise<T>
): Promise<FallbackResult<T>> {
  const errors: Array<{ provider: string; error: string }> = [];
  const active = chain.filter(c => c.enabled === 1);

  for (const cfg of active) {
    try {
      const result = await fn(cfg);
      return { result, providerUsed: cfg.provider_code, errors };
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      errors.push({ provider: cfg.provider_code, error: msg });
    }
  }

  return { result: null, providerUsed: null, errors };
}
