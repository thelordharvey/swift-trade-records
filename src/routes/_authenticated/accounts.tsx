import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { z } from "zod";
import { Copy, KeyRound, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { accountsQuery, type Account } from "@/lib/queries";
import { calcPips, plannedRR, sessionOf } from "@/lib/calc";
import { Card, ErrorState, LoadingGrid, PageHeader } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Accounts & Broker Sync — EdgeLog" }, { name: "description", content: "Connect MT4/MT5 and other brokers, import CSV." }] }),
  component: AccountsPage,
});

const accSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(60),
  broker: z.string().trim().max(60),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, "3-letter currency"),
  starting_balance: z.number().min(0).max(1e10),
});

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function AccountsPage() {
  const qc = useQueryClient();
  const q = useQuery(accountsQuery());
  const [f, setF] = useState({ name: "", broker: "", platform: "MT5", account_type: "live", currency: "USD", starting_balance: "10000" });
  const [newKey, setNewKey] = useState<{ id: string; key: string } | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const p = accSchema.safeParse({ ...f, currency: f.currency.toUpperCase(), starting_balance: Number(f.starting_balance) });
      if (!p.success) throw new Error(p.error.issues[0]?.message ?? "Invalid input");
      const { error } = await supabase.from("accounts").insert({ ...p.data, platform: f.platform, account_type: f.account_type });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounts"] }); toast.success("Account created"); setF({ ...f, name: "", broker: "" }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const genKey = useMutation({
    mutationFn: async (a: Account) => {
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      const key = "el_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const { error } = await supabase.from("accounts").update({ ingest_api_key_hash: await sha256(key), ingest_key_prefix: key.slice(0, 9) }).eq("id", a.id);
      if (error) throw error;
      return { id: a.id, key };
    },
    onSuccess: (r) => { setNewKey(r); qc.invalidateQueries({ queryKey: ["accounts"] }); toast.success("New API key generated — copy it now"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (q.isLoading) return <LoadingGrid />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const accounts = q.data ?? [];
  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/public/ingest` : "/api/public/ingest";

  return (
    <>
      <PageHeader title="Accounts & Broker Sync" sub="Connect any broker via the sync API, or import a CSV." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Add trading account">
          <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <div className="col-span-2 space-y-1"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="FTMO 100k" /></div>
            <div className="space-y-1"><Label>Broker</Label><Input value={f.broker} onChange={(e) => setF({ ...f, broker: e.target.value })} placeholder="IC Markets" /></div>
            <div className="space-y-1"><Label>Platform</Label>
              <Select value={f.platform} onValueChange={(v) => setF({ ...f, platform: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["MT4", "MT5", "cTrader", "TradeLocker", "Other"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Type</Label>
              <Select value={f.account_type} onValueChange={(v) => setF({ ...f, account_type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="live">Live</SelectItem><SelectItem value="demo">Demo</SelectItem><SelectItem value="prop">Prop firm</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label>Currency</Label><Input value={f.currency} maxLength={3} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></div>
            <div className="col-span-2 space-y-1"><Label>Starting balance</Label><Input className="num" type="number" min={0} value={f.starting_balance} onChange={(e) => setF({ ...f, starting_balance: e.target.value })} /></div>
            <Button className="col-span-2" type="submit" disabled={create.isPending}>Create account</Button>
          </form>
        </Card>
        <Card title="Your accounts">
          {accounts.length === 0 ? <p className="text-sm text-muted-foreground">No accounts yet.</p> : (
            <div className="space-y-3">
              {accounts.map((a) => (
                <div key={a.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{a.name} <span className="text-xs text-muted-foreground">{a.platform} · {a.account_type} · {a.currency}</span></p>
                      <p className="text-xs text-muted-foreground">
                        {a.ingest_key_prefix ? `Key ${a.ingest_key_prefix}… · ${a.last_sync_at ? "last sync " + formatDistanceToNow(new Date(a.last_sync_at)) + " ago" : "never synced"}` : "Not connected"}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => genKey.mutate(a)} disabled={genKey.isPending}><KeyRound className="h-4 w-4" />{a.ingest_key_prefix ? "Rotate key" : "Connect"}</Button>
                  </div>
                  {newKey?.id === a.id && (
                    <div className="mt-3 rounded-md border border-gold/50 bg-gold/10 p-2">
                      <p className="text-xs text-gold">Copy this key now — it won't be shown again.</p>
                      <div className="mt-1 flex gap-2"><code className="num flex-1 break-all text-xs">{newKey.key}</code>
                        <Button size="icon" variant="ghost" aria-label="Copy key" onClick={() => { navigator.clipboard.writeText(newKey.key); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Connect your broker (MT4 / MT5 / cTrader / any bridge)" className="mt-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Click <b>Connect</b> on an account to get its private API key.</li>
          <li>Send closed (or open) trades as JSON to the endpoint below with header <code>x-api-key</code>.</li>
          <li>Re-sending the same ticket (<code>external_id</code>) updates it — no duplicates. Trades appear live.</li>
        </ol>
        <pre className="num mt-4 overflow-x-auto rounded-lg bg-background p-4 text-xs">{`curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" -H "x-api-key: YOUR_KEY" \\
  -d '[{"external_id":"123456","symbol":"XAUUSD","direction":"buy",
        "opened_at":"2026-10-05T09:15:00Z","closed_at":"2026-10-05T10:02:00Z",
        "entry_price":2650.5,"exit_price":2658.1,"stop_loss":2645,"take_profit":2665,
        "lot_size":0.5,"gross_pnl":380,"commission":-3.5,"swap":0}]'`}</pre>
        <p className="mt-4 text-sm font-semibold">Python bridge for MetaTrader 5 (runs on your PC)</p>
        <pre className="num mt-2 overflow-x-auto rounded-lg bg-background p-4 text-xs">{`import MetaTrader5 as mt5, requests, datetime as dt
KEY = "YOUR_KEY"; URL = "${endpoint}"
mt5.initialize()
deals = mt5.history_deals_get(dt.datetime.now() - dt.timedelta(days=30), dt.datetime.now())
opens = {d.position_id: d for d in deals if d.entry == 0}
out = []
for d in deals:
    if d.entry != 1 or d.position_id not in opens: continue
    o = opens[d.position_id]
    out.append({"external_id": str(d.position_id), "symbol": d.symbol,
        "direction": "buy" if o.type == 0 else "sell",
        "opened_at": dt.datetime.utcfromtimestamp(o.time).isoformat() + "Z",
        "closed_at": dt.datetime.utcfromtimestamp(d.time).isoformat() + "Z",
        "entry_price": o.price, "exit_price": d.price, "lot_size": d.volume,
        "gross_pnl": d.profit, "commission": d.commission + o.commission, "swap": d.swap})
for i in range(0, len(out), 500):
    print(requests.post(URL, json=out[i:i+500], headers={"x-api-key": KEY}).json())`}</pre>
      </Card>

      <CsvImport accounts={accounts} />
    </>
  );
}

