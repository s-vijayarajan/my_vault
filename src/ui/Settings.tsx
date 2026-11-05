import { useRef, useState } from 'react';
import { useVault } from '../vault';
import { accountBalance, deleteAccount, uid } from '../engine/ledger';
import { exportBackup, validateBackup, txsToCsv } from '../engine/backup';
import { formatINR, parseRupees, toRupeeString } from '../engine/money';
import { today } from '../engine/dates';
import type { Account, Data, Settings as S } from '../engine/types';
import { Field, Icon, Sheet } from './common';
import { saveFile } from '../files';
import { biometricAvailable, hashPin, newSalt } from '../security';
import { store } from '../db';

export function SettingsScreen({ lockNow }: { lockNow: () => void }) {
  const { data, setSettings, say, apply, replace } = useVault(); const st = data.settings; const [sheet, setSheet] = useState<'account' | 'pin' | null>(null); const [acc, setAcc] = useState<Account | undefined>(); const [restore, setRestore] = useState<{ data: Data; transactions: number; exportedAt: string } | null>(null); const [err, setErr] = useState(''); const file = useRef<HTMLInputElement>(null);
  const days = st.lastBackupAt ? Math.floor((Date.now() - st.lastBackupAt) / 864e5) : null; const stale = st.lastBackupAt === undefined ? data.txs.length > 0 : days! >= 7;
  async function backup() { try { await saveFile(`my-vault-backup-${today()}.json`, exportBackup(data), 'application/json'); await setSettings({ lastBackupAt: Date.now() }); say('Backup created'); } catch { say('Backup cancelled'); } }
  async function pick(f?: File) { if (!f) return; setErr(''); const r = validateBackup(await f.text()); if (!r.ok) { setErr(r.error); return; } setRestore({ data: r.data, transactions: r.meta.transactions, exportedAt: r.meta.exportedAt }); if (file.current) file.current.value = ''; }
  async function doRestore() { if (!restore) return; try { const d = { ...restore.data, settings: { ...restore.data.settings, pinHash: st.pinHash, pinSalt: st.pinSalt, biometric: st.biometric, lastBackupAt: Date.now() } }; await replace(d); setRestore(null); say('Backup restored'); } catch { say('Restore failed. Your current data is unchanged.'); } }
  async function toggleBio() { if (!st.biometric) { if (!st.pinHash) return say('Set a PIN first.'); if (!(await biometricAvailable())) return say('Fingerprint or face unlock is not available on this device.'); } await setSettings({ biometric: !st.biometric }); }
  return <>
    <div className="top"><div><h1>Settings</h1><div className="sub">Stored only on this device ({store.kind === 'sqlite' ? 'SQLite' : 'browser storage, development mode'})</div></div></div>
    <div className="card"><h3>Business</h3><Field label="Business name"><input className="in" value={st.businessName} onChange={e => setSettings({ businessName: e.target.value })} /></Field><Field label="Owner name"><input className="in" value={st.ownerName} onChange={e => setSettings({ ownerName: e.target.value })} /></Field>
      <Field label="Currency"><input className="in" value="Indian rupee (₹ INR)" disabled /></Field>
      <Field label="Date format"><div className="chips">{(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const).map(f => <button key={f} className={'chip' + (st.dateFormat === f ? ' on' : '')} onClick={() => setSettings({ dateFormat: f })}>{f}</button>)}</div></Field>
      <Field label="Theme"><div className="chips">{(['system', 'light', 'dark'] as const).map(t => <button key={t} className={'chip' + (st.theme === t ? ' on' : '')} onClick={() => setSettings({ theme: t })}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div></Field></div>
    <div className="card"><h3>Accounts <button onClick={() => { setAcc(undefined); setSheet('account'); }}>Add</button></h3>{data.accounts.map(a => <button className="row2" style={{ width: '100%', textAlign: 'left' }} key={a.id} onClick={() => { setAcc(a); setSheet('account'); }}><span><Icon n={a.type === 'cash' ? 'down' : 'bank'} s={16} /> {a.name}<span className="mute small"> · {a.type === 'cash' ? 'Cash' : 'Bank'}</span></span><b>{formatINR(accountBalance(data, a.id))}</b></button>)}</div>
    <div className="card"><h3>Security</h3>
      <div className="row2"><span>PIN lock<div className="small mute">{st.pinHash ? 'On' : 'Off'}</div></span><div style={{ display: 'flex', gap: 8 }}>{st.pinHash && <button className="chip" onClick={lockNow}>Lock now</button>}<button className="chip on" onClick={() => setSheet('pin')}>{st.pinHash ? 'Change' : 'Set PIN'}</button></div></div>
      <div className="row2"><span>Fingerprint or face unlock<div className="small mute">Needs a PIN as backup</div></span><button className={'chip' + (st.biometric ? ' on' : '')} onClick={toggleBio}>{st.biometric ? 'On' : 'Off'}</button></div></div>
    <div className="card"><h3>Backup and restore</h3>
      <p className={'small ' + (stale ? 'neg' : 'mute')} style={{ marginBottom: 12 }} role="status">{st.lastBackupAt === undefined ? (data.txs.length ? 'No backup yet. Create one now so a lost phone does not mean lost records.' : 'No backup yet.') : `Last backup ${days === 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago'}.`}{st.lastBackupAt !== undefined && stale ? ' Time for a fresh one.' : ''}</p>
      <div className="grid2"><button className="btn" onClick={backup}>Back up now</button><button className="btn alt" onClick={() => file.current?.click()}>Restore</button></div>
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={e => pick(e.target.files?.[0])} />
      {err && <p className="neg small" style={{ marginTop: 10 }} role="alert">{err}</p>}
      <button className="btn alt" style={{ marginTop: 10 }} onClick={() => saveFile(`my-vault-all-transactions-${today()}.csv`, txsToCsv(data, data.txs), 'text/csv').catch(() => say('Export cancelled'))}>Export all transactions (CSV)</button>
      <p className="small mute" style={{ marginTop: 10 }}>Backups do not include your PIN. They are plain files, so keep them somewhere private.</p></div>
    {sheet === 'account' && <AccountForm acc={acc} onClose={() => setSheet(null)} />}{sheet === 'pin' && <PinForm onClose={() => setSheet(null)} />}
    {restore && <Sheet title="Restore this backup?" onClose={() => setRestore(null)}><p style={{ marginBottom: 8 }}>The file is valid: {restore.transactions} transactions, saved {new Date(restore.exportedAt).toLocaleString()}.</p><p className="neg small" style={{ marginBottom: 16 }}>Everything currently in the app will be replaced. Back up first if you may need it.</p><button className="btn" onClick={doRestore}>Replace my data</button><button className="btn alt" style={{ marginTop: 10 }} onClick={() => setRestore(null)}>Cancel</button></Sheet>}
  </>;
  void apply;
}
function AccountForm({ acc, onClose }: { acc?: Account; onClose: () => void }) {
  const { apply } = useVault(); const [name, setName] = useState(acc?.name ?? ''); const [type, setType] = useState<Account['type']>(acc?.type ?? 'bank'); const [open, setOpen] = useState(acc ? toRupeeString(acc.opening) : ''); const [err, setErr] = useState(''); const [conf, setConf] = useState(false);
  async function save() { const o = open.trim() ? parseRupees(open.replace('-', '')) : 0; if (!name.trim()) return setErr('Enter an account name.'); if (o === null) return setErr('Opening balance must be a valid amount.'); const a: Account = { id: acc?.id ?? uid(), name: name.trim(), type, opening: o };
    if (await apply(d => ({ ...d, accounts: acc ? d.accounts.map(x => x.id === a.id ? a : x) : [...d.accounts, a] }), 'Account saved')) onClose(); }
  return <Sheet title={acc ? 'Edit account' : 'New account'} onClose={onClose}><Field label="Name"><input className="in" autoFocus value={name} onChange={e => setName(e.target.value)} /></Field>
    <Field label="Type"><div className="chips">{(['cash', 'bank'] as const).map(t => <button key={t} className={'chip' + (type === t ? ' on' : '')} onClick={() => setType(t)}>{t === 'cash' ? 'Cash' : 'Bank'}</button>)}</div></Field>
    <Field label="Opening balance (₹)"><input className="in" inputMode="decimal" placeholder="0" value={open} onChange={e => setOpen(e.target.value)} /></Field>{err && <p className="neg small" style={{ marginBottom: 10 }} role="alert">{err}</p>}
    <button className="btn" onClick={save}>Save account</button>{acc && <button className="btn danger" style={{ marginTop: 10 }} onClick={async () => { if (!conf) return setConf(true); if (await apply(d => deleteAccount(d, acc.id), 'Account deleted')) onClose(); }}>{conf ? 'Tap again to delete' : 'Delete account'}</button>}</Sheet>;
}
function PinForm({ onClose }: { onClose: () => void }) {
  const { data, setSettings, say } = useVault(); const st = data.settings; const [cur, setCur] = useState(''); const [a, setA] = useState(''); const [b, setB] = useState(''); const [err, setErr] = useState('');
  async function save(remove = false) {
    if (st.pinHash && (await hashPin(cur, st.pinSalt!)) !== st.pinHash) return setErr('Current PIN is wrong.');
    if (remove) { await setSettings({ pinHash: undefined, pinSalt: undefined, biometric: false } as Partial<S>); say('PIN removed'); return onClose(); }
    if (!/^\d{4,6}$/.test(a)) return setErr('Use 4 to 6 digits.'); if (a !== b) return setErr('The two PINs do not match.');
    const salt = newSalt(); await setSettings({ pinSalt: salt, pinHash: await hashPin(a, salt) }); say('PIN saved'); onClose();
  }
  const pin = (v: string, f: (s: string) => void, l: string) => <Field label={l}><input className="in" type="password" inputMode="numeric" maxLength={6} value={v} onChange={e => { f(e.target.value.replace(/\D/g, '')); setErr(''); }} /></Field>;
  return <Sheet title={st.pinHash ? 'Change PIN' : 'Set a PIN'} onClose={onClose}>{st.pinHash && pin(cur, setCur, 'Current PIN')}{pin(a, setA, 'New PIN (4 to 6 digits)')}{pin(b, setB, 'Repeat new PIN')}{err && <p className="neg small" style={{ marginBottom: 10 }} role="alert">{err}</p>}
    <button className="btn" onClick={() => save()}>Save PIN</button>{st.pinHash && <button className="btn danger" style={{ marginTop: 10 }} onClick={() => save(true)}>Remove PIN</button>}</Sheet>;
}
