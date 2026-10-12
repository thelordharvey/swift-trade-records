//+------------------------------------------------------------------+
//| EdgeLogSync.mq5 - sends closed and open positions to EdgeLog     |
//| Setup: Tools > Options > Expert Advisors > tick                  |
//| "Allow WebRequest for listed URL" and add your journal address.  |
//| Attach to any chart, paste your account API key, Algo Trading ON.|
//+------------------------------------------------------------------+
#property copyright "EdgeLog"
#property version   "1.00"
#property description "Auto-syncs trades to the EdgeLog trading journal"

input string InpEndpoint        = "https://YOUR-APP.lovable.app/api/public/ingest"; // Journal endpoint
input string InpApiKey          = "";    // Account API key (starts with el_)
input int    InpIntervalSec     = 30;    // Sync interval in seconds
input int    InpFirstSyncDays   = 90;    // History uploaded on the very first run
input bool   InpSendOpen        = true;  // Also sync open positions
input int    InpServerUtcOffset = 99;    // Broker server UTC offset in hours (99 = automatic)

string GVKey() { return "EdgeLog_last_" + IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN)); }

long UtcOffsetSeconds()
{
   if(InpServerUtcOffset != 99) return (long)InpServerUtcOffset * 3600;
   long diff = (long)(TimeTradeServer() - TimeGMT());
   return ((diff + (diff >= 0 ? 450 : -450)) / 900) * 900;
}

string Iso(datetime serverTime)
{
   datetime utc = (datetime)((long)serverTime - UtcOffsetSeconds());
   string s = TimeToString(utc, TIME_DATE | TIME_SECONDS);
   StringReplace(s, ".", "-");
   StringReplace(s, " ", "T");
   return s + "Z";
}

string Num(double v, int digits) { return DoubleToString(v, digits); }

string Esc(string s)
{
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   return s;
}

string TradeJson(string id, string symbol, string dir, datetime opened, datetime closed,
                 double entry, double exitPrice, bool isClosed, double sl, double tp,
                 double lots, double commission, double swap, double profit)
{
   string j = "{";
   j += "\"external_id\":\"" + id + "\",";
   j += "\"symbol\":\"" + Esc(symbol) + "\",";
   j += "\"direction\":\"" + dir + "\",";
   j += "\"opened_at\":\"" + Iso(opened) + "\",";
   if(isClosed)
   {
      j += "\"closed_at\":\"" + Iso(closed) + "\",";
      j += "\"exit_price\":" + Num(exitPrice, 8) + ",";
   }
   j += "\"entry_price\":" + Num(entry, 8) + ",";
   if(sl > 0) j += "\"stop_loss\":" + Num(sl, 8) + ",";
   if(tp > 0) j += "\"take_profit\":" + Num(tp, 8) + ",";
   j += "\"lot_size\":" + Num(lots, 4) + ",";
   j += "\"commission\":" + Num(commission, 2) + ",";
   j += "\"swap\":" + Num(swap, 2) + ",";
   j += "\"gross_pnl\":" + Num(profit, 2);
   j += "}";
   return j;
}

string BuildClosed(ulong pos)
{
   if(!HistorySelectByPosition(pos)) return "";
   int total = HistoryDealsTotal();
   double volIn = 0, volOut = 0, pIn = 0, pOut = 0, profit = 0, comm = 0, swap = 0;
   double slIn = 0, tpIn = 0, slOut = 0, tpOut = 0;
   datetime tIn = 0, tOut = 0;
   long dirType = -1;
   string symbol = "";
   for(int i = 0; i < total; i++)
   {
      ulong d = HistoryDealGetTicket(i);
      if(d == 0) continue;
      long ty = HistoryDealGetInteger(d, DEAL_TYPE);
      if(ty != DEAL_TYPE_BUY && ty != DEAL_TYPE_SELL) continue;
      long en = HistoryDealGetInteger(d, DEAL_ENTRY);
      double v = HistoryDealGetDouble(d, DEAL_VOLUME);
      double p = HistoryDealGetDouble(d, DEAL_PRICE);
      datetime t = (datetime)HistoryDealGetInteger(d, DEAL_TIME);
      comm   += HistoryDealGetDouble(d, DEAL_COMMISSION);
      swap   += HistoryDealGetDouble(d, DEAL_SWAP);
      profit += HistoryDealGetDouble(d, DEAL_PROFIT);
      symbol  = HistoryDealGetString(d, DEAL_SYMBOL);
      double dsl = HistoryDealGetDouble(d, DEAL_SL);
      double dtp = HistoryDealGetDouble(d, DEAL_TP);
      if(en == DEAL_ENTRY_IN)
      {
         pIn += p * v; volIn += v;
         if(tIn == 0 || t < tIn) tIn = t;
         if(dirType < 0) dirType = ty;
         if(dsl > 0 && slIn == 0) slIn = dsl;
         if(dtp > 0 && tpIn == 0) tpIn = dtp;
      }
      else
      {
         pOut += p * v; volOut += v;
         if(t > tOut) tOut = t;
         if(dsl > 0) slOut = dsl;
         if(dtp > 0) tpOut = dtp;
      }
   }
   if(volIn <= 0 || volOut <= 0) return "";
   if(volOut < volIn - 0.0000001) return "";   // still partially open: wait until fully closed
   double sl = (slIn > 0) ? slIn : slOut;
   double tp = (tpIn > 0) ? tpIn : tpOut;
   string dir = (dirType == DEAL_TYPE_BUY) ? "buy" : "sell";
   return TradeJson(IntegerToString((long)pos), symbol, dir, tIn, tOut, pIn / volIn, pOut / volOut, true, sl, tp, volIn, comm, swap, profit);
}

