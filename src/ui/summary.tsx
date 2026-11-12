import type { SFSymbol } from 'expo-symbols';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { Stage, StageSegment } from '../lib/types';
import { Icon, useTheme } from './kit';
import { PressScale, enter, useFill } from './motion';

/** Шеврон «›» как в списках iOS. */
export function Chevron({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size * 0.6} height={size} viewBox="0 0 8 13">
      <Path d="M1.5 1.5 6.5 6.5l-5 5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Заголовок раздела: «Последняя ночь» слева, ссылка справа — как «Закреплено · Изменить». */
export function SectionHeader(props: { title: string; action?: string; onAction?: () => void; i?: number }) {
  const { c } = useTheme();
  return (
    <Animated.View
      entering={enter(props.i ?? 0)}
      style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6, marginBottom: 10, paddingHorizontal: 4 }}
    >
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>
        {props.title}
      </Text>
      {props.action ? (
        <PressScale accessibilityLabel={props.action} onPress={props.onAction} scaleTo={0.9}>
          <Text style={{ color: c.accent, fontSize: 17 }}>{props.action}</Text>
        </PressScale>
      ) : null}
    </Animated.View>
  );
}

/**
 * Карточка сводки в духе «Здоровья»: сверху цветной значок с названием и время с шевроном,
 * снизу крупное значение слева и маленький график справа.
 */
export function SummaryCard(props: {
  icon: SFSymbol;
  title: string;
  color: string;
  time?: string;
  onPress?: () => void;
  accessory?: React.ReactNode;
  children: React.ReactNode;
  i?: number;
}) {
  const { c } = useTheme();
  const body = (
    <View style={[styles.card, { backgroundColor: c.card }]}>
      <View style={styles.head}>
        <Icon name={props.icon} color={props.color} size={17} />
        <Text style={[styles.title, { color: props.color }]} numberOfLines={1}>
          {props.title}
        </Text>
        {props.time ? <Text style={[styles.time, { color: c.dim }]}>{props.time}</Text> : null}
        {props.onPress ? <Chevron color={c.dim} /> : null}
      </View>
      <View style={styles.bottom}>
        <View style={{ flex: 1, paddingRight: 8 }}>{props.children}</View>
        {props.accessory}
      </View>
    </View>
  );
  return (
    <Animated.View entering={enter(props.i ?? 0)} style={{ marginBottom: 12 }}>
      {props.onPress ? (
        <PressScale accessibilityLabel={props.title} scaleTo={0.97} onPress={props.onPress}>
          {body}
        </PressScale>
      ) : (
        body
      )}
    </Animated.View>
  );
}

/** Крупное значение: число жирное, единицы мелкие и серые — «2 114 шагов». */
export function Value({ parts, sub, color }: { parts: string[]; sub?: string; color?: string }) {
  const { c } = useTheme();
  return (
    <View>
      <Text style={{ color: color ?? c.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.4 }} numberOfLines={1} adjustsFontSizeToFit>
        {parts.map((p, i) =>
          i % 2 === 0 ? (
            p
          ) : (
            <Text key={i} style={{ color: c.dim, fontSize: 17, fontWeight: '600', letterSpacing: 0 }}>
              {` ${p}${i < parts.length - 1 ? ' ' : ''}`}
            </Text>
          ),
        )}
      </Text>
      {sub ? (
        <Text style={{ color: c.dim, fontSize: 15, marginTop: 2 }} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return <Text style={{ color: c.dim, fontSize: 15, fontWeight: '600', marginBottom: 2 }}>{children}</Text>;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Маленькое кольцо, как кольца активности. */
export function MiniRing({ share, color, size = 54 }: { share: number; color: string; size?: number }) {
  const stroke = size * 0.2;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const p = useFill(share, 250);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r * 0.82} stroke={color} strokeOpacity={0.25} strokeWidth={stroke * 0.8} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r * 0.82}
          stroke={color}
          strokeWidth={stroke * 0.8}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${len} ${len}`}
          animatedProps={arc}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}

function Bar({ h, color, i, w }: { h: number; color: string; i: number; w: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(200 + i * 50, withSpring(h, { damping: 15, stiffness: 150 }));
  }, [h, i, v]);
  const st = useAnimatedStyle(() => ({ height: v.value }));
  return <Animated.View style={[{ width: w, borderRadius: 2, backgroundColor: color }, st]} />;
}

/** Столбики за неделю: серые, последний — цветной, как «Шаги» в «Здоровье». */
export function MiniBars({ values, color, height = 52 }: { values: number[]; color: string; height?: number }) {
  const { c } = useTheme();
  const max = Math.max(1, ...values);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height }}>
      {values.map((v, i) => (
        <Bar key={i} i={i} w={9} h={Math.max(4, (v / max) * height)} color={i === values.length - 1 ? color : c.fill} />
      ))}
    </View>
  );
}

/** Точки по ночам, последняя — цветная, как «Пульс» в «Здоровье». */
export function MiniDots({ values, color, height = 48 }: { values: number[]; color: string; height?: number }) {
  const { c } = useTheme();
  const lo = Math.min(...values) - 3;
  const hi = Math.max(...values) + 3;
  const w = values.length * 9;
  return (
    <Svg width={w} height={height}>
      {values.map((v, i) => {
        const y = height - 4 - ((v - lo) / Math.max(1, hi - lo)) * (height - 8);
        const last = i === values.length - 1;
        return <Rect key={i} x={i * 9 + 1} y={y - 3} width={6} height={6} rx={3} fill={last ? color : c.dim} fillOpacity={last ? 1 : 0.35} />;
      })}
    </Svg>
  );
}

const ROWS: Stage[] = ['awake', 'rem', 'light', 'deep'];

/** Миниатюра графика фаз. */
export function MiniStages({ segments, width = 112, height = 48 }: { segments: StageSegment[]; width?: number; height?: number }) {
  const { c } = useTheme();
  if (!segments.length) return null;
  const from = segments[0].start;
  const span = Math.max(1, segments[segments.length - 1].end - from);
  const rowH = height / 4;
  return (
    <Svg width={width} height={height}>
      {segments.map((s, i) => (
        <Rect
          key={i}
          x={((s.start - from) / span) * width}
          y={ROWS.indexOf(s.stage) * rowH + 1.5}
          width={Math.max(1.5, ((s.end - s.start) / span) * width)}
          height={rowH - 3}
          rx={2}
          fill={c[s.stage]}
        />
      ))}
    </Svg>
  );
}

/** Круглая кнопка профиля в правом верхнем углу. */
export function ProfileButton({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressScale accessibilityLabel="Настройки" onPress={onPress} scaleTo={0.9}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: c.dark ? '#3A3A6E' : '#D9D6FF',
          borderWidth: 2,
          borderColor: c.dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={40} height={40} viewBox="0 0 40 40">
          <Circle cx={20} cy={16} r={7} fill={c.dark ? '#B9B4FF' : '#6C63D9'} />
          <Path d="M6 38c1.5-7.5 7-11 14-11s12.5 3.5 14 11Z" fill={c.dark ? '#B9B4FF' : '#6C63D9'} />
        </Svg>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, minHeight: 132 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 16, fontWeight: '600' },
  time: { fontSize: 14, marginRight: 4 },
  bottom: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', marginTop: 22 },
});
