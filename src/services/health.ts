import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { BUNDLE_ID } from '../config';
import { computeScore } from '../lib/score';
import { MIN, dayId, type Night, type Stage, type StageSegment } from '../lib/types';

type HK = typeof import('@kingstinct/react-native-healthkit');

/** HealthKit есть только на iPhone; на остальных платформах модуль не загружаем. */
function hk(): HK | null {
  if (Platform.OS !== 'ios') return null;
  try {
    return require('@kingstinct/react-native-healthkit') as HK;
  } catch {
    return null;
  }
}

const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis' as const;
const HEART = 'HKQuantityTypeIdentifierHeartRate' as const;

export function healthAvailable(): boolean {
  const h = hk();
  try {
    return !!h && h.isHealthDataAvailable();
  } catch {
    return false;
  }
}

export async function requestHealthAccess(write: boolean): Promise<boolean> {
  const h = hk();
  if (!h) return false;
  return h.requestAuthorization({ toRead: [SLEEP, HEART], toShare: write ? [SLEEP] : [] });
}

// Значения HKCategoryValueSleepAnalysis.
const V_IN_BED = 0;
const V_ASLEEP = 1;
const V_AWAKE = 2;
const V_CORE = 3;
const V_DEEP = 4;
const V_REM = 5;

function stageOf(value: number): Stage | null {
  switch (value) {
    case V_AWAKE:
      return 'awake';
    case V_ASLEEP:
    case V_CORE:
      return 'light';
    case V_DEEP:
      return 'deep';
    case V_REM:
      return 'rem';
    default:
      return null;
  }
}

interface RawSample {
  start: number;
  end: number;
  value: number;
  source: string;
}

/** Делит записи на ночи: новый сон начинается после перерыва больше 3 часов. */
export function groupIntoNights(samples: RawSample[]): RawSample[][] {
  const sorted = [...samples].sort((a, b) => a.start - b.start);
  const groups: RawSample[][] = [];
  let end = 0;
  for (const s of sorted) {
    if (!groups.length || s.start - end > 180 * MIN) groups.push([]);
    groups[groups.length - 1].push(s);
    end = Math.max(end, s.end);
  }
  return groups;
}

/** Собирает ночь из записей одного источника (того, у которого больше всего сна). */
export function nightFromSamples(group: RawSample[], goalMin: number): Night | null {
  const bySource = new Map<string, RawSample[]>();
  for (const s of group) bySource.set(s.source, [...(bySource.get(s.source) ?? []), s]);

  let best: RawSample[] = [];
  let bestSleep = -1;
  for (const list of bySource.values()) {
    const sleep = list.reduce((a, s) => a + (stageOf(s.value) && s.value !== V_AWAKE ? s.end - s.start : 0), 0);
    if (sleep > bestSleep) {
      bestSleep = sleep;
      best = list;
    }
  }
  const segments: StageSegment[] = [];
  for (const s of best) {
    const stage = stageOf(s.value);
    if (stage && s.end > s.start) segments.push({ start: s.start, end: s.end, stage });
  }
  if (!segments.length || bestSleep < 60 * MIN) return null;
  segments.sort((a, b) => a.start - b.start);

  const bedtime = Math.min(...best.map((s) => s.start));
  const wake = Math.max(...best.map((s) => s.end));
  return {
    id: dayId(wake),
    source: 'health',
    bedtime,
    wake,
    segments,
    score: computeScore(segments, bedtime, wake, goalMin),
  };
}

/** Читает сон из Здоровья за последние `days` дней (туда его выгружает Mi Fitness). */
export async function readNightsFromHealth(days: number, goalMin: number): Promise<Night[]> {
  const h = hk();
  if (!h) return [];
  const startDate = new Date(Date.now() - days * 24 * 60 * MIN);
  const samples = await h.queryCategorySamples(SLEEP, {
    filter: { date: { startDate, endDate: new Date() } },
    limit: 5000,
    ascending: true,
  });
  const raw: RawSample[] = samples
    .map((s) => ({
      start: new Date(s.startDate).getTime(),
      end: new Date(s.endDate).getTime(),
      value: Number(s.value),
      source: s.sourceRevision?.source?.bundleIdentifier ?? 'unknown',
    }))
    // Свои же записи обратно не импортируем. Реальный идентификатор берём у системы:
    // при установке через Sideloadly он отличается от указанного в app.json.
    .filter((s) => s.source !== (Application.applicationId ?? BUNDLE_ID));

  const nights: Night[] = [];
  for (const group of groupIntoNights(raw)) {
    const night = nightFromSamples(group, goalMin);
    if (!night) continue;
    night.hr = await readHeartRate(night.bedtime, night.wake);
    nights.push(night);
  }
  return nights;
}

async function readHeartRate(from: number, to: number): Promise<{ avg: number; min: number } | undefined> {
  const h = hk();
  if (!h) return undefined;
  try {
    const list = await h.queryQuantitySamples(HEART, {
      filter: { date: { startDate: new Date(from), endDate: new Date(to) } },
      limit: 5000,
      unit: 'count/min',
    });
    if (!list.length) return undefined;
    const values = list.map((s) => s.quantity);
    return {
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      min: Math.round(Math.min(...values)),
    };
  } catch {
    return undefined;
  }
}

/** Записывает в Здоровье ночь, отслеженную самим приложением. */
export async function writeNightToHealth(night: Night): Promise<boolean> {
  const h = hk();
  if (!h || night.source === 'health') return false;
  const value: Record<Stage, number> = { awake: V_AWAKE, light: V_CORE, deep: V_DEEP, rem: V_REM };
  await h.saveCategorySample(SLEEP, V_IN_BED, new Date(night.bedtime), new Date(night.wake));
  for (const s of night.segments) {
    // Без пульса фазы не различаются — пишем «сон без уточнения».
    const v = s.stage === 'light' && !night.score.hasStages ? V_ASLEEP : value[s.stage];
    await h.saveCategorySample(SLEEP, v, new Date(s.start), new Date(s.end));
  }
  return true;
}
