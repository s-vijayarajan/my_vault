import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.myvault.cashbook',
  appName: 'MY VAULT',
  webDir: 'dist',
  android: { allowMixedContent: false },
};
export default config;
