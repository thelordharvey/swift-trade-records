export type SyncState = "live" | "idle" | "offline" | "unconnected";

/** Receipt of an authenticated EA heartbeat, not proof of broker authentication. */
export function syncState(at: string | null, now: number): SyncState {
  if (!at) return "unconnected";
  const time = new Date(at).getTime();
  if (!Number.isFinite(time) || time > now + 60_000) return "offline";
  const age = now - time;
  if (age < 5 * 60_000) return "live";
  if (age < 24 * 60 * 60_000) return "idle";
  return "offline";
}

export function receivedSince(at: string | null, since: number): boolean {
  return at != null && Number.isFinite(Date.parse(at)) && Date.parse(at) >= since;
}