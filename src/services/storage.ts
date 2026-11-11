import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS, type Epoch, type Night, type Settings } from '../lib/types';

const K_NIGHTS = 'nights.v1';
const K_SETTINGS = 'settings.v1';
const K_SESSION = 'session.v1';

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(K_SETTINGS);
  return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(K_SETTINGS, JSON.stringify(s));
}

/** Ночи, новые сначала. Храним последние 90. */
export async function loadNights(): Promise<Night[]> {
  const raw = await AsyncStorage.getItem(K_NIGHTS);
  return raw ? (JSON.parse(raw) as Night[]) : [];
}

export async function saveNights(nights: Night[]): Promise<Night[]> {
  const sorted = [...nights].sort((a, b) => b.wake - a.wake).slice(0, 90);
  await AsyncStorage.setItem(K_NIGHTS, JSON.stringify(sorted));
  return sorted;
}

/** Незавершённая ночь — чтобы данные не пропали, если приложение было выгружено. */
export interface SessionSnapshot {
  startedAt: number;
  target: number | null;
  epochs: Epoch[];
  usedBand: boolean;
}

export async function saveSession(s: SessionSnapshot | null): Promise<void> {
  if (s) await AsyncStorage.setItem(K_SESSION, JSON.stringify(s));
  else await AsyncStorage.removeItem(K_SESSION);
}

export async function loadSession(): Promise<SessionSnapshot | null> {
  const raw = await AsyncStorage.getItem(K_SESSION);
  return raw ? (JSON.parse(raw) as SessionSnapshot) : null;
}
