import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { MIN, fmtDuration, fmtTime } from '../lib/types';
import { useStore } from '../store';
import { EASE_OUT, SNAPPY, SPRING, haptic } from '../ui/motion';
import { ROUNDED } from '../ui/kit';

const NIGHT = {
  top: '#05061A',
  bottom: '#1A1446',
  text: '#F4F3FF',
  dim: 'rgba(230,228,255,0.62)',
  chip: 'rgba(255,255,255,0.08)',
  chipEdge: 'rgba(255,255,255,0.12)',
  moon: '#F6E7B8',
  glow: '#8E84FF',
  heart: '#FF5C8A',
  mic: '#7FE0FF',
};

const BAND_STATUS = {
  off: 'не подключён',
  connecting: 'подключение…',
  connected: 'подключён',
  lost: 'переподключение…',
} as const;

/** Детерминированные «случайные» звёзды, чтобы небо не прыгало между перерисовками. */
function makeStars(count: number) {
  let s = 42;
  const r = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    x: r(),
    y: r() * 0.7,
    size: 1 + r() * 2.2,
    delay: r() * 3000,
    period: 1600 + r() * 2600,
  }));
}

function Star(props: { x: number; y: number; size: number; delay: number; period: number; reduce: boolean }) {
  const o = useSharedValue(0.5);
  useEffect(() => {
    if (props.reduce) return;
    o.value = withDelay(
      props.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: props.period, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.15, { duration: props.period, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(o);
  }, [o, props.delay, props.period, props.reduce]);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: 0.6 + o.value * 0.5 }] }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${props.x * 100}%`,
          top: `${props.y * 100}%`,
          width: props.size,
          height: props.size,
          borderRadius: props.size,
          backgroundColor: '#FFFFFF',
        },
        st,
      ]}
    />
  );
}

function Sky({ warm }: { warm: boolean }) {
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const stars = useMemo(() => makeStars(46), []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={NIGHT.top} />
            <Stop offset="1" stopColor={NIGHT.bottom} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#sky)" />
      </Svg>
      {warm ? (
        <Animated.View entering={FadeIn.duration(1800)} style={StyleSheet.absoluteFill}>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="dawn" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#2B2A6B" />
                <Stop offset="0.55" stopColor="#C2577A" />
                <Stop offset="1" stopColor="#FFB067" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={width} height={height} fill="url(#dawn)" />
          </Svg>
        </Animated.View>
      ) : null}
      {stars.map((st, i) => (
        <Star key={i} {...st} reduce={reduce} />
      ))}
    </View>
  );
}

/** Луна, которая медленно покачивается и «дышит» сиянием. */
function Moon() {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [t, reduce]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(t.value, [0, 1], [-6, 6]) }] }));
  const glow = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [0.45, 0.85]),
    transform: [{ scale: interpolate(t.value, [0, 1], [0.92, 1.08]) }],
  }));
  return (
    <Animated.View entering={FadeInDown.duration(900).springify().damping(18)} style={[{ width: 160, height: 160 }, float]}>
      <Animated.View style={[StyleSheet.absoluteFill, glow]}>
        <Svg width={160} height={160}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0.35" stopColor={NIGHT.glow} stopOpacity={0.55} />
              <Stop offset="1" stopColor={NIGHT.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={80} cy={80} r={80} fill="url(#glow)" />
        </Svg>
      </Animated.View>
      <Svg width={160} height={160} style={StyleSheet.absoluteFill}>
        <Path d="M104 98A34 34 0 0 1 62 56a34 34 0 1 0 42 42Z" fill={NIGHT.moon} />
        <Circle cx={68} cy={92} r={3.5} fill="#E6D39E" />
        <Circle cx={80} cy={106} r={2.4} fill="#E6D39E" />
      </Svg>
    </Animated.View>
  );
}

/** Солнце, встающее из-за горизонта, и расходящиеся волны вокруг часов. */
function Sunrise() {
  const { width } = useWindowDimensions();
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withTiming(1, { duration: 2400, easing: EASE_OUT });
  }, [rise]);
  const st = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(rise.value, [0, 1], [220, 0]) }],
    opacity: rise.value,
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', bottom: -120, left: width / 2 - 160 }, st]}>
      <Svg width={320} height={320}>
        <Defs>
          <RadialGradient id="sun" cx="50%" cy="50%" r="50%">
            <Stop offset="0.3" stopColor="#FFE3A3" stopOpacity={1} />
            <Stop offset="0.55" stopColor="#FFB86B" stopOpacity={0.7} />
            <Stop offset="1" stopColor="#FF8A5B" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={160} cy={160} r={160} fill="url(#sun)" />
      </Svg>
    </Animated.View>
  );
}

function Ripple({ delay }: { delay: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1));
    return () => cancelAnimation(p);
  }, [p, delay, reduce]);
  const st = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.2, 1], [0, 0.5, 0]),
    transform: [{ scale: interpolate(p.value, [0, 1], [0.6, 1.9]) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 2, borderColor: 'rgba(255,236,200,0.9)' },
        st,
      ]}
    />
  );
}

/** Часы с мигающим двоеточием. */
function Clock({ now, size }: { now: number; size: number }) {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  const tick = d.getSeconds() % 2 === 0;
  const style = { color: NIGHT.text, fontSize: size, fontWeight: '200' as const, letterSpacing: -2, ...ROUNDED };
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Сейчас ${fmtTime(now)}`}
      style={{ flexDirection: 'row', alignItems: 'center' }}
    >
      <Text style={style}>{pad(d.getHours())}</Text>
      <Text style={[style, { opacity: tick ? 1 : 0.25, marginHorizontal: 2, marginTop: -size * 0.08 }]}>:</Text>
      <Text style={style}>{pad(d.getMinutes())}</Text>
    </View>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
        backgroundColor: NIGHT.chip,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: NIGHT.chipEdge,
      }}
    >
      {children}
    </View>
  );
}

