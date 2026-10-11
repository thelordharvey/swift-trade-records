import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Trade } from "@/lib/queries";

/** Subscribes to trade changes, refreshes the ["trades"] query, and shows one debounced toast per sync burst. */
export function useLiveTrades() {
  const qc = useQueryClient();
  useEffect(() => {
    let pending: Trade[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inv: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      const list = pending; pending = []; timer = null;
      if (!list.length) return;
      if (list.length === 1) {
        const t = list[0]!;
        toast.success(`Synced: ${t.symbol} ${t.direction === "long" ? "+" : "-"}${Number(t.lot_size)} lot`);
      } else toast.success(`Synced ${list.length} trades`);
    };
    const ch = supabase
      .channel("trades-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, (payload) => {
        if (inv) clearTimeout(inv);
        inv = setTimeout(() => qc.invalidateQueries({ queryKey: ["trades"] }), 400);
        if (payload.eventType === "INSERT") {
          const t = payload.new as Trade;
          if (t.source === "api" || t.source === "csv") {
            pending.push(t);
            if (timer) clearTimeout(timer);
            timer = setTimeout(flush, 1500);
          }
        }
      })
      .subscribe();
    return () => { if (timer) clearTimeout(timer); if (inv) clearTimeout(inv); supabase.removeChannel(ch); };
  }, [qc]);
}
