import type { Account, Data, Party, Tx, TxKind } from './types';
import { DEFAULT_SETTINGS } from './types';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const emptyData = (): Data => ({ accounts: [{ id: 'cash', name: 'Cash', type: 'cash', opening: 0 }], parties: [], txs: [], recurring: [], budgets: [], settings: { ...DEFAULT_SETTINGS } });

/** Effect of a transaction on an account balance (paise). */
export function accountDelta(tx: Tx, accountId: string): number {
  if (tx.kind === 'transfer') return (tx.toAccountId === accountId ? tx.amount : 0) - (tx.accountId === accountId ? tx.amount : 0);
  if (tx.accountId !== accountId) return 0;
  if (tx.kind === 'income' || tx.kind === 'received') return tx.amount;
  if (tx.kind === 'expense' || tx.kind === 'paid') return -tx.amount;
  return 0; // credit sale/purchase do not touch accounts
}
/** Effect on a party's outstanding balance. Customer: + they owe us. Supplier: + we owe them. */
export function partyDelta(tx: Tx, partyId: string): number {
  if (tx.partyId !== partyId) return 0;
  if (tx.kind === 'credit_sale' || tx.kind === 'credit_purchase') return tx.amount;
  if (tx.kind === 'received' || tx.kind === 'paid') return -tx.amount;
  return 0;
}
export const accountBalance = (d: Data, id: string) => (d.accounts.find(a => a.id === id)?.opening ?? 0) + d.txs.reduce((s, t) => s + accountDelta(t, id), 0);
export const totalCash = (d: Data) => d.accounts.reduce((s, a) => s + accountBalance(d, a.id), 0);
export const partyBalance = (d: Data, id: string) => (d.parties.find(p => p.id === id)?.opening ?? 0) + d.txs.reduce((s, t) => s + partyDelta(t, id), 0);
export const outstanding = (d: Data, kind: 'customer' | 'supplier') => d.parties.filter(p => p.kind === kind).reduce((s, p) => s + Math.max(0, partyBalance(d, p.id)), 0);

export function validateTx(d: Data, t: Tx): string | null {
  if (!Number.isSafeInteger(t.amount) || t.amount <= 0) return 'Enter an amount greater than zero.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return 'Choose a valid date.';
  const acc = (id?: string) => !!id && d.accounts.some(a => a.id === id);
  const party = (k: 'customer' | 'supplier') => d.parties.some(p => p.id === t.partyId && p.kind === k);
  switch (t.kind) {
    case 'income': case 'expense': return acc(t.accountId) ? null : 'Choose an account.';
    case 'received': return !acc(t.accountId) ? 'Choose an account.' : !party('customer') ? 'Choose a customer.' : null;
    case 'paid': return !acc(t.accountId) ? 'Choose an account.' : !party('supplier') ? 'Choose a supplier.' : null;
    case 'credit_sale': return party('customer') ? null : 'Choose a customer.';
    case 'credit_purchase': return party('supplier') ? null : 'Choose a supplier.';
    case 'transfer': return !acc(t.accountId) || !acc(t.toAccountId) ? 'Choose both accounts.' : t.accountId === t.toAccountId ? 'Choose two different accounts.' : null;
  }
}
export type Result = { ok: true; data: Data } | { ok: false; error: string };
export function addTx(d: Data, t: Tx): Result {
  const e = validateTx(d, t); if (e) return { ok: false, error: e };
  if (d.txs.some(x => x.id === t.id)) return { ok: false, error: 'Duplicate transaction.' };
  return { ok: true, data: { ...d, txs: [...d.txs, t] } };
}
export function updateTx(d: Data, t: Tx): Result {
  if (!d.txs.some(x => x.id === t.id)) return { ok: false, error: 'Transaction not found.' };
  const e = validateTx(d, t); if (e) return { ok: false, error: e };
  return { ok: true, data: { ...d, txs: d.txs.map(x => x.id === t.id ? t : x) } };
}
export const deleteTx = (d: Data, id: string): Data => ({ ...d, txs: d.txs.filter(x => x.id !== id) });
export function deleteAccount(d: Data, id: string): Result {
  if (d.accounts.length <= 1) return { ok: false, error: 'Keep at least one account.' };
  if (d.txs.some(t => t.accountId === id || t.toAccountId === id) || d.recurring.some(r => r.accountId === id)) return { ok: false, error: 'This account has transactions. Delete or move them first.' };
  return { ok: true, data: { ...d, accounts: d.accounts.filter(a => a.id !== id) } };
}
export function deleteParty(d: Data, id: string): Result {
  if (d.txs.some(t => t.partyId === id)) return { ok: false, error: 'This party has transactions. Delete them first.' };
  return { ok: true, data: { ...d, parties: d.parties.filter(p => p.id !== id) } };
}

