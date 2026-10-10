import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useFilteredTrades } from "@/hooks/use-filtered-trades";
import { computeStats, fmtMoney, fmtPct } from "@/lib/calc";
import { Card, Empty, ErrorState, Kpi, LoadingGrid, PageHeader, pnlClass } from "@/components/ui-kit";
import { useTradeDialog } from "@/components/AppShell";
import { assetClass } from "@/lib/calc";
import { cn } from "@/lib/utils";

const PIE = ["var(--primary)", "var(--profit)", "var(--chart-5)", "var(--loss)"];

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
    trades.filter((t) => t.status === "closed").forEach((t) => { const e = m[new Date(t.closed_at ?? t.opened_at).getDay()]; if (e) e.pnl += Number(t.net_pnl ?? 0); });
    return m.slice(1, 6).map((x) => ({ ...x, pnl: Math.round(x.pnl * 100) / 100 }));
  }, [trades]);

  const assets = useMemo(() => {
    const m = new Map<string, number>();
    trades.forEach((t) => { const k = assetClass(t.symbol); m.set(k, (m.get(k) ?? 0) + 1); });
    return Array.from(m, ([n, v]) => ({ n, v }));
  }, [trades]);
  if (isLoading) return <LoadingGrid />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (accounts.length === 0)
    return <><PageHeader title="Dashboard" /><Empty title="Welcome to EdgeLog" text="Add your first trading account, then log or sync trades." action={<Button asChild><Link to="/accounts">Add account</Link></Button>} /></>;

  return (
    <>
      
      {s.count === 0 ? (
        <Empty title="No closed trades yet" text="Log a trade or connect your broker to see your stats." action={<Button onClick={() => openTrade()}>Log first trade</Button>} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            <Kpi big highlight label="Net PnL" value={(s.net >= 0 ? "+" : "") + fmtMoney(s.net, currency)} />
            <Kpi big label="Win rate" value={fmtPct(s.winRate)} />
            <Kpi big label="Profit factor" value={isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : "∞"} />
            <Kpi big label="Open trades" value={String(s.openCount)} />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_372px]">
            <Card title="Equity curve">
              <div className="h-80">
                <ResponsiveContainer>
                  <AreaChart data={[{ i: 0, id: "", balance: startingBalance, date: "" }, ...s.equity]} onClick={(e) => { const p = e?.activePayload?.[0]?.payload; const t = p && trades.find((x) => x.id === p.id); if (t) openTrade(t); }}>
                    <defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="2 6" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d) => (d ? format(new Date(d), "MMM d") : "")} stroke="var(--muted-foreground)" fontSize={10} fontFamily="var(--font-mono)" tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={10} fontFamily="var(--font-mono)" tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => "$" + Math.round(v)} width={56} />
                    <Tooltip {...tip} formatter={(v: number) => fmtMoney(v, currency)} labelFormatter={(d) => (d ? format(new Date(d), "dd MMM yyyy HH:mm") : "Start")} />
                    <Area type="stepAfter" dataKey="balance" stroke="var(--primary)" fill="url(#eq)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <div className="space-y-6">
              <Card title="Active adapters">
                <div className="space-y-4">
                  {accounts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{a.broker || a.name} / {a.platform}</p>
                        <p className="label-mono mt-1 truncate text-muted-foreground">{a.name}</p>
                      </div>
                      <span className={cn("label-mono font-semibold", a.ingest_key_prefix ? "text-primary" : "text-muted-foreground")}>{a.ingest_key_prefix ? "Connected" : "Manual"}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Asset class">
                <div className="flex items-center gap-6">
                  <div className="h-44 w-44 shrink-0">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={assets} dataKey="v" nameKey="n" innerRadius={58} outerRadius={72} stroke="none" paddingAngle={2}>
                          {assets.map((x, i) => <Cell key={x.n} fill={PIE[i % PIE.length]} />)}
                        </Pie>
                        <Tooltip {...tip} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-3">
                    {assets.map((x, i) => (
                      <li key={x.n} className="label-mono flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: PIE[i % PIE.length] }} />{x.n}</li>
                    ))}
                  </ul>
                </div>
              </Card>
            </div>
          </div>
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