/** Сердце, которое бьётся с частотой пульса. */
function Heart({ bpm }: { bpm: number | null }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (!bpm || reduce) return;
    const beat = Math.max(300, 60_000 / bpm);
    s.value = withRepeat(
      withSequence(
        withTiming(1.28, { duration: beat * 0.14 }),
        withTiming(1, { duration: beat * 0.18 }),
        withTiming(1.14, { duration: beat * 0.12 }),
        withTiming(1, { duration: beat * 0.56 }),
      ),
      -1,
    );
    return () => cancelAnimation(s);
  }, [bpm, s, reduce]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={st}>
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.4 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 6 3.5 4.5 7.2C19.5 16.4 12 21 12 21Z" fill={NIGHT.heart} />
      </Svg>
    </Animated.View>
  );
}

/** Индикатор громкости: полоски, которые поднимаются вместе со звуком. */
function MicMeter({ db }: { db: number | null }) {
  const level = useSharedValue(0);
  useEffect(() => {
    const l = db == null ? 0 : Math.max(0, Math.min(1, (db + 60) / 45));
    level.value = withSpring(l, SNAPPY);
  }, [db, level]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 16 }}>
      {[0.35, 0.7, 1, 0.6, 0.3].map((k, i) => (
        <MicBar key={i} k={k} level={level} />
      ))}
    </View>
  );
}

function MicBar({ k, level }: { k: number; level: SharedValue<number> }) {
  const st = useAnimatedStyle(() => ({ height: 3 + 13 * Math.min(1, level.value * k * 1.4) }));
  return <Animated.View style={[{ width: 3, borderRadius: 2, backgroundColor: NIGHT.mic }, st]} />;
}

/**
 * Кнопка «удерживайте»: заливка растёт, пока палец на кнопке, и действие
 * срабатывает только по её завершении. Ночью так не выключить запись случайно.
 */
