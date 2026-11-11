export type Stage = 'awake' | 'light' | 'deep' | 'rem';

/** Отрезок сна. Время в миллисекундах Unix. */
export interface StageSegment {
  start: number;
  end: number;
  stage: Stage;
}

export interface SnoreEpisode {
  start: number;
  end: number;
  peakDb: number;
}

/** Одна минута ночного трекинга. */
export interface Epoch {
  t: number;
  /** Средний пульс за минуту (с браслета по Bluetooth), если был. */
  hr?: number;
  /** Число движений за минуту по акселерометру телефона. */
  motion: number;
  /** Число громких звуковых событий за минуту. */
  sound: number;
}

export interface ScoreParts {
  duration: number;
  efficiency: number;
  deep: number;
  rem: number;
  continuity: number;
  snorePenalty: number;
}

export interface SleepScore {
  total: number;
  label: string;
  parts: ScoreParts;
  sleepMin: number;
  inBedMin: number;
  deepMin: number;
  remMin: number;
  lightMin: number;
  awakeMin: number;
  awakenings: number;
  /** false, если фазы не различались (только «спал / не спал»). */
  hasStages: boolean;
}

/** health — из Apple Здоровья (Mi Fitness), band — свой трекинг с пульсом браслета, phone — только телефон. */
export type NightSource = 'health' | 'band' | 'phone';

export interface Night {
  /** Дата пробуждения, ГГГГ-ММ-ДД. */
  id: string;
  source: NightSource;
  bedtime: number;
  wake: number;
  segments: StageSegment[];
  snore?: { episodes: SnoreEpisode[]; totalMin: number };
  hr?: { avg: number; min: number };
  score: SleepScore;
  wokeBy?: 'smart' | 'deadline' | 'manual';
  exportedToHealth?: boolean;
}

export interface Settings {
  alarmHour: number;
  alarmMinute: number;
  alarmEnabled: boolean;
  /** Окно умного будильника, минут до назначенного времени. */
  windowMin: number;
  goalMin: number;
  snoreEnabled: boolean;
  motionEnabled: boolean;
  healthRead: boolean;
  healthWrite: boolean;
  bandId?: string;
  bandName?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  alarmHour: 7,
  alarmMinute: 30,
  alarmEnabled: true,
  windowMin: 30,
  goalMin: 480,
  snoreEnabled: false,
  motionEnabled: true,
  healthRead: false,
  healthWrite: false,
};

export const MIN = 60_000;

export function dayId(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)} ч ${String(m % 60).padStart(2, '0')} мин`;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
