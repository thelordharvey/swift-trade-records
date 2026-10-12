import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { calcPips, closedTradeR, normalizeSymbol, plannedRR, sessionOf } from "@/lib/calc";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const tradeSchema = z.object({
  external_id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(64)),
  symbol: z.string().trim().min(2).max(20),
  direction: z.string().transform((d) => d.toLowerCase()).pipe(z.enum(["long", "short", "buy", "sell"])).transform((d) => (d === "buy" ? "long" : d === "sell" ? "short" : d)),
  opened_at: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/)).refine((s) => Number.isFinite(Date.parse(s.includes("T") ? s : s.replace(" ", "T") + "Z")), "Invalid open time"),
  closed_at: z.string().refine((s) => Number.isFinite(Date.parse(s.includes("T") ? s : s.replace(" ", "T") + "Z")), "Invalid close time").nullable().optional(),
  entry_price: z.coerce.number().positive(),
  exit_price: z.coerce.number().positive().nullable().optional(),
  stop_loss: z.coerce.number().nullable().optional(),
  take_profit: z.coerce.number().nullable().optional(),
  lot_size: z.coerce.number().positive().max(10000),
  commission: z.coerce.number().optional().default(0),
  swap: z.coerce.number().optional().default(0),
  gross_pnl: z.coerce.number().optional().default(0),
});
const bodySchema = z.union([
  z.array(z.unknown()).max(500),
  z.object({ trades: z.array(z.unknown()).max(500) }).transform((b) => b.trades),
]);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const iso = (s: string) => new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z").toISOString();

async function findAccount(request: Request) {
  const key = request.headers.get("x-api-key") ?? "";
  if (!/^el_[a-f0-9]{48}$/.test(key)) return { error: json({ ok: false, error: "Missing or invalid x-api-key" }, 401) } as const;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: acc, error } = await supabaseAdmin.from("accounts").select("id,user_id,name,last_sync_at").eq("ingest_api_key_hash", await sha256(key)).eq("is_archived", false).maybeSingle();
  if (error) { console.error(error); return { error: json({ ok: false, error: "Server error, try again" }, 500) } as const; }
  if (!acc) return { error: json({ ok: false, error: "Unknown API key" }, 401) } as const;
  return { acc, db: supabaseAdmin } as const;
}

export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const r = await findAccount(request);
        if ("error" in r) return r.error;
        return json({ ok: true, account: r.acc.name, last_sync_at: r.acc.last_sync_at });
      },
      POST: async ({ request }) => {
        const r = await findAccount(request);
        if ("error" in r) return r.error;
        const { acc, db } = r;
        let raw: unknown;
        try { raw = await request.json(); } catch { return json({ ok: false, error: "Body must be JSON" }, 400); }
        const body = bodySchema.safeParse(raw);
        if (!body.success) return json({ ok: false, error: "Body must be an array of up to 500 trades" }, 400);

        // An empty upload is a terminal heartbeat, including when no positions exist.
        if (!body.data.length) {
          const { error } = await db.from("accounts").update({ last_sync_at: new Date().toISOString() }).eq("id", acc.id);
          if (error) return json({ ok: false, error: "Could not save sync status, try again" }, 500);
          return json({ ok: true, upserted: 0, rejected: 0 });
        }

        let rejected = 0;
        const valid = body.data.flatMap((item) => {
          const p = tradeSchema.safeParse(item);
          if (!p.success) { rejected++; return []; }
          return [p.data];
        });

        let rows = valid.map((t) => {
          const dir = t.direction as "long" | "short";
          const symbol = normalizeSymbol(t.symbol);
          const opened = iso(t.opened_at);
          const exit = t.exit_price ?? null;
          const sl = t.stop_loss || null, tp = t.take_profit || null;
          return {
            user_id: acc.user_id, account_id: acc.id, external_id: t.external_id, source: "api",
            symbol, direction: dir,
            status: exit != null ? "closed" : "open",
            opened_at: opened, closed_at: exit != null && t.closed_at ? iso(t.closed_at) : exit != null ? opened : null,
            entry_price: t.entry_price, exit_price: exit, stop_loss: sl, take_profit: tp,
            lot_size: t.lot_size, gross_pnl: t.gross_pnl, commission: t.commission, swap: t.swap,
            pips: calcPips(symbol, dir, t.entry_price, exit),
            planned_rr: plannedRR(t.entry_price, sl, tp),
            r_multiple: closedTradeR(dir, t.entry_price, sl, exit),
            session: sessionOf(opened),
          };
        });
        // PostgreSQL cannot update one conflict target twice in the same batch.
        const unique = new Map<string, typeof rows[number]>();
        for (const row of rows) {
          const previous = unique.get(row.external_id);
          if (previous?.status === "closed" && row.status === "open") continue;
          unique.set(row.external_id, row);
        }
        rows = [...unique.values()];

        // Never downgrade a stored closed trade back to open.
        const openIds = rows.filter((x) => x.status === "open").map((x) => x.external_id);
        if (openIds.length) {
          const { data: closed, error } = await db.from("trades").select("external_id").eq("account_id", acc.id).eq("status", "closed").in("external_id", openIds);
          if (error) { console.error(error); return json({ ok: false, error: "Server error, try again" }, 500); }
          const skip = new Set((closed ?? []).map((c) => c.external_id));
          rows = rows.filter((x) => !(x.status === "open" && skip.has(x.external_id)));
        }

        let upserted = 0;
        if (rows.length) {
          const { error, count } = await db.from("trades").upsert(rows, { onConflict: "account_id,external_id", count: "exact" });
          if (error) { console.error(error); return json({ ok: false, error: "Could not save trades, try again" }, 500); }
          upserted = count ?? rows.length;
        }
        if (rejected > 0) return json({ ok: false, upserted, rejected, error: "Some trades were invalid. Check the terminal log and retry." }, 422);
        const history = await db.from("import_jobs").insert({ user_id: acc.user_id, account_id: acc.id, source: "api", rows_total: body.data.length, rows_imported: upserted, rows_skipped: rejected });
        if (history.error) return json({ ok: false, error: "Could not save sync history, try again" }, 500);
        const heartbeat = await db.from("accounts").update({ last_sync_at: new Date().toISOString() }).eq("id", acc.id);
        if (heartbeat.error) return json({ ok: false, error: "Could not save sync status, try again" }, 500);
        return json({ ok: true, upserted, rejected });
      },
    },
  },
});
