import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
Object.defineProperty(window, 'matchMedia', { value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
window.scrollTo = () => {};
afterEach(() => { cleanup(); localStorage.clear(); });
