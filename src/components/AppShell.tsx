import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, ListOrdered, CalendarDays, BarChart3, BookOpen, Plug, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterProvider, useFilters, type Range } from "@/lib/filters";
import { accountsQuery, tradesQuery, type Trade } from "@/lib/queries";
import { TradeDialog } from "./TradeDialog";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/trades", label: "Trades", icon: ListOrdered },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/accounts", label: "Accounts", icon: Plug },
] as const;

const TradeCtx = createContext<{ openTrade: (t?: Trade | null) => void } | null>(null);
export const useTradeDialog = () => {
  const c = useContext(TradeCtx);
  if (!c) throw new Error("useTradeDialog outside AppShell");
  return c;
};

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Trade | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Realtime: trades pushed by the broker API appear live.
  useEffect(() => {
    const ch = supabase
      .channel("trades-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, (payload) => {
        qc.invalidateQueries({ queryKey: ["trades"] });
        if (payload.eventType === "INSERT") {
          const t = payload.new as Trade;
          if (t.source === "api") toast.success(`New ${t.symbol} trade synced from broker`);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // Keyboard: N = new trade
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input,textarea,select,[contenteditable],[role=dialog]")) return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); setEditing(null); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const openTrade = (t?: Trade | null) => { setEditing(t ?? null); setOpen(true); };

  return (
    <FilterProvider>
      <TradeCtx.Provider value={{ openTrade }}>
        <div className="min-h-screen">
          <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur">
            <div className="mx-auto flex max-w-[1180px] items-center gap-6 px-6 py-5">
              <Link to="/dashboard" className="font-mono text-base font-semibold tracking-[0.25em]">LORD<span className="text-primary">ROSEN</span></Link>
              <nav className="hidden flex-1 items-center gap-5 lg:flex">
                {nav.map((n) => (
                  <Link key={n.to} to={n.to} className="label-mono text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "text-primary" }}>{n.label}</Link>
                ))}
              </nav>
              <div className="ml-auto flex items-center gap-3">
                <button onClick={signOut} className="label-mono hidden px-3 text-muted-foreground hover:text-foreground sm:inline">Sign out</button>
                <Link to="/accounts" className="label-mono inline-flex items-center gap-2 rounded-md border border-input px-5 py-3 text-foreground hover:border-primary"><Plug className="h-4 w-4" /> Connect</Link>
                <button onClick={() => openTrade()} className="label-mono inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> Log trade</button>
              </div>
            </div>
          </header>
          <FilterBar />
          <main className="mx-auto max-w-[1180px] px-6 py-6 pb-24 lg:pb-10">{children}</main>
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-background/90 py-2 backdrop-blur lg:hidden">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} aria-label={n.label} className="p-2 text-muted-foreground" activeProps={{ className: "text-primary" }}>
              <n.icon className="h-5 w-5" />
            </Link>
          ))}
        </nav>
        <TradeDialog open={open} onOpenChange={setOpen} trade={editing} />
      </TradeCtx.Provider>
    </FilterProvider>
  );
}

function FilterBar() {
  const { filters, set } = useFilters();
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: trades = [] } = useQuery(tradesQuery());
  const symbols = Array.from(new Set(trades.map((t) => t.symbol))).sort();
  return (
    <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-2 px-6 pt-5">
      <Select value={filters.accountId} onValueChange={(v) => set({ accountId: v })}>
        <SelectTrigger className="h-8 w-40" aria-label="Account"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All accounts</SelectItem>
          {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.range} onValueChange={(v) => set({ range: v as Range })}>
        <SelectTrigger className="h-8 w-32" aria-label="Date range"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All time</SelectItem>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="mtd">This month</SelectItem>
          <SelectItem value="ytd">This year</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.symbol} onValueChange={(v) => set({ symbol: v })}>
        <SelectTrigger className="h-8 w-32" aria-label="Symbol"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All symbols</SelectItem>
          {symbols.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.direction} onValueChange={(v) => set({ direction: v as "all" | "long" | "short" })}>
        <SelectTrigger className="h-8 w-28" aria-label="Direction"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Long & short</SelectItem>
          <SelectItem value="long">Long</SelectItem>
          <SelectItem value="short">Short</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
