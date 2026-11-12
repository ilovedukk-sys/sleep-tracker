import type { SFSymbol } from 'expo-symbols';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { nextAlarmTime } from '../lib/smartAlarm';
import { MIN, fmtDuration, fmtTime } from '../lib/types';
import { useStore } from '../store';
import { Button, Card, Hint, Icon, ROUNDED, RollingText, Stepper, Title, ToggleRow, useTheme } from '../ui/kit';
import { PressScale, SPRING } from '../ui/motion';

const pad = (n: number) => String(n).padStart(2, '0');

/** Колонка «▲ число ▼» для часов или минут. */
function Wheel(props: { value: number; label: string; onStep: (d: 1 | -1) => void }) {
  const { c } = useTheme();
  const [dir, setDir] = useState(1);
  const step = (d: 1 | -1) => {
    setDir(d);
    props.onStep(d);
  };
  const arrow = (d: 1 | -1) => (
    <PressScale
      accessibilityLabel={`${props.label}: ${d > 0 ? 'больше' : 'меньше'}`}
      feedback="select"
      scaleTo={0.8}
      onPress={() => step(d)}
      style={{ width: 64, height: 36, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={26} height={14} viewBox="0 0 26 14">
        <Path
          d={d > 0 ? 'M3 11 13 3l10 8' : 'M3 3l10 8 10-8'}
          stroke={c.accent}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </PressScale>
  );
  return (
    <View style={{ alignItems: 'center' }}>
      {arrow(1)}
      <RollingText
        value={pad(props.value)}
        dir={dir}
        style={{ color: c.text, fontSize: 64, fontWeight: '700', width: 92, textAlign: 'center', ...ROUNDED }}
      />
      {arrow(-1)}
    </View>
  );
}

function TrackItem({ icon, on, text }: { icon: SFSymbol; on: boolean; text: string }) {
  const { c, s } = useTheme();
  return (
    <View style={[s.row, { gap: 12 }]}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: on ? c.sleep : c.fill,
        }}
      >
        <Icon name={icon} color={on ? '#FFFFFF' : c.dim} size={15} />
      </View>
      <Text style={[s.rowLabel, { flex: 1, fontSize: 15, color: on ? c.text : c.dim }]}>{text}</Text>
    </View>
  );
}

export function Sleep() {
  const { c: C } = useTheme();
  const { settings, update, startSleep } = useStore();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      await startSleep();
    } finally {
      setBusy(false);
    }
  };

  const target = nextAlarmTime(now, settings.alarmHour, settings.alarmMinute);
  const left = (target - now) / MIN;

  return (
    <>
      <Card i={0}>
        <Title icon="alarm.fill" color={C.warn}>
          Умный будильник
        </Title>
        <ToggleRow label="Будильник" value={settings.alarmEnabled} onChange={(v) => update({ alarmEnabled: v })} />
        {settings.alarmEnabled ? (
          <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} layout={LinearTransition.springify().damping(SPRING.damping)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}>
              <Wheel
                label="Часы"
                value={settings.alarmHour}
                onStep={(d) => update({ alarmHour: (settings.alarmHour + d + 24) % 24 })}
              />
              <Text style={{ color: C.dim, fontSize: 56, fontWeight: '600', marginTop: -8, ...ROUNDED }}>:</Text>
              <Wheel
                label="Минуты"
                value={settings.alarmMinute}
                onStep={(d) => update({ alarmMinute: (settings.alarmMinute + d * 5 + 60) % 60 })}
              />
            </View>
            <Hint style={{ textAlign: 'center', marginBottom: 6 }}>
              {`До будильника ${fmtDuration(left)}`}
            </Hint>
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
          </Animated.View>
        ) : null}
      </Card>

      <Card i={1}>
        <Title icon="bed.double.fill">Что будет отслеживаться</Title>
        <TrackItem
          icon="heart.fill"
          on={!!settings.bandId}
          text={settings.bandId ? `Пульс с «${settings.bandName ?? 'Band'}»` : 'Браслет по Bluetooth не подключён'}
        />
        <TrackItem
          icon="iphone.radiowaves.left.and.right"
          on={settings.motionEnabled}
          text={settings.motionEnabled ? 'Движения — телефон на матрасе' : 'Движения не учитываются'}
        />
        <TrackItem
          icon="waveform"
          on={settings.snoreEnabled}
          text={settings.snoreEnabled ? 'Храп — микрофон, звук не сохраняется' : 'Храп не отслеживается'}
        />
      </Card>

      <Animated.View entering={FadeIn.delay(200).duration(400)}>
        <Button icon="moon.fill" label="Лечь спать" disabled={busy} onPress={() => void start()} />
      </Animated.View>
    </>
  );
}
