import { useMemo, useState } from 'react';
import { useVault } from '../vault';
import { searchAll, type SearchFilters } from '../engine/ledger';
import { addDays, formatDate, parse, rangeFor, today, iso, monthKey } from '../engine/dates';
import { dayTotals } from '../engine/analytics';
import { formatINR, parseRupees } from '../engine/money';
import type { Party, Tx } from '../engine/types';
import { Empty, Icon, KIND_LABEL, MONTHS, TxRow } from './common';
import { txsToCsv } from '../engine/backup';
import { saveFile } from '../files';

type Quick = 'all' | 'today' | '7d' | 'month';
export function Transactions({ open, openParty }: { open: (t: Tx) => void; openParty: (p: Party) => void }) {
  const { data, say } = useVault(); const t0 = today();
  const [view, setView] = useState<'list' | 'calendar'>('list'); const [q, setQ] = useState(''); const [quick, setQuick] = useState<Quick>('all');
  const [kind, setKind] = useState<SearchFilters['kind']>('all'); const [min, setMin] = useState(''); const [max, setMax] = useState(''); const [more, setMore] = useState(false);
  const [month, setMonth] = useState(monthKey(t0)); const [sel, setSel] = useState<string>(t0);
  const range = quick === 'today' ? [t0, t0] : quick === '7d' ? [addDays(t0, -6), t0] : quick === 'month' ? rangeFor('month', t0) : [undefined, undefined];
  const f: SearchFilters = { q, from: view === 'calendar' ? sel : range[0], to: view === 'calendar' ? sel : range[1], min: min ? parseRupees(min) ?? undefined : undefined, max: max ? parseRupees(max) ?? undefined : undefined, kind };
  const res = useMemo(() => searchAll(data, view === 'calendar' ? { q: '', from: sel, to: sel } : f), [data, view, q, quick, kind, min, max, sel]); // eslint-disable-line
  const groups = useMemo(() => { const m = new Map<string, Tx[]>(); res.txs.forEach(t => m.set(t.date, [...(m.get(t.date) ?? []), t])); return [...m.entries()]; }, [res.txs]);
  async function exportCsv() { try { await saveFile(`my-vault-transactions-${t0}.csv`, txsToCsv(data, res.txs), 'text/csv'); } catch { say('Export cancelled'); } }

  return <>
    <div className="top"><div><h1>Transactions</h1><div className="sub">{view === 'list' ? `${res.txs.length} shown` : 'Pick a day'}</div></div>
      <div style={{ display: 'flex', gap: 8 }}><button className="iconbtn" aria-label={view === 'list' ? 'Calendar view' : 'List view'} onClick={() => setView(view === 'list' ? 'calendar' : 'list')}><Icon n={view === 'list' ? 'cal' : 'list'} /></button>
        {view === 'list' && <button className="iconbtn" aria-label="Export CSV" onClick={exportCsv}><Icon n="file" /></button>}</div></div>
    {view === 'list' ? <>
      <div className="search"><Icon n="search" /><input placeholder="Search notes, people, categories, amounts" value={q} onChange={e => setQ(e.target.value)} aria-label="Search" /><button onClick={() => setMore(!more)} className="small mute" style={{ fontWeight: 600 }}>{more ? 'Less' : 'Filters'}</button></div>
      <div className="scroll" style={{ marginBottom: 12 }}>{([['all', 'All time'], ['today', 'Today'], ['7d', 'Last 7 days'], ['month', 'This month']] as const).map(([k, l]) => <button key={k} className={'chip' + (quick === k ? ' on' : '')} onClick={() => setQuick(k)}>{l}</button>)}</div>
      {more && <div className="card"><div className="scroll" style={{ marginBottom: 12 }}>{(['all', 'income', 'expense', 'received', 'paid', 'credit_sale', 'credit_purchase', 'transfer'] as const).map(k => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{k === 'all' ? 'All types' : KIND_LABEL[k]}</button>)}</div>
        <div className="grid2"><label className="field" style={{ margin: 0 }}><span>Min amount (₹)</span><input className="in" inputMode="decimal" value={min} onChange={e => setMin(e.target.value)} /></label><label className="field" style={{ margin: 0 }}><span>Max amount (₹)</span><input className="in" inputMode="decimal" value={max} onChange={e => setMax(e.target.value)} /></label></div></div>}
      {(res.parties.length > 0 || res.accounts.length > 0) && <div className="card"><h3>People and accounts</h3>{res.parties.slice(0, 4).map(p => <button className="row2" style={{ width: '100%' }} key={p.id} onClick={() => openParty(p)}><span>{p.name}<span className="mute small"> · {p.kind}</span></span><Icon n="chev" s={16} /></button>)}{res.accounts.map(a => <div className="row2" key={a.id}><span>{a.name}<span className="mute small"> · account</span></span></div>)}</div>}
    </> : <Calendar month={month} setMonth={setMonth} sel={sel} setSel={setSel} />}
    {groups.length ? groups.map(([date, txs]) => <div key={date}><div className="dayhead"><span>{date === t0 ? 'Today' : formatDate(date, data.settings.dateFormat)}</span><span>{formatINR(txs.reduce((s, t) => s + (t.kind === 'income' || t.kind === 'credit_sale' || t.kind === 'received' ? t.amount : t.kind === 'transfer' ? 0 : -t.amount), 0), { sign: true })}</span></div>
      <div className="card" style={{ padding: '4px 16px', marginBottom: 8 }}>{txs.map(t => <TxRow key={t.id} t={t} onClick={() => open(t)} />)}</div></div>)
      : <Empty>{view === 'calendar' ? 'Nothing recorded on this day.' : q || quick !== 'all' || min || max || kind !== 'all' ? 'No transactions match these filters.' : 'No transactions yet. Tap + to add one.'}</Empty>}
  </>;
}
function Calendar({ month, setMonth, sel, setSel }: { month: string; setMonth: (m: string) => void; sel: string; setSel: (d: string) => void }) {
  const { data } = useVault(); const t0 = today(); const totals = useMemo(() => dayTotals(data, month), [data, month]);
  const [y, m] = month.split('-').map(Number); const first = (new Date(y, m - 1, 1).getDay() + 6) % 7; const dim = new Date(y, m, 0).getDate();
  const shift = (n: number) => setMonth(monthKey(iso(new Date(y, m - 1 + n, 1)))); const s = totals.get(sel);
  return <div className="card"><div className="row2" style={{ paddingTop: 0 }}><button className="iconbtn" aria-label="Previous month" onClick={() => shift(-1)}><Icon n="back" /></button><b>{MONTHS[m - 1]} {y}</b><button className="iconbtn" aria-label="Next month" onClick={() => shift(1)} style={{ transform: 'scaleX(-1)' }}><Icon n="back" /></button></div>
    <div className="cal">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div className="h" key={i}>{d}</div>)}{Array.from({ length: first }, (_, i) => <span key={'e' + i} />)}
      {Array.from({ length: dim }, (_, i) => { const d = `${month}-${String(i + 1).padStart(2, '0')}`; const tt = totals.get(d); return <button key={d} className={(sel === d ? 'sel ' : '') + (d === t0 ? 'today' : '')} onClick={() => setSel(d)} aria-label={d}>{i + 1}<i>{tt?.income ? <b /> : null}{tt?.expense ? <b /> : null}</i></button>; })}</div>
    <div className="grid2" style={{ marginTop: 14 }}><div><div className="small mute">Income on {parse(sel).getDate()} {MONTHS[parse(sel).getMonth()]}</div><b className="pos">{formatINR(s?.income ?? 0)}</b></div><div><div className="small mute">Expenses</div><b>{formatINR(s?.expense ?? 0)}</b></div></div></div>;
}
