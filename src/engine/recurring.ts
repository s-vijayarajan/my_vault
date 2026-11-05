import type { Data, Recurring, Tx } from './types';
import { addDays, addMonthsClamped, parse } from './dates';

const MAX = 800;
/** Occurrence dates of a schedule from its start up to (and including) `upTo`. Monthly schedules keep their anchor day (31st -> last day of short months). */
export function occurrences(r: Recurring, upTo: string): string[] {
  const out: string[] = []; const last = r.end && r.end < upTo ? r.end : upTo; const anchor = parse(r.start).getDate();
  for (let i = 0; i < MAX; i++) {
    const d = r.freq === 'daily' ? addDays(r.start, i) : r.freq === 'weekly' ? addDays(r.start, 7 * i) : addMonthsClamped(r.start, i, anchor);
    if (d > last) break; out.push(d);
  }
  return out;
}
export const recurringTxId = (r: Recurring, date: string) => `rec:${r.id}:${date}`;
/** Idempotent: occurrence ids are deterministic, so running it any number of times never duplicates entries. */
export function processRecurring(d: Data, todayStr: string): { data: Data; created: number } {
  const have = new Set(d.txs.map(t => t.id)); const added: Tx[] = [];
  for (const r of d.recurring) {
    if (!r.active || !d.accounts.some(a => a.id === r.accountId)) continue;
    for (const date of occurrences(r, todayStr)) {
      const id = recurringTxId(r, date); if (have.has(id)) continue;
      have.add(id); added.push({ id, date, kind: r.kind, amount: r.amount, accountId: r.accountId, category: r.category, note: r.note, recurringId: r.id, createdAt: Date.parse(date + 'T00:00:00') || 0 });
    }
  }
  return added.length ? { data: { ...d, txs: [...d.txs, ...added] }, created: added.length } : { data: d, created: 0 };
}
export function upcoming(d: Data, todayStr: string, days = 30): { rec: Recurring; date: string }[] {
  const horizon = addDays(todayStr, days); const out: { rec: Recurring; date: string }[] = [];
  for (const r of d.recurring) if (r.active) for (const date of occurrences(r, horizon)) if (date > todayStr) out.push({ rec: r, date });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
