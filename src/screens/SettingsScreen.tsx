import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fmtDuration } from '../lib/types';
import { bleAvailable, scanForBands, type FoundBand } from '../services/band';
import { healthAvailable, requestHealthAccess } from '../services/health';
import { useStore } from '../store';
import { Button, Card, Hint, Stepper, Title, ToggleRow, useTheme } from '../ui/kit';

export function SettingsScreen() {
  const { settings, update, syncHealth, loadDemo, clearAll } = useStore();
  const { c: C, s } = useTheme();
  const [found, setFound] = useState<FoundBand[]>([]);
  const [scanning, setScanning] = useState(false);
  const [bleError, setBleError] = useState<string | null>(null);
  const stopScan = useRef<(() => void) | null>(null);
  const hasHealth = healthAvailable();

  useEffect(() => () => stopScan.current?.(), []);

  const scan = () => {
    setFound([]);
    setBleError(null);
    setScanning(true);
    stopScan.current = scanForBands(
      (band) => setFound((list) => (list.some((b) => b.id === band.id) ? list : [...list, band])),
      (msg) => {
        setBleError(msg);
        setScanning(false);
      },
    );
    setTimeout(() => {
      stopScan.current?.();
      setScanning(false);
    }, 20_000);
  };

  const toggleHealthRead = async (v: boolean) => {
    update({ healthRead: v });
    if (v) await syncHealth();
  };

  const toggleHealthWrite = async (v: boolean) => {
    update({ healthWrite: v });
    if (v) await requestHealthAccess(true).catch(() => false);
  };

  return (
    <>
      <Card>
        <Title icon="heart.fill" color={C.heart}>Браслет через «Здоровье»</Title>
        <Hint>
          Точные фазы сна с Xiaomi Smart Band 9. В Mi Fitness откройте Профиль → Настройки → Подключённые приложения →
          Apple Здоровье и включите сон и пульс. Данные появляются утром после синхронизации браслета.
        </Hint>
        {hasHealth ? (
          <>
            <ToggleRow label="Читать сон из «Здоровья»" value={settings.healthRead} onChange={(v) => void toggleHealthRead(v)} />
            <ToggleRow
              label="Записывать в «Здоровье»"
              hint="Ночи, отслеженные самим приложением"
              value={settings.healthWrite}
              onChange={(v) => void toggleHealthWrite(v)}
            />
          </>
        ) : (
          <Hint>«Здоровье» доступно только на iPhone.</Hint>
        )}
      </Card>

      <Card>
        <Title icon="antenna.radiowaves.left.and.right" color={C.accent}>Браслет напрямую по Bluetooth</Title>
        <Hint>
          Пульс в реальном времени — для умного будильника и собственной оценки фаз. На браслете включите Настройки →
          «Трансляция пульса», затем нажмите «Найти браслет». Сохранённый браслетом сон так не передаётся — для него
          нужно «Здоровье».
        </Hint>
        {settings.bandId ? (
          <>
            <View style={s.row}>
              <Text style={[s.rowLabel, { flex: 1 }]}>{settings.bandName ?? 'Браслет'}</Text>
              <Text style={s.hint}>выбран</Text>
            </View>
            <Button kind="ghost" label="Отвязать" onPress={() => update({ bandId: undefined, bandName: undefined })} />
          </>
        ) : bleAvailable() ? (
          <>
            <Button label={scanning ? 'Поиск…' : 'Найти браслет'} disabled={scanning} onPress={scan} />
            {found.map((b) => (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                style={s.row}
                onPress={() => {
                  stopScan.current?.();
                  setScanning(false);
                  update({ bandId: b.id, bandName: b.name });
                }}
              >
                <Text style={[s.rowLabel, { flex: 1 }]}>{b.name}</Text>
                <Text style={{ color: C.accent, fontSize: 15 }}>Выбрать</Text>
              </Pressable>
            ))}
            {scanning && !found.length ? <Hint>Ищем устройства с трансляцией пульса…</Hint> : null}
            {bleError ? <Hint>{bleError}</Hint> : null}
          </>
        ) : (
          <Hint>Bluetooth недоступен на этом устройстве.</Hint>
        )}
      </Card>

      <Card>
        <Title icon="iphone">Трекинг телефоном</Title>
        <ToggleRow
          label="Храп"
          hint="Микрофон iPhone ночью. Анализируется только громкость, звук не сохраняется."
          value={settings.snoreEnabled}
          onChange={(v) => update({ snoreEnabled: v })}
        />
        <ToggleRow
          label="Движения"
          hint="Акселерометр: телефон должен лежать на матрасе"
          value={settings.motionEnabled}
          onChange={(v) => update({ motionEnabled: v })}
        />
        <Stepper
          label="Цель сна"
          value={fmtDuration(settings.goalMin).replace(' мин', 'м').replace(' ч ', 'ч ')}
          onMinus={() => update({ goalMin: Math.max(300, settings.goalMin - 15) })}
          onPlus={() => update({ goalMin: Math.min(600, settings.goalMin + 15) })}
        />
      </Card>

      <Card>
        <Title icon="tray.full.fill" color={C.dim}>Данные</Title>
        <Button kind="ghost" label="Добавить примерные ночи" onPress={() => void loadDemo()} />
        <Button kind="ghost" label="Удалить все ночи из приложения" onPress={() => void clearAll()} />
        <View style={{ marginTop: 10 }}>
          <Hint>Приложение не ставит диагнозов. Оценка сна и храпа — ориентир, а не медицинское измерение.</Hint>
        </View>
      </Card>
    </>
  );
}