function HoldButton(props: { label: string; onDone: () => void; disabled?: boolean }) {
  const p = useSharedValue(0);
  const scale = useSharedValue(1);
  const [w, setW] = useState(0);
  const done = useRef(props.onDone);
  done.current = props.onDone;
  const finish = () => {
    haptic.success();
    done.current();
  };
  const HOLD = 1100;
  const fill = useAnimatedStyle(() => ({ width: w * p.value }));
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Отпустили раньше — заливка откатывается, и прерванная анимация не вызывает действие.
  const release = () => {
    p.value = withTiming(0, { duration: 260 });
    scale.value = withSpring(1, SPRING);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityHint="Нажмите и удерживайте"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => props.onDone()}
      disabled={props.disabled}
      onPressIn={() => {
        haptic.tap();
        scale.value = withSpring(0.97, SNAPPY);
        // Действие срабатывает ровно тогда, когда заливка дошла до конца.
        p.value = withTiming(1, { duration: HOLD, easing: Easing.linear }, (completed) => {
          if (completed) scheduleOnRN(finish);
        });
      }}
      onPressOut={release}
    >
      <Animated.View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={[
          {
            height: 60,
            borderRadius: 30,
            overflow: 'hidden',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(255,255,255,0.2)',
            opacity: props.disabled ? 0.5 : 1,
          },
          press,
        ]}
      >
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.22)' }, fill]} />
        <Text style={{ color: NIGHT.text, fontSize: 17, fontWeight: '600' }}>{props.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Крупная кнопка будильника, которая мягко пульсирует. */
function PulseButton(props: { label: string; onPress: () => void; disabled?: boolean }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [t, reduce]);
  const st = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * interpolate(t.value, [0, 1], [1, 1.035]) }],
    shadowOpacity: interpolate(t.value, [0, 1], [0.25, 0.55]),
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={props.disabled}
      onPressIn={() => (scale.value = withSpring(0.95, SNAPPY))}
      onPressOut={() => (scale.value = withSpring(1, SPRING))}
      onPress={() => {
        haptic.success();
        props.onPress();
      }}
    >
      <Animated.View
        style={[
          {
            height: 64,
            borderRadius: 32,
            backgroundColor: '#FFF4E2',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#FFB067',
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 0 },
          },
          st,
        ]}
      >
        <Text style={{ color: '#5A2A3A', fontSize: 18, fontWeight: '700' }}>{props.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Полноэкранный ночной режим: пока идёт трекинг и когда звонит будильник. */
export function NightScreen() {
  const { settings, tracking, stopSleep } = useStore();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const ringing = tracking.phase === 'ringing';

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (ringing) haptic.heavy();
  }, [ringing]);

  const stop = async () => {
    setBusy(true);
    try {
      await stopSleep();
    } finally {
      setBusy(false);
    }
  };

  const t = tracking.target;
  const slept = tracking.startedAt ? (now - tracking.startedAt) / MIN : 0;
  const clockSize = Math.min(96, width * 0.24);

  return (
    <Animated.View entering={FadeIn.duration(700)} exiting={FadeOut.duration(400)} style={StyleSheet.absoluteFill}>
      <Sky warm={ringing} />
      {ringing ? <Sunrise /> : null}
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20, paddingHorizontal: 24 }}>
        {ringing ? (
          <Animated.View key="ring" entering={FadeIn.duration(900)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ alignItems: 'center', justifyContent: 'center', width: 240, height: 240 }}>
              <Ripple delay={0} />
              <Ripple delay={800} />
              <Ripple delay={1600} />
              <Clock now={now} size={clockSize} />
            </View>
            <Animated.Text
              entering={FadeInDown.delay(300).springify()}
              style={{ color: NIGHT.text, fontSize: 30, fontWeight: '700', marginTop: 28 }}
            >
              Доброе утро
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(450).springify()}
              style={{ color: NIGHT.dim, fontSize: 15, marginTop: 8, textAlign: 'center' }}
            >
              {tracking.wokeBy === 'smart' ? 'Вы в лёгкой фазе сна — самое время вставать.' : 'Назначенное время будильника.'}
            </Animated.Text>
            {tracking.startedAt ? (
              <Animated.Text entering={FadeInDown.delay(600).springify()} style={{ color: NIGHT.dim, fontSize: 15, marginTop: 4 }}>
                Вы спали {fmtDuration(slept)}
              </Animated.Text>
            ) : null}
          </Animated.View>
        ) : (
          <Animated.View key="night" style={{ flex: 1, alignItems: 'center' }}>
            <Moon />
            <Animated.View entering={FadeInDown.delay(200).springify()} style={{ marginTop: 8 }}>
              <Clock now={now} size={clockSize} />
            </Animated.View>
            <Animated.Text
              entering={FadeInDown.delay(320).springify()}
              style={{ color: NIGHT.dim, fontSize: 15, textAlign: 'center', marginTop: 4 }}
            >
              {t ? `Будильник ${fmtTime(t - settings.windowMin * MIN)} – ${fmtTime(t)}` : 'Будильник выключен'}
            </Animated.Text>
            <Animated.View
              entering={FadeInDown.delay(440).springify()}
              style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 28 }}
            >
              <Chip>
                <Text style={{ color: NIGHT.dim, fontSize: 14 }}>
                  Сон с {tracking.startedAt ? fmtTime(tracking.startedAt) : '—'} · {fmtDuration(slept)}
                </Text>
              </Chip>
              {settings.bandId ? (
                <Chip>
                  <Heart bpm={tracking.hr} />
                  <Text style={{ color: NIGHT.text, fontSize: 14, fontWeight: '600', ...ROUNDED }}>
                    {tracking.hr ? `${tracking.hr} уд/мин` : BAND_STATUS[tracking.band]}
                  </Text>
                </Chip>
              ) : null}
              {tracking.micActive ? (
                <Chip>
                  <MicMeter db={tracking.db} />
                  <Text style={{ color: NIGHT.text, fontSize: 14, fontWeight: '600' }}>
                    {tracking.snoring ? 'слышен храп' : 'слушаю'}
                  </Text>
                </Chip>
              ) : null}
            </Animated.View>
            <View style={{ flex: 1 }} />
            <Animated.Text
              entering={FadeIn.delay(900).duration(800)}
              style={{ color: NIGHT.dim, fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: 16 }}
            >
              Не закрывайте приложение смахиванием. Экран можно заблокировать.
              {settings.motionEnabled ? ' Положите iPhone на матрас рядом с подушкой.' : ''}
            </Animated.Text>
          </Animated.View>
        )}
        <Animated.View entering={FadeInDown.delay(500).springify()} style={{ alignSelf: 'stretch' }}>
          {ringing ? (
            <PulseButton label="Выключить будильник" disabled={busy} onPress={() => void stop()} />
          ) : (
            <HoldButton label="Удерживайте — я проснулся" disabled={busy} onDone={() => void stop()} />
          )}
        </Animated.View>
      </View>
    </Animated.View>
  );
}
