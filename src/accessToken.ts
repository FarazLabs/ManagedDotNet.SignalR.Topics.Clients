import { HttpError } from "@microsoft/signalr";
import type { TopicHubClientOptions } from "./types.js";

/**
 * Optionally rotates host tokens, then returns the current access token for negotiate.
 */
export async function resolveAccessToken(options: TopicHubClientOptions): Promise<string> {
  if (options.rotateTokens !== undefined) {
    await options.rotateTokens();
  }

  const token: string | null | undefined = options.getAccessToken?.();
  return token ?? "";
}

/**
 * True when the error (or a nested cause) is an HTTP 401 from SignalR negotiate/start.
 */
export function isUnauthorizedError(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 6 && current !== undefined && current !== null; depth++) {
    if (current instanceof HttpError && current.statusCode === 401) {
      return true;
    }

    if (
      typeof current === "object" &&
      "statusCode" in current &&
      (current as { statusCode: unknown }).statusCode === 401
    ) {
      return true;
    }

    if (current instanceof Error && "cause" in current) {
      current = current.cause;
      continue;
    }

    break;
  }

  return false;
}
