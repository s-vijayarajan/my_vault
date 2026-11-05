import { useState } from 'react';
import { useVault } from '../vault';
import { deleteParty, partyBalance, partyStatement, uid, outstanding } from '../engine/ledger';
import { formatINR, parseRupees, toRupeeString } from '../engine/money';
import { formatDate } from '../engine/dates';
import type { Party, Tx } from '../engine/types';
import { Empty, Field, Icon, KIND_LABEL, Sheet } from './common';
import { saveFile } from '../files';
import { partyPdf } from '../report';
import type { Preset } from './TxForm';

export function Parties({ add, openTx, focus, clearFocus }: { add: (p: Preset) => void; openTx: (t: Tx) => void; focus?: Party | null; clearFocus: () => void }) {
  const { data } = useVault(); const [tab, setTab] = useState<'customer' | 'supplier'>('customer'); const [form, setForm] = useState<Party | 'new' | null>(null); const [sel, setSel] = useState<string | null>(focus?.id ?? null);
  const list = data.parties.filter(p => p.kind === tab).sort((a, b) => partyBalance(data, b.id) - partyBalance(data, a.id));
  const cur = data.parties.find(p => p.id === sel);
  if (cur) return <Statement party={cur} back={() => { setSel(null); clearFocus(); }} add={add} openTx={openTx} edit={() => setForm(cur)} form={form} setForm={setForm} />;
  return <>
    <div className="top"><div><h1>Parties</h1><div className="sub">{tab === 'customer' ? `${formatINR(outstanding(data, 'customer'))} to receive` : `${formatINR(outstanding(data, 'supplier'))} to pay`}</div></div><button className="iconbtn" aria-label="Add party" onClick={() => setForm('new')}><Icon n="plus" /></button></div>
    <div className="seg"><button className={tab === 'customer' ? 'on' : ''} onClick={() => setTab('customer')}>Customers</button><button className={tab === 'supplier' ? 'on' : ''} onClick={() => setTab('supplier')}>Suppliers</button></div>
    {list.length ? <div className="card" style={{ padding: '4px 16px' }}>{list.map(p => { const b = partyBalance(data, p.id); return <button className="tx" key={p.id} onClick={() => setSel(p.id)}><span className="dot">{p.name[0]?.toUpperCase()}</span><span className="mid"><b>{p.name}</b><span>{b === 0 ? 'Settled' : b > 0 ? (tab === 'customer' ? 'Owes you' : 'You owe') : (tab === 'customer' ? 'Advance from them' : 'Advance paid')}</span></span><span className={'amt ' + (b > 0 && tab === 'customer' ? 'pos' : '')}>{formatINR(Math.abs(b))}</span></button>; })}</div>
      : <Empty>No {tab}s yet. Add one to track credit and payments.</Empty>}
    {form && <PartyForm party={form === 'new' ? undefined : form} kind={tab} onClose={() => setForm(null)} onDeleted={() => setSel(null)} />}
  </>;
}
function Statement({ party, back, add, openTx, edit, form, setForm }: { party: Party; back: () => void; add: (p: Preset) => void; openTx: (t: Tx) => void; edit: () => void; form: Party | 'new' | null; setForm: (f: Party | 'new' | null) => void }) {
  const { data, say } = useVault(); const st = partyStatement(data, party.id); const isC = party.kind === 'customer';
  const pay = isC ? 'received' : 'paid'; const credit = isC ? 'credit_sale' : 'credit_purchase';
  async function pdf() { try { const b64 = partyPdf(data, party); await saveFile(`${party.name.replace(/\W+/g, '-')}-statement.pdf`, b64, 'application/pdf', true); } catch { say('Could not create the PDF'); } }
  return <>
    <div className="top"><button className="iconbtn" aria-label="Back" onClick={back}><Icon n="back" /></button><div style={{ flex: 1, padding: '0 12px' }}><h1>{party.name}</h1><div className="sub">{isC ? 'Customer' : 'Supplier'}{party.phone ? ` · ${party.phone}` : ''}</div></div><button className="iconbtn" aria-label="Edit" onClick={edit}><Icon n="edit" /></button></div>
    <div className="hero" style={{ padding: 20 }}><div className="lbl">{st.closing >= 0 ? (isC ? 'Outstanding to receive' : 'Outstanding to pay') : 'Advance balance'}</div><div className="big" style={{ marginBottom: 6 }}>{formatINR(Math.abs(st.closing))}</div><div className="small" style={{ opacity: .75 }}>Opening balance {formatINR(st.opening)}</div></div>
    <div className="grid2" style={{ marginBottom: 14 }}><button className="btn" onClick={() => add({ kind: pay, partyId: party.id })}>{isC ? 'Money received' : 'Money paid'}</button><button className="btn alt" onClick={() => add({ kind: credit, partyId: party.id })}>{isC ? 'Credit sale' : 'Credit purchase'}</button></div>
    <div className="card"><h3>Statement <button onClick={pdf}>PDF</button></h3>
      {st.rows.length ? <div style={{ overflowX: 'auto' }}><table className="t"><thead><tr><th>Date</th><th>Entry</th><th>Amount</th><th>Balance</th></tr></thead><tbody>{st.rows.map(r => <tr key={r.tx.id} onClick={() => openTx(r.tx)} style={{ cursor: 'pointer' }}><td>{formatDate(r.tx.date, data.settings.dateFormat)}</td><td>{KIND_LABEL[r.tx.kind]}{r.tx.note ? <div className="small mute">{r.tx.note}</div> : null}</td><td className={r.delta < 0 ? 'pos' : ''}>{r.delta < 0 ? '−' : '+'}{formatINR(Math.abs(r.delta))}</td><td>{formatINR(r.running)}</td></tr>)}</tbody></table></div> : <Empty>No entries yet.</Empty>}</div>
    {form && <PartyForm party={form === 'new' ? undefined : form} kind={party.kind} onClose={() => setForm(null)} onDeleted={back} />}
  </>;
}
function PartyForm({ party, kind, onClose, onDeleted }: { party?: Party; kind: 'customer' | 'supplier'; onClose: () => void; onDeleted: () => void }) {
  const { apply } = useVault(); const k = party?.kind ?? kind; const [name, setName] = useState(party?.name ?? ''); const [phone, setPhone] = useState(party?.phone ?? ''); const [open, setOpen] = useState(party ? toRupeeString(party.opening) : ''); const [err, setErr] = useState(''); const [confirm, setConfirm] = useState(false);
  async function save() {
    const o = open.trim() === '' ? 0 : parseRupees(open); if (!name.trim()) return setErr('Enter a name.'); if (o === null) return setErr('Opening balance must be a valid amount.');
    const p: Party = { id: party?.id ?? uid(), kind: k, name: name.trim(), phone: phone.trim() || undefined, opening: o };
    if (await apply(d => ({ ...d, parties: party ? d.parties.map(x => x.id === p.id ? p : x) : [...d.parties, p] }), party ? 'Saved' : `${k === 'customer' ? 'Customer' : 'Supplier'} added`)) onClose();
  }
  return <Sheet title={party ? `Edit ${k}` : `New ${k}`} onClose={onClose}>
    <Field label="Name"><input className="in" autoFocus value={name} onChange={e => { setName(e.target.value); setErr(''); }} /></Field>
    <Field label="Phone (optional)"><input className="in" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></Field>
    <Field label={k === 'customer' ? 'Opening balance they owe you (₹)' : 'Opening balance you owe them (₹)'}><input className="in" inputMode="decimal" placeholder="0" value={open} onChange={e => { setOpen(e.target.value); setErr(''); }} /></Field>
    {err && <p className="neg small" style={{ marginBottom: 10 }} role="alert">{err}</p>}<button className="btn" onClick={save}>Save</button>
    {party && <button className="btn danger" style={{ marginTop: 10 }} onClick={async () => { if (!confirm) return setConfirm(true); if (await apply(d => deleteParty(d, party.id), 'Deleted')) { onClose(); onDeleted(); } }}>{confirm ? 'Tap again to delete' : 'Delete'}</button>}
  </Sheet>;
}
