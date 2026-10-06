import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFilteredTrades } from "@/hooks/use-filtered-trades";
import { fmtMoney } from "@/lib/calc";
import { Empty, ErrorState, LoadingGrid, PageHeader, pnlClass } from "@/components/ui-kit";
import { useTradeDialog } from "@/components/AppShell";
import type { Trade } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/trades")({
  head: () => ({ meta: [{ title: "Trades — EdgeLog" }, { name: "description", content: "All your trades, searchable and sortable." }] }),
  component: TradesPage,
});

type Key = "opened_at" | "symbol" | "net_pnl" | "pips" | "r_multiple" | "lot_size";

function TradesPage() {
  const { trades, accounts, isLoading, error, refetch } = useFilteredTrades();
  const { openTrade } = useTradeDialog();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: Key; asc: boolean }>({ k: "opened_at", asc: false });
  const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "";

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? trades.filter((t) => [t.symbol, t.notes, ...(t.tags ?? []), ...(t.mistake_tags ?? [])].some((x) => x?.toLowerCase().includes(s))) : trades;
    return [...list].sort((a, b) => {
      const av = a[sort.k], bv = b[sort.k];
      const r = typeof av === "string" ? String(av).localeCompare(String(bv)) : Number(av ?? -Infinity) - Number(bv ?? -Infinity);
      return sort.asc ? r : -r;
    });
  }, [trades, q, sort]);

  function exportCsv() {
    const cols: (keyof Trade)[] = ["opened_at", "closed_at", "symbol", "direction", "entry_price", "exit_price", "stop_loss", "take_profit", "lot_size", "gross_pnl", "commission", "swap", "net_pnl", "pips", "r_multiple", "session", "notes"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "edgelog-trades.csv"; a.click(); URL.revokeObjectURL(url);
  }

  const H = ({ k, children }: { k: Key; children: string }) => (
    <TableHead><button className="hover:text-foreground" onClick={() => setSort((s) => ({ k, asc: s.k === k ? !s.asc : false }))}>{children}{sort.k === k ? (sort.asc ? " ↑" : " ↓") : ""}</button></TableHead>
  );

  if (isLoading) return <LoadingGrid />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  return (
    <>
      <PageHeader title="Trades" sub={`${rows.length} trades`} action={<div className="flex gap-2"><Button variant="outline" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button><Button onClick={() => openTrade()}>Log trade</Button></div>} />
      <Input placeholder="Search symbol, tag, note…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />
      {rows.length === 0 ? <Empty title="No trades found" text="Log a trade, import a CSV, or connect your broker." action={<Button onClick={() => openTrade()}>Log trade</Button>} /> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <H k="opened_at">Opened</H><H k="symbol">Symbol</H><TableHead>Side</TableHead><TableHead>Account</TableHead>
                <H k="lot_size">Lots</H><TableHead>Entry → Exit</TableHead><H k="pips">Pips</H><H k="r_multiple">R</H><H k="net_pnl">Net P&L</H><TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => openTrade(t)}>
                  <TableCell className="num whitespace-nowrap text-xs">{format(new Date(t.opened_at), "yyyy-MM-dd HH:mm")}</TableCell>
                  <TableCell className="font-semibold">{t.symbol}{t.is_demo && <span className="ml-2 rounded bg-gold/20 px-1 text-xs text-gold">DEMO</span>}</TableCell>
                  <TableCell className={t.direction === "long" ? "text-profit" : "text-loss"}>{t.direction === "long" ? "▲ Long" : "▼ Short"}</TableCell>
                  <TableCell className="text-muted-foreground">{accName(t.account_id)}</TableCell>
                  <TableCell className="num">{t.lot_size}</TableCell>
                  <TableCell className="num whitespace-nowrap text-xs">{t.entry_price} → {t.exit_price ?? "open"}</TableCell>
                  <TableCell className={`num ${pnlClass(t.pips)}`}>{t.pips ?? "—"}</TableCell>
                  <TableCell className={`num ${pnlClass(t.r_multiple)}`}>{t.r_multiple != null ? `${t.r_multiple}R` : "—"}</TableCell>
                  <TableCell className={`num font-semibold ${pnlClass(Number(t.net_pnl))}`}>{t.status === "open" ? "OPEN" : fmtMoney(Number(t.net_pnl))}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{[...(t.tags ?? []), ...(t.mistake_tags ?? [])].join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
