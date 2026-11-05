import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Data, Settings } from './engine/types';
import type { Result } from './engine/ledger';
import { processRecurring } from './engine/recurring';
import { today } from './engine/dates';
import { store } from './db';

type Change = Data | Result;
interface Vault {
  data: Data; ready: boolean; fatal: string | null; toast: string | null; recurringCreated: number;
  apply(fn: (d: Data) => Change, okMsg?: string): Promise<boolean>; replace(d: Data): Promise<void>;
  setSettings(p: Partial<Settings>): Promise<void>; say(msg: string): void;
}
const Ctx = createContext<Vault>(null as unknown as Vault);
export const useVault = () => useContext(Ctx);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null); const ref = useRef<Data | null>(null); const [fatal, setFatal] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null); const [recurringCreated, setRC] = useState(0); const queue = useRef(Promise.resolve());
  const say = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(t => (t === m ? null : t)), 2600); }, []);

  useEffect(() => { (async () => {
    try {
      let d = await store.load(); const r = processRecurring(d, today()); // offline recurring catch-up on open; idempotent
      if (r.created) { await store.persist(d, r.data); d = r.data; setRC(r.created); }
      ref.current = d; setData(d);
    } catch (e) { setFatal(`Could not open the local database (${store.kind}). ${(e as Error).message ?? e}`); }
  })(); }, []);

  const commit = useCallback((next: Data) => {
    const prev = ref.current!; ref.current = next; setData(next);
    return (queue.current = queue.current.then(() => store.persist(prev, next)).catch(e => { ref.current = prev; setData(prev); say('Could not save. Nothing was changed.'); throw e; }));
  }, [say]);

  const apply: Vault['apply'] = useCallback(async (fn, okMsg) => {
    const res = fn(ref.current!); const next = 'ok' in res ? (res.ok ? res.data : null) : res;
    if (!next) { say((res as { error: string }).error); return false; }
    try { await commit(next); if (okMsg) say(okMsg); return true; } catch { return false; }
  }, [commit, say]);
  const replace = useCallback(async (d: Data) => { const prev = ref.current!; ref.current = d; setData(d); try { await store.replaceAll(d); } catch (e) { ref.current = prev; setData(prev); throw e; } }, []);
  const setSettings = useCallback(async (p: Partial<Settings>) => { await apply(d => ({ ...d, settings: { ...d.settings, ...p } })); }, [apply]);

  if (fatal) return <div className="fatal"><h2>Storage problem</h2><p>{fatal}</p><p>Your data was not changed. Close the app and open it again. If this repeats, reinstall without clearing data.</p></div>;
  if (!data) return <div className="splash"><div className="logo">MY VAULT</div></div>;
  return <Ctx.Provider value={{ data, ready: true, fatal, toast, recurringCreated, apply, replace, setSettings, say }}>{children}</Ctx.Provider>;
}