function parseCsv(text: string) {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const delim = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') inQ = false; else cell += c; }
    else if (c === '"') inQ = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

const FIELDS = ["external_id", "symbol", "direction", "opened_at", "closed_at", "entry_price", "exit_price", "stop_loss", "take_profit", "lot_size", "gross_pnl", "commission", "swap"] as const;

function CsvImport({ accounts }: { accounts: Account[] }) {
  const qc = useQueryClient();
  const [acc, setAcc] = useState("");
  const [data, setData] = useState<string[][] | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    if (file.size > 5_000_000) return toast.error("File too large (max 5 MB)");
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return toast.error("CSV has no data rows");
    setData(rows);
    const h = rows[0].map((x) => x.trim().toLowerCase());
    const guess: Record<string, string> = {};
    const alias: Record<string, string[]> = {
      external_id: ["external_id", "ticket", "position", "id", "order"], symbol: ["symbol", "pair", "instrument", "item"],
      direction: ["direction", "type", "side"], opened_at: ["opened_at", "open time", "open_time", "time"], closed_at: ["closed_at", "close time", "close_time"],
      entry_price: ["entry_price", "open price", "entry", "price"], exit_price: ["exit_price", "close price", "exit"], stop_loss: ["stop_loss", "s / l", "sl", "s/l"],
      take_profit: ["take_profit", "t / p", "tp", "t/p"], lot_size: ["lot_size", "volume", "size", "lots"], gross_pnl: ["gross_pnl", "profit", "pnl", "p&l"],
      commission: ["commission"], swap: ["swap"],
    };
    FIELDS.forEach((f) => { const i = h.findIndex((x) => alias[f].includes(x)); if (i >= 0) guess[f] = String(i); });
    setMap(guess);
  }

  async function runImport() {
    if (!data || !acc) return toast.error("Choose an account and file");
    for (const f of ["symbol", "direction", "opened_at", "entry_price"]) if (!map[f]) return toast.error(`Map the "${f}" column`);
    setBusy(true);
    try {
      const get = (r: string[], f: string) => (map[f] != null && map[f] !== "" ? r[Number(map[f])]?.trim() ?? "" : "");
      const n = (s: string) => (s === "" ? null : Number(s.replace(/\s/g, "").replace(",", ".")));
      const errors: string[] = [];
      const rows = data.slice(1).flatMap((r, idx) => {
        const symbol = get(r, "symbol").toUpperCase();
        const d = get(r, "direction").toLowerCase();
        const direction = d.startsWith("b") || d === "long" ? "long" : d.startsWith("s") ? "short" : null;
        const entry = n(get(r, "entry_price"));
        const openedDate = new Date(get(r, "opened_at").replace(/\./g, "-"));
        if (!symbol || !direction || !entry || isNaN(+openedDate)) { errors.push(`Row ${idx + 2}`); return []; }
        const exit = n(get(r, "exit_price"));
        const closedRaw = get(r, "closed_at");
        const closed = closedRaw ? new Date(closedRaw.replace(/\./g, "-")) : null;
        const opened = openedDate.toISOString();
        const sl = n(get(r, "stop_loss")) || null, tp = n(get(r, "take_profit")) || null;
        return [{
          account_id: acc, external_id: get(r, "external_id") || `csv-${symbol}-${opened}-${entry}`, source: "csv",
          symbol, direction, status: exit != null ? "closed" : "open", opened_at: opened,
          closed_at: exit != null ? (closed && !isNaN(+closed) ? closed.toISOString() : opened) : null,
          entry_price: entry, exit_price: exit, stop_loss: sl, take_profit: tp, lot_size: n(get(r, "lot_size")) || 0.01,
          gross_pnl: n(get(r, "gross_pnl")) ?? 0, commission: n(get(r, "commission")) ?? 0, swap: n(get(r, "swap")) ?? 0,
          pips: calcPips(symbol, direction, entry, exit), planned_rr: plannedRR(entry, sl, tp), session: sessionOf(opened),
        }];
      });
      let imported = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const { error, count } = await supabase.from("trades").upsert(rows.slice(i, i + 500), { onConflict: "account_id,external_id", count: "exact" });
        if (error) throw error;
        imported += count ?? 0;
      }
      await supabase.from("import_jobs").insert({ account_id: acc, source: "csv", rows_total: data.length - 1, rows_imported: imported, rows_skipped: errors.length, errors });
      qc.invalidateQueries({ queryKey: ["trades"] });
      toast.success(`Imported ${imported} trades${errors.length ? `, skipped ${errors.length} invalid rows` : ""}. Duplicates were merged.`);
      setData(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally { setBusy(false); }
  }

  return (
    <Card title="CSV import (MT4/MT5 history export, broker statements)" className="mt-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label>Account</Label>
          <Select value={acc} onValueChange={setAcc}><SelectTrigger className="w-48"><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm hover:border-primary">
          <Upload className="h-4 w-4" /> Choose CSV
          <input type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      </div>
      {data && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{data.length - 1} rows found. Match your columns:</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {FIELDS.map((f) => (
              <div key={f} className="space-y-1"><Label className="text-xs">{f}</Label>
                <Select value={map[f] ?? "none"} onValueChange={(v) => setMap({ ...map, [f]: v === "none" ? "" : v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">—</SelectItem>{data[0].map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Column ${i + 1}`}</SelectItem>)}</SelectContent>
                </Select></div>
            ))}
          </div>
          <Button onClick={runImport} disabled={busy}>{busy ? "Importing…" : `Import ${data.length - 1} rows`}</Button>
        </div>
      )}
    </Card>
  );
}
