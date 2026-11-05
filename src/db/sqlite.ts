import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { fromRows, allOps, diff, type Op, type Store } from './adapter';
import type { Data } from '../engine/types';

const SCHEMA = `CREATE TABLE IF NOT EXISTS records (collection TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (collection, id));
CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection);`;

export class SqliteStore implements Store {
  readonly kind = 'sqlite' as const; private db!: SQLiteDBConnection;
  private async open() {
    if (this.db) return;
    const conn = new SQLiteConnection(CapacitorSQLite);
    const existing = (await conn.isConnection('myvault', false)).result;
    this.db = existing ? await conn.retrieveConnection('myvault', false) : await conn.createConnection('myvault', false, 'no-encryption', 1, false);
    await this.db.open(); await this.db.execute(SCHEMA);
  }
  private set(ops: Op[], wipe = false) {
    const set = ops.map(o => o.type === 'put' ? { statement: 'INSERT OR REPLACE INTO records (collection, id, json) VALUES (?, ?, ?)', values: [o.collection, o.id, o.json] } : { statement: 'DELETE FROM records WHERE collection = ? AND id = ?', values: [o.collection, o.id] });
    return this.db.executeSet(wipe ? [{ statement: 'DELETE FROM records', values: [] }, ...set] : set, true); // transaction = true: all or nothing
  }
  async load(): Promise<Data> {
    await this.open(); const r = await this.db.query('SELECT collection, id, json FROM records');
    return fromRows((r.values ?? []) as { collection: string; id: string; json: string }[]);
  }
  async persist(prev: Data, next: Data) { await this.open(); const ops = diff(prev, next); if (ops.length) await this.set(ops); }
  async replaceAll(next: Data) { await this.open(); await this.set(allOps(next), true); }
}
