import { MIN, type Epoch } from './types';

export type WakeDecision = 'wait' | 'smart' | 'deadline';

/** Ближайший момент срабатывания будильника после `now`. */
export function nextAlarmTime(now: number, hour: number, minute: number): number {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= now + MIN) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/**
 * Признак лёгкого сна по последним минутам: человек зашевелился,
 * пульс поднялся относительно предыдущих 10 минут или появились звуки.
 */
export function isLightSleepNow(epochs: Epoch[]): boolean {
  if (epochs.length < 3) return false;
  const last2 = epochs.slice(-2);
  const motion = last2.reduce((a, e) => a + e.motion, 0);
  if (motion >= 2) return true;

  const cur = epochs[epochs.length - 1].hr;
  const prev = epochs
    .slice(-12, -2)
    .map((e) => e.hr)
    .filter((v): v is number => v != null);
  if (cur != null && prev.length >= 5) {
    const mean = prev.reduce((a, b) => a + b, 0) / prev.length;
    if (cur > mean * 1.07) return true;
  }
  return motion >= 1 && last2.some((e) => e.sound >= 2);
}

/**
 * Будить ли сейчас: в назначенное время — всегда, внутри окна перед ним —
 * только если сон лёгкий.
 */
export function decideWake(now: number, target: number, windowMin: number, epochs: Epoch[]): WakeDecision {
  if (now >= target) return 'deadline';
  if (now >= target - windowMin * MIN && isLightSleepNow(epochs)) return 'smart';
  return 'wait';
}
