import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="label-mono text-sm text-primary">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("card-glow rounded-2xl border bg-card/80 p-6 backdrop-blur", className)}>
      {title && <h2 className="label-mono mb-6 font-semibold text-primary">{title}</h2>}
      {children}
    </section>
  );
}

export function Kpi({ label, value, tone, highlight, big }: { label: string; value: string; tone?: number; highlight?: boolean; big?: boolean }) {
  return (
    <div className={cn("card-glow rounded-2xl border p-6 backdrop-blur", highlight ? "border-primary/30 bg-primary/10" : "bg-card/80")}>
      <p className="label-mono font-semibold text-muted-foreground">{label}</p>
      <p className={cn("display-num mt-5 font-bold leading-none", big ? "text-5xl" : "text-2xl",
        highlight ? "text-primary" : tone != null && tone > 0 ? "text-profit" : tone != null && tone < 0 ? "text-loss" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

export function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="rounded-xl border border-loss/40 bg-card p-8 text-center">
      <p className="font-semibold text-loss">Couldn't load your data</p>
      <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
      <Button className="mt-4" variant="outline" onClick={retry}>Retry</Button>
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const pnlClass = (n: number | null | undefined) => (n == null ? "" : n > 0 ? "text-profit" : n < 0 ? "text-loss" : "text-muted-foreground");
