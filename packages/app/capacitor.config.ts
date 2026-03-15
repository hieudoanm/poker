import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.hieudoanm.poker',
  appName: 'Poker',
  webDir: '../../docs',
  android: { path: 'mobile/android' },
  ios: { path: 'mobile/ios' },
};

export default config;
