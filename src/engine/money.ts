/** All money is integer paise. Never use floats for arithmetic. */
export function parseRupees(input: string): number | null {
  const s = input.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [r, p = ''] = s.split('.');
  return Number(r) * 100 + Number((p + '00').slice(0, 2));
}
export function formatINR(paise: number, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const neg = paise < 0; const abs = Math.abs(paise);
  const prefix = neg ? '-' : opts.sign ? '+' : '';
  if (opts.compact) {
    const rupees = abs / 100;
    if (rupees >= 1e7) return prefix + '₹' + trim(rupees / 1e7) + 'Cr';
    if (rupees >= 1e5) return prefix + '₹' + trim(rupees / 1e5) + 'L';
    if (rupees >= 1e4) return prefix + '₹' + trim(rupees / 1e3) + 'K';
  }
  const rupees = Math.floor(abs / 100); const ps = abs % 100;
  let r = String(rupees);
  if (r.length > 3) { r = r.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + r.slice(-3); }
  return prefix + '₹' + r + (ps ? '.' + String(ps).padStart(2, '0') : '');
}
const trim = (n: number) => n.toFixed(2).replace(/\.?0+$/, '');
export function toRupeeString(paise: number): string {
  return (paise / 100).toFixed(2).replace(/\.00$/, '');
}
