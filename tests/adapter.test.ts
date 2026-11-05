import { describe, it, expect } from 'vitest';
import { diff, fromRows, allOps } from '../src/db/adapter';
import { emptyData, addTx } from '../src/engine/ledger';
import type { Data } from '../src/engine/types';

// In-memory stand-in for the SQLite `records` table, driven by the same Op list the SqliteStore executes.
function apply(rows: Map<string, string>, ops: ReturnType<typeof diff>) { for (const o of ops) { const k = o.collection + '|' + o.id; if (o.type === 'put') rows.set(k, o.json); else rows.delete(k); } }
const load = (rows: Map<string, string>) => fromRows([...rows].map(([k, json]) => ({ collection: k.split('|')[0], id: k.split('|')[1], json })));
describe('persistence diff', () => {
  it('stores only changes and round-trips exactly (restart simulation)', () => {
    const rows = new Map<string, string>(); let d: Data = emptyData(); apply(rows, allOps(d));
    const t = { id: 'a', date: '2026-11-01', kind: 'income' as const, amount: 12345, accountId: 'cash', category: 'Sales', note: 'x', createdAt: 1 };
    const r = addTx(d, t); if (!r.ok) throw new Error(); const ops = diff(d, r.data); expect(ops).toHaveLength(1); apply(rows, ops); d = r.data;
    expect(load(rows).txs).toEqual(d.txs); expect(load(rows).accounts).toEqual(d.accounts);
    const removed = { ...d, txs: [] }; apply(rows, diff(d, removed)); expect(load(rows).txs).toEqual([]);
  });
  it('unchanged state produces no writes', () => { const d = emptyData(); expect(diff(d, d)).toEqual([]); });
});
