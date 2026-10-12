import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowLeft, ArrowRight, Check, Copy, Download, KeyRound, Monitor, ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Account } from "@/lib/queries";
import { receivedSince } from "@/lib/sync";

type Props = {
  accounts: Account[];
  accountId: string | null;
  onClose: () => void;
  newKey: { id: string; key: string } | null;
  generateKey: (account: Account) => void;
  generating: boolean;
};

export function BrokerConnection({ accounts, accountId, onClose, newKey, generateKey, generating }: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(accountId || accounts[0]?.id || "");
  const [step, setStep] = useState(0);
  const [since, setSince] = useState<number | null>(null);
  const [origin, setOrigin] = useState("");
  const [preview, setPreview] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const account = accounts.find((a) => a.id === selected);
  const key = newKey?.id === selected ? newKey.key : null;
  const connected = since != null && receivedSince(account?.last_sync_at ?? null, since);

  useEffect(() => {
    setOrigin(window.location.origin);
    setPreview(window.location.hostname.includes("id-preview"));
  }, []);
  useEffect(() => {
    if (step !== 2 || connected) return;
    const timer = setInterval(() => { void qc.invalidateQueries({ queryKey: ["accounts"] }); }, 5_000);
    return () => clearInterval(timer);
  }, [step, connected, qc]);

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); toast.success("Copied"); }
    catch { toast.error("Could not copy — select and copy the text manually"); }
  }

  async function download() {
    if (!account) return;
    setBusy(true); setError(null);
    try {
      const ext = account.platform === "MT4" ? "mq4" : "mq5";
      const response = await fetch(`/ea/EdgeLogSync.${ext}`);
      if (!response.ok) throw new Error("Download failed. Please retry.");
      let text = await response.text();
      if (!text.includes("#property") || !text.includes("https://YOUR-APP.lovable.app")) throw new Error("The sync file is unavailable. Please retry.");
      text = text.replaceAll("https://YOUR-APP.lovable.app", window.location.origin);
      // Do not embed the account key in a downloaded file.
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      const link = document.createElement("a");
      link.href = url; link.download = `EdgeLogSync.${ext}`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Download failed. Please retry."); }
    finally { setBusy(false); }
  }

  async function check() {
    setChecking(true); setError(null);
    try {
      await qc.refetchQueries({ queryKey: ["accounts"], type: "active" }, { throwOnError: true });
      const fresh = qc.getQueryData<Account[]>(["accounts"])?.find((a) => a.id === selected);
      if (since == null || !receivedSince(fresh?.last_sync_at ?? null, since)) {
        setError("No new terminal sync received. Check the EA's Experts tab, WebRequest URL, API key, and Algo Trading, then retry.");
      }
    } catch { setError("Could not check the connection. Please retry."); }
    finally { setChecking(false); }
  }

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg bg-card sm:p-8">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3 text-xl tracking-normal"><Monitor className="h-6 w-6 text-primary" />Connect trading account</DialogTitle>
        <DialogDescription>MetaTrader automatic sync</DialogDescription>
      </DialogHeader>
      <ol className="my-2 grid grid-cols-3 border-b pb-5 text-xs" aria-label="Connection progress">
        {["Account", "Install EA", "Verify sync"].map((label, i) => <li key={label} className={`flex items-center gap-2 ${i <= step ? "text-primary" : "text-muted-foreground"}`} aria-current={i === step ? "step" : undefined}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${i <= step ? "border-primary bg-primary/10" : "border-input"}`}>{i < step ? <Check className="h-3 w-3" /> : i + 1}</span>{label}
        </li>)}
      </ol>
      {step === 0 && <div className="space-y-5">
        <div className="space-y-2"><Label htmlFor="connect-account">Trading account</Label>
          <Select value={selected} onValueChange={(id) => { setSelected(id); setDownloaded(false); }}><SelectTrigger id="connect-account"><SelectValue placeholder="Choose an account" /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem value={a.id} key={a.id}>{a.name} · {a.platform}</SelectItem>)}</SelectContent></Select>
        </div>
        {account ? <div className="grid grid-cols-2 gap-4 border-y py-4 text-sm">
          <div><p className="text-xs text-muted-foreground">Broker</p><p className="mt-1">{account.broker || "Not specified"}</p></div>
          <div><p className="text-xs text-muted-foreground">Platform</p><p className="mt-1">{account.platform}</p></div>
          <div><p className="text-xs text-muted-foreground">Account type</p><p className="mt-1 capitalize">{account.account_type}</p></div>
          <div><p className="text-xs text-muted-foreground">Currency</p><p className="mt-1">{account.currency}</p></div>
        </div> : <p className="text-sm text-muted-foreground">Add a trading account on the Accounts page first.</p>}
        {account && !["MT4", "MT5"].includes(account.platform) && <p className="text-sm text-gold">Automatic EA sync is available for MT4 and MT5. Use CSV or the sync API for this platform.</p>}
        <p className="flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-profit" />Your broker password stays in MetaTrader. The EA sends trade data only and does not place orders.</p>
      </div>}
      {step === 1 && account && <div className="space-y-5">
        {preview && <p className="border-l-2 border-gold pl-3 text-sm text-gold">Open the published site to get the correct endpoint</p>}
        <div className="space-y-2"><h3 className="text-sm font-semibold">1. Account sync key</h3>
          {key ? <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3"><code className="min-w-0 flex-1 break-all text-xs">{key}</code><Button size="icon" variant="ghost" aria-label="Copy sync key" onClick={() => copy(key)}><Copy className="h-4 w-4" /></Button></div>
            : <Button variant="outline" onClick={() => generateKey(account)} disabled={generating}><KeyRound className="h-4 w-4" />{generating ? "Generating…" : account.ingest_key_prefix ? "Generate replacement key" : "Generate sync key"}</Button>}
          <p className="text-xs text-muted-foreground">{account.ingest_key_prefix ? "Use your saved key, or generate a replacement. A replacement disconnects any EA using the previous key." : "Copy your key now; it cannot be displayed again after you close this page."}</p>
        </div>
        <div className="space-y-2"><h3 className="text-sm font-semibold">2. Install EdgeLogSync</h3>
          <Button variant="outline" onClick={download} disabled={busy}><Download className="h-4 w-4" />{busy ? "Downloading…" : `Download for ${account.platform}`}</Button>
          <p className="text-xs leading-relaxed text-muted-foreground">File → Open Data Folder → {account.platform === "MT4" ? "MQL4" : "MQL5"}/Experts. Open the downloaded file in MetaEditor and click Compile, then refresh the Navigator in MetaTrader.</p>
        </div>
        <div className="space-y-2"><h3 className="text-sm font-semibold">3. Allow WebRequest</h3><p className="text-xs text-muted-foreground">Tools → Options → Expert Advisors → Allow WebRequest for listed URL. Add:</p>
          <div className="flex items-center gap-2 border-b py-2"><code className="min-w-0 flex-1 break-all text-xs">{origin}</code><Button size="icon" variant="ghost" aria-label="Copy WebRequest URL" onClick={() => copy(origin)}><Copy className="h-4 w-4" /></Button></div>
        </div>
        <p className="text-xs text-muted-foreground">Drag EdgeLogSync onto a chart, paste your key into InpApiKey, and turn {account.platform === "MT4" ? "AutoTrading" : "Algo Trading"} on. Keep the terminal open, or use a Windows VPS. Mobile MetaTrader cannot run EAs.</p>
      </div>}
      {step === 2 && <div className="py-5 text-center">
        <Activity className={`mx-auto h-10 w-10 ${connected ? "text-profit" : "text-primary motion-safe:animate-pulse"}`} />
        <h3 className="mt-4 text-lg font-semibold">{connected ? "Terminal sync connected" : "Waiting for MetaTrader"}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{connected ? `${account?.name} received a new sync from its terminal.` : "Waiting for a new EA heartbeat or trade upload. No connection is assumed until it arrives."}</p>
        {connected && <p className="mt-2 num text-xs text-profit">Last received: {account?.last_sync_at ? new Date(account.last_sync_at).toLocaleString() : "—"}</p>}
        {!connected && <Button className="mt-5" variant="outline" disabled={checking} onClick={check}><RefreshCw className={`h-4 w-4 ${checking ? "motion-safe:animate-spin" : ""}`} />{checking ? "Checking…" : "Check connection"}</Button>}
      </div>}
      {error && <p role="alert" className="border-l-2 border-loss pl-3 text-sm text-loss">{error}</p>}
      <div className="mt-3 flex items-center justify-between border-t pt-4">
        <Button variant="ghost" onClick={() => { setError(null); if (step === 0) onClose(); else setStep(step - 1); }}><ArrowLeft className="h-4 w-4" />{step === 0 ? "Cancel" : "Back"}</Button>
        {step < 2 ? <Button disabled={!account || !["MT4", "MT5"].includes(account.platform) || (step === 1 && (!downloaded || (!key && !account.ingest_key_prefix)))} onClick={() => { setError(null); if (step === 1) setSince(Date.now()); setStep(step + 1); }}>{step === 0 ? "Continue" : "Verify connection"}<ArrowRight className="h-4 w-4" /></Button>
          : <Button onClick={onClose}>{connected ? "Done" : "Close setup"}</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}