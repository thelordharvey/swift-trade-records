import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gold">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("card-glow rounded-xl border bg-card p-5", className)}>
      {title && <h2 className="mb-4 text-sm font-semibold text-muted-foreground">{title}</h2>}
      {children}
    </section>
  );
}

export function Kpi({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="card-glow rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("num mt-1 text-xl font-semibold", tone != null && tone > 0 && "text-profit", tone != null && tone < 0 && "text-loss")}>
        {tone != null && tone > 0 ? "▲ " : tone != null && tone < 0 ? "▼ " : ""}{value}
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
