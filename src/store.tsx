import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { demoNights } from './lib/demo';
import { mergeNights } from './lib/night';
import { nextAlarmTime } from './lib/smartAlarm';
import { DEFAULT_SETTINGS, type Night, type Settings } from './lib/types';
import { readNightsFromHealth, requestHealthAccess, writeNightToHealth } from './services/health';
import { loadNights, loadSettings, saveNights, saveSettings } from './services/storage';
import { tracker, type TrackerState } from './services/tracker';
import { updateWidget } from './services/widget';

interface Store {
  ready: boolean;
  settings: Settings;
  nights: Night[];
  tracking: TrackerState;
  message: string | null;
  update: (patch: Partial<Settings>) => void;
  syncHealth: () => Promise<void>;
  startSleep: () => Promise<void>;
  stopSleep: () => Promise<void>;
  loadDemo: () => Promise<void>;
  clearAll: () => Promise<void>;
  dismissMessage: () => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('Store не подключён');
  return s;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [nights, setNights] = useState<Night[]>([]);
  const [tracking, setTracking] = useState<TrackerState>(tracker.state);
  const [message, setMessage] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  const nightsRef = useRef(nights);
  settingsRef.current = settings;
  nightsRef.current = nights;

  const commitNights = useCallback(async (list: Night[]) => {
    const saved = await saveNights(list);
    setNights(saved);
    const s = settingsRef.current;
    const next = s.alarmEnabled ? nextAlarmTime(Date.now(), s.alarmHour, s.alarmMinute) : null;
    updateWidget(saved[0] ?? null, next);
    return saved;
  }, []);

  /** Сохраняет отслеженную ночь и, если разрешено, записывает её в Здоровье. */
  const addNight = useCallback(
    async (night: Night) => {
      const s = settingsRef.current;
      if (s.healthWrite) {
        try {
          night.exportedToHealth = await writeNightToHealth(night);
        } catch {
          setMessage('Ночь сохранена, но записать её в «Здоровье» не удалось.');
        }
      }
      await commitNights(mergeNights([night, ...nightsRef.current.filter((n) => n.id !== night.id)], [], s.goalMin));
    },
    [commitNights],
  );

  const syncHealth = useCallback(async () => {
    const s = settingsRef.current;
    try {
      const ok = await requestHealthAccess(s.healthWrite);
      if (!ok) return setMessage('«Здоровье» недоступно на этом устройстве.');
      const fromHealth = await readNightsFromHealth(14, s.goalMin);
      await commitNights(mergeNights(nightsRef.current, fromHealth, s.goalMin));
      if (!fromHealth.length) {
        setMessage(
          'В «Здоровье» нет данных сна. Проверьте, что в Mi Fitness включена синхронизация с Apple Здоровьем и что приложению разрешено чтение сна.',
        );
      }
    } catch (e) {
      setMessage(`Не удалось прочитать «Здоровье»: ${String((e as Error)?.message ?? e)}`);
    }
  }, [commitNights]);

  useEffect(() => {
    const off = tracker.subscribe(setTracking);
    (async () => {
      const [s, n] = await Promise.all([loadSettings(), loadNights()]);
      settingsRef.current = s;
      nightsRef.current = n;
      setSettings(s);
      setNights(n);
      setReady(true);
      const recovered = await tracker.recover(s.goalMin);
      if (recovered) {
        await addNight(recovered);
        setMessage('Трекинг прошлой ночи прервался раньше времени. Сохранено то, что успели записать.');
      }
      if (s.healthRead) await syncHealth();
    })();
    return () => {
      off();
    };
  }, [addNight, syncHealth]);

  const update = useCallback((patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    void saveSettings(next);
    const alarm = next.alarmEnabled ? nextAlarmTime(Date.now(), next.alarmHour, next.alarmMinute) : null;
    updateWidget(nightsRef.current[0] ?? null, alarm);
  }, []);

  const startSleep = useCallback(async () => {
    const error = await tracker.start(settingsRef.current);
    if (error) setMessage(error);
  }, []);

  const stopSleep = useCallback(async () => {
    const night = await tracker.stop();
    if (night) await addNight(night);
    else setMessage('Запись короче 20 минут — ночь не сохранена.');
    // Утром подтягиваем точные фазы с браслета, если подключено «Здоровье».
    if (settingsRef.current.healthRead) await syncHealth();
  }, [addNight, syncHealth]);

  const loadDemo = useCallback(async () => {
    await commitNights(mergeNights(nightsRef.current, demoNights(settingsRef.current.goalMin), settingsRef.current.goalMin));
  }, [commitNights]);

  const clearAll = useCallback(async () => {
    await commitNights([]);
  }, [commitNights]);

  return (
    <Ctx.Provider
      value={{
        ready,
        settings,
        nights,
        tracking,
        message,
        update,
        syncHealth,
        startSleep,
        stopSleep,
        loadDemo,
        clearAll,
        dismissMessage: () => setMessage(null),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
