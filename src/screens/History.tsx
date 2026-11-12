import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { fmtDuration, type Night } from '../lib/types';
import { useStore } from '../store';
import { Button, Card, Hint, Icon, ROUNDED, Title, scoreColor, useTheme } from '../ui/kit';
import { PressScale, SPRING, enter, haptic } from '../ui/motion';
import { NightDetails } from './Today';

const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function dateLabel(night: Night): string {
  const d = new Date(night.wake);
  return `${DAYS[d.getDay()]}, ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Столбик недели: вырастает снизу с задержкой по номеру. */
function WeekBar({ night, i, color }: { night: Night; i: number; color: string }) {
  const { s } = useTheme();
  const h = useSharedValue(0);
  const target = Math.max(4, night.score.total * 0.8);
  useEffect(() => {
    h.value = withDelay(150 + i * 70, withSpring(target, { damping: 14, stiffness: 140 }));
  }, [h, i, target]);
  const bar = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Animated.Text entering={enter(i + 2)} style={[s.hint, { marginBottom: 4, ...ROUNDED }]}>
        {night.score.total}
      </Animated.Text>
      <Animated.View style={[{ width: '100%', backgroundColor: color, borderRadius: 7 }, bar]} />
      <Text style={[s.hint, { marginTop: 4 }]}>{DAYS[new Date(night.wake).getDay()]}</Text>
    </View>
  );
}

/** Экран одной ночи: въезжает справа, назад — кнопкой или свайпом от левого края. */
export function Detail({ night, width, onBack, backLabel = 'История' }: { night: Night; width: number; onBack: () => void; backLabel?: string }) {
  const { c } = useTheme();
  const screen = useWindowDimensions().width;
  const x = useSharedValue(0);
  const drag = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const back = useRef(onBack);
  back.current = onBack;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (e, g) => g.x0 < 40 && g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderMove: (_, g) => {
        x.value = Math.max(0, g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > 110 || g.vx > 0.6) {
          haptic.tap();
          x.value = withTiming(screen, { duration: 180 }, () => {});
          setTimeout(() => back.current(), 170);
        } else {
          x.value = withSpring(0, SPRING);
        }
      },
      onPanResponderTerminate: () => {
        x.value = withSpring(0, SPRING);
      },
    }),
  ).current;

  return (
    <Animated.View entering={SlideInRight.springify().damping(20).stiffness(170)} style={drag} {...pan.panHandlers}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`Назад: ${backLabel}`}
        onPress={onBack}
        style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 6 }}
      >
        <Text style={{ color: c.accent, fontSize: 28, lineHeight: 28, marginRight: 4, marginTop: -2 }}>‹</Text>
        <Text style={{ color: c.accent, fontSize: 17 }}>{backLabel}</Text>
      </PressScale>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 12 }}>{dateLabel(night)}</Text>
      <NightDetails night={night} width={width} />
    </Animated.View>
  );
}

export function History({ width, onNavigate }: { width: number; onNavigate?: () => void }) {
  const { nights, loadDemo } = useStore();
  const { c: C, s } = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const [cameBack, setCameBack] = useState(false);
  const open = nights.find((n) => n.id === openId);

  if (open) {
    return (
      <Detail
        key={open.id}
        night={open}
        width={width}
        onBack={() => {
          setCameBack(true);
          setOpenId(null);
          onNavigate?.();
        }}
      />
    );
  }
  if (!nights.length) {
    return (
      <Card i={0} style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Icon name="chart.bar.fill" color={C.sleep} size={40} />
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', marginTop: 12 }}>История пуста</Text>
        <Hint style={{ textAlign: 'center', marginTop: 4 }}>Здесь появятся ваши ночи.</Hint>
        <Button kind="ghost" label="Показать на примере" onPress={() => void loadDemo()} style={{ alignSelf: 'stretch' }} />
      </Card>
    );
  }

  const week = nights.slice(0, 7).reverse();
  const avg = Math.round(week.reduce((a, n) => a + n.score.total, 0) / week.length);
  const avgSleep = week.reduce((a, n) => a + n.score.sleepMin, 0) / week.length;

  return (
    <Animated.View entering={cameBack ? SlideInLeft.springify().damping(20).stiffness(170) : undefined}>
      <Card i={cameBack ? undefined : 0}>
        <Title icon="chart.bar.fill">Последние {week.length} ноч.</Title>
        <Hint>
          Средняя оценка {avg} · средний сон {fmtDuration(avgSleep)}
        </Hint>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, marginTop: 14, gap: 8 }}>
          {week.map((n, i) => (
            <WeekBar key={n.id} night={n} i={i} color={scoreColor(n.score.total, C)} />
          ))}
        </View>
      </Card>
      {nights.map((n, i) => (
        <Animated.View key={n.id} entering={cameBack ? undefined : enter(i + 1)}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`${dateLabel(n)}, оценка ${n.score.total}`}
            scaleTo={0.97}
            onPress={() => {
              setOpenId(n.id);
              onNavigate?.();
            }}
            style={[s.card, { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }]}
          >
            <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: scoreColor(n.score.total, C), marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{dateLabel(n)}</Text>
              <Hint>
                {fmtDuration(n.score.sleepMin)}
                {n.snore ? ` · храп ${Math.round(n.snore.totalMin)} мин` : ''}
              </Hint>
            </View>
            <Text style={{ color: scoreColor(n.score.total, C), fontSize: 28, fontWeight: '700', ...ROUNDED }}>{n.score.total}</Text>
            <Text style={{ color: C.dim, fontSize: 22, marginLeft: 10 }}>›</Text>
          </PressScale>
        </Animated.View>
      ))}
    </Animated.View>
  );
}
