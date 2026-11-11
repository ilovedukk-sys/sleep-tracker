import { computeScore } from './score';
import { snoreMinutes } from './snore';
import { estimateStages } from './staging';
import { MIN, dayId, type Epoch, type Night, type SnoreEpisode } from './types';

/** Собирает ночь из минутных эпох собственного трекинга. null, если запись короче 20 минут. */
export function buildNight(
  epochs: Epoch[],
  startedAt: number,
  wake: number,
  episodes: SnoreEpisode[] | null,
  goalMin: number,
  wokeBy: Night['wokeBy'],
): Night | null {
  if (epochs.length < 20) return null;
  const segments = estimateStages(epochs);
  const hrs = epochs.map((e) => e.hr).filter((v): v is number => v != null);
  const hasHr = hrs.length >= epochs.length * 0.5;
  const snore = episodes ? { episodes, totalMin: snoreMinutes(episodes) } : undefined;
  const end = Math.max(wake, epochs[epochs.length - 1].t + MIN);
  return {
    id: dayId(end),
    source: hasHr ? 'band' : 'phone',
    bedtime: startedAt,
    wake: end,
    segments,
    snore,
    hr: hasHr
      ? { avg: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length), min: Math.round(Math.min(...hrs)) }
      : undefined,
    score: computeScore(segments, startedAt, end, goalMin, snore?.totalMin ?? 0),
    wokeBy,
  };
}

/**
 * Объединяет ночи из Здоровья с отслеженными приложением. Для одной даты
 * фазы и время берутся из Здоровья (браслет определяет их точнее), а храп и
 * способ пробуждения — из собственного трекинга; оценка пересчитывается.
 */
export function mergeNights(existing: Night[], fromHealth: Night[], goalMin: number): Night[] {
  const byId = new Map(existing.map((n) => [n.id, n]));
  for (const h of fromHealth) {
    const own = byId.get(h.id);
    if (!own || own.source === 'health') {
      byId.set(h.id, own?.snore ? withSnore(h, own, goalMin) : h);
    } else {
      byId.set(h.id, withSnore(h, own, goalMin));
    }
  }
  return [...byId.values()].sort((a, b) => b.wake - a.wake);
}

function withSnore(health: Night, own: Night, goalMin: number): Night {
  return {
    ...health,
    snore: own.snore,
    wokeBy: own.wokeBy,
    hr: health.hr ?? own.hr,
    exportedToHealth: own.exportedToHealth,
    score: computeScore(health.segments, health.bedtime, health.wake, goalMin, own.snore?.totalMin ?? 0),
  };
}
