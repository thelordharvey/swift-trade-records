import { describe, expect, it } from "vitest";
import { receivedSince, syncState } from "./sync";

describe("terminal connection state", () => {
  const now = Date.parse("2026-10-12T10:00:00Z");
  it("never marks an unconnected account live", () => {
    expect(syncState(null, now)).toBe("unconnected");
    expect(syncState("invalid", now)).toBe("offline");
    expect(syncState("2026-10-13T10:00:00Z", now)).toBe("offline");
  });
  it("reflects heartbeat freshness at exact boundaries", () => {
    expect(syncState(new Date(now - 299_999).toISOString(), now)).toBe("live");
    expect(syncState(new Date(now - 300_000).toISOString(), now)).toBe("idle");
    expect(syncState(new Date(now - 86_400_000).toISOString(), now)).toBe("offline");
  });
  it("requires a new heartbeat to complete setup", () => {
    expect(receivedSince(null, now)).toBe(false);
    expect(receivedSince("invalid", now)).toBe(false);
    expect(receivedSince(new Date(now - 1).toISOString(), now)).toBe(false);
    expect(receivedSince(new Date(now).toISOString(), now)).toBe(true);
  });
});