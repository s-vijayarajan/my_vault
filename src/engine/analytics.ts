import type { Data, Tx } from './types';
import { addDays, parse, iso, monthKey, rangeFor } from './dates';
import { categoryTotals, isExpenseKind, isIncomeKind, summary, inRange } from './ledger';

export function monthlySeries(d: Data, endDate: string, months = 6) {
  const end = parse(endDate); const out: { month: string; income: number; expense: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = new Date(end.getFullYear(), end.getMonth() - i, 1); const key = monthKey(iso(m));
    const s = summary(d, key + '-01', key + '-31'); out.push({ month: key, income: s.income, expense: s.expense });
  }
  return out;
}
export function dailySeries(d: Data, from: string, to: string) {
  const out: { date: string; income: number; expense: number }[] = []; const idx = new Map<string, number>();
  for (let x = from; x <= to; x = addDays(x, 1)) { idx.set(x, out.length); out.push({ date: x, income: 0, expense: 0 }); }
  for (const t of d.txs) { const i = idx.get(t.date); if (i === undefined) continue; if (isIncomeKind(t.kind)) out[i].income += t.amount; if (isExpenseKind(t.kind)) out[i].expense += t.amount; }
  return out;
}
export function dayTotals(d: Data, month: string) {
  const m = new Map<string, { income: number; expense: number }>();
  for (const t of d.txs) { if (monthKey(t.date) !== month) continue; const e = m.get(t.date) ?? { income: 0, expense: 0 };
    if (isIncomeKind(t.kind)) e.income += t.amount; if (isExpenseKind(t.kind)) e.expense += t.amount; m.set(t.date, e); }
  return m;
}
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

export interface Insights {
  bestIncomeDay: { date: string; amount: number } | null;
  topExpenseCategory: { category: string; total: number; share: number } | null;
  spendingTrend: { current: number; previous: number; changePct: number | null };
  incomeVsExpense: { income: number; expense: number };
  unusual: Tx[];
  savingsSoFar: number; savingsProjected: number;
  health: { label: 'Strong' | 'Steady' | 'Needs attention' | 'No data'; savingsRate: number | null };
}
export function insights(d: Data, todayStr: string): Insights {
  const [mFrom, mTo] = rangeFor('month', todayStr); const prev = rangeFor('month', addDays(mFrom, -1));
  const cur = summary(d, mFrom, mTo); const pre = summary(d, prev[0], prev[1]);
  // best income day over the last 90 days
  const days = new Map<string, number>(); const from90 = addDays(todayStr, -89);
  for (const t of d.txs) if (isIncomeKind(t.kind) && inRange(t, from90, todayStr)) days.set(t.date, (days.get(t.date) ?? 0) + t.amount);
  let best: Insights['bestIncomeDay'] = null; for (const [date, amount] of days) if (!best || amount > best.amount) best = { date, amount };
  const cats = categoryTotals(d, mFrom, mTo, 'expense'); const top = cats[0] ? { ...cats[0], share: cur.expense ? cats[0].total / cur.expense : 0 } : null;
  // unusual expenses: last 60 days, vs history of the same category (needs >=4 earlier entries)
  const unusual: Tx[] = []; const exp = d.txs.filter(t => isExpenseKind(t.kind));
  for (const t of exp) {
    if (t.date < addDays(todayStr, -60) || t.date > todayStr) continue;
    const hist = exp.filter(x => x.category === t.category && x.id !== t.id && (x.date < t.date || (x.date === t.date && x.createdAt < t.createdAt))).map(x => x.amount);
    if (hist.length < 4) continue;
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length; const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) ** 2, 0) / hist.length);
    if (t.amount >= Math.max(3 * median(hist), mean + 2 * sd)) unusual.push(t);
  }
  unusual.sort((a, b) => b.date.localeCompare(a.date));
  const dom = parse(todayStr).getDate(); const dim = parse(mTo).getDate();
  const proj = Math.round(cur.net / dom * dim);
  const rate = cur.income > 0 ? cur.net / cur.income : null;
  const label = cur.income === 0 && cur.expense === 0 ? 'No data' : rate === null || rate < 0 ? 'Needs attention' : rate >= 0.2 ? 'Strong' : 'Steady';
  return {
    bestIncomeDay: best, topExpenseCategory: top,
    spendingTrend: { current: cur.expense, previous: pre.expense, changePct: pre.expense ? Math.round((cur.expense - pre.expense) / pre.expense * 100) : null },
    incomeVsExpense: { income: cur.income, expense: cur.expense }, unusual: unusual.slice(0, 5),
    savingsSoFar: cur.net, savingsProjected: proj, health: { label, savingsRate: rate },
  };
}

export interface BudgetRow { id: string; category: string; limit: number; spent: number; pct: number; status: 'ok' | 'near' | 'over'; }
export function budgetProgress(d: Data, todayStr: string): { rows: BudgetRow[]; overall: { limit: number; spent: number; pct: number } | null; savings: { target: number; actual: number; pct: number } | null } {
  const [f, t] = rangeFor('month', todayStr); const cats = new Map(categoryTotals(d, f, t, 'expense').map(c => [c.category, c.total]));
  const rows = d.budgets.map(b => { const spent = cats.get(b.category) ?? 0; const pct = b.limit ? Math.round(spent / b.limit * 100) : 0; return { id: b.id, category: b.category, limit: b.limit, spent, pct, status: pct >= 100 ? 'over' as const : pct >= 80 ? 'near' as const : 'ok' as const }; });
  const s = summary(d, f, t); const st = d.settings;
  return {
    rows,
    overall: st.expenseLimit > 0 ? { limit: st.expenseLimit, spent: s.expense, pct: Math.round(s.expense / st.expenseLimit * 100) } : null,
    savings: st.savingsTarget > 0 ? { target: st.savingsTarget, actual: s.net, pct: Math.max(0, Math.round(s.net / st.savingsTarget * 100)) } : null,
  };
}
