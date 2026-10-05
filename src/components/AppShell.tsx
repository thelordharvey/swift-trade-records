import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, ListOrdered, CalendarDays, BarChart3, BookOpen, Plug, LogOut, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  { to: "/accounts", label: "Accounts & Sync", icon: Plug },
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
        <div className="flex min-h-screen">
          <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
            <Link to="/dashboard" className="mb-8 px-2 text-lg font-bold">Edge<span className="text-gold">Log</span></Link>
            <nav className="flex-1 space-y-1">
              {nav.map((n) => (
                <Link key={n.to} to={n.to} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground" activeProps={{ className: "bg-sidebar-accent text-foreground" }}>
                  <n.icon className="h-4 w-4" aria-hidden /> {n.label}
                </Link>
              ))}
            </nav>
            <Button onClick={() => openTrade()} className="mb-2"><Plus className="h-4 w-4" /> New trade <kbd className="num ml-auto text-xs opacity-70">N</kbd></Button>
            <Button variant="ghost" onClick={signOut} className="justify-start text-muted-foreground"><LogOut className="h-4 w-4" /> Sign out</Button>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
            <FilterBar />
            <main className="flex-1 p-4 md:p-8">{children}</main>
          </div>
        </div>
        {/* mobile nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-sidebar py-2 md:hidden">
          {nav.slice(0, 5).map((n) => (
            <Link key={n.to} to={n.to} aria-label={n.label} className="p-2 text-muted-foreground" activeProps={{ className: "text-gold" }}>
              <n.icon className="h-5 w-5" />
            </Link>
          ))}
        </nav>
        <Button size="icon" aria-label="New trade" onClick={() => openTrade()} className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full md:hidden"><Plus /></Button>
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
    <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b bg-background/85 px-4 py-3 backdrop-blur md:px-8">
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
