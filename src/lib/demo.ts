import { buildNight } from './night';
import { MIN, type Epoch, type Night, type SnoreEpisode } from './types';

/** Детерминированный генератор случайных чисел, чтобы демо и тесты были воспроизводимы. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Минутные эпохи правдоподобной ночи: циклы по ~90 минут «лёгкий → глубокий → лёгкий → REM». */
export function demoEpochs(start: number, minutes: number, seed = 1): Epoch[] {
  const rand = rng(seed);
  const out: Epoch[] = [];
  for (let i = 0; i < minutes; i++) {
    const t = start + i * MIN;
    if (i < 12) {
      out.push({ t, hr: 68 + Math.round(rand() * 4), motion: rand() < 0.6 ? 2 + Math.floor(rand() * 5) : 0, sound: 0 });
      continue;
    }
    const pos = (i - 12) % 90;
    const late = i / minutes;
    const briefWake = pos === 0 && i > 60 && rand() < 0.5;
    let hr: number;
    let motion = 0;
    if (briefWake) {
      hr = 70;
      motion = 7;
    } else if (pos >= 15 && pos < 45 - late * 20) {
      hr = 50 + Math.round(rand() * 2); // глубокий
    } else if (pos >= 65) {
      hr = 60 + Math.round(rand() * 9); // REM: пульс скачет
      motion = rand() < 0.05 ? 1 : 0;
    } else {
      hr = 56 + Math.round(rand() * 3); // лёгкий
      motion = rand() < 0.12 ? 1 + Math.floor(rand() * 2) : 0;
    }
    out.push({ t, hr, motion, sound: motion > 1 ? 1 : 0 });
  }
  return out;
}

/** Несколько ночей с примерными данными — чтобы посмотреть интерфейс без браслета. */
export function demoNights(goalMin: number, count = 7): Night[] {
  const nights: Night[] = [];
  const today = new Date();
  today.setHours(7, 10, 0, 0);
  for (let d = 0; d < count; d++) {
    const rand = rng(d + 7);
    const wake = today.getTime() - d * 24 * 60 * MIN + Math.round((rand() - 0.5) * 50) * MIN;
    const minutes = 360 + Math.round(rand() * 150);
    const start = wake - minutes * MIN;
    const episodes: SnoreEpisode[] = [];
    for (let k = 0; k < Math.floor(rand() * 5); k++) {
      const s = start + Math.round(rand() * (minutes - 30)) * MIN;
      episodes.push({ start: s, end: s + (2 + Math.round(rand() * 10)) * MIN, peakDb: -30 + Math.round(rand() * 12) });
    }
    episodes.sort((a, b) => a.start - b.start);
    const night = buildNight(demoEpochs(start, minutes, d + 1), start, wake, episodes, goalMin, d % 2 ? 'smart' : 'deadline');
    if (night) nights.push(night);
  }
  return nights;
}
