import type { Config } from "../config/loader.js";

export interface AllowResult {
  allowed: true;
}

export interface BlockResult {
  allowed: false;
  reason: string;
}

export type DomainCheckResult = AllowResult | BlockResult;

function matchesPattern(url: string, pattern: string): boolean {
  // Convert glob-style wildcard pattern to a regex
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i").test(extractHostname(url));
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function checkDomain(url: string, config: Config): DomainCheckResult {
  const hostname = extractHostname(url);

  for (const pattern of config.block) {
    if (matchesPattern(hostname, pattern)) {
      return { allowed: false, reason: `Domain blocked by config: ${pattern}` };
    }
  }

  if (config.allow.length > 0) {
    const permitted = config.allow.some((p) => matchesPattern(hostname, p));
    if (!permitted) {
      return {
        allowed: false,
        reason: `Domain not in allow list: ${hostname}`,
      };
    }
  }

  return { allowed: true };
}
