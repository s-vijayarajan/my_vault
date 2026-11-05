import type { Data } from './types';
import { DEFAULT_SETTINGS } from './types';

export const BACKUP_VERSION = 1;
function checksum(s: string): string { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
const stripSecrets = (d: Data): Data => { const { pinHash, pinSalt, ...rest } = d.settings; void pinHash; void pinSalt; return { ...d, settings: rest as Data['settings'] }; };

export function exportBackup(d: Data): string {
  const data = stripSecrets(d); const body = JSON.stringify(data);
  return JSON.stringify({ app: 'my-vault', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), counts: { transactions: d.txs.length, accounts: d.accounts.length, parties: d.parties.length }, checksum: checksum(body), data });
}
const isInt = (n: unknown) => Number.isSafeInteger(n);
export function validateBackup(text: string): { ok: true; data: Data; meta: { exportedAt: string; transactions: number } } | { ok: false; error: string } {
  let o: any; try { o = JSON.parse(text); } catch { return { ok: false, error: 'This file is not a valid backup (unreadable JSON).' }; }
  if (!o || o.app !== 'my-vault') return { ok: false, error: 'This file was not created by MY VAULT.' };
  if (o.version !== BACKUP_VERSION) return { ok: false, error: `Unsupported backup version ${o.version}.` };
  const d = o.data; if (!d || !Array.isArray(d.accounts) || !Array.isArray(d.parties) || !Array.isArray(d.txs) || !Array.isArray(d.recurring) || !Array.isArray(d.budgets) || typeof d.settings !== 'object') return { ok: false, error: 'Backup is missing required sections.' };
  if (checksum(JSON.stringify(d)) !== o.checksum) return { ok: false, error: 'Backup is damaged: the checksum does not match.' };
  if (!d.accounts.length) return { ok: false, error: 'Backup has no accounts.' };
  const accIds = new Set<string>(); for (const a of d.accounts) { if (!a.id || accIds.has(a.id) || !isInt(a.opening)) return { ok: false, error: 'Backup contains an invalid account.' }; accIds.add(a.id); }
  const partyKind = new Map<string, string>(); for (const p of d.parties) { if (!p.id || partyKind.has(p.id) || !isInt(p.opening) || !['customer', 'supplier'].includes(p.kind)) return { ok: false, error: 'Backup contains an invalid customer or supplier.' }; partyKind.set(p.id, p.kind); }
  const txIds = new Set<string>();
  for (const t of d.txs) {
    if (!t.id || txIds.has(t.id)) return { ok: false, error: 'Backup contains duplicate transaction IDs.' }; txIds.add(t.id);
    if (!isInt(t.amount) || t.amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return { ok: false, error: 'Backup contains a transaction with an invalid amount or date.' };
    if ((t.accountId && !accIds.has(t.accountId)) || (t.toAccountId && !accIds.has(t.toAccountId)) || (t.partyId && !partyKind.has(t.partyId))) return { ok: false, error: 'Backup contains a transaction that points to a missing account or party.' };
  }
  const data: Data = { ...d, settings: { ...DEFAULT_SETTINGS, ...d.settings } };
  return { ok: true, data, meta: { exportedAt: o.exportedAt, transactions: d.txs.length } };
}
const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
export function txsToCsv(d: Data, txs: Data['txs']): string {
  const acc = (id?: string) => d.accounts.find(a => a.id === id)?.name ?? ''; const par = (id?: string) => d.parties.find(p => p.id === id)?.name ?? '';
  const head = ['Date', 'Type', 'Amount (INR)', 'Account', 'To account', 'Party', 'Category', 'Note'].join(',');
  return [head, ...txs.map(t => [t.date, t.kind, (t.amount / 100).toFixed(2), acc(t.accountId), acc(t.toAccountId), par(t.partyId), t.category, t.note].map(q).join(','))].join('\n');
}