export const isIncomeKind = (k: TxKind) => k === 'income' || k === 'credit_sale';
export const isExpenseKind = (k: TxKind) => k === 'expense' || k === 'credit_purchase';
export const inRange = (t: Tx, from: string, to: string) => t.date >= from && t.date <= to;

export interface Summary { income: number; expense: number; received: number; paid: number; net: number; cashIn: number; cashOut: number; count: number; }
export function summary(d: Data, from: string, to: string): Summary {
  const s: Summary = { income: 0, expense: 0, received: 0, paid: 0, net: 0, cashIn: 0, cashOut: 0, count: 0 };
  for (const t of d.txs) {
    if (!inRange(t, from, to) || t.kind === 'transfer') continue;
    s.count++;
    if (isIncomeKind(t.kind)) s.income += t.amount;
    if (isExpenseKind(t.kind)) s.expense += t.amount;
    if (t.kind === 'received') s.received += t.amount;
    if (t.kind === 'paid') s.paid += t.amount;
  }
  s.cashIn = d.txs.filter(t => inRange(t, from, to) && (t.kind === 'income' || t.kind === 'received')).reduce((a, t) => a + t.amount, 0);
  s.cashOut = d.txs.filter(t => inRange(t, from, to) && (t.kind === 'expense' || t.kind === 'paid')).reduce((a, t) => a + t.amount, 0);
  s.net = s.income - s.expense;
  return s;
}
export function categoryTotals(d: Data, from: string, to: string, kind: 'income' | 'expense') {
  const m = new Map<string, number>();
  for (const t of d.txs) if (inRange(t, from, to) && (kind === 'income' ? isIncomeKind(t.kind) : isExpenseKind(t.kind))) m.set(t.category || 'Other', (m.get(t.category || 'Other') ?? 0) + t.amount);
  return [...m.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

export interface PartyRow { tx: Tx; delta: number; running: number; }
export function partyStatement(d: Data, id: string): { opening: number; rows: PartyRow[]; closing: number } {
  const p = d.parties.find(x => x.id === id); const opening = p?.opening ?? 0;
  const txs = d.txs.filter(t => t.partyId === id).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  let run = opening; const rows = txs.map(tx => { const delta = partyDelta(tx, id); run += delta; return { tx, delta, running: run }; });
  return { opening, rows, closing: run };
}
export function accountStatement(d: Data, id: string): { opening: number; rows: PartyRow[]; closing: number } {
  const a = d.accounts.find(x => x.id === id); const opening = a?.opening ?? 0;
  const txs = d.txs.filter(t => accountDelta(t, id) !== 0).sort((x, y) => x.date.localeCompare(y.date) || x.createdAt - y.createdAt);
  let run = opening; const rows = txs.map(tx => { const delta = accountDelta(tx, id); run += delta; return { tx, delta, running: run }; });
  return { opening, rows, closing: run };
}
export const sortedTxs = (txs: Tx[]) => [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

export interface SearchFilters { q: string; from?: string; to?: string; min?: number; max?: number; kind?: TxKind | 'all' }
export function searchAll(d: Data, f: SearchFilters): { txs: Tx[]; parties: Party[]; accounts: Account[] } {
  const q = f.q.trim().toLowerCase();
  const partyName = (id?: string) => d.parties.find(p => p.id === id)?.name.toLowerCase() ?? '';
  const txs = sortedTxs(d.txs.filter(t => {
    if (f.from && t.date < f.from) return false; if (f.to && t.date > f.to) return false;
    if (f.min !== undefined && t.amount < f.min) return false; if (f.max !== undefined && t.amount > f.max) return false;
    if (f.kind && f.kind !== 'all' && t.kind !== f.kind) return false;
    if (!q) return true;
    return t.note.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || partyName(t.partyId).includes(q) || (t.amount / 100).toFixed(2).includes(q) || t.date.includes(q);
  }));
  const parties = q ? d.parties.filter(p => p.name.toLowerCase().includes(q) || (p.phone ?? '').includes(q)) : [];
  const accounts = q ? d.accounts.filter(a => a.name.toLowerCase().includes(q)) : [];
  return { txs, parties, accounts };
}
