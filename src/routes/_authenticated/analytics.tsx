import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFilteredTrades } from "@/hooks/use-filtered-trades";
import { useFilters } from "@/lib/filters";
import { computeStats, fmtMoney, fmtPct } from "@/lib/calc";
import { Card, Empty, ErrorState, Kpi, LoadingGrid, PageHeader, pnlClass } from "@/components/ui-kit";
import type { Trade } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — EdgeLog" }, { name: "description", content: "Performance breakdowns by symbol, session, hour and behaviour." }] }),
  component: Analytics,
});

const dims: Record<string, { label: string; key: (t: Trade) => string[] }> = {
  symbol: { label: "Symbol", key: (t) => [t.symbol] },
  session: { label: "Session", key: (t) => [t.session ?? "unknown"] },
  hour: { label: "Hour (local)", key: (t) => [String(new Date(t.opened_at).getHours()).padStart(2, "0") + ":00"] },
  direction: { label: "Direction", key: (t) => [t.direction] },
  plan: { label: "Followed plan", key: (t) => [t.followed_plan == null ? "unset" : t.followed_plan ? "yes" : "no"] },
  emotion: { label: "Emotion before", key: (t) => [t.emotion_before || "unset"] },
  tag: { label: "Tag", key: (t) => (t.tags?.length ? t.tags : ["untagged"]) },
  mistake: { label: "Mistake", key: (t) => (t.mistake_tags?.length ? t.mistake_tags : ["none"]) },
};
const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 } };

function Analytics() {
  const { trades, startingBalance, currency, isLoading, error, refetch } = useFilteredTrades();
  const { set } = useFilters();
  const [dim, setDim] = useState("symbol");
  const [dropWorst, setDropWorst] = useState(0);
  const closed = useMemo(() => trades.filter((t) => t.status === "closed"), [trades]);
  const s = useMemo(() => computeStats(closed, startingBalance), [closed, startingBalance]);

  const rows = useMemo(() => {
    const m = new Map<string, Trade[]>();
    closed.forEach((t) => (dims[dim] ?? dims.symbol!).key(t).forEach((k) => m.set(k, [...(m.get(k) ?? []), t])));
    return Array.from(m.entries()).map(([k, ts]) => {
      const st = computeStats(ts);
      return { k, n: st.count, net: Math.round(st.net * 100) / 100, wr: st.winRate, pf: st.profitFactor, exp: st.expectancy };
    }).sort((a, b) => b.net - a.net);
  }, [closed, dim]);

  const mistakeCost = useMemo(() => closed.filter((t) => t.mistake_tags?.length && Number(t.net_pnl) < 0).reduce((a, t) => a + Number(t.net_pnl), 0), [closed]);
  const sim = useMemo(() => {
    const sorted = [...closed].sort((a, b) => Number(a.net_pnl) - Number(b.net_pnl));
    const removed = new Set(sorted.slice(0, dropWorst).map((t) => t.id));
    return computeStats(closed.filter((t) => !removed.has(t.id)), startingBalance);
  }, [closed, dropWorst, startingBalance]);

  if (isLoading) return <LoadingGrid />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (!closed.length) return <><PageHeader title="Analytics" /><Empty title="Nothing to analyse yet" text="Close a few trades to unlock analytics." /></>;

  return (
    <>
      <PageHeader title="Analytics" sub={`${s.count} closed trades`} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Avg win" value={fmtMoney(s.avgWin, currency)} tone={1} />
        <Kpi label="Avg loss" value={fmtMoney(-s.avgLoss, currency)} tone={-1} />
        <Kpi label="Longest win / loss streak" value={`${s.longestWin} / ${s.longestLoss}`} />
        <Kpi label="Cost of mistakes" value={fmtMoney(mistakeCost, currency)} tone={mistakeCost} />
      </div>
      <Card title="Performance by">
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(dims).map(([k, d]) => (
            <button key={k} onClick={() => setDim(k)} className={cn("rounded-full border px-3 py-1 text-xs", dim === k ? "border-primary bg-primary/20 text-foreground" : "text-muted-foreground")}>{d.label}</button>
          ))}
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={rows} onClick={(e) => { const k = e?.activeLabel; if (dim === "symbol" && k) set({ symbol: String(k) }); if (dim === "direction" && (k === "long" || k === "short")) set({ direction: k }); }}>
              <XAxis dataKey="k" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip {...tip} formatter={(v: number) => fmtMoney(v, currency)} />
              <Bar dataKey="net" radius={[4, 4, 0, 0]}>{rows.map((r) => <Cell key={r.k} fill={r.net >= 0 ? "var(--profit)" : "var(--loss)"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">{dims[dim]?.label}</th><th>Trades</th><th>Win rate</th><th>Profit factor</th><th>Expectancy</th><th className="text-right">Net</th></tr></thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.k}>
                <td className="py-2 font-medium">{r.k}</td><td className="num">{r.n}</td><td className="num">{fmtPct(r.wr)}</td>
                <td className="num">{isFinite(r.pf) ? r.pf.toFixed(2) : "∞"}</td><td className={`num ${pnlClass(r.exp)}`}>{fmtMoney(r.exp, currency)}</td>
                <td className={`num text-right font-semibold ${pnlClass(r.net)}`}>{fmtMoney(r.net, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(dim === "symbol" || dim === "direction") && <p className="mt-2 text-xs text-muted-foreground">Click a bar to filter every page by it.</p>}
      </Card>
      <Card title="What-if simulator" className="mt-4">
        <label className="text-sm">Remove my worst <span className="num font-semibold text-gold">{dropWorst}</span> trades</label>
        <input type="range" min={0} max={Math.min(20, closed.length)} value={dropWorst} onChange={(e) => setDropWorst(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" aria-label="Worst trades to remove" />
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Kpi label="Net P&L" value={fmtMoney(sim.net, currency)} tone={sim.net} />
          <Kpi label="Win rate" value={fmtPct(sim.winRate)} />
          <Kpi label="Difference" value={fmtMoney(sim.net - s.net, currency)} tone={sim.net - s.net} />
        </div>
      </Card>
    </>
  );
}
