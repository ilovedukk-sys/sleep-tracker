import type { SnoreEpisode } from './types';

/**
 * Детектор храпа по уровню громкости микрофона (dBFS, обычно от -160 до 0).
 * Аудио не анализируется по спектру и не сохраняется: храпом считается серия
 * громких звуков длительностью 0,25–3,5 с, повторяющихся в ритме дыхания
 * (каждые 2–8 секунд, минимум 3 подряд). Разовые шумы (хлопок двери, кашель)
 * в храп не попадают, но попадают в счётчик звуковых событий.
 */
export class SnoreDetector {
  private floor = -60;
  private inEvent = false;
  private eventStart = 0;
  private eventPeak = -160;
  private onsets: number[] = [];
  private current: SnoreEpisode | null = null;
  private lastSnoreEvent = 0;
  private soundEvents = 0;

  readonly episodes: SnoreEpisode[] = [];

  constructor(
    private readonly thresholdDb = 12,
    private readonly minMs = 250,
    private readonly maxMs = 3500,
  ) {}

  get noiseFloor(): number {
    return this.floor;
  }

  /** Вызывать ~5–10 раз в секунду. */
  feed(db: number, t: number): void {
    if (!Number.isFinite(db)) return;
    // Шумовой фон: быстро опускается, медленно поднимается.
    this.floor += (db - this.floor) * (db < this.floor ? 0.2 : 0.004);
    const loud = db > this.floor + this.thresholdDb;

    if (loud && !this.inEvent) {
      this.inEvent = true;
      this.eventStart = t;
      this.eventPeak = db;
    } else if (loud) {
      this.eventPeak = Math.max(this.eventPeak, db);
    } else if (this.inEvent) {
      this.inEvent = false;
      this.soundEvents++;
      const dur = t - this.eventStart;
      if (dur >= this.minMs && dur <= this.maxMs) this.onEvent(this.eventStart, t, this.eventPeak);
    }

    if (this.current && t - this.lastSnoreEvent > 12_000) this.closeEpisode();
  }

  private onEvent(start: number, end: number, peak: number): void {
    this.onsets = this.onsets.filter((o) => start - o <= 30_000);
    this.onsets.push(start);

    let rhythmic = 0;
    for (let i = 1; i < this.onsets.length; i++) {
      const gap = this.onsets[i] - this.onsets[i - 1];
      if (gap >= 2000 && gap <= 8000) rhythmic++;
    }
    if (rhythmic < 2) return;

    this.lastSnoreEvent = end;
    if (!this.current) this.current = { start: this.onsets[0], end, peakDb: peak };
    else {
      this.current.end = end;
      this.current.peakDb = Math.max(this.current.peakDb, peak);
    }
  }

  private closeEpisode(): void {
    if (this.current) this.episodes.push(this.current);
    this.current = null;
    this.onsets = [];
  }

  /** Сколько звуковых событий накопилось с прошлого вызова. */
  takeSoundEvents(): number {
    const n = this.soundEvents;
    this.soundEvents = 0;
    return n;
  }

  get snoringNow(): boolean {
    return this.current != null;
  }

  finish(): SnoreEpisode[] {
    this.closeEpisode();
    return this.episodes;
  }
}

export function snoreMinutes(episodes: SnoreEpisode[]): number {
  return Math.round((episodes.reduce((a, e) => a + (e.end - e.start), 0) / 60_000) * 10) / 10;
}
