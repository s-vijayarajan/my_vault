import type { Data } from '../engine/types';
import { emptyData } from '../engine/ledger';
import { DEFAULT_SETTINGS } from '../engine/types';

/** Persistence is independent from the accounting engine: it only stores records and applies diffs. */
export interface Store {
  readonly kind: 'sqlite' | 'browser';
  load(): Promise<Data>;
  /** Persist the difference between two states atomically. Throws on failure (caller reverts). */
  persist(prev: Data, next: Data): Promise<void>;
  replaceAll(next: Data): Promise<void>;
}
export type Op = { type: 'put'; collection: string; id: string; json: string } | { type: 'del'; collection: string; id: string };
const COLS = ['accounts', 'parties', 'txs', 'recurring', 'budgets'] as const;

export function diff(prev: Data, next: Data): Op[] {
  const ops: Op[] = [];
  for (const c of COLS) {
    const before = new Map((prev[c] as { id: string }[]).map(r => [r.id, r])); const after = new Map((next[c] as { id: string }[]).map(r => [r.id, r]));
    for (const [id, r] of after) if (before.get(id) !== r) ops.push({ type: 'put', collection: c, id, json: JSON.stringify(r) });
    for (const id of before.keys()) if (!after.has(id)) ops.push({ type: 'del', collection: c, id });
  }
  if (prev.settings !== next.settings) ops.push({ type: 'put', collection: 'settings', id: 'main', json: JSON.stringify(next.settings) });
  return ops;
}
export function fromRows(rows: { collection: string; id: string; json: string }[]): Data {
  const d = emptyData(); d.accounts = [];
  for (const r of rows) {
    const v = JSON.parse(r.json);
    if (r.collection === 'settings') d.settings = { ...DEFAULT_SETTINGS, ...v }; else if ((COLS as readonly string[]).includes(r.collection)) (d as any)[r.collection].push(v);
  }
  if (!d.accounts.length) d.accounts = emptyData().accounts;
  return d;
}
export function allOps(d: Data): Op[] { return diff({ ...emptyData(), accounts: [], settings: undefined as any }, d); }
