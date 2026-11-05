import { useMemo, useState } from 'react';
import { useVault } from '../vault';
import { budgetProgress, insights } from '../engine/analytics';
import { categoryTotals, outstanding, partyBalance, sortedTxs, summary, inRange, uid } from '../engine/ledger';
import { addDays, formatDate, parse, rangeFor, today } from '../engine/dates';
import { formatINR, parseRupees, toRupeeString } from '../engine/money';
import { processRecurring, upcoming } from '../engine/recurring';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type Recurring } from '../engine/types';
import { Empty, Field, Icon, Progress, Sheet, TxRow } from './common';
import { saveFile } from '../files';
import { periodPdf } from '../report';
import { txsToCsv } from '../engine/backup';
import type { Tx } from '../engine/types';

type Sub = 'insights' | 'goals' | 'reports' | 'recurring';
export function Insights({ initial, open }: { initial?: string; open: (t: Tx) => void }) {
  const [sub, setSub] = useState<Sub>((initial as Sub) || 'insights');
  return <><div className="top"><div><h1>Insights</h1><div className="sub">Worked out on your phone, never uploaded</div></div></div>
    <div className="seg">{([['insights', 'Overview'], ['goals', 'Goals'], ['reports', 'Reports'], ['recurring', 'Recurring']] as const).map(([k, l]) => <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>)}</div>
    {sub === 'insights' && <Overview open={open} />}{sub === 'goals' && <Goals />}{sub === 'reports' && <Reports />}{sub === 'recurring' && <RecurringTab />}</>;
}
function Overview({ open }: { open: (t: Tx) => void }) {
  const { data } = useVault(); const t0 = today(); const i = useMemo(() => insights(data, t0), [data, t0]); const df = data.settings.dateFormat; const ch = i.spendingTrend.changePct;
  if (!data.txs.length) return <Empty>Add a few transactions and your insights will appear here.</Empty>;
  const items: [string, string, string][] = [
    ['target', i.bestIncomeDay ? `Best income day: ${formatDate(i.bestIncomeDay.date, df)}` : 'Best income day', i.bestIncomeDay ? `${formatINR(i.bestIncomeDay.amount)} earned, from the last 90 days.` : 'No income in the last 90 days.'],
    ['up', i.topExpenseCategory ? `Biggest expense: ${i.topExpenseCategory.category}` : 'Biggest expense', i.topExpenseCategory ? `${formatINR(i.topExpenseCategory.total)}, ${Math.round(i.topExpenseCategory.share * 100)}% of this month's spending.` : 'No expenses this month yet.'],
    ['spark', 'Spending trend', ch === null ? `${formatINR(i.spendingTrend.current)} spent this month. Last month had no expenses to compare.` : `${formatINR(i.spendingTrend.current)} this month, ${Math.abs(ch)}% ${ch > 0 ? 'higher' : ch < 0 ? 'lower' : 'the same'} than last month (${formatINR(i.spendingTrend.previous)}).`],
    ['swap', 'Income versus expenses', `${formatINR(i.incomeVsExpense.income)} in, ${formatINR(i.incomeVsExpense.expense)} out this month.`],
    ['bulb', 'Savings estimate', `${formatINR(i.savingsSoFar)} saved so far. At this pace you will finish the month near ${formatINR(i.savingsProjected)}.`],
  ];
  return <>
    <div className="card"><h3>Financial health <b className={i.health.label === 'Strong' ? 'pos' : i.health.label === 'Needs attention' ? 'neg' : ''}>{i.health.label}</b></h3><p className="small mute">{i.health.savingsRate === null ? 'No income recorded this month, so a savings rate cannot be worked out.' : `You are keeping ${Math.round(i.health.savingsRate * 100)}% of this month's income. 20% or more is strong.`}</p></div>
    <div className="card">{items.map(([ic, t, s]) => <div className="insight" key={t}><span className="dot"><Icon n={ic} s={18} /></span><div><b>{t}</b><span>{s}</span></div></div>)}</div>
    <div className="card"><h3>Unusual expenses</h3>{i.unusual.length ? <>{i.unusual.map(t => <TxRow key={t.id} t={t} onClick={() => open(t)} />)}<p className="small mute" style={{ marginTop: 8 }}>Much larger than your usual spending in the same category.</p></> : <p className="small mute">Nothing stands out in the last 60 days.</p>}</div></>;
}
function Goals() {
  const { data, apply, setSettings } = useVault(); const p = budgetProgress(data, today()); const [form, setForm] = useState<'budget' | 'limits' | null>(null);
  return <>
    <div className="card"><h3>This month <button onClick={() => setForm('limits')}>Set targets</button></h3>
      {p.savings ? <div style={{ marginBottom: 14 }}><div className="row2" style={{ padding: '0 0 8px' }}><span>Savings target</span><b>{formatINR(p.savings.actual)} of {formatINR(p.savings.target)}</b></div><Progress pct={Math.min(p.savings.pct, 100)} /></div> : <p className="small mute" style={{ marginBottom: 10 }}>No savings target yet.</p>}
      {p.overall ? <div><div className="row2" style={{ padding: '0 0 8px' }}><span>Spending limit</span><b>{formatINR(p.overall.spent)} of {formatINR(p.overall.limit)}</b></div><Progress pct={p.overall.pct} /></div> : <p className="small mute">No overall expense limit yet.</p>}</div>
    <div className="card"><h3>Category budgets <button onClick={() => setForm('budget')}>Add</button></h3>
      {p.rows.length ? p.rows.map(r => <div key={r.id} style={{ marginBottom: 14 }}><div className="row2" style={{ padding: '0 0 8px' }}><span>{r.category}<span className="mute small"> · {r.pct}%</span></span><span><b className={r.status === 'over' ? 'neg' : ''}>{formatINR(r.spent)}</b><span className="mute small"> / {formatINR(r.limit)}</span> <button aria-label={`Remove ${r.category} budget`} onClick={() => apply(d => ({ ...d, budgets: d.budgets.filter(b => b.id !== r.id) }))} className="mute" style={{ marginLeft: 6 }}><Icon n="x" s={14} /></button></span></div><Progress pct={r.pct} /></div>) : <Empty>Set a monthly limit for a category, such as Food or Transport, and track it here.</Empty>}</div>
    {form === 'limits' && <LimitsForm onClose={() => setForm(null)} save={async (s, e) => { await setSettings({ savingsTarget: s, expenseLimit: e }); setForm(null); }} />}
    {form === 'budget' && <BudgetForm onClose={() => setForm(null)} />}
  </>;
}
function LimitsForm({ onClose, save }: { onClose: () => void; save: (s: number, e: number) => void }) {
  const { data } = useVault(); const [s, setS] = useState(data.settings.savingsTarget ? toRupeeString(data.settings.savingsTarget) : ''); const [e, setE] = useState(data.settings.expenseLimit ? toRupeeString(data.settings.expenseLimit) : ''); const [err, setErr] = useState('');
  return <Sheet title="Monthly targets" onClose={onClose}><Field label="Savings target (₹)"><input className="in" inputMode="decimal" value={s} onChange={x => setS(x.target.value)} /></Field><Field label="Overall spending limit (₹)"><input className="in" inputMode="decimal" value={e} onChange={x => setE(x.target.value)} /></Field>
    {err && <p className="neg small" role="alert">{err}</p>}<button className="btn" onClick={() => { const a = s.trim() ? parseRupees(s) : 0, b = e.trim() ? parseRupees(e) : 0; if (a === null || b === null) return setErr('Enter valid amounts, or leave a field empty.'); save(a, b); }}>Save targets</button></Sheet>;
}
function BudgetForm({ onClose }: { onClose: () => void }) {
  const { data, apply } = useVault(); const cats = [...new Set([...EXPENSE_CATEGORIES, ...data.txs.map(t => t.category).filter(Boolean)])].filter(c => !data.budgets.some(b => b.category === c)); const [cat, setCat] = useState(cats[0] ?? ''); const [amt, setAmt] = useState(''); const [err, setErr] = useState('');
  return <Sheet title="New category budget" onClose={onClose}><Field label="Category"><div className="chips">{cats.map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}</div></Field><Field label="Monthly limit (₹)"><input className="in" inputMode="decimal" autoFocus value={amt} onChange={e => setAmt(e.target.value)} /></Field>
    {err && <p className="neg small" role="alert">{err}</p>}<button className="btn" onClick={async () => { const v = parseRupees(amt); if (!cat || !v) return setErr('Choose a category and enter a limit above zero.'); if (await apply(d => ({ ...d, budgets: [...d.budgets, { id: uid(), category: cat, limit: v }] }), 'Budget added')) onClose(); }}>Add budget</button></Sheet>;
}
type Period = 'day' | 'week' | 'month' | 'year' | 'custom';
function Reports() {
  const { data, say } = useVault(); const t0 = today(); const df = data.settings.dateFormat; const [per, setPer] = useState<Period>('month'); const [ref, setRef] = useState(t0); const [cf, setCf] = useState(addDays(t0, -29)); const [ct, setCt] = useState(t0);
  const [from, to] = per === 'custom' ? [cf, ct] : rangeFor(per, ref); const s = summary(data, from, to); const txs = sortedTxs(data.txs.filter(t => inRange(t, from, to)));
  const step = (n: number) => { const d = parse(ref); if (per === 'day') d.setDate(d.getDate() + n); else if (per === 'week') d.setDate(d.getDate() + 7 * n); else if (per === 'month') d.setMonth(d.getMonth() + n); else d.setFullYear(d.getFullYear() + n); setRef(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); };
  const exp = categoryTotals(data, from, to, 'expense'), inc = categoryTotals(data, from, to, 'income'); const label = { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly', custom: 'Custom' }[per];
  const cust = data.parties.filter(p => p.kind === 'customer' && partyBalance(data, p.id) > 0), supp = data.parties.filter(p => p.kind === 'supplier' && partyBalance(data, p.id) > 0);
  const Cat = ({ rows, total }: { rows: { category: string; total: number }[]; total: number }) => rows.length ? <>{rows.map(c => <div key={c.category} style={{ marginBottom: 10 }}><div className="row2" style={{ padding: '0 0 6px' }}><span>{c.category}</span><b>{formatINR(c.total)}</b></div><Progress pct={Math.round(c.total / Math.max(1, total) * 100)} /></div>)}</> : <p className="small mute">Nothing in this period.</p>;
  return <>
    <div className="scroll" style={{ marginBottom: 12 }}>{(['day', 'week', 'month', 'year', 'custom'] as const).map(k => <button key={k} className={'chip' + (per === k ? ' on' : '')} onClick={() => setPer(k)}>{{ day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly', custom: 'Custom' }[k]}</button>)}</div>
    {per === 'custom' ? <div className="grid2" style={{ marginBottom: 12 }}><Field label="From"><input className="in" type="date" value={cf} onChange={e => setCf(e.target.value)} /></Field><Field label="To"><input className="in" type="date" value={ct} onChange={e => setCt(e.target.value)} /></Field></div>
      : <div className="row2" style={{ paddingTop: 0 }}><button className="iconbtn" aria-label="Previous period" onClick={() => step(-1)}><Icon n="back" /></button><b>{from === to ? formatDate(from, df) : `${formatDate(from, df)} to ${formatDate(to, df)}`}</b><button className="iconbtn" aria-label="Next period" style={{ transform: 'scaleX(-1)' }} onClick={() => step(1)}><Icon n="back" /></button></div>}
    {from > to ? <Empty>The start date is after the end date.</Empty> : <>
      <div className="grid2" style={{ marginBottom: 14 }}><div className="stat"><div className="lbl">Income</div><b className="pos">{formatINR(s.income)}</b></div><div className="stat"><div className="lbl">Expenses</div><b>{formatINR(s.expense)}</b></div></div>
      <div className="card"><h3>Cash flow</h3>{[['Cash in', s.cashIn], ['Cash out', s.cashOut], ['Net cash flow', s.cashIn - s.cashOut], ['Money received', s.received], ['Money paid', s.paid]].map(([k, v]) => <div className="row2" key={k as string}><span>{k}</span><b className={(v as number) < 0 ? 'neg' : ''}>{formatINR(v as number)}</b></div>)}</div>
      <div className="card"><h3>Income by category</h3><Cat rows={inc} total={s.income} /></div><div className="card"><h3>Expenses by category</h3><Cat rows={exp} total={s.expense} /></div>
      <div className="card"><h3>Customers owing you <b>{formatINR(outstanding(data, 'customer'))}</b></h3>{cust.length ? cust.map(p => <div className="row2" key={p.id}><span>{p.name}</span><b>{formatINR(partyBalance(data, p.id))}</b></div>) : <p className="small mute">No outstanding balances.</p>}</div>
      <div className="card"><h3>You owe suppliers <b>{formatINR(outstanding(data, 'supplier'))}</b></h3>{supp.length ? supp.map(p => <div className="row2" key={p.id}><span>{p.name}</span><b>{formatINR(partyBalance(data, p.id))}</b></div>) : <p className="small mute">No payables.</p>}</div>
      <div className="grid2"><button className="btn" onClick={async () => { try { await saveFile(`my-vault-${per}-${from}.pdf`, periodPdf(data, from, to, label), 'application/pdf', true); } catch { say('Could not create the PDF'); } }}>Export PDF</button><button className="btn alt" onClick={async () => { try { await saveFile(`my-vault-${from}-to-${to}.csv`, txsToCsv(data, txs), 'text/csv'); } catch { say('Export cancelled'); } }}>Export CSV</button></div></>}
  </>;
}
function RecurringTab() {
  const { data, apply } = useVault(); const [form, setForm] = useState<Recurring | 'new' | null>(null); const up = upcoming(data, today(), 30).slice(0, 8);
  return <>
    <div className="card"><h3>Schedules <button onClick={() => setForm('new')}>Add</button></h3>
      {data.recurring.length ? data.recurring.map(r => <div className="row2" key={r.id}><button style={{ textAlign: 'left', flex: 1 }} onClick={() => setForm(r)}><b>{r.note || r.category}</b><div className="small mute">{r.freq === 'daily' ? 'Every day' : r.freq === 'weekly' ? 'Every week' : 'Every month'} from {formatDate(r.start, data.settings.dateFormat)}{r.active ? '' : ' · paused'}</div></button><b className={r.kind === 'income' ? 'pos' : ''}>{formatINR(r.amount)}</b></div>) : <Empty>Add rent, salary or any payment that repeats. It is recorded automatically when you open the app.</Empty>}</div>
    {up.length > 0 && <div className="card"><h3>Next 30 days</h3>{up.map((u, i) => <div className="row2" key={i}><span>{u.rec.note || u.rec.category}<span className="mute small"> · {formatDate(u.date, data.settings.dateFormat)}</span></span><b className={u.rec.kind === 'income' ? 'pos' : ''}>{formatINR(u.rec.amount)}</b></div>)}</div>}
    {form && <RecForm rec={form === 'new' ? undefined : form} onClose={() => setForm(null)} apply={apply} />}</>;
}
function RecForm({ rec, onClose, apply }: { rec?: Recurring; onClose: () => void; apply: ReturnType<typeof useVault>['apply'] }) {
  const { data } = useVault(); const [kind, setKind] = useState<'income' | 'expense'>(rec?.kind ?? 'expense'); const [amt, setAmt] = useState(rec ? toRupeeString(rec.amount) : ''); const [acc, setAcc] = useState(rec?.accountId ?? data.accounts[0].id); const [cat, setCat] = useState(rec?.category ?? '');
  const [note, setNote] = useState(rec?.note ?? ''); const [freq, setFreq] = useState<Recurring['freq']>(rec?.freq ?? 'monthly'); const [start, setStart] = useState(rec?.start ?? today()); const [end, setEnd] = useState(rec?.end ?? ''); const [active, setActive] = useState(rec?.active ?? true); const [err, setErr] = useState(''); const [conf, setConf] = useState(false);
  const cats = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  async function save() { const a = parseRupees(amt); if (!a) return setErr('Enter an amount above zero.'); if (end && end < start) return setErr('The end date is before the start date.');
    const r: Recurring = { id: rec?.id ?? uid(), kind, amount: a, accountId: acc, category: cat || 'Other', note: note.trim(), freq, start, end: end || undefined, active };
    if (await apply(d => processRecurring({ ...d, recurring: rec ? d.recurring.map(x => x.id === r.id ? r : x) : [...d.recurring, r] }, today()).data, 'Schedule saved')) onClose(); }
  return <Sheet title={rec ? 'Edit schedule' : 'New schedule'} onClose={onClose}>
    <div className="seg"><button className={kind === 'expense' ? 'on' : ''} onClick={() => setKind('expense')}>Expense</button><button className={kind === 'income' ? 'on' : ''} onClick={() => setKind('income')}>Income</button></div>
    <Field label="Amount (₹)"><input className="in" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} /></Field>
    <Field label="Repeats"><div className="chips">{(['daily', 'weekly', 'monthly'] as const).map(f => <button key={f} className={'chip' + (freq === f ? ' on' : '')} onClick={() => setFreq(f)}>{f === 'daily' ? 'Daily' : f === 'weekly' ? 'Weekly' : 'Monthly'}</button>)}</div></Field>
    <Field label="Account"><div className="chips">{data.accounts.map(a => <button key={a.id} className={'chip' + (acc === a.id ? ' on' : '')} onClick={() => setAcc(a.id)}>{a.name}</button>)}</div></Field>
    <Field label="Category"><div className="scroll">{cats.map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}</div></Field>
    <Field label="Description"><input className="in" value={note} onChange={e => setNote(e.target.value)} /></Field>
    <div className="grid2"><Field label="Starts"><input className="in" type="date" value={start} onChange={e => setStart(e.target.value)} /></Field><Field label="Ends (optional)"><input className="in" type="date" value={end} onChange={e => setEnd(e.target.value)} /></Field></div>
    {rec && <button className="chip" style={{ marginBottom: 14 }} onClick={() => setActive(!active)}>{active ? 'Active. Tap to pause' : 'Paused. Tap to resume'}</button>}
    {err && <p className="neg small" style={{ marginBottom: 10 }} role="alert">{err}</p>}<button className="btn" onClick={save}>Save schedule</button>
    {rec && <button className="btn danger" style={{ marginTop: 10 }} onClick={async () => { if (!conf) return setConf(true); if (await apply(d => ({ ...d, recurring: d.recurring.filter(x => x.id !== rec.id) }), 'Schedule deleted. Past entries were kept.')) onClose(); }}>{conf ? 'Tap again to delete the schedule' : 'Delete schedule'}</button>}
  </Sheet>;
}
