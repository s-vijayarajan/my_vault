import { jsPDF } from 'jspdf';
import type { Data, Party } from './engine/types';
import { accountBalance, categoryTotals, outstanding, partyBalance, partyStatement, sortedTxs, summary, inRange, accountDelta } from './engine/ledger';
import { formatINR } from './engine/money';
import { formatDate } from './engine/dates';
import { KIND_LABEL } from './ui/common';

const pdfMoney = (n: number) => 'Rs ' + formatINR(n).replace('₹', '').replace('−', '-'); // built-in PDF fonts lack the rupee glyph
function doc(title: string, sub: string, d: Data) {
  const p = new jsPDF({ unit: 'pt', format: 'a4' }); p.setFillColor(20, 56, 47); p.rect(0, 0, 595, 70, 'F'); p.setTextColor(243, 239, 227); p.setFontSize(18); p.text(d.settings.businessName || 'MY VAULT', 40, 38); p.setFontSize(10); p.text(title, 40, 56);
  p.setTextColor(27, 36, 32); p.setFontSize(10); p.text(sub, 40, 92); return p;
}
function table(p: jsPDF, head: string[], rows: string[][], x: number[], y: number) {
  const row = (cells: string[], bold = false) => { if (y > 790) { p.addPage(); y = 50; } p.setFont('helvetica', bold ? 'bold' : 'normal'); cells.forEach((c, i) => { const right = i === cells.length - 1 || (i >= 2 && head.length > 3); p.text(String(c).slice(0, 34), right ? x[i] + 90 : x[i], y, right ? { align: 'right' } : undefined); }); y += 17; };
  row(head, true); p.setDrawColor(200); p.line(40, y - 12, 555, y - 12); rows.forEach(r => row(r)); return y;
}
export function periodPdf(d: Data, from: string, to: string, label: string): string {
  const df = d.settings.dateFormat; const s = summary(d, from, to); const p = doc(`${label} report`, `${formatDate(from, df)} to ${formatDate(to, df)}`, d); let y = 120;
  p.setFontSize(11); [['Income', s.income], ['Expenses', s.expense], ['Net', s.net], ['Money received', s.received], ['Money paid', s.paid], ['Cash in', s.cashIn], ['Cash out', s.cashOut], ['Customers owe you', outstanding(d, 'customer')], ['You owe suppliers', outstanding(d, 'supplier')]].forEach(([k, v]) => { p.text(String(k), 40, y); p.text(pdfMoney(v as number), 300, y, { align: 'right' }); y += 18; });
  y += 10; p.setFont('helvetica', 'bold'); p.text('Top expense categories', 40, y); y += 18; p.setFont('helvetica', 'normal'); categoryTotals(d, from, to, 'expense').slice(0, 6).forEach(c => { p.text(c.category, 40, y); p.text(pdfMoney(c.total), 300, y, { align: 'right' }); y += 16; });
  p.addPage(); const rows = sortedTxs(d.txs.filter(t => inRange(t, from, to))).map(t => [formatDate(t.date, df), KIND_LABEL[t.kind], (t.note || t.category).slice(0, 22), pdfMoney(t.amount)]);
  table(p, ['Date', 'Type', 'Details', 'Amount'], rows, [40, 110, 210, 420], 60); return p.output('datauristring').split(',')[1];
}
export function partyPdf(d: Data, party: Party): string {
  const df = d.settings.dateFormat; const st = partyStatement(d, party.id); const p = doc(`${party.kind === 'customer' ? 'Customer' : 'Supplier'} statement: ${party.name}`, `Opening ${pdfMoney(st.opening)} | Closing ${pdfMoney(partyBalance(d, party.id))}`, d);
  table(p, ['Date', 'Entry', 'Amount', 'Balance'], st.rows.map(r => [formatDate(r.tx.date, df), KIND_LABEL[r.tx.kind], (r.delta < 0 ? '-' : '+') + pdfMoney(Math.abs(r.delta)), pdfMoney(r.running)]), [40, 120, 300, 440], 120); return p.output('datauristring').split(',')[1];
}
void accountBalance; void accountDelta;