string BuildOpen(int idx)
{
   ulong ticket = PositionGetTicket(idx);
   if(ticket == 0) return "";
   long type = PositionGetInteger(POSITION_TYPE);
   long pid  = PositionGetInteger(POSITION_IDENTIFIER);
   return TradeJson(IntegerToString(pid), PositionGetString(POSITION_SYMBOL),
                    (type == POSITION_TYPE_BUY ? "buy" : "sell"),
                    (datetime)PositionGetInteger(POSITION_TIME), 0,
                    PositionGetDouble(POSITION_PRICE_OPEN), 0, false,
                    PositionGetDouble(POSITION_SL), PositionGetDouble(POSITION_TP),
                    PositionGetDouble(POSITION_VOLUME), 0, PositionGetDouble(POSITION_SWAP),
                    PositionGetDouble(POSITION_PROFIT));
}

bool PostBatch(string &items[], int from, int to)
{
   string body = "[";
   for(int i = from; i < to; i++)
   {
      if(i > from) body += ",";
      body += items[i];
   }
   body += "]";
   char data[]; char result[]; string rh;
   int len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8) - 1;
   ArrayResize(data, len);
   string headers = "Content-Type: application/json\r\nx-api-key: " + InpApiKey + "\r\n";
   ResetLastError();
   int code = WebRequest("POST", InpEndpoint, headers, 20000, data, result, rh);
   if(code == -1)
   {
      Print("EdgeLogSync: WebRequest failed (error ", GetLastError(), "). Add this site under Tools > Options > Expert Advisors > Allow WebRequest.");
      return false;
   }
   if(code >= 200 && code < 300) return true;
   Print("EdgeLogSync: server replied ", code, " ", CharArrayToString(result, 0, -1, CP_UTF8));
   return false;
}

void Ping()
{
   char data[]; char result[]; string rh;
   string headers = "x-api-key: " + InpApiKey + "\r\n";
   ResetLastError();
   int code = WebRequest("GET", InpEndpoint, headers, 10000, data, result, rh);
   if(code == -1)
   {
      Print("EdgeLogSync: cannot reach ", InpEndpoint, " (error ", GetLastError(), "). Allow this URL in Tools > Options > Expert Advisors.");
      return;
   }
   Print("EdgeLogSync: ping ", code, " ", CharArrayToString(result, 0, -1, CP_UTF8));
}

void Sync()
{
   string items[];
   int n = 0;
   datetime now = TimeCurrent();
   double lastD = GlobalVariableCheck(GVKey()) ? GlobalVariableGet(GVKey()) : 0;
   datetime from = (lastD > 0) ? (datetime)((long)lastD - 6 * 3600)
                               : (datetime)((long)now - (long)InpFirstSyncDays * 86400);

   ulong pos[];
   int np = 0;
   if(HistorySelect(from, now + 86400))
   {
      int total = HistoryDealsTotal();
      for(int i = 0; i < total; i++)
      {
         ulong d = HistoryDealGetTicket(i);
         if(d == 0) continue;
         long en = HistoryDealGetInteger(d, DEAL_ENTRY);
         if(en != DEAL_ENTRY_OUT && en != DEAL_ENTRY_OUT_BY && en != DEAL_ENTRY_INOUT) continue;
         long ty = HistoryDealGetInteger(d, DEAL_TYPE);
         if(ty != DEAL_TYPE_BUY && ty != DEAL_TYPE_SELL) continue;
         ulong pid = (ulong)HistoryDealGetInteger(d, DEAL_POSITION_ID);
         bool seen = false;
         for(int k = 0; k < np; k++) { if(pos[k] == pid) { seen = true; break; } }
         if(seen) continue;
         ArrayResize(pos, np + 1);
         pos[np] = pid;
         np++;
      }
   }
   for(int k = 0; k < np; k++)
   {
      string jc = BuildClosed(pos[k]);
      if(jc == "") continue;
      ArrayResize(items, n + 1);
      items[n] = jc;
      n++;
   }
   if(InpSendOpen)
   {
      for(int i = 0; i < PositionsTotal(); i++)
      {
         string jo = BuildOpen(i);
         if(jo == "") continue;
         ArrayResize(items, n + 1);
         items[n] = jo;
         n++;
      }
   }
    if(n == 0) { if(PostBatch(items, 0, 0)) GlobalVariableSet(GVKey(), (double)now); return; }
   bool ok = true;
   for(int s = 0; s < n; s += 100)
   {
      if(!PostBatch(items, s, MathMin(n, s + 100))) ok = false;
   }
   if(ok) GlobalVariableSet(GVKey(), (double)now);
}

int OnInit()
{
   if(StringLen(InpApiKey) < 10 || StringFind(InpApiKey, "el_") != 0)
   {
      Alert("EdgeLogSync: paste your account API key (starts with el_) in the EA inputs.");
      return INIT_PARAMETERS_INCORRECT;
   }
   if(StringFind(InpEndpoint, "https://") != 0)
   {
      Alert("EdgeLogSync: the endpoint must start with https://");
      return INIT_PARAMETERS_INCORRECT;
   }
   EventSetTimer(MathMax(5, InpIntervalSec));
   Ping();
   Sync();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTimer() { Sync(); }

void OnTradeTransaction(const MqlTradeTransaction &trans, const MqlTradeRequest &request, const MqlTradeResult &result)
{
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD) Sync();
}
