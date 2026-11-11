import { MIN, type Epoch, type Stage, type StageSegment } from './types';

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function localSd(values: (number | undefined)[], i: number, half = 2): number {
  const w: number[] = [];
  for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
    const v = values[j];
    if (v != null) w.push(v);
  }
  if (w.length < 2) return 0;
  const m = w.reduce((a, b) => a + b, 0) / w.length;
  return Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / w.length);
}

/**
 * Оценка фаз сна по минутным эпохам собственного трекинга (пульс + движения).
 * Это эвристика, а не медицинская полисомнография:
 *  - бодрствование: много движений или движения вместе с заметно повышенным пульсом;
 *  - глубокий сон: долгая неподвижность и пульс в нижней четверти за ночь;
 *  - REM: неподвижность, пульс не ниже медианы и «скачет»;
 *  - остальное: лёгкий сон.
 * Без пульса REM не выделяется, глубокий сон определяется только по долгой неподвижности.
 */
export function estimateStageByEpoch(epochs: Epoch[]): Stage[] {
  const n = epochs.length;
  if (!n) return [];
  const hr = epochs.map((e) => e.hr);
  const known = hr.filter((v): v is number => v != null).sort((a, b) => a - b);
  const hasHr = known.length >= n * 0.5;
  const q25 = quantile(known, 0.25);
  const med = quantile(known, 0.5);
  const sds = epochs.map((_, i) => localSd(hr, i));
  const medSd = quantile([...sds].sort((a, b) => a - b), 0.5);

  // Сколько минут подряд без движений к моменту i.
  const still: number[] = [];
  let run = 0;
  for (let i = 0; i < n; i++) {
    run = epochs[i].motion > 0 ? 0 : run + 1;
    still.push(run);
  }
  // Засыпание: первые 5 минут неподвижности подряд.
  let onset = still.findIndex((s) => s >= 5);
  onset = onset < 0 ? n : onset - 4;

  const raw: Stage[] = epochs.map((e, i) => {
    if (i < onset) return 'awake';
    const h = e.hr;
    if (e.motion >= 6 || (e.motion >= 3 && h != null && med > 0 && h > med * 1.12)) return 'awake';
    if (hasHr && h != null) {
      if (still[i] >= 8 && h <= q25 * 1.02) return 'deep';
      if (e.motion <= 1 && h >= med && sds[i] > medSd && i > n * 0.2) return 'rem';
      return 'light';
    }
    return still[i] >= 20 ? 'deep' : 'light';
  });

  // Сглаживание: большинство в окне 5 минут.
  return raw.map((_, i) => {
    const count: Record<Stage, number> = { awake: 0, light: 0, deep: 0, rem: 0 };
    for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) count[raw[j]]++;
    let best: Stage = raw[i];
    (Object.keys(count) as Stage[]).forEach((s) => {
      if (count[s] > count[best]) best = s;
    });
    return best;
  });
}

export function toSegments(epochs: Epoch[], stages: Stage[], epochMs = MIN): StageSegment[] {
  const out: StageSegment[] = [];
  epochs.forEach((e, i) => {
    const last = out[out.length - 1];
    if (last && last.stage === stages[i] && last.end === e.t) last.end = e.t + epochMs;
    else out.push({ start: e.t, end: e.t + epochMs, stage: stages[i] });
  });
  return out;
}

export function estimateStages(epochs: Epoch[]): StageSegment[] {
  return toSegments(epochs, estimateStageByEpoch(epochs));
}
