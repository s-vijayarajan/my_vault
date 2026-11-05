import { useEffect, useState } from 'react';
import { hashPin, biometricUnlock } from '../security';
import { useVault } from '../vault';

export function Lock({ onUnlock }: { onUnlock: () => void }) {
  const { data } = useVault(); const st = data.settings; const [pin, setPin] = useState(''); const [bad, setBad] = useState(false);
  useEffect(() => { if (st.biometric) biometricUnlock().then(ok => ok && onUnlock()); }, []); // eslint-disable-line
  async function press(d: string) {
    if (d === '<') return setPin(p => p.slice(0, -1)); const n = (pin + d).slice(0, 6); setPin(n); setBad(false);
    if (n.length >= 4 && (await hashPin(n, st.pinSalt!)) === st.pinHash) onUnlock(); else if (n.length === 6) { setBad(true); setPin(''); }
  }
  return <div className="lock"><div className="logo gold">MY VAULT</div><div className="pins" aria-label="PIN entered">{Array.from({ length: 6 }, (_, i) => <i key={i} className={i < pin.length ? 'f' : ''} />)}</div>
    <p className="small" role="alert" style={{ minHeight: 18, opacity: .85 }}>{bad ? 'Wrong PIN. Try again.' : 'Enter your PIN (4 to 6 digits)'}</p>
    <div className="pad">{['1', '2', '3', '4', '5', '6', '7', '8', '9', st.biometric ? 'bio' : '', '0', '<'].map((d, i) => d === '' ? <span key={i} /> : d === 'bio' ? <button key={i} onClick={() => biometricUnlock().then(ok => ok && onUnlock())} aria-label="Use fingerprint">⌖</button> : <button key={i} onClick={() => press(d)} aria-label={d === '<' ? 'Delete' : d}>{d === '<' ? '⌫' : d}</button>)}</div></div>;
}
