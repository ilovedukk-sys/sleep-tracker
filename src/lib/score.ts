import { MIN, type SleepScore, type StageSegment } from './types';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Линейно: lo -> 0, hi -> 1. */
const ramp = (x: number, lo: number, hi: number) => clamp01((x - lo) / (hi - lo));

export function scoreLabel(total: number): string {
  if (total >= 85) return 'Отличный сон';
  if (total >= 70) return 'Хороший сон';
  if (total >= 50) return 'Средний сон';
  return 'Плохой сон';
}

/**
 * Оценка сна 0–100.
 * Длительность 40, эффективность 20, глубокий сон 15, REM 15, непрерывность 10,
 * минус до 10 баллов за храп. Если фазы неизвестны, баллы за глубокий сон и REM
 * не начисляются, а остальные растягиваются до 100.
 */
export function computeScore(
  segments: StageSegment[],
  bedtime: number,
  wake: number,
  goalMin: number,
  snoreMin = 0,
): SleepScore {
  const mins = { awake: 0, light: 0, deep: 0, rem: 0 };
  for (const s of segments) mins[s.stage] += (s.end - s.start) / MIN;

  const sleepMin = mins.light + mins.deep + mins.rem;
  const inBedMin = Math.max(sleepMin + mins.awake, (wake - bedtime) / MIN);
  const hasStages = mins.deep + mins.rem > 0;

  // Пробуждения: отрезки бодрствования от 2 минут между отрезками сна.
  const firstSleep = segments.findIndex((s) => s.stage !== 'awake');
  let lastSleep = -1;
  segments.forEach((s, i) => {
    if (s.stage !== 'awake') lastSleep = i;
  });
  let awakenings = 0;
  segments.forEach((s, i) => {
    if (s.stage === 'awake' && i > firstSleep && i < lastSleep && s.end - s.start >= 2 * MIN) awakenings++;
  });

  let duration = clamp01(sleepMin / goalMin) * 40;
  const over = sleepMin - (goalMin + 90);
  if (over > 0) duration -= Math.min(8, over / 15);

  const efficiency = inBedMin > 0 ? ramp(sleepMin / inBedMin, 0.7, 0.92) * 20 : 0;
  const deep = sleepMin > 0 ? ramp(mins.deep / sleepMin, 0.05, 0.15) * 15 : 0;
  const rem = sleepMin > 0 ? ramp(mins.rem / sleepMin, 0.05, 0.2) * 15 : 0;
  const continuity = sleepMin > 0 ? Math.max(0, 10 - Math.max(0, awakenings - 1) * 2) : 0;
  const snorePenalty = sleepMin > 0 ? Math.min(10, (snoreMin / sleepMin) * 50) : 0;

  let base = duration + efficiency + continuity;
  base = hasStages ? base + deep + rem : (base / 70) * 100;
  const total = Math.round(Math.max(0, Math.min(100, base - snorePenalty)));

  const r = (x: number) => Math.round(x * 10) / 10;
  return {
    total,
    label: scoreLabel(total),
    parts: {
      duration: r(duration),
      efficiency: r(efficiency),
      deep: r(hasStages ? deep : 0),
      rem: r(hasStages ? rem : 0),
      continuity: r(continuity),
      snorePenalty: r(snorePenalty),
    },
    sleepMin: Math.round(sleepMin),
    inBedMin: Math.round(inBedMin),
    deepMin: Math.round(mins.deep),
    remMin: Math.round(mins.rem),
    lightMin: Math.round(mins.light),
    awakeMin: Math.round(mins.awake),
    awakenings,
    hasStages,
  };
}
