import { useMemo } from 'react';
import { useVault } from '../vault';
import { accountBalance, outstanding, sortedTxs, summary, totalCash } from '../engine/ledger';
import { addDays, rangeFor, today } from '../engine/dates';
import { dailySeries, insights, monthlySeries } from '../engine/analytics';
import { upcoming } from '../engine/recurring';
import { formatINR } from '../engine/money';
import { formatDate } from '../engine/dates';
import { FlowChart, Icon, MONTHS, Sparkline, TxRow, Empty } from './common';
import type { Preset } from './TxForm';
import type { Tx } from '../engine/types';

export function Home({ add, open, go }: { add: (p?: Preset) => void; open: (t: Tx) => void; go: (tab: string) => void }) {
  const { data } = useVault(); const t0 = today(); const [mf, mt] = rangeFor('month', t0);
  const cash = totalCash(data); const day = summary(data, t0, t0); const mon = summary(data, mf, mt);
  const toRecv = outstanding(data, 'customer'), toPay = outstanding(data, 'supplier'); const ins = useMemo(() => insights(data, t0), [data, t0]);
  const series = useMemo(() => monthlySeries(data, t0, 6).map(m => ({ label: MONTHS[+m.month.slice(5) - 1], income: m.income, expense: m.expense })), [data, t0]);
  const spark = useMemo(() => { // cash balance trend over the last 30 days
    const days = dailySeries(data, addDays(t0, -29), t0);
    let bal = cash; const out: number[] = []; const net = new Map<string, number>();
    data.txs.forEach(t => { const d = (t.kind === 'income' || t.kind === 'received') ? t.amount : (t.kind === 'expense' || t.kind === 'paid') ? -t.amount : 0; net.set(t.date, (net.get(t.date) ?? 0) + d); });
    for (let i = days.length - 1; i >= 0; i--) { out.unshift(bal); bal -= net.get(days[i].date) ?? 0; } return out; }, [data, cash, t0]);
  const recent = sortedTxs(data.txs).slice(0, 5); const up = upcoming(data, t0, 14).slice(0, 3);
  const healthTone = ins.health.label === 'Strong' ? 'pos' : ins.health.label === 'Needs attention' ? 'neg' : '';
  return <div className="home">
    <div className="span"><div className="hero"><Sparkline values={spark} /><div className="lbl">Total cash balance</div><div className="big">{formatINR(cash)}</div>
      <div className="row"><div><span>In today</span><b>{formatINR(day.cashIn)}</b></div><div><span>Out today</span><b>{formatINR(day.cashOut)}</b></div></div></div>
    <div className="quick">{([['income', 'Income', 'down'], ['expense', 'Expense', 'up'], ['received', 'Received', 'down'], ['paid', 'Paid', 'up'], ['transfer', 'Transfer', 'swap']] as const).map(([k, l, i]) => <button key={k} onClick={() => add({ kind: k })}><i><Icon n={i} s={18} /></i>{l}</button>)}</div></div>
    <div>
      <div className="grid2" style={{ marginBottom: 14 }}><div className="stat"><div className="lbl">To receive</div><b className="pos">{formatINR(toRecv)}</b></div><div className="stat"><div className="lbl">To pay</div><b>{formatINR(toPay)}</b></div></div>
      <div className="card"><h3>This month <button onClick={() => go('insights')}>Insights</button></h3>
        <div className="grid2"><div><div className="small mute">Income</div><b style={{ fontSize: 19 }} className="pos">{formatINR(mon.income)}</b></div><div><div className="small mute">Expenses</div><b style={{ fontSize: 19 }}>{formatINR(mon.expense)}</b></div></div>
        <div className="row2" style={{ marginTop: 10 }}><span className="mute small">Saved so far</span><b className={mon.net < 0 ? 'neg' : ''}>{formatINR(mon.net)}</b></div>
        <div className="row2"><span className="mute small">Financial health</span><b className={healthTone}>{ins.health.label}{ins.health.savingsRate !== null ? ` · ${Math.round(ins.health.savingsRate * 100)}% saved` : ''}</b></div></div>
      {up.length > 0 && <div className="card"><h3>Coming up <button onClick={() => go('insights:recurring')}>All</button></h3>{up.map((u, i) => <div className="row2" key={i}><span>{u.rec.note || u.rec.category}<span className="mute small"> · {formatDate(u.date, data.settings.dateFormat)}</span></span><b className={u.rec.kind === 'income' ? 'pos' : ''}>{formatINR(u.rec.amount)}</b></div>)}</div>}
    </div>
    <div>
      <div className="card"><h3>Income and expenses <span className="small mute" style={{ fontWeight: 500 }}>6 months</span></h3><FlowChart series={series} />
        <div className="chips small mute" style={{ marginTop: 6 }}><span><b className="pos">■</b> Income</span><span><b className="gold">■</b> Expenses</span></div></div>
      {data.accounts.length > 1 && <div className="card"><h3>Accounts <button onClick={() => go('settings')}>Manage</button></h3>{data.accounts.map(a => <div className="row2" key={a.id}><span>{a.name}</span><b>{formatINR(accountBalance(data, a.id))}</b></div>)}</div>}
    </div>
    <div className="span card"><h3>Recent <button onClick={() => go('transactions')}>See all</button></h3>
      {recent.length ? recent.map(t => <TxRow key={t.id} t={t} onClick={() => open(t)} />) : <Empty>No transactions yet. Tap + to record your first one.</Empty>}</div>
  </div>;
}
