import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useFilteredTrades } from "@/hooks/use-filtered-trades";
import { computeStats, fmtMoney, fmtPct } from "@/lib/calc";
import { Card, Empty, ErrorState, Kpi, LoadingGrid, PageHeader, pnlClass } from "@/components/ui-kit";
import { useTradeDialog } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — EdgeLog" }, { name: "description", content: "Your trading performance at a glance." }] }),
  component: Dashboard,
});

const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }, labelStyle: { color: "var(--muted-foreground)" } };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Dashboard() {
  const { trades, accounts, startingBalance, currency, isLoading, error, refetch } = useFilteredTrades();
  const { openTrade } = useTradeDialog();
  const s = useMemo(() => computeStats(trades, startingBalance), [trades, startingBalance]);
  const byDay = useMemo(() => {
    const m = DAYS.map((d) => ({ d, pnl: 0 }));
    trades.filter((t) => t.status === "closed").forEach((t) => (m[new Date(t.closed_at ?? t.opened_at).getDay()].pnl += Number(t.net_pnl ?? 0)));
    return m.slice(1, 6).map((x) => ({ ...x, pnl: Math.round(x.pnl * 100) / 100 }));
  }, [trades]);

  if (isLoading) return <LoadingGrid />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (accounts.length === 0)
    return <><PageHeader title="Dashboard" /><Empty title="Welcome to EdgeLog" text="Add your first trading account, then log or sync trades." action={<Button asChild><Link to="/accounts">Add account</Link></Button>} /></>;

  return (
    <>
      <PageHeader title="Dashboard" sub={`${s.count} closed trades · ${s.openCount} open`} action={<Button onClick={() => openTrade()}>Log trade</Button>} />
      {s.count === 0 ? (
        <Empty title="No closed trades yet" text="Log a trade or connect your broker to see your stats." action={<Button onClick={() => openTrade()}>Log first trade</Button>} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Net P&L" value={fmtMoney(s.net, currency)} tone={s.net} />
            <Kpi label="Win rate" value={fmtPct(s.winRate)} />
            <Kpi label="Profit factor" value={isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : "∞"} />
            <Kpi label="Expectancy / trade" value={fmtMoney(s.expectancy, currency)} tone={s.expectancy} />
            <Kpi label="Avg R" value={s.avgR != null ? `${s.avgR.toFixed(2)}R` : "—"} tone={s.avgR ?? undefined} />
            <Kpi label="Max drawdown" value={`${fmtMoney(s.maxDD, currency)} (${fmtPct(s.maxDDPct)})`} />
            <Kpi label="Largest win" value={fmtMoney(s.largestWin, currency)} tone={s.largestWin} />
            <Kpi label="Largest loss" value={fmtMoney(s.largestLoss, currency)} tone={s.largestLoss} />
          </div>
          <Card title="Equity curve">
            <div className="h-72">
              <ResponsiveContainer>
                <AreaChart data={s.equity} onClick={(e) => { const p = e?.activePayload?.[0]?.payload; const t = p && trades.find((x) => x.id === p.id); if (t) openTrade(t); }}>
                  <defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="i" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={["auto", "auto"]} />
                  <Tooltip {...tip} formatter={(v: number) => fmtMoney(v, currency)} labelFormatter={(i) => `Trade #${i}`} />
                  <Area type="monotone" dataKey="balance" stroke="var(--primary)" fill="url(#eq)" strokeWidth={2} />
                  <Area type="monotone" dataKey="drawdown" stroke="var(--loss)" fill="var(--loss)" fillOpacity={0.15} strokeWidth={1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Click a point to open that trade.</p>
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Win / Loss">
              <div className="h-52">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={[{ n: "Wins", v: s.wins }, { n: "Losses", v: s.losses }, { n: "Break-even", v: s.breakeven }]} dataKey="v" nameKey="n" innerRadius={50} outerRadius={80}>
                      <Cell fill="var(--profit)" /><Cell fill="var(--loss)" /><Cell fill="var(--muted-foreground)" />
                    </Pie>
                    <Tooltip {...tip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="P&L by weekday" className="lg:col-span-2">
              <div className="h-52">
                <ResponsiveContainer>
                  <BarChart data={byDay}>
                    <XAxis dataKey="d" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip {...tip} formatter={(v: number) => fmtMoney(v, currency)} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>{byDay.map((d) => <Cell key={d.d} fill={d.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <Card title="Recent trades">
            <div className="divide-y">
              {trades.slice(0, 10).map((t) => (
                <button key={t.id} onClick={() => openTrade(t)} className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:bg-accent/40">
                  <span className="flex items-center gap-3">
                    <span className={t.direction === "long" ? "text-profit" : "text-loss"}>{t.direction === "long" ? "▲" : "▼"}</span>
                    <span className="font-semibold">{t.symbol}</span>
                    <span className="text-muted-foreground">{format(new Date(t.opened_at), "dd MMM HH:mm")}</span>
                    {t.is_demo && <span className="rounded bg-gold/20 px-1.5 text-xs text-gold">DEMO</span>}
                  </span>
                  <span className={`num ${pnlClass(Number(t.net_pnl))}`}>{t.status === "open" ? "OPEN" : fmtMoney(Number(t.net_pnl), currency)}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
