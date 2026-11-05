import { Capacitor } from '@capacitor/core';
import type { Store } from './adapter';
import { BrowserStore } from './browser';
import { SqliteStore } from './sqlite';

/** On Android/iOS SQLite is mandatory: if it cannot open, the app reports the error instead of silently using temporary storage. */
export const store: Store = Capacitor.isNativePlatform() ? new SqliteStore() : new BrowserStore();
