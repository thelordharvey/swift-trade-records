import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { accountsQuery, tradesQuery } from "@/lib/queries";
import { applyFilters, useFilters } from "@/lib/filters";

export function useFilteredTrades() {
  const { filters } = useFilters();
  const trades = useQuery(tradesQuery());
  const accounts = useQuery(accountsQuery());
  const filtered = useMemo(() => applyFilters(trades.data ?? [], filters), [trades.data, filters]);
  const startingBalance = useMemo(() => {
    const accs = accounts.data ?? [];
    const sel = filters.accountId === "all" ? accs : accs.filter((a) => a.id === filters.accountId);
    return sel.reduce((s, a) => s + Number(a.starting_balance), 0);
  }, [accounts.data, filters.accountId]);
  const currency = accounts.data?.find((a) => a.id === filters.accountId)?.currency ?? accounts.data?.[0]?.currency ?? "USD";
  return {
    trades: filtered,
    accounts: accounts.data ?? [],
    startingBalance,
    currency,
    isLoading: trades.isLoading || accounts.isLoading,
    error: trades.error ?? accounts.error,
    refetch: () => { trades.refetch(); accounts.refetch(); },
  };
}
