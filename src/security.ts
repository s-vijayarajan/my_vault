import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
export const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
export async function hashPin(pin: string, salt: string): Promise<string> { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin))); }
export async function biometricAvailable(): Promise<boolean> { try { return (await BiometricAuth.checkBiometry()).isAvailable; } catch { return false; } }
export async function biometricUnlock(): Promise<boolean> { try { await BiometricAuth.authenticate({ reason: 'Unlock MY VAULT', allowDeviceCredential: false }); return true; } catch { return false; } }
