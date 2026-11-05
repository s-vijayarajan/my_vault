export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => iso(new Date());
export function parse(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(s: string, n: number): string { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
export function addMonthsClamped(s: string, n: number, anchorDay: number): string {
  const d = parse(s); const y = d.getFullYear(); const m = d.getMonth() + n;
  const last = new Date(y, m + 1, 0).getDate();
  return iso(new Date(y, m, Math.min(anchorDay, last)));
}
export const monthKey = (s: string) => s.slice(0, 7);
export function startOfWeek(s: string): string { const d = parse(s); const wd = (d.getDay() + 6) % 7; return addDays(s, -wd); }
export function formatDate(s: string, f: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY'): string {
  const [y, m, d] = s.split('-'); return f === 'DD/MM/YYYY' ? `${d}/${m}/${y}` : f === 'MM/DD/YYYY' ? `${m}/${d}/${y}` : s;
}
export function rangeFor(kind: 'day' | 'week' | 'month' | 'year', ref: string): [string, string] {
  const d = parse(ref);
  if (kind === 'day') return [ref, ref];
  if (kind === 'week') { const a = startOfWeek(ref); return [a, addDays(a, 6)]; }
  if (kind === 'month') return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  return [`${d.getFullYear()}-01-01`, `${d.getFullYear()}-12-31`];
}
