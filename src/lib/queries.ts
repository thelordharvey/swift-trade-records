import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Trade = Database["public"]["Tables"]["trades"]["Row"];
export type TradeInsert = Database["public"]["Tables"]["trades"]["Insert"];
export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type Setup = Database["public"]["Tables"]["setups"]["Row"];
export type Journal = Database["public"]["Tables"]["daily_journal"]["Row"];

export const accountsQuery = () =>
  queryOptions({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

export const tradesQuery = () =>
  queryOptions({
    queryKey: ["trades"],
    queryFn: async () => {
      const all: Trade[] = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await supabase
          .from("trades")
          .select("*")
          .order("opened_at", { ascending: false })
          .range(from, from + page - 1);
        if (error) throw error;
        all.push(...data);
        if (data.length < page) break;
      }
      return all;
    },
  });

export const setupsQuery = () =>
  queryOptions({
    queryKey: ["setups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("setups").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

export const journalQuery = () =>
  queryOptions({
    queryKey: ["journal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_journal").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
