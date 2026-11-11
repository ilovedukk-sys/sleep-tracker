import { Platform } from 'react-native';
import { APP_GROUP } from '../config';
import { fmtTime, type Night } from '../lib/types';

type Targets = typeof import('@bacons/apple-targets');

/** Передаёт последнюю ночь виджетам через общий UserDefaults (App Group). */
export function updateWidget(night: Night | null, nextAlarm: number | null): void {
  if (Platform.OS !== 'ios') return;
  try {
    const { ExtensionStorage } = require('@bacons/apple-targets') as Targets;
    const store = new ExtensionStorage(APP_GROUP);
    if (night) {
      store.set('score', night.score.total);
      store.set('label', night.score.label);
      store.set('sleepMin', night.score.sleepMin);
      store.set('deepMin', night.score.deepMin);
      store.set('remMin', night.score.remMin);
      store.set('lightMin', night.score.lightMin);
      store.set('awakeMin', night.score.awakeMin);
      store.set('snoreMin', Math.round(night.snore?.totalMin ?? 0));
      store.set('nightId', night.id);
    }
    store.set('nextAlarm', nextAlarm ? fmtTime(nextAlarm) : '');
    ExtensionStorage.reloadWidget();
  } catch {
    // Виджет не обязателен: приложение работает и без него.
  }
}
