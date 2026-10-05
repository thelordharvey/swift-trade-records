import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { subDays, startOfMonth, startOfYear } from "date-fns";
import type { Trade } from "./queries";

export type Range = "7d" | "30d" | "mtd" | "ytd" | "all";
interface Filters {
  accountId: string; // "all" or id
  range: Range;
  symbol: string; // "all" or symbol
  direction: "all" | "long" | "short";
}
const Ctx = createContext<{ filters: Filters; set: (f: Partial<Filters>) => void } | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setF] = useState<Filters>({ accountId: "all", range: "all", symbol: "all", direction: "all" });
  const value = useMemo(() => ({ filters, set: (f: Partial<Filters>) => setF((p) => ({ ...p, ...f })) }), [filters]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilters() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useFilters outside FilterProvider");
  return c;
}

export function applyFilters(trades: Trade[], f: Filters) {
  const now = new Date();
  const from =
    f.range === "7d" ? subDays(now, 7)
    : f.range === "30d" ? subDays(now, 30)
    : f.range === "mtd" ? startOfMonth(now)
    : f.range === "ytd" ? startOfYear(now)
    : null;
  return trades.filter(
    (t) =>
      (f.accountId === "all" || t.account_id === f.accountId) &&
      (f.symbol === "all" || t.symbol === f.symbol) &&
      (f.direction === "all" || t.direction === f.direction) &&
      (!from || new Date(t.opened_at) >= from),
  );
}
