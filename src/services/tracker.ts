import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { Accelerometer } from 'expo-sensors';
import { buildNight } from '../lib/night';
import { decideWake, nextAlarmTime } from '../lib/smartAlarm';
import { SnoreDetector } from '../lib/snore';
import { MIN, type Epoch, type Night, type Settings } from '../lib/types';
import { BandLink, type BandStatus } from './band';
import { loadSession, saveSession } from './storage';

export interface TrackerState {
  phase: 'idle' | 'tracking' | 'ringing';
  startedAt: number | null;
  /** Время, не позже которого сработает будильник; null — будильник выключен. */
  target: number | null;
  hr: number | null;
  band: BandStatus;
  /** Текущая громкость с микрофона, dBFS. */
  db: number | null;
  snoring: boolean;
  micActive: boolean;
  wokeBy: Night['wokeBy'] | null;
}

const IDLE: TrackerState = {
  phase: 'idle',
  startedAt: null,
  target: null,
  hr: null,
  band: 'off',
  db: null,
  snoring: false,
  micActive: false,
  wokeBy: null,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Ночной трекинг. Пока он идёт, приложение не засыпает в фоне: либо пишет
 * звук с микрофона (если включён храп), либо проигрывает тишину. Раз в минуту
 * собирается «эпоха» (пульс, движения, звуки) и проверяется, не пора ли будить.
 */
class Tracker {
  state: TrackerState = IDLE;
  private listeners = new Set<(s: TrackerState) => void>();

  private epochs: Epoch[] = [];
  private goalMin = 480;
  private windowMin = 30;
  private detector: SnoreDetector | null = null;
  private recorder: AudioRecorder | null = null;
  private silence: AudioPlayer | null = null;
  private alarm: AudioPlayer | null = null;
  private band: BandLink | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private motionSub: { remove: () => void } | null = null;
  private notificationId: string | null = null;

  // Накопители текущей минуты.
  private hrSum = 0;
  private hrCount = 0;
  private motion = 0;
  private lastMag: number | null = null;

  subscribe(fn: (s: TrackerState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<TrackerState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  /** Возвращает текст ошибки или null, если трекинг начался. */
  async start(settings: Settings): Promise<string | null> {
    if (this.state.phase !== 'idle') return null;
    const now = Date.now();
    const target = settings.alarmEnabled ? nextAlarmTime(now, settings.alarmHour, settings.alarmMinute) : null;
    this.goalMin = settings.goalMin;
    this.windowMin = settings.windowMin;
    this.epochs = [];
    this.resetMinute();

    let mic = false;
    if (settings.snoreEnabled) {
      const perm = await requestRecordingPermissionsAsync().catch(() => null);
      mic = !!perm?.granted;
      if (!mic) return 'Нет доступа к микрофону. Разрешите его в настройках iPhone или выключите учёт храпа.';
    }

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        allowsRecording: mic,
        allowsBackgroundRecording: mic,
        interruptionMode: 'mixWithOthers',
      });
      if (mic) await this.startMic();
      else this.startSilence();
    } catch (e) {
      return `Не удалось запустить звук: ${String((e as Error)?.message ?? e)}`;
    }

    if (settings.motionEnabled) this.startMotion();
    if (settings.bandId) {
      this.band = new BandLink(
        settings.bandId,
        (bpm) => {
          this.hrSum += bpm;
          this.hrCount++;
          if (this.state.hr !== bpm) this.set({ hr: bpm });
        },
        (band) => this.set({ band }),
      );
      this.band.start();
    }

    if (target) await this.scheduleFallback(target);
    this.timers.push(setInterval(() => this.tick(), MIN));
    this.set({ ...IDLE, phase: 'tracking', startedAt: now, target, micActive: mic });
    void saveSession({ startedAt: now, target, epochs: [], usedBand: !!settings.bandId });
    return null;
  }

  private async startMic(): Promise<void> {
    this.detector = new SnoreDetector();
    // Низкое качество: запись нужна только ради уровня громкости и удаляется утром.
    this.recorder = new AudioModule.AudioRecorder({
      ...RecordingPresets.LOW_QUALITY,
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 16000,
      isMeteringEnabled: true,
    });
    await this.recorder.prepareToRecordAsync();
    this.recorder.record();
    this.timers.push(
      setInterval(() => {
        const db = this.recorder?.getStatus().metering;
        if (db == null || !this.detector) return;
        this.detector.feed(db, Date.now());
        const snoring = this.detector.snoringNow;
        if (snoring !== this.state.snoring || Math.abs((this.state.db ?? -160) - db) > 3) this.set({ db, snoring });
      }, 150),
    );
  }

  private startSilence(): void {
    this.silence = createAudioPlayer(require('../../assets/silence.wav'));
    this.silence.loop = true;
    this.silence.volume = 0;
    this.silence.play();
  }

  private startMotion(): void {
    try {
      Accelerometer.setUpdateInterval(200);
      this.motionSub = Accelerometer.addListener(({ x, y, z }) => {
        const mag = Math.sqrt(x * x + y * y + z * z);
        // Движение — изменение ускорения больше 0,03 g между отсчётами.
        if (this.lastMag != null && Math.abs(mag - this.lastMag) > 0.03) this.motion++;
        this.lastMag = mag;
      });
    } catch {
      this.motionSub = null;
    }
  }

  /** Запасной будильник: уведомление со звуком сработает, даже если iOS выгрузит приложение. */
  private async scheduleFallback(target: number): Promise<void> {
    try {
      const perm = await Notifications.requestPermissionsAsync();
      if (!perm.granted) return;
      this.notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Пора вставать',
          body: 'Будильник трекера сна',
          sound: 'alarm.wav',
          interruptionLevel: 'timeSensitive',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(target) },
      });
    } catch {
      this.notificationId = null;
    }
  }

  private resetMinute(): void {
    this.hrSum = 0;
    this.hrCount = 0;
    this.motion = 0;
  }

  private tick(): void {
    if (this.state.phase !== 'tracking') return;
    const now = Date.now();
    this.epochs.push({
      t: now - MIN,
      hr: this.hrCount ? Math.round(this.hrSum / this.hrCount) : undefined,
      // Одно «шевеление» даёт серию отсчётов; считаем движением каждые 3.
      motion: Math.min(20, Math.ceil(this.motion / 3)),
      sound: this.detector?.takeSoundEvents() ?? 0,
    });
    this.resetMinute();

    if (this.epochs.length % 5 === 0 && this.state.startedAt) {
      void saveSession({
        startedAt: this.state.startedAt,
        target: this.state.target,
        epochs: this.epochs,
        usedBand: this.band != null,
      });
    }

    if (this.state.target) {
      const decision = decideWake(now, this.state.target, this.windowMin, this.epochs);
      if (decision !== 'wait') this.ring(decision);
    }
  }

  private ring(reason: 'smart' | 'deadline'): void {
    if (reason === 'smart' && this.notificationId) {
      void Notifications.cancelScheduledNotificationAsync(this.notificationId).catch(() => {});
      this.notificationId = null;
    }
    try {
      this.alarm = createAudioPlayer(require('../../assets/alarm.wav'));
      this.alarm.loop = true;
      this.alarm.volume = 1;
      this.alarm.play();
    } catch {
      this.alarm = null;
    }
    this.set({ phase: 'ringing', wokeBy: reason });
  }

  /** Завершает ночь (кнопка «Я проснулся» или выключение будильника) и возвращает её. */
  async stop(): Promise<Night | null> {
    if (this.state.phase === 'idle') return null;
    const { startedAt, wokeBy } = this.state;
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.motionSub?.remove();
    this.motionSub = null;
    this.lastMag = null;
    this.band?.stop();
    this.band = null;

    this.alarm?.pause();
    this.alarm?.remove();
    this.alarm = null;
    this.silence?.pause();
    this.silence?.remove();
    this.silence = null;

    if (this.notificationId) {
      void Notifications.cancelScheduledNotificationAsync(this.notificationId).catch(() => {});
      this.notificationId = null;
    }

    if (this.recorder) {
      try {
        await this.recorder.stop();
        const uri = this.recorder.uri;
        if (uri) new File(uri).delete(); // сам звук не храним
      } catch {
        // файл удалит система вместе с кэшем
      }
      this.recorder = null;
    }
    const episodes = this.detector ? this.detector.finish() : null;
    this.detector = null;

    const night = startedAt
      ? buildNight(this.epochs, startedAt, Date.now(), episodes, this.goalMin, wokeBy ?? 'manual')
      : null;
    this.epochs = [];
    await saveSession(null);
    this.set(IDLE);
    return night;
  }

  /** Если прошлую ночь приложение не дожило до утра — собирает ночь из сохранённых эпох. */
  async recover(goalMin: number): Promise<Night | null> {
    if (this.state.phase !== 'idle') return null;
    const snap = await loadSession();
    if (!snap) return null;
    await saveSession(null);
    const last = snap.epochs[snap.epochs.length - 1];
    return last ? buildNight(snap.epochs, snap.startedAt, last.t + MIN, null, goalMin, 'manual') : null;
  }
}

export const tracker = new Tracker();
