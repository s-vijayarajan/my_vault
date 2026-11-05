import { describe, it, expect } from 'vitest';
import { emptyData, addTx, updateTx, deleteTx, accountBalance, totalCash, partyBalance, summary, outstanding, partyStatement, deleteAccount, deleteParty, searchAll } from '../src/engine/ledger';
import { processRecurring, upcoming, occurrences } from '../src/engine/recurring';
import { exportBackup, validateBackup, txsToCsv } from '../src/engine/backup';
import { insights, budgetProgress, monthlySeries } from '../src/engine/analytics';
import { parseRupees, formatINR } from '../src/engine/money';
import type { Data, Tx } from '../src/engine/types';

let n = 0;
const tx = (p: Partial<Tx>): Tx => ({ id: 't' + ++n, date: '2026-11-03', kind: 'income', amount: 10000, accountId: 'cash', category: 'Sales', note: '', createdAt: n, ...p });
const must = (r: ReturnType<typeof addTx>): Data => { if (!r.ok) throw new Error(r.error); return r.data; };
function base(): Data {
  const d = emptyData();
  d.accounts.push({ id: 'bank', name: 'HDFC', type: 'bank', opening: 500000 });
  d.parties.push({ id: 'c1', kind: 'customer', name: 'Asha', opening: 20000 }, { id: 's1', kind: 'supplier', name: 'Mani Traders', opening: 30000 });
  return d;
}
describe('money', () => {
  it('parses without floats', () => { expect(parseRupees('1,234.5')).toBe(123450); expect(parseRupees('0.07')).toBe(7); expect(parseRupees('abc')).toBeNull(); expect(parseRupees('1.234')).toBeNull(); });
  it('formats Indian grouping', () => { expect(formatINR(12345678)).toBe('₹1,23,456.78'); expect(formatINR(-50000)).toBe('-₹500'); expect(formatINR(10000000, { compact: true })).toBe('₹1L'); });
  it('0.1+0.2 style sums stay exact', () => { let s = 0; for (let i = 0; i < 10; i++) s += parseRupees('0.10')!; expect(s).toBe(100); });
});
describe('accounting rules', () => {
  it('income up, expense down', () => {
    let d = base(); d = must(addTx(d, tx({ amount: 100000 }))); d = must(addTx(d, tx({ kind: 'expense', amount: 30000 })));
    expect(accountBalance(d, 'cash')).toBe(70000);
  });
  it('received lowers customer outstanding and raises account', () => {
    let d = base(); d = must(addTx(d, tx({ kind: 'received', amount: 5000, partyId: 'c1' })));
    expect(partyBalance(d, 'c1')).toBe(15000); expect(accountBalance(d, 'cash')).toBe(5000);
  });
  it('paid lowers supplier payable and account', () => {
    let d = base(); d = must(addTx(d, tx({ kind: 'paid', amount: 10000, partyId: 's1' })));
    expect(partyBalance(d, 's1')).toBe(20000); expect(accountBalance(d, 'cash')).toBe(-10000);
  });
  it('credit sale/purchase raise balances, not accounts, and count as income/expense', () => {
    let d = base(); d = must(addTx(d, tx({ kind: 'credit_sale', amount: 7000, partyId: 'c1', accountId: undefined })));
    d = must(addTx(d, tx({ kind: 'credit_purchase', amount: 4000, partyId: 's1', accountId: undefined })));
    expect(partyBalance(d, 'c1')).toBe(27000); expect(partyBalance(d, 's1')).toBe(34000); expect(totalCash(d)).toBe(500000);
    const s = summary(d, '2026-11-01', '2026-11-30'); expect(s.income).toBe(7000); expect(s.expense).toBe(4000); expect(s.cashIn).toBe(0);
  });
  it('transfer moves money between accounts, total cash unchanged, not in income/expense', () => {
    let d = base(); const before = totalCash(d); d = must(addTx(d, tx({ kind: 'transfer', amount: 100000, accountId: 'bank', toAccountId: 'cash' })));
    expect(accountBalance(d, 'bank')).toBe(400000); expect(accountBalance(d, 'cash')).toBe(100000); expect(totalCash(d)).toBe(before);
    const s = summary(d, '2026-11-01', '2026-11-30'); expect(s.income + s.expense).toBe(0);
  });
  it('edit and delete rebalance everything', () => {
    let d = base(); const t = tx({ kind: 'received', amount: 5000, partyId: 'c1' }); d = must(addTx(d, t));
    d = must(updateTx(d, { ...t, amount: 8000, accountId: 'bank' }));
    expect(partyBalance(d, 'c1')).toBe(12000); expect(accountBalance(d, 'bank')).toBe(508000); expect(accountBalance(d, 'cash')).toBe(0);
    d = deleteTx(d, t.id); expect(partyBalance(d, 'c1')).toBe(20000); expect(accountBalance(d, 'bank')).toBe(500000);
  });
  it('outstanding totals and statements with running balance', () => {
    let d = base(); d = must(addTx(d, tx({ kind: 'credit_sale', amount: 5000, partyId: 'c1', accountId: undefined, date: '2026-11-01' })));
    d = must(addTx(d, tx({ kind: 'received', amount: 10000, partyId: 'c1', date: '2026-11-02' })));
    expect(outstanding(d, 'customer')).toBe(15000); expect(outstanding(d, 'supplier')).toBe(30000);
    const st = partyStatement(d, 'c1'); expect(st.rows.map(r => r.running)).toEqual([25000, 15000]); expect(st.closing).toBe(15000);
  });
  it('rejects invalid transactions', () => {
    const d = base();
    expect(addTx(d, tx({ amount: 0 })).ok).toBe(false); expect(addTx(d, tx({ amount: 1.5 })).ok).toBe(false);
    expect(addTx(d, tx({ kind: 'received', partyId: 's1' })).ok).toBe(false); expect(addTx(d, tx({ kind: 'transfer', accountId: 'cash', toAccountId: 'cash' })).ok).toBe(false);
    expect(addTx(d, tx({ accountId: 'nope' })).ok).toBe(false);
  });
  it('blocks deleting accounts/parties in use', () => {
    let d = base(); d = must(addTx(d, tx({ partyId: undefined }))); d = must(addTx(d, tx({ kind: 'credit_sale', partyId: 'c1', accountId: undefined })));
    expect(deleteAccount(d, 'cash').ok).toBe(false); expect(deleteParty(d, 'c1').ok).toBe(false); expect(deleteAccount(d, 'bank').ok).toBe(true);
  });
});
describe('recurring', () => {
  const rec = { id: 'r1', kind: 'expense' as const, amount: 100000, accountId: 'cash', category: 'Rent', note: 'Rent', freq: 'monthly' as const, start: '2026-08-31', active: true };
  it('monthly keeps anchor day with clamping', () => { expect(occurrences(rec, '2026-12-31')).toEqual(['2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31']); });
  it('is idempotent — no duplicates on repeated opens', () => {
    const d = { ...base(), recurring: [rec] }; const a = processRecurring(d, '2026-11-05'); expect(a.created).toBe(3);
    const b = processRecurring(a.data, '2026-11-05'); expect(b.created).toBe(0); expect(b.data.txs.length).toBe(3);
    const c = processRecurring(b.data, '2026-12-31'); expect(c.created).toBe(2);
  });
  it('lists upcoming and honours end date / inactive', () => {
    const d = { ...base(), recurring: [{ ...rec, freq: 'weekly' as const, start: '2026-11-01' }] };
    expect(upcoming(d, '2026-11-05', 14).map(u => u.date)).toEqual(['2026-11-08', '2026-11-15', '2026-11-22'].filter(x => x <= '2026-11-19'));
    expect(processRecurring({ ...d, recurring: [{ ...d.recurring[0], active: false }] }, '2026-11-30').created).toBe(0);
    expect(occurrences({ ...rec, end: '2026-09-30' }, '2026-12-31').length).toBe(2);
  });
});
describe('backup', () => {
  it('round-trips and strips PIN secrets', () => {
    let d = base(); d.settings.pinHash = 'x'; d.settings.pinSalt = 'y'; d = must(addTx(d, tx({})));
    const r = validateBackup(exportBackup(d)); expect(r.ok).toBe(true); if (r.ok) { expect(r.data.txs).toEqual(d.txs); expect(r.data.settings.pinHash).toBeUndefined(); }
  });
  it('rejects tampered, foreign, broken and inconsistent files', () => {
    const d = must(addTx(base(), tx({}))); const good = exportBackup(d);
    expect(validateBackup('nope').ok).toBe(false); expect(validateBackup('{"app":"other"}').ok).toBe(false);
    expect(validateBackup(good.replace('"amount":10000', '"amount":99999')).ok).toBe(false);
    const o = JSON.parse(good); o.data.txs[0].accountId = 'ghost'; expect(validateBackup(JSON.stringify(o)).ok).toBe(false);
  });
  it('csv escapes quotes', () => { const d = must(addTx(base(), tx({ note: 'He said "hi", ok' }))); expect(txsToCsv(d, d.txs)).toContain('"He said ""hi"", ok"'); });
});
describe('insights, budgets, search', () => {
  it('computes insights from local data', () => {
    let d = base();
    for (let i = 0; i < 5; i++) d = must(addTx(d, tx({ kind: 'expense', category: 'Food', amount: 20000, date: `2026-10-0${i + 1}` })));
    d = must(addTx(d, tx({ kind: 'expense', category: 'Food', amount: 500000, date: '2026-11-04' })));
    d = must(addTx(d, tx({ amount: 900000, date: '2026-11-02' }))); d = must(addTx(d, tx({ amount: 100000, date: '2026-11-03' })));
    const i = insights(d, '2026-11-05');
    expect(i.bestIncomeDay).toEqual({ date: '2026-11-02', amount: 900000 }); expect(i.topExpenseCategory?.category).toBe('Food');
    expect(i.unusual.map(t => t.amount)).toEqual([500000]); expect(i.spendingTrend.changePct).toBe(400); expect(i.savingsSoFar).toBe(500000);
    expect(i.savingsProjected).toBe(3000000); expect(i.health.label).toBe('Strong');
  });
  it('budget progress flags near/over', () => {
    let d = base(); d.budgets.push({ id: 'b', category: 'Food', limit: 10000 }); d.settings.savingsTarget = 50000;
    d = must(addTx(d, tx({ kind: 'expense', category: 'Food', amount: 9000 }))); const p = budgetProgress(d, '2026-11-05');
    expect(p.rows[0].status).toBe('near'); expect(p.savings?.actual).toBe(-9000);
  });
  it('monthly series and search filters', () => {
    let d = base(); d = must(addTx(d, tx({ amount: 5000, date: '2026-10-10', note: 'Diwali order' }))); d = must(addTx(d, tx({ kind: 'credit_sale', partyId: 'c1', accountId: undefined, amount: 90000 })));
    expect(monthlySeries(d, '2026-11-05', 3).map(m => m.income)).toEqual([0, 5000, 90000]);
    expect(searchAll(d, { q: 'diwali' }).txs.length).toBe(1); expect(searchAll(d, { q: '', min: 50000 }).txs.length).toBe(1); expect(searchAll(d, { q: 'asha' }).parties.length).toBe(1);
  });
});
