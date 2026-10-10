import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { journalQuery } from "@/lib/queries";
import { useFilteredTrades } from "@/hooks/use-filtered-trades";
import { fmtMoney } from "@/lib/calc";
import { Card, ErrorState, LoadingGrid, PageHeader, pnlClass } from "@/components/ui-kit";
import { useTradeDialog } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({ meta: [{ title: "Journal — LordRosen" }, { name: "description", content: "Daily pre-market plans and post-market reviews." }] }),
  component: JournalPage,
});

const empty = { pre_market_plan: "", post_market_review: "", lessons: "", mood_before: "", mood_after: "" };

function JournalPage() {
  const qc = useQueryClient();
  const j = useQuery(journalQuery());
  const { trades, currency } = useFilteredTrades();
  const { openTrade } = useTradeDialog();
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [f, setF] = useState(empty);

  useEffect(() => {
    const e = j.data?.find((x) => x.date === date);
    setF(e ? { pre_market_plan: e.pre_market_plan ?? "", post_market_review: e.post_market_review ?? "", lessons: e.lessons ?? "", mood_before: e.mood_before?.toString() ?? "", mood_after: e.mood_after?.toString() ?? "" } : empty);
  }, [date, j.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const mood = (v: string) => { const n = Number(v); return v && n >= 1 && n <= 5 ? n : null; };
      const { error } = await supabase.from("daily_journal").upsert({
        user_id: u.user.id, date,
        pre_market_plan: f.pre_market_plan.slice(0, 10000), post_market_review: f.post_market_review.slice(0, 10000), lessons: f.lessons.slice(0, 5000),
        mood_before: mood(f.mood_before), mood_after: mood(f.mood_after),
      }, { onConflict: "user_id,date" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["journal"] }); toast.success("Journal saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  if (j.isLoading) return <LoadingGrid />;
  if (j.error) return <ErrorState error={j.error} retry={() => j.refetch()} />;
  const dayTrades = trades.filter((t) => format(new Date(t.opened_at), "yyyy-MM-dd") === date);

  return (
    <>
      <PageHeader title="Daily Journal" action={<Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-44" />} />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Mood before (1–5)</Label><Input type="number" min={1} max={5} value={f.mood_before} onChange={(e) => setF({ ...f, mood_before: e.target.value })} /></div>
              <div className="space-y-1"><Label>Mood after (1–5)</Label><Input type="number" min={1} max={5} value={f.mood_after} onChange={(e) => setF({ ...f, mood_after: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Pre-market plan · bias · key levels</Label><Textarea rows={5} value={f.pre_market_plan} onChange={(e) => setF({ ...f, pre_market_plan: e.target.value })} /></div>
            <div className="space-y-1"><Label>Post-market review</Label><Textarea rows={5} value={f.post_market_review} onChange={(e) => setF({ ...f, post_market_review: e.target.value })} /></div>
            <div className="space-y-1"><Label>Lessons</Label><Textarea rows={3} value={f.lessons} onChange={(e) => setF({ ...f, lessons: e.target.value })} /></div>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save entry"}</Button>
          </form>
        </Card>
        <div className="space-y-4">
          <Card title="Trades this day">
            {dayTrades.length === 0 ? <p className="text-sm text-muted-foreground">No trades.</p> : dayTrades.map((t) => (
              <button key={t.id} onClick={() => openTrade(t)} className="flex w-full justify-between py-1.5 text-sm hover:text-primary">
                <span>{t.symbol} {t.direction === "long" ? "▲" : "▼"}</span><span className={`num ${pnlClass(Number(t.net_pnl))}`}>{fmtMoney(Number(t.net_pnl), currency)}</span>
              </button>
            ))}
          </Card>
          <Card title="Past entries">
            {(j.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No entries yet.</p> : (j.data ?? []).slice(0, 30).map((e) => (
              <button key={e.id} onClick={() => setDate(e.date)} className="block w-full py-1.5 text-left text-sm hover:text-primary">
                <span className="num text-gold">{e.date}</span> <span className="text-muted-foreground">{(e.lessons || e.pre_market_plan || "").slice(0, 40)}</span>
              </button>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
