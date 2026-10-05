import { describe, it, expect } from "vitest";
import { calcPips, plannedRR, realizedRR, rMultiple, computeStats, pipSize } from "./calc";

describe("calc", () => {
  it("pip sizes", () => {
    expect(pipSize("XAUUSD")).toBe(0.1);
    expect(pipSize("USDJPY")).toBe(0.01);
    expect(pipSize("EURUSD")).toBe(0.0001);
    expect(pipSize("NAS100")).toBe(1);
  });
  it("pips long/short", () => {
    expect(calcPips("EURUSD", "long", 1.1, 1.1025)).toBe(25);
    expect(calcPips("EURUSD", "short", 1.1, 1.1025)).toBe(-25);
    expect(calcPips("XAUUSD", "long", 2000, 2005)).toBe(50);
    expect(calcPips("USDJPY", "short", 150, 149.5)).toBe(50);
    expect(calcPips("EURUSD", "long", 1.1, null)).toBeNull();
  });
  it("rr", () => {
    expect(plannedRR(100, 99, 103)).toBe(3);
    expect(plannedRR(100, null, 103)).toBeNull();
    expect(realizedRR("short", 100, 101, 98)).toBe(2);
    expect(rMultiple(200, 100)).toBe(2);
    expect(rMultiple(200, 0)).toBeNull();
  });
  it("stats", () => {
    const s = computeStats(
      [
        { id: "a", net_pnl: 100, r_multiple: 1, opened_at: "2026-01-01", closed_at: "2026-01-01", status: "closed" },
        { id: "b", net_pnl: -50, r_multiple: -0.5, opened_at: "2026-01-02", closed_at: "2026-01-02", status: "closed" },
      ],
      1000,
    );
    expect(s.net).toBe(50);
    expect(s.winRate).toBe(0.5);
    expect(s.profitFactor).toBe(2);
    expect(s.maxDD).toBe(50);
  });
});
