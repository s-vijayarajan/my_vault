import { useMemo, useState } from 'react';
import type { Party, Tx, TxKind } from '../engine/types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../engine/types';
import { addTx, updateTx, deleteTx, uid, sortedTxs, isExpenseKind } from '../engine/ledger';
import { parseRupees, toRupeeString } from '../engine/money';
import { today } from '../engine/dates';
import { useVault } from '../vault';
import { Field, Sheet } from './common';

const KINDS: { k: TxKind; label: string; tone: 'in' | 'out' | 'neu' }[] = [
  { k: 'income', label: 'Income', tone: 'in' }, { k: 'expense', label: 'Expense', tone: 'out' }, { k: 'received', label: 'Received', tone: 'in' }, { k: 'paid', label: 'Paid', tone: 'out' },
  { k: 'credit_sale', label: 'Credit sale', tone: 'in' }, { k: 'credit_purchase', label: 'Credit buy', tone: 'out' }, { k: 'transfer', label: 'Transfer', tone: 'neu' },
];
export interface Preset { kind?: TxKind; partyId?: string; date?: string }

export function TxForm({ edit, preset, onClose }: { edit?: Tx; preset?: Preset; onClose: () => void }) {
  const { data, apply } = useVault(); const st = data.settings;
  const defAcc = data.accounts.find(a => a.id === st.lastAccountId)?.id ?? data.accounts[0].id;
  const [kind, setKind] = useState<TxKind>(edit?.kind ?? preset?.kind ?? 'expense');
  const [amt, setAmt] = useState(edit ? toRupeeString(edit.amount) : '');
  const [accountId, setAccountId] = useState(edit?.accountId ?? defAcc);
  const [toId, setToId] = useState(edit?.toAccountId ?? data.accounts.find(a => a.id !== defAcc)?.id ?? '');
  const [partyId, setPartyId] = useState(edit?.partyId ?? preset?.partyId ?? '');
  const [category, setCategory] = useState(edit?.category ?? '');
  const [note, setNote] = useState(edit?.note ?? '');
  const [date, setDate] = useState(edit?.date ?? preset?.date ?? today());
  const [err, setErr] = useState(''); const [confirmDel, setConfirmDel] = useState(false); const [newName, setNewName] = useState<string | null>(null);

  const needsAcc = kind !== 'credit_sale' && kind !== 'credit_purchase'; const partyKind = kind === 'received' || kind === 'credit_sale' ? 'customer' : kind === 'paid' || kind === 'credit_purchase' ? 'supplier' : null;
  const usesCat = kind !== 'transfer' && kind !== 'received' && kind !== 'paid';
  const isOut = isExpenseKind(kind);
  const recent = useMemo(() => sortedTxs(data.txs).slice(0, 80), [data.txs]);
  const cats = useMemo(() => { const base = isOut ? EXPENSE_CATEGORIES : INCOME_CATEGORIES; const freq = new Map<string, number>();
    recent.filter(t => (isExpenseKind(t.kind) === isOut) && t.category).forEach(t => freq.set(t.category, (freq.get(t.category) ?? 0) + 1));
    return [...new Set([...[...freq.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]), ...base])].slice(0, 12); }, [recent, isOut]);
  const notes = useMemo(() => [...new Set(recent.filter(t => t.note && (!category || t.category === category) && isExpenseKind(t.kind) === isOut).map(t => t.note))].slice(0, 5), [recent, category, isOut]);
  const parties = useMemo(() => { const last = new Map<string, number>(); recent.forEach((t, i) => t.partyId && !last.has(t.partyId) && last.set(t.partyId, i));
    return data.parties.filter(p => p.kind === partyKind).sort((a, b) => (last.get(a.id) ?? 999) - (last.get(b.id) ?? 999) || a.name.localeCompare(b.name)); }, [data.parties, recent, partyKind]);

  const pickKind = (k: TxKind) => { setKind(k); setPartyId(''); setCategory(''); setErr(''); };
  async function save() {
    const amount = parseRupees(amt); if (amount === null || amount <= 0) return setErr('Enter an amount greater than zero, for example 1250.50.');
    const t: Tx = { id: edit?.id ?? uid(), createdAt: edit?.createdAt ?? Date.now(), recurringId: edit?.recurringId, date, kind, amount, category: usesCat ? category || 'Other' : '', note: note.trim(),
      accountId: needsAcc ? accountId : undefined, toAccountId: kind === 'transfer' ? toId : undefined, partyId: partyKind ? partyId || undefined : undefined };
    const ok = await apply(d => { const r = edit ? updateTx(d, t) : addTx(d, t); return r.ok ? { ok: true, data: needsAcc ? { ...r.data, settings: { ...r.data.settings, lastAccountId: accountId } } : r.data } : r; }, edit ? 'Changes saved' : 'Transaction added');
    if (ok) onClose(); else setErr('');
  }
  async function addParty() {
    const name = (newName ?? '').trim(); if (!name || !partyKind) return; const p: Party = { id: uid(), kind: partyKind, name, opening: 0 };
    await apply(d => ({ ...d, parties: [...d.parties, p] })); setPartyId(p.id); setNewName(null);
  }
  return <Sheet title={edit ? 'Edit transaction' : 'New transaction'} onClose={onClose}>
    <div className="kind" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>{KINDS.map(x => <button key={x.k} className={(kind === x.k ? 'on ' : '') + x.tone} onClick={() => pickKind(x.k)}>{x.label}</button>)}</div>
    <Field label="Amount (₹)"><input className="amount-in" inputMode="decimal" autoFocus={!edit} placeholder="0" value={amt} onChange={e => { setAmt(e.target.value); setErr(''); }} /></Field>
    {needsAcc && <Field label={kind === 'transfer' ? 'From account' : 'Account'}><div className="chips">{data.accounts.map(a => <button key={a.id} className={'chip' + (accountId === a.id ? ' on' : '')} onClick={() => setAccountId(a.id)}>{a.name}</button>)}</div></Field>}
    {kind === 'transfer' && <Field label="To account"><div className="chips">{data.accounts.filter(a => a.id !== accountId).map(a => <button key={a.id} className={'chip' + (toId === a.id ? ' on' : '')} onClick={() => setToId(a.id)}>{a.name}</button>)}</div>{data.accounts.length < 2 && <p className="small mute">Add a second account in Settings to make transfers.</p>}</Field>}
    {partyKind && <Field label={partyKind === 'customer' ? 'Customer' : 'Supplier'}><div className="scroll">{parties.map(p => <button key={p.id} className={'chip' + (partyId === p.id ? ' on' : '')} onClick={() => setPartyId(p.id)}>{p.name}</button>)}
      {newName === null ? <button className="chip" onClick={() => setNewName('')}>+ New</button> : null}</div>
      {newName !== null && <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><input className="in" autoFocus placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} /><button className="btn sm" onClick={addParty}>Add</button></div>}</Field>}
    {usesCat && <Field label="Category"><div className="scroll">{cats.map(c => <button key={c} className={'chip' + (category === c ? ' on' : '')} onClick={() => setCategory(c)}>{c}</button>)}</div></Field>}
    <Field label="Description"><input className="in" aria-label="Description" placeholder="Optional" value={note} onChange={e => setNote(e.target.value)} />{notes.length > 0 && <div className="scroll" style={{ marginTop: 8 }}>{notes.map(n => <button key={n} className="chip" onClick={() => setNote(n)}>{n}</button>)}</div>}</Field>
    <Field label="Date"><input className="in" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
    {err && <p className="neg small" style={{ marginBottom: 10 }} role="alert">{err}</p>}
    <button className="btn" onClick={save}>{edit ? 'Save changes' : 'Add transaction'}</button>
    {edit && <button className="btn danger" style={{ marginTop: 10 }} onClick={async () => { if (!confirmDel) return setConfirmDel(true); if (await apply(d => deleteTx(d, edit.id), 'Transaction deleted')) onClose(); }}>{confirmDel ? 'Tap again to delete for good' : 'Delete transaction'}</button>}
  </Sheet>;
}
