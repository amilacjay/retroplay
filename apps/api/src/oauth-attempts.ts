import { randomToken } from './crypto';

const STATE = /^[A-Za-z0-9_-]{40,50}$/;
const TTL = 10 * 60_000;

/** Single-use, short-lived OAuth `state` values with whatever the callback needs to finish the flow. Kept in memory. */
export class OAuthAttempts<T> {
  private readonly items = new Map<string, { data: T; expiresAt: number }>();

  create(data: T): string {
    const now = Date.now();
    this.items.forEach((item, key) => { if (item.expiresAt < now) this.items.delete(key); });
    const state = randomToken();
    this.items.set(state, { data, expiresAt: now + TTL });
    return state;
  }

  consume(state: string | undefined): T | undefined {
    if (!state || !STATE.test(state)) return undefined;
    const item = this.items.get(state);
    this.items.delete(state);
    return item && item.expiresAt >= Date.now() ? item.data : undefined;
  }
}
