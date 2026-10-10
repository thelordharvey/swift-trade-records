import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Activity, CalendarDays, Plug, LineChart, BookOpen, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LordRosen — The trading journal that finds your edge" },
      { name: "description", content: "Log, sync and analyse your forex, gold, indices and crypto trades. Connect MT4/MT5 or any broker via API." },
      { property: "og:title", content: "LordRosen — Trading Journal" },
      { property: "og:description", content: "Sync your broker, journal every trade, and see what actually makes you money." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Plug, title: "Connect any broker", text: "MT4/MT5 Expert Advisor, cTrader or any bridge pushes trades through a secure per-account API key." },
  { icon: LineChart, title: "Interactive analytics", text: "Equity curve, drawdown, P&L by symbol, session, weekday and hour. Click anything to drill down." },
  { icon: CalendarDays, title: "P&L calendar", text: "Every day coloured by result. Open a day to see its trades and journal entry." },
  { icon: BookOpen, title: "Daily journal", text: "Pre-market plan, post-market review and lessons, linked to the trades of the day." },
  { icon: Activity, title: "Live calculator", text: "Pips, planned RR, R-multiple and risk computed as you type — XAUUSD, JPY pairs, indices." },
  { icon: ShieldCheck, title: "Private by design", text: "Your data is only visible to you. CSV import with duplicate protection." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-mono text-base font-semibold tracking-[0.25em]">LORD<span className="text-primary">ROSEN</span></span>
        <Button asChild variant="outline"><Link to="/auth">Sign in</Link></Button>
      </header>
      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 text-center md:py-28">
          <p className="num mb-4 text-xs uppercase tracking-[0.3em] text-gold">Forex · Gold · Indices · Crypto</p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Know exactly <span className="text-gold">what makes you money.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-muted-foreground">
            A professional trading journal that syncs with your broker, calculates every metric for you, and shows where your edge really is.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Button asChild size="lg"><Link to="/auth">Start journaling — free</Link></Button>
          </div>
        </section>
        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card-glow rounded-xl border bg-card p-6">
              <f.icon className="h-6 w-6 text-gold" aria-hidden />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
