import { isValidElement, type ReactNode } from 'react';
import type { Tx, TxKind } from '../engine/types';
import { formatINR } from '../engine/money';
import { formatDate } from '../engine/dates';
import { useVault } from '../vault';

const P: Record<string, string> = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', users: 'M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1.5a4 4 0 0 0-3-3.9M16 4.2a3.5 3.5 0 0 1 0 6.6',
  spark: 'M3 17l6-6 4 4 8-9M15 6h6v6', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  plus: 'M12 5v14M5 12h14', down: 'M12 5v14M6 13l6 6 6-6', up: 'M12 19V5M6 11l6-6 6 6', swap: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7', search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3', cal: 'M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  back: 'M15 18l-6-6 6-6', chev: 'M9 6l6 6-6 6', lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', bank: 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18', check: 'M5 12l5 5 9-10', repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6', bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z', target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', x: 'M6 6l12 12M18 6L6 18', edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
};
export const Icon = ({ n, s = 20 }: { n: string; s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={P[n]} /></svg>;

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="overlay" onClick={onClose}><div className="sheet" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}><div className="grab" /><h2>{title}</h2>{children}</div></div>;
}
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;
/** A lone input gets a real <label>; groups of buttons use a labelled group so chips keep their own accessible names. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const single = isValidElement(children) && children.type === 'input';
  return single ? <label className="field"><span>{label}</span>{children}</label> : <div className="field" role="group" aria-label={label}><span>{label}</span>{children}</div>;
}

export const KIND_LABEL: Record<TxKind, string> = { income: 'Income', expense: 'Expense', received: 'Money received', paid: 'Money paid', credit_sale: 'Credit sale', credit_purchase: 'Credit purchase', transfer: 'Transfer' };
export const KIND_ICON: Record<TxKind, string> = { income: 'down', expense: 'up', received: 'down', paid: 'up', credit_sale: 'down', credit_purchase: 'up', transfer: 'swap' };
export const signOf = (k: TxKind) => (k === 'income' || k === 'received' || k === 'credit_sale' ? 1 : k === 'transfer' ? 0 : -1);

export function TxRow({ t, onClick }: { t: Tx; onClick?: () => void }) {
  const { data } = useVault(); const sg = signOf(t.kind); const party = data.parties.find(p => p.id === t.partyId)?.name;
  const acc = data.accounts.find(a => a.id === t.accountId)?.name; const to = data.accounts.find(a => a.id === t.toAccountId)?.name;
  const title = t.note || party || (t.kind === 'transfer' ? `${acc} to ${to}` : t.category || KIND_LABEL[t.kind]);
  const sub = [KIND_LABEL[t.kind], party && t.note ? party : '', t.kind !== 'transfer' && t.category && t.category !== 'Other' ? t.category : '', formatDate(t.date, data.settings.dateFormat)].filter(Boolean).join(' · ');
  return <button className="tx" onClick={onClick}><span className="dot"><Icon n={KIND_ICON[t.kind]} s={18} /></span><span className="mid"><b>{title}</b><span>{sub}</span></span>
    <span className={'amt ' + (sg > 0 ? 'pos' : sg < 0 ? 'neg' : '')}>{sg > 0 ? '+' : sg < 0 ? '−' : ''}{formatINR(t.amount).replace('₹', '₹')}</span></button>;
}
export function Progress({ pct }: { pct: number }) { const s = pct >= 100 ? 'over' : pct >= 80 ? 'near' : ''; return <div className={'bar ' + s} role="progressbar" aria-valuenow={pct}><i style={{ width: Math.min(100, pct) + '%' }} /></div>; }

/** Income vs expense grouped bars (SVG, no chart library). */
export function FlowChart({ series }: { series: { label: string; income: number; expense: number }[] }) {
  const max = Math.max(1, ...series.flatMap(s => [s.income, s.expense])); const W = 320, H = 150, pad = 22, bw = 14, gap = (W - pad * 2) / series.length;
  return <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" role="img" aria-label="Income versus expenses">
    <line x1="0" x2={W} y1={H} y2={H} stroke="var(--line)" />
    {series.map((s, i) => { const x = pad + i * gap + gap / 2 - bw - 1; const hi = (s.income / max) * (H - 10); const he = (s.expense / max) * (H - 10);
      return <g key={i}><rect x={x} y={H - hi} width={bw} height={hi} rx="5" fill="var(--forest2)" /><rect x={x + bw + 3} y={H - he} width={bw} height={he} rx="5" fill="var(--gold)" /><text x={x + bw + 1} y={H + 16} textAnchor="middle" fontSize="10.5" fill="var(--grey)">{s.label}</text></g>; })}
  </svg>;
}
export function Sparkline({ values, color = '#c9a45c' }: { values: number[]; color?: string }) {
  const min = Math.min(...values), max = Math.max(...values), r = max - min || 1; const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 200},${60 - ((v - min) / r) * 50 - 4}`).join(' ');
  return <svg viewBox="0 0 200 64" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>;
}
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
