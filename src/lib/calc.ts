// Pure trading calculations. Shared by browser and server (ingest API).

export function pipSize(symbol: string): number {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith("XAU")) return 0.1;
  if (s.startsWith("XAG")) return 0.01;
  if (/^[A-Z]{6}$/.test(s)) return s.includes("JPY") ? 0.01 : 0.0001;
  return 1; // indices, crypto, stocks: points
}

export function assetClass(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.startsWith("XAU") || s.startsWith("XAG")) return "metal";
  if (/BTC|ETH|SOL|XRP|DOGE/.test(s)) return "crypto";
  if (/^[A-Z]{6}$/.test(s)) return "forex";
  return "index";
}

type Dir = "long" | "short";
const sign = (d: Dir) => (d === "long" ? 1 : -1);

export function calcPips(symbol: string, dir: Dir, entry: number, exit: number | null | undefined) {
  if (exit == null || !isFinite(exit)) return null;
  return round(((exit - entry) * sign(dir)) / pipSize(symbol), 1);
}

export function plannedRR(entry: number, sl?: number | null, tp?: number | null) {
  if (sl == null || tp == null) return null;
  const risk = Math.abs(entry - sl);
  if (risk === 0) return null;
  return round(Math.abs(tp - entry) / risk, 2);
}

export function realizedRR(dir: Dir, entry: number, sl?: number | null, exit?: number | null) {
  if (sl == null || exit == null) return null;
  const risk = Math.abs(entry - sl);
  if (risk === 0) return null;
  return round(((exit - entry) * sign(dir)) / risk, 2);
}

export function rMultiple(netPnl: number, risk?: number | null) {
  if (!risk || risk <= 0) return null;
  return round(netPnl / risk, 2);
}

/** Session by UTC hour. */
export function sessionOf(iso: string): string {
  const h = new Date(iso).getUTCHours();
  if (h >= 12 && h < 16) return "overlap";
  if (h >= 7 && h < 12) return "london";
  if (h >= 16 && h < 21) return "newyork";
  return "asia";
}

export function round(n: number, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export interface StatTrade {
  id: string;
  net_pnl: number | null;
  r_multiple: number | null;
  opened_at: string;
  closed_at: string | null;
  status: string;
}

export function computeStats(trades: StatTrade[], startingBalance = 0) {
  const closed = trades
    .filter((t) => t.status === "closed")
    .sort((a, b) => +new Date(a.closed_at ?? a.opened_at) - +new Date(b.closed_at ?? b.opened_at));
  const pnl = closed.map((t) => Number(t.net_pnl ?? 0));
  const wins = pnl.filter((p) => p > 0);
  const losses = pnl.filter((p) => p < 0);
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const net = grossProfit - grossLoss;
  const decided = wins.length + losses.length;
  const winRate = decided ? wins.length / decided : 0;
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;
  const rs = closed.map((t) => t.r_multiple).filter((r): r is number => r != null);
  const avgR = rs.length ? rs.reduce((a, b) => a + Number(b), 0) / rs.length : null;

  let bal = startingBalance, peak = startingBalance, maxDD = 0, maxDDPct = 0;
  let cur = 0, longestWin = 0, longestLoss = 0;
  const equity = closed.map((t, i) => {
    bal += Number(t.net_pnl ?? 0);
    peak = Math.max(peak, bal);
    const dd = peak - bal;
    if (dd > maxDD) { maxDD = dd; maxDDPct = peak > 0 ? dd / peak : 0; }
    const p = Number(t.net_pnl ?? 0);
    if (p > 0) cur = cur > 0 ? cur + 1 : 1;
    else if (p < 0) cur = cur < 0 ? cur - 1 : -1;
    longestWin = Math.max(longestWin, cur);
    longestLoss = Math.min(longestLoss, cur);
    return { i: i + 1, id: t.id, date: t.closed_at ?? t.opened_at, balance: round(bal), pnl: round(p), drawdown: round(-dd) };
  });

  return {
    count: closed.length,
    openCount: trades.length - closed.length,
    net, grossProfit, grossLoss, winRate, avgWin, avgLoss, expectancy, avgR,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    largestWin: wins.length ? Math.max(...wins) : 0,
    largestLoss: losses.length ? Math.min(...losses) : 0,
    maxDD, maxDDPct, currentStreak: cur, longestWin, longestLoss: Math.abs(longestLoss),
    wins: wins.length, losses: losses.length, breakeven: closed.length - decided,
    equity,
  };
}

export function fmtMoney(n: number | null | undefined, currency = "USD") {
  if (n == null || !isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}
export const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

const CCY = new Set(["EUR","USD","GBP","JPY","CHF","AUD","CAD","NZD","SEK","NOK","MXN","ZAR","TRY","SGD","HKD","PLN","CNH"]);

/** Uppercase and strip broker suffixes: EURUSDm, EURUSD.pro, XAUUSD.a, GOLD#, US30.cash. */
export function normalizeSymbol(raw: string): string {
  const up = String(raw ?? "").trim().toUpperCase();
  const base = up.split(/[^A-Z0-9]/).find((p) => p.length > 0) ?? up;
  const six = base.slice(0, 6);
  if (/^[A-Z]{6}$/.test(six)) {
    const a = six.slice(0, 3), b = six.slice(3);
    if ((CCY.has(a) || a === "XAU" || a === "XAG") && CCY.has(b)) return six;
  }
  return base;
}

/** Price-based R for a closed trade with a stop loss; null otherwise. */
export function closedTradeR(dir: Dir, entry: number, sl: number | null | undefined, exit: number | null | undefined) {
  if (exit == null || sl == null || !sl) return null;
  return realizedRR(dir, entry, sl, exit);
}
