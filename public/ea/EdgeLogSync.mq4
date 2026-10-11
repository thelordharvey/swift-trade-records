//+------------------------------------------------------------------+
//| EdgeLogSync.mq4 - sends closed and open orders to EdgeLog        |
//| Setup: Tools > Options > Expert Advisors > tick                  |
//| "Allow WebRequest for listed URL" and add your journal address.  |
//| Attach to any chart, paste your account API key, AutoTrading ON. |
//| In the Account History tab choose "All History" first.           |
//+------------------------------------------------------------------+
#property copyright "EdgeLog"
#property version   "1.00"
#property strict

input string InpEndpoint        = "https://YOUR-APP.lovable.app/api/public/ingest"; // Journal endpoint
input string InpApiKey          = "";    // Account API key (starts with el_)
input int    InpIntervalSec     = 30;    // Sync interval in seconds
input int    InpFirstSyncDays   = 90;    // History uploaded on the very first run
input bool   InpSendOpen        = true;  // Also sync open orders
input int    InpServerUtcOffset = 99;    // Broker server UTC offset in hours (99 = automatic; set it manually if you start the EA on a weekend)

long g_offset = 0;

string GVKey() { return "EdgeLog_last_" + IntegerToString(AccountNumber()); }

long UtcOffsetSeconds()
{
   if(InpServerUtcOffset != 99) return (long)InpServerUtcOffset * 3600;
   long diff = (long)(TimeCurrent() - TimeGMT());
   if(MathAbs((double)diff) > 14 * 3600) return g_offset;   // stale quote time (market closed): keep last good value
   g_offset = ((diff + (diff >= 0 ? 450 : -450)) / 900) * 900;
   return g_offset;
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

   for(int i = OrdersHistoryTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) continue;
      int t = OrderType();
      if(t != OP_BUY && t != OP_SELL) continue;
      if(OrderCloseTime() < from) continue;
      ArrayResize(items, n + 1);
      items[n] = TradeJson(IntegerToString(OrderTicket()), OrderSymbol(), (t == OP_BUY ? "buy" : "sell"),
                           OrderOpenTime(), OrderCloseTime(), OrderOpenPrice(), OrderClosePrice(), true,
                           OrderStopLoss(), OrderTakeProfit(), OrderLots(), OrderCommission(), OrderSwap(), OrderProfit());
      n++;
   }
   if(InpSendOpen)
   {
      for(int k = 0; k < OrdersTotal(); k++)
      {
         if(!OrderSelect(k, SELECT_BY_POS, MODE_TRADES)) continue;
         int ot = OrderType();
         if(ot != OP_BUY && ot != OP_SELL) continue;
         ArrayResize(items, n + 1);
         items[n] = TradeJson(IntegerToString(OrderTicket()), OrderSymbol(), (ot == OP_BUY ? "buy" : "sell"),
                              OrderOpenTime(), 0, OrderOpenPrice(), 0, false,
                              OrderStopLoss(), OrderTakeProfit(), OrderLots(), OrderCommission(), OrderSwap(), OrderProfit());
         n++;
      }
   }
   if(n == 0) { GlobalVariableSet(GVKey(), (double)now); return; }
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
