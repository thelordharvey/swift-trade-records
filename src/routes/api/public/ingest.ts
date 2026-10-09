import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { calcPips, plannedRR, sessionOf } from "@/lib/calc";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const tradeSchema = z.object({
  external_id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(64)),
  symbol: z.string().trim().min(2).max(20),
  direction: z.string().transform((d) => d.toLowerCase()).pipe(z.enum(["long", "short", "buy", "sell"])).transform((d) => (d === "buy" ? "long" : d === "sell" ? "short" : d)),
  opened_at: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/)),
  closed_at: z.string().nullable().optional(),
  entry_price: z.coerce.number().positive(),
  exit_price: z.coerce.number().positive().nullable().optional(),
  stop_loss: z.coerce.number().nullable().optional(),
  take_profit: z.coerce.number().nullable().optional(),
  lot_size: z.coerce.number().positive().max(10000),
  commission: z.coerce.number().optional().default(0),
  swap: z.coerce.number().optional().default(0),
  gross_pnl: z.coerce.number().optional().default(0),
});
const bodySchema = z.union([z.array(tradeSchema).min(1).max(500), z.object({ trades: z.array(tradeSchema).min(1).max(500) }).transform((b) => b.trades)]);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const iso = (s: string) => new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z").toISOString();

export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const key = request.headers.get("x-api-key") ?? "";
        if (!/^el_[a-f0-9]{48}$/.test(key)) return json({ error: "Missing or invalid x-api-key" }, 401);
        let raw: unknown;
        try { raw = await request.json(); } catch { return json({ error: "Body must be JSON" }, 400); }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) return json({ error: "Validation failed", issues: parsed.error.issues.slice(0, 20) }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: acc, error: accErr } = await supabaseAdmin.from("accounts").select("id,user_id").eq("ingest_api_key_hash", await sha256(key)).maybeSingle();
        if (accErr) { console.error(accErr); return json({ error: "Lookup failed" }, 500); }
        if (!acc) return json({ error: "Unknown API key" }, 401);

        const rows = parsed.data.map((t) => {
          const dir = t.direction as "long" | "short";
          const opened = iso(t.opened_at);
          const exit = t.exit_price ?? null;
          return {
            user_id: acc.user_id, account_id: acc.id, external_id: t.external_id, source: "api",
            symbol: t.symbol.toUpperCase(), direction: dir,
            status: exit != null ? "closed" : "open",
            opened_at: opened, closed_at: exit != null && t.closed_at ? iso(t.closed_at) : exit != null ? opened : null,
            entry_price: t.entry_price, exit_price: exit, stop_loss: t.stop_loss || null, take_profit: t.take_profit || null,
            lot_size: t.lot_size, gross_pnl: t.gross_pnl, commission: t.commission, swap: t.swap,
            pips: calcPips(t.symbol, dir, t.entry_price, exit),
            planned_rr: plannedRR(t.entry_price, t.stop_loss || null, t.take_profit || null),
            session: sessionOf(opened),
          };
        });
        const { error, count } = await supabaseAdmin.from("trades").upsert(rows, { onConflict: "account_id,external_id", count: "exact" });
        if (error) { console.error(error); return json({ error: "Insert failed", detail: error.message }, 500); }
        await supabaseAdmin.from("accounts").update({ last_sync_at: new Date().toISOString() }).eq("id", acc.id);
        await supabaseAdmin.from("import_jobs").insert({ user_id: acc.user_id, account_id: acc.id, source: "api", rows_total: rows.length, rows_imported: count ?? rows.length });
        return json({ ok: true, upserted: count ?? rows.length });
      },
    },
  },
});
