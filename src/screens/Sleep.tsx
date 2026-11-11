import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { nextAlarmTime } from '../lib/smartAlarm';
import { MIN, fmtTime } from '../lib/types';
import { useStore } from '../store';
import { Button, Card, Hint, ROUNDED, Stepper, Title, ToggleRow, useTheme } from '../ui/kit';

const BAND_STATUS = {
  off: 'не подключён',
  connecting: 'подключение…',
  connected: 'подключён',
  lost: 'связь потеряна, переподключение…',
} as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function Sleep() {
  const { c: C } = useTheme();
  const { settings, update, tracking, startSleep, stopSleep } = useStore();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  if (tracking.phase === 'ringing') {
    return (
      <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
        <Text style={{ color: C.text, fontSize: 76, fontWeight: '700', ...ROUNDED }}>{fmtTime(now)}</Text>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '700', marginVertical: 12 }}>Доброе утро</Text>
        <Hint>
          {tracking.wokeBy === 'smart'
            ? 'Вы в лёгкой фазе сна — самое время вставать.'
            : 'Назначенное время будильника.'}
        </Hint>
        <View style={{ alignSelf: 'stretch', marginTop: 20 }}>
          <Button kind="danger" label="Выключить будильник" disabled={busy} onPress={() => void run(stopSleep)} />
        </View>
      </Card>
    );
  }

  if (tracking.phase === 'tracking') {
    const t = tracking.target;
    return (
      <>
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Text style={{ color: C.text, fontSize: 76, fontWeight: '700', ...ROUNDED }}>{fmtTime(now)}</Text>
          <Hint>
            {t
              ? `Будильник: ${fmtTime(t - settings.windowMin * MIN)} – ${fmtTime(t)}`
              : 'Будильник выключен — отслеживается только сон'}
          </Hint>
        </Card>
        <Card>
          <Title icon="moon.zzz.fill">Идёт трекинг</Title>
          <Hint>Спим с {tracking.startedAt ? fmtTime(tracking.startedAt) : '—'}</Hint>
          {settings.bandId ? (
            <Hint>
              Браслет: {BAND_STATUS[tracking.band]}
              {tracking.hr ? ` · пульс ${tracking.hr} уд/мин` : ''}
            </Hint>
          ) : null}
          {tracking.micActive ? (
            <Hint>
              Микрофон: {tracking.db != null ? `${Math.round(tracking.db)} дБ` : 'слушает'}
              {tracking.snoring ? ' · слышен храп' : ''}
            </Hint>
          ) : null}
          <View style={{ marginTop: 8 }}>
            <Hint>
              Не закрывайте приложение смахиванием. Экран можно заблокировать. Поставьте iPhone на зарядку
              {settings.motionEnabled ? ' и положите на матрас рядом с подушкой' : ''}.
            </Hint>
          </View>
          <Button label="Я проснулся" disabled={busy} onPress={() => void run(stopSleep)} />
        </Card>
      </>
    );
  }

  const target = nextAlarmTime(now, settings.alarmHour, settings.alarmMinute);
  return (
    <>
      <Card>
        <Title icon="alarm.fill" color={C.warn}>Умный будильник</Title>
        <ToggleRow label="Будильник" value={settings.alarmEnabled} onChange={(v) => update({ alarmEnabled: v })} />
        {settings.alarmEnabled ? (
          <>
            <Stepper
              label="Часы"
              value={pad(settings.alarmHour)}
              onMinus={() => update({ alarmHour: (settings.alarmHour + 23) % 24 })}
              onPlus={() => update({ alarmHour: (settings.alarmHour + 1) % 24 })}
            />
            <Stepper
              label="Минуты"
              value={pad(settings.alarmMinute)}
              onMinus={() => update({ alarmMinute: (settings.alarmMinute + 55) % 60 })}
              onPlus={() => update({ alarmMinute: (settings.alarmMinute + 5) % 60 })}
            />
            <Stepper
              label="Окно пробуждения"
              value={`${settings.windowMin} мин`}
              onMinus={() => update({ windowMin: Math.max(0, settings.windowMin - 5) })}
              onPlus={() => update({ windowMin: Math.min(60, settings.windowMin + 5) })}
            />
            <Hint>
              {settings.windowMin > 0
                ? `Разбудим между ${fmtTime(target - settings.windowMin * MIN)} и ${fmtTime(target)}, когда сон станет лёгким, и не позже ${fmtTime(target)}.`
                : `Разбудим ровно в ${fmtTime(target)}.`}
            </Hint>
          </>
        ) : null}
      </Card>
      <Card>
        <Title icon="bed.double.fill">Что будет отслеживаться</Title>
        <Hint>
          {settings.bandId ? `• Пульс с браслета «${settings.bandName ?? 'Band'}» по Bluetooth` : '• Браслет по Bluetooth не подключён'}
        </Hint>
        <Hint>{settings.motionEnabled ? '• Движения — акселерометр телефона на матрасе' : '• Движения не учитываются'}</Hint>
        <Hint>{settings.snoreEnabled ? '• Храп — микрофон iPhone (звук не сохраняется)' : '• Храп не отслеживается'}</Hint>
        <Button label="Лечь спать" disabled={busy} onPress={() => void run(startSleep)} />
      </Card>
    </>
  );
}
