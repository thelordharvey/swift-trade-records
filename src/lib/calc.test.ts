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

import { normalizeSymbol, closedTradeR } from "./calc";
describe("normalizeSymbol", () => {
  it("strips broker suffixes", () => {
    expect(normalizeSymbol("EURUSDm")).toBe("EURUSD");
    expect(normalizeSymbol("EURUSD.pro")).toBe("EURUSD");
    expect(normalizeSymbol("xauusd.a")).toBe("XAUUSD");
    expect(normalizeSymbol("GOLD#")).toBe("GOLD");
    expect(normalizeSymbol("US30.cash")).toBe("US30");
    expect(normalizeSymbol("XAGUSDc")).toBe("XAGUSD");
    expect(normalizeSymbol(" gbpjpy ")).toBe("GBPJPY");
  });
  it("keeps non-currency symbols intact", () => {
    expect(normalizeSymbol("NAS100")).toBe("NAS100");
    expect(normalizeSymbol("BTCUSDT")).toBe("BTCUSDT");
    expect(normalizeSymbol("GER40")).toBe("GER40");
  });
});
describe("closedTradeR", () => {
  it("price-based R", () => {
    expect(closedTradeR("long", 100, 99, 102)).toBe(2);
    expect(closedTradeR("short", 100, 101, 101)).toBe(-1);
    expect(closedTradeR("long", 100, null, 102)).toBeNull();
    expect(closedTradeR("long", 100, 0, 102)).toBeNull();
    expect(closedTradeR("long", 100, 99, null)).toBeNull();
    expect(closedTradeR("long", 100, 100, 102)).toBeNull();
  });
});
