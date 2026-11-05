import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { useVault } from '../vault';
import type { Party, Tx } from '../engine/types';
import { Icon } from './common';
import { Home } from './Home';
import { Transactions } from './Transactions';
import { Parties } from './Parties';
import { Insights } from './Insights';
import { SettingsScreen } from './Settings';
import { TxForm, type Preset } from './TxForm';
import { Lock } from './Lock';

const TABS = [['home', 'Home', 'home'], ['transactions', 'Transactions', 'list'], ['parties', 'Parties', 'users'], ['insights', 'Insights', 'spark'], ['settings', 'Settings', 'gear']] as const;
export function AppShell() {
  const { data, toast, recurringCreated, say } = useVault(); const st = data.settings; const [tab, setTab] = useState('home'); const [sub, setSub] = useState<string | undefined>();
  const [form, setForm] = useState<{ edit?: Tx; preset?: Preset } | null>(null); const [focus, setFocus] = useState<Party | null>(null); const [locked, setLocked] = useState(!!st.pinHash);
  useEffect(() => { const t = st.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : st.theme; document.documentElement.dataset.theme = t; }, [st.theme]);
  useEffect(() => { if (recurringCreated) say(`${recurringCreated} recurring ${recurringCreated === 1 ? 'entry' : 'entries'} added`); }, []); // eslint-disable-line
  useEffect(() => { const h = CapApp.addListener('appStateChange', s => { if (!s.isActive && st.pinHash) setLocked(true); }); return () => { h.then(x => x.remove()); }; }, [st.pinHash]);
  const go = (t: string) => { const [a, b] = t.split(':'); setTab(a); setSub(b); window.scrollTo(0, 0); };
  if (locked && st.pinHash) return <Lock onUnlock={() => setLocked(false)} />;
  const add = (p?: Preset) => setForm({ preset: p }); const open = (t: Tx) => setForm({ edit: t });
  return <div className="app">
    <aside className="sidebar"><div className="brand">MY <span>VAULT</span></div>{TABS.map(([k, l, i]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}><Icon n={i} />{l}</button>)}</aside>
    <main>{tab === 'home' && <><div className="top"><div><h1>{st.businessName || 'MY VAULT'}</h1><div className="sub">{st.ownerName ? `Hello, ${st.ownerName}` : 'Your cash book'}</div></div></div><Home add={add} open={open} go={go} /></>}
      {tab === 'transactions' && <Transactions open={open} openParty={p => { setFocus(p); go('parties'); }} />}
      {tab === 'parties' && <Parties add={add} openTx={open} focus={focus} clearFocus={() => setFocus(null)} />}
      {tab === 'insights' && <Insights key={sub} initial={sub} open={open} />}
      {tab === 'settings' && <SettingsScreen lockNow={() => setLocked(true)} />}</main>
    <nav className="nav" aria-label="Main">{TABS.map(([k, l, i]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)} aria-current={tab === k ? 'page' : undefined}><Icon n={i} />{l}</button>)}</nav>
    <button className="fab" aria-label="Add transaction" onClick={() => add()}><Icon n="plus" s={26} /></button>
    {form && <TxForm edit={form.edit} preset={form.preset} onClose={() => setForm(null)} />}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
