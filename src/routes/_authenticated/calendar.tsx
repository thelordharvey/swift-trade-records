import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useFilteredTrades } from "@/hooks/use-filtered-trades";
import { fmtMoney } from "@/lib/calc";
import { ErrorState, LoadingGrid, PageHeader, pnlClass } from "@/components/ui-kit";
import { useTradeDialog } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — LordRosen" }, { name: "description", content: "Daily P&L calendar." }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const { trades, currency, isLoading, error, refetch } = useFilteredTrades();
  const { openTrade } = useTradeDialog();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [day, setDay] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, { pnl: number; n: number; w: number }>();
    trades.filter((t) => t.status === "closed").forEach((t) => {
      const k = format(new Date(t.closed_at ?? t.opened_at), "yyyy-MM-dd");
      const v = m.get(k) ?? { pnl: 0, n: 0, w: 0 };
      const p = Number(t.net_pnl ?? 0);
      v.pnl += p; v.n++; if (p > 0) v.w++;
      m.set(k, v);
    });
    return m;
  }, [trades]);
  const maxAbs = Math.max(1, ...Array.from(byDay.values()).map((v) => Math.abs(v.pnl)));
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  const dayTrades = day ? trades.filter((t) => format(new Date(t.closed_at ?? t.opened_at), "yyyy-MM-dd") === day) : [];

  if (isLoading) return <LoadingGrid />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  return (
    <>
      <PageHeader title="Calendar" action={
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}><ChevronLeft /></Button>
          <span className="w-36 text-center font-semibold">{format(month, "MMMM yyyy")}</span>
          <Button size="icon" variant="outline" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight /></Button>
        </div>} />
      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-8 gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Week"].map((d) => <div key={d} className="text-center text-xs text-muted-foreground">{d}</div>)}
          {weeks.map((w, wi) => {
            const wk = w.reduce((s, d) => { const v = byDay.get(format(d, "yyyy-MM-dd")); return { pnl: s.pnl + (v?.pnl ?? 0), n: s.n + (v?.n ?? 0) }; }, { pnl: 0, n: 0 });
            return [
              ...w.map((d) => {
                const k = format(d, "yyyy-MM-dd");
                const v = byDay.get(k);
                const a = v ? Math.min(0.55, 0.12 + (Math.abs(v.pnl) / maxAbs) * 0.45) : 0;
                return (
                  <button key={k} onClick={() => setDay(k)} title={v ? `${fmtMoney(v.pnl, currency)} · ${v.n} trades · ${Math.round((v.w / v.n) * 100)}% WR` : "No trades"}
                    className={cn("h-24 rounded-lg border p-2 text-left transition-colors hover:border-primary", !isSameMonth(d, month) && "opacity-40")}
                    style={v ? { backgroundColor: `color-mix(in oklab, var(${v.pnl >= 0 ? "--profit" : "--loss"}) ${a * 100}%, var(--card))` } : { backgroundColor: "var(--card)" }}>
                    <div className="text-xs text-muted-foreground">{format(d, "d")}</div>
                    {v && <><div className="num mt-2 text-sm font-semibold">{fmtMoney(v.pnl, currency)}</div><div className="text-xs text-muted-foreground">{v.n} trade{v.n > 1 ? "s" : ""}</div></>}
                  </button>
                );
              }),
              <div key={`w${wi}`} className="flex h-24 flex-col justify-center rounded-lg border bg-muted/40 p-2 text-center">
                <div className={`num text-sm font-semibold ${pnlClass(wk.pnl)}`}>{wk.n ? fmtMoney(wk.pnl, currency) : "—"}</div>
                <div className="text-xs text-muted-foreground">{wk.n} trades</div>
              </div>,
            ];
          })}
        </div>
      </div>
      <Sheet open={!!day} onOpenChange={(o) => !o && setDay(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>{day && format(new Date(day + "T00:00"), "EEEE d MMMM yyyy")}</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-2">
            {dayTrades.length === 0 && <p className="text-sm text-muted-foreground">No trades this day.</p>}
            {dayTrades.map((t) => (
              <button key={t.id} onClick={() => openTrade(t)} className="flex w-full justify-between rounded-md border p-3 text-sm hover:border-primary">
                <span><span className={t.direction === "long" ? "text-profit" : "text-loss"}>{t.direction === "long" ? "▲" : "▼"}</span> {t.symbol}</span>
                <span className={`num ${pnlClass(Number(t.net_pnl))}`}>{fmtMoney(Number(t.net_pnl), currency)}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
