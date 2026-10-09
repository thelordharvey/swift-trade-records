import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { accountsQuery, setupsQuery, type Trade } from "@/lib/queries";
import { calcPips, plannedRR, realizedRR, rMultiple, sessionOf, fmtMoney } from "@/lib/calc";
import { cn } from "@/lib/utils";

const toLocal = (iso?: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");
const num = (v: string) => (v.trim() === "" ? null : Number(v));

const schema = z.object({
  account_id: z.string().uuid("Choose an account"),
  symbol: z.string().trim().min(2, "Symbol required").max(20).regex(/^[A-Za-z0-9._]+$/, "Letters/numbers only"),
  entry_price: z.number({ invalid_type_error: "Entry required" }).positive("Entry must be > 0"),
  lot_size: z.number().positive("Lot size must be > 0").max(10000),
});

interface Form {
  account_id: string; symbol: string; direction: "long" | "short";
  opened_at: string; closed_at: string;
  entry: string; sl: string; tp: string; exit: string; lot: string;
  gross: string; commission: string; swap: string; risk: string;
  setup_id: string; tags: string; mistakes: string; emotion_before: string; emotion_after: string;
  confidence: string; rating: string; followed_plan: boolean; notes: string;
}

function initial(t: Trade | null, defaultAccount: string): Form {
  return {
    account_id: t?.account_id ?? defaultAccount,
    symbol: t?.symbol ?? "",
    direction: (t?.direction as "long" | "short") ?? "long",
    opened_at: toLocal(t?.opened_at ?? new Date().toISOString()),
    closed_at: toLocal(t?.closed_at),
    entry: t?.entry_price?.toString() ?? "",
    sl: t?.stop_loss?.toString() ?? "",
    tp: t?.take_profit?.toString() ?? "",
    exit: t?.exit_price?.toString() ?? "",
    lot: t?.lot_size?.toString() ?? "0.10",
    gross: t?.gross_pnl?.toString() ?? "",
    commission: t?.commission?.toString() ?? "0",
    swap: t?.swap?.toString() ?? "0",
    risk: t?.planned_risk_amount?.toString() ?? "",
    setup_id: t?.setup_id ?? "none",
    tags: t?.tags?.join(", ") ?? "",
    mistakes: t?.mistake_tags?.join(", ") ?? "",
    emotion_before: t?.emotion_before ?? "",
    emotion_after: t?.emotion_after ?? "",
    confidence: t?.confidence?.toString() ?? "",
    rating: t?.rating?.toString() ?? "",
    followed_plan: t?.followed_plan ?? true,
    notes: t?.notes ?? "",
  };
}

export function TradeDialog({ open, onOpenChange, trade }: { open: boolean; onOpenChange: (o: boolean) => void; trade: Trade | null }) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: setups = [] } = useQuery(setupsQuery());
  const [f, setF] = useState<Form>(() => initial(trade, ""));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) { setF(initial(trade, accounts[0]?.id ?? "")); setErrors({}); }
  }, [open, trade, accounts]);

  const upd = (p: Partial<Form>) => setF((s) => ({ ...s, ...p }));

  const live = useMemo(() => {
    const entry = num(f.entry), sl = num(f.sl), tp = num(f.tp), exit = num(f.exit);
    const net = (num(f.gross) ?? 0) + (num(f.commission) ?? 0) + (num(f.swap) ?? 0);
    const risk = num(f.risk);
    const slWrong = entry != null && sl != null && (f.direction === "long" ? sl >= entry : sl <= entry);
    const tpWrong = entry != null && tp != null && (f.direction === "long" ? tp <= entry : tp >= entry);
    return {
      pips: entry != null && f.symbol ? calcPips(f.symbol, f.direction, entry, exit) : null,
      prr: entry != null ? plannedRR(entry, sl, tp) : null,
      rrr: entry != null ? realizedRR(f.direction, entry, sl, exit) : null,
      r: rMultiple(net, risk),
      net, slWrong, tpWrong,
    };
  }, [f]);

  const save = useMutation({
    mutationFn: async () => {
      const entry = num(f.entry);
      const parsed = schema.safeParse({ account_id: f.account_id, symbol: f.symbol, entry_price: entry ?? undefined, lot_size: num(f.lot) ?? 0 });
      const errs: Record<string, string> = {};
      if (!parsed.success) parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      if (live.slWrong) errs["sl"] = `Stop loss must be ${f.direction === "long" ? "below" : "above"} entry`;
      if (live.tpWrong) errs["tp"] = `Take profit must be ${f.direction === "long" ? "above" : "below"} entry`;
      if (!f.opened_at) errs["opened_at"] = "Open time required";
      if (f.closed_at && f.opened_at && new Date(f.closed_at) < new Date(f.opened_at)) errs["closed_at"] = "Close must be after open";
      setErrors(errs);
      if (Object.keys(errs).length) throw new Error("Please fix the highlighted fields");

      const symbol = f.symbol.toUpperCase().trim();
      const opened = new Date(f.opened_at).toISOString();
      const exit = num(f.exit);
      const closed = f.closed_at ? new Date(f.closed_at).toISOString() : exit != null ? opened : null;
      const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 20);
      const row = {
        account_id: f.account_id, symbol, direction: f.direction,
        status: exit != null ? "closed" : "open",
        opened_at: opened, closed_at: exit != null ? closed : null,
        entry_price: entry!, exit_price: exit, stop_loss: num(f.sl), take_profit: num(f.tp),
        lot_size: num(f.lot)!, gross_pnl: num(f.gross) ?? 0, commission: num(f.commission) ?? 0, swap: num(f.swap) ?? 0,
        planned_risk_amount: num(f.risk), pips: live.pips, planned_rr: live.prr, r_multiple: live.r,
        session: sessionOf(opened),
        setup_id: f.setup_id === "none" ? null : f.setup_id,
        tags: list(f.tags), mistake_tags: list(f.mistakes),
        emotion_before: f.emotion_before.slice(0, 50) || null, emotion_after: f.emotion_after.slice(0, 50) || null,
        confidence: num(f.confidence), rating: num(f.rating), followed_plan: f.followed_plan,
        notes: f.notes.slice(0, 10000) || null,
      };
      if (trade) {
        const { error } = await supabase.from("trades").update(row).eq("id", trade.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trades").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      toast.success(trade ? "Trade updated" : "Trade logged");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save trade"),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trades").delete().eq("id", trade!.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trades"] }); toast.success("Trade deleted"); onOpenChange(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const Err = ({ k }: { k: string }) => (errors[k] ? <p className="text-xs text-loss">{errors[k]}</p> : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{trade ? "Edit trade" : "Log a trade"}</DialogTitle></DialogHeader>
        {accounts.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-muted-foreground">Create a trading account first.</p>
            <Button asChild className="mt-4" onClick={() => onOpenChange(false)}><Link to="/accounts">Add account</Link></Button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-6 md:grid-cols-[1fr_220px]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Account</Label>
                  <Select value={f.account_id} onValueChange={(v) => upd({ account_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                    <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Err k="account_id" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sym">Symbol</Label>
                  <Input id="sym" placeholder="XAUUSD" value={f.symbol} onChange={(e) => upd({ symbol: e.target.value.toUpperCase() })} autoFocus />
                  <Err k="symbol" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Direction">
                {(["long", "short"] as const).map((d) => (
                  <button type="button" key={d} role="radio" aria-checked={f.direction === d} onClick={() => upd({ direction: d })}
                    className={cn("rounded-md border py-2 text-sm font-semibold capitalize transition-colors",
                      f.direction === d ? (d === "long" ? "border-profit bg-profit/15 text-profit" : "border-loss bg-loss/15 text-loss") : "text-muted-foreground")}>
                    {d === "long" ? "▲ Long" : "▼ Short"}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Opened</Label><Input type="datetime-local" value={f.opened_at} onChange={(e) => upd({ opened_at: e.target.value })} /><Err k="opened_at" /></div>
                <div className="space-y-1">
                  <Label className="flex justify-between">Closed <button type="button" className="text-xs text-primary" onClick={() => upd({ closed_at: toLocal(new Date().toISOString()) })}>now</button></Label>
                  <Input type="datetime-local" value={f.closed_at} onChange={(e) => upd({ closed_at: e.target.value })} /><Err k="closed_at" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {([["entry", "Entry"], ["sl", "Stop loss"], ["tp", "Take profit"], ["exit", "Exit"], ["lot", "Lots"]] as const).map(([k, l]) => (
                  <div key={k} className="space-y-1">
                    <Label>{l}</Label>
                    <Input className="num" inputMode="decimal" type="number" step="any" value={f[k]} onChange={(e) => upd({ [k]: e.target.value } as Partial<Form>)} />
                    <Err k={k === "entry" ? "entry_price" : k === "lot" ? "lot_size" : k} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([["gross", "Gross P&L"], ["commission", "Commission"], ["swap", "Swap"], ["risk", "Risk amount"]] as const).map(([k, l]) => (
                  <div key={k} className="space-y-1">
                    <Label>{l}</Label>
                    <Input className="num" type="number" step="any" value={f[k]} onChange={(e) => upd({ [k]: e.target.value } as Partial<Form>)} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Setup</Label>
                  <Select value={f.setup_id} onValueChange={(v) => upd({ setup_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No setup</SelectItem>
                      {setups.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Tags (comma)</Label><Input value={f.tags} onChange={(e) => upd({ tags: e.target.value })} placeholder="breakout, news" /></div>
                <div className="space-y-1"><Label>Mistakes (comma)</Label><Input value={f.mistakes} onChange={(e) => upd({ mistakes: e.target.value })} placeholder="FOMO, moved SL" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>Confidence</Label><Input type="number" min={1} max={5} value={f.confidence} onChange={(e) => upd({ confidence: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Rating</Label><Input type="number" min={1} max={5} value={f.rating} onChange={(e) => upd({ rating: e.target.value })} /></div>
                </div>
                <div className="space-y-1"><Label>Emotion before</Label><Input value={f.emotion_before} onChange={(e) => upd({ emotion_before: e.target.value })} placeholder="calm" /></div>
                <div className="space-y-1"><Label>Emotion after</Label><Input value={f.emotion_after} onChange={(e) => upd({ emotion_after: e.target.value })} placeholder="satisfied" /></div>
              </div>
              <div className="flex items-center gap-3"><Switch id="plan" checked={f.followed_plan} onCheckedChange={(v) => upd({ followed_plan: v })} /><Label htmlFor="plan">Followed my plan</Label></div>
              <div className="space-y-1"><Label>Notes</Label><Textarea rows={3} value={f.notes} onChange={(e) => upd({ notes: e.target.value })} /></div>
            </div>
            <aside className="space-y-3 rounded-xl border bg-muted/40 p-4 md:sticky md:top-0 md:self-start">
              <p className="text-xs uppercase tracking-wider text-gold">Live calculator</p>
              <Stat label="Net P&L" value={fmtMoney(live.net)} tone={live.net} />
              <Stat label="Pips" value={live.pips?.toString() ?? "—"} tone={live.pips ?? 0} />
              <Stat label="Planned RR" value={live.prr != null ? `1 : ${live.prr}` : "—"} />
              <Stat label="Realized RR" value={live.rrr?.toString() ?? "—"} tone={live.rrr ?? 0} />
              <Stat label="R-multiple" value={live.r != null ? `${live.r}R` : "—"} tone={live.r ?? 0} />
              <RRBar f={f} />
              <div className="flex flex-col gap-2 pt-2">
                <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : trade ? "Save changes" : "Log trade"}</Button>
                {trade && <Button type="button" variant="ghost" className="text-loss" onClick={() => del.mutate()} disabled={del.isPending}>Delete</Button>}
              </div>
            </aside>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("num text-sm font-semibold", tone != null && tone > 0 && "text-profit", tone != null && tone < 0 && "text-loss")}>{value}</span>
    </div>
  );
}

function RRBar({ f }: { f: Form }) {
  const e = num(f.entry), sl = num(f.sl), tp = num(f.tp);
  if (e == null || sl == null || tp == null) return null;
  const risk = Math.abs(e - sl), reward = Math.abs(tp - e);
  const total = risk + reward;
  if (total === 0) return null;
  return (
    <div aria-label="Risk to reward bar" className="flex h-2 overflow-hidden rounded-full">
      <div className="bg-loss" style={{ width: `${(risk / total) * 100}%` }} />
      <div className="bg-profit" style={{ width: `${(reward / total) * 100}%` }} />
    </div>
  );
}
