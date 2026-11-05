import type { Store } from './adapter';
import type { Data } from '../engine/types';
import { emptyData } from '../engine/ledger';
import { DEFAULT_SETTINGS } from '../engine/types';

/** Browser / desktop development adapter (localStorage). Never used on Android. */
const KEY = 'myvault.data.v1';
export class BrowserStore implements Store {
  readonly kind = 'browser' as const;
  async load(): Promise<Data> {
    const raw = localStorage.getItem(KEY); if (!raw) return emptyData();
    const d = JSON.parse(raw); return { ...emptyData(), ...d, settings: { ...DEFAULT_SETTINGS, ...d.settings } };
  }
  async persist(_prev: Data, next: Data) { localStorage.setItem(KEY, JSON.stringify(next)); }
  async replaceAll(next: Data) { localStorage.setItem(KEY, JSON.stringify(next)); }
}
