import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import React from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Rect, Stop } from 'react-native-svg';
import { MIN, fmtTime, type SnoreEpisode, type Stage, type StageSegment } from '../lib/types';

/** Системные цвета iOS; фазы сна — как в приложении «Здоровье». */
const LIGHT = {
  dark: false,
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#000000',
  dim: '#6C6C70',
  line: '#E5E5EA',
  fill: '#EEEEF2',
  accent: '#007AFF',
  sleep: '#12A5B0',
  heart: '#FF2D55',
  good: '#34C759',
  warn: '#FF9500',
  bad: '#FF3B30',
  awake: '#FF6B4A',
  light: '#3F8CFF',
  deep: '#3634A3',
  rem: '#64C8FA',
  snore: '#FF2D55',
  glass: 'rgba(255,255,255,0.66)',
  glassEdge: 'rgba(255,255,255,0.9)',
};

const DARK: Palette = {
  dark: true,
  bg: '#000000',
  card: '#1C1C1E',
  text: '#FFFFFF',
  dim: '#98989F',
  line: '#2C2C2E',
  fill: '#2C2C2E',
  accent: '#0A84FF',
  sleep: '#5AD8E0',
  heart: '#FF375F',
  good: '#30D158',
  warn: '#FF9F0A',
  bad: '#FF453A',
  awake: '#FF7A5C',
  light: '#4C9BFF',
  deep: '#5E5CE6',
  rem: '#70D7FF',
  snore: '#FF375F',
  glass: 'rgba(58,58,62,0.6)',
  glassEdge: 'rgba(255,255,255,0.16)',
};

export type Palette = typeof LIGHT;

/** Скруглённый системный шрифт для чисел, как в «Здоровье». */
export const ROUNDED = Platform.OS === 'ios' ? { fontFamily: 'ui-rounded' } : {};

function makeStyles(c: Palette) {
  return StyleSheet.create({
    card: { backgroundColor: c.card, borderRadius: 24, padding: 16, marginBottom: 14 },
    title: { fontSize: 15, fontWeight: '700' },
    hint: { color: c.dim, fontSize: 13, lineHeight: 18 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      minHeight: 48,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.line,
    },
    rowLabel: { color: c.text, fontSize: 16 },
    btn: { borderRadius: 26, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 10 },
    btnText: { fontSize: 17, fontWeight: '600' },
    stepper: { flexDirection: 'row', backgroundColor: c.fill, borderRadius: 12, alignItems: 'center' },
    step: { width: 46, height: 38, alignItems: 'center', justifyContent: 'center' },
    stepText: { color: c.text, fontSize: 22, fontWeight: '500' },
    stepValue: { color: c.text, fontSize: 17, fontWeight: '600', minWidth: 76, textAlign: 'center', marginRight: 10, ...ROUNDED },
    barBg: { backgroundColor: c.fill, height: 8, borderRadius: 4, marginTop: 6, overflow: 'hidden' },
  });
}

const THEMES = {
  light: { c: LIGHT, s: makeStyles(LIGHT) },
  dark: { c: DARK, s: makeStyles(DARK) },
};

/** Цвета и стили под текущую тему iPhone (светлую или тёмную). */
export function useTheme() {
  return useColorScheme() === 'dark' ? THEMES.dark : THEMES.light;
}

export const STAGE_NAME: Record<Stage, string> = {
  awake: 'Бодрствование',
  light: 'Основной',
  deep: 'Глубокий',
  rem: 'REM',
};

export function scoreColor(score: number, c: Palette): string {
  return score >= 85 ? c.good : score >= 70 ? c.accent : score >= 50 ? c.warn : c.bad;
}

const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

/**
 * Поверхность Liquid Glass. На iOS 26 — настоящее системное стекло; на более
 * старых iOS и в браузере — полупрозрачная подложка с размытием.
 */
export function Glass(props: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: string;
  interactive?: boolean;
}) {
  const { c } = useTheme();
  if (GLASS) {
    return (
      <GlassView glassEffectStyle="regular" tintColor={props.tint} isInteractive={props.interactive} style={props.style}>
        {props.children}
      </GlassView>
    );
  }
  const web = Platform.OS === 'web' ? ({ backdropFilter: 'blur(22px) saturate(180%)' } as object) : null;
  return (
    <View
      style={[
        { backgroundColor: props.tint ?? c.glass, borderWidth: props.tint ? 0 : StyleSheet.hairlineWidth, borderColor: c.glassEdge },
        web,
        props.style,
      ]}
    >
      {props.children}
    </View>
  );
}

/** Значок SF Symbols; в браузере — запасной рисунок или ничего. */
export function Icon(props: { name: SFSymbol; color: string; size?: number; fallback?: React.ReactNode }) {
  const size = props.size ?? 18;
  return <SymbolView name={props.name} tintColor={props.color} size={size} fallback={props.fallback ?? null} />;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { s } = useTheme();
  return <View style={[s.card, style]}>{children}</View>;
}

/** Заголовок карточки: цветная подпись со значком, как в сводке «Здоровья». */
export function Title(props: { children: React.ReactNode; icon?: SFSymbol; color?: string }) {
  const { c, s } = useTheme();
  const color = props.color ?? c.sleep;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      {props.icon ? <Icon name={props.icon} color={color} size={17} /> : null}
      <Text style={[s.title, { color }]}>{props.children}</Text>
    </View>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  const { s } = useTheme();
  return <Text style={s.hint}>{children}</Text>;
}

/** Крупное значение с мелкими единицами: «7 ч 32 мин». Части чередуются: число, единица, число, единица. */
export function Big({ parts, size = 34 }: { parts: string[]; size?: number }) {
  const { c } = useTheme();
  return (
    <Text style={{ color: c.text, fontSize: size, fontWeight: '700', ...ROUNDED }}>
      {parts.map((p, i) =>
        i % 2 === 0 ? (
          p
        ) : (
          <Text key={i} style={{ color: c.dim, fontSize: size * 0.5, fontWeight: '600' }}>
            {` ${p} `}
          </Text>
        ),
      )}
    </Text>
  );
}

export function Button(props: { label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean }) {
  const { c, s } = useTheme();
  const kind = props.kind ?? 'primary';
  const tint = kind === 'primary' ? c.accent : kind === 'danger' ? c.bad : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => (pressed || props.disabled ? { opacity: 0.55 } : null)}
    >
      <Glass interactive tint={tint} style={[s.btn, !tint && !GLASS && { backgroundColor: c.fill, borderWidth: 0 }]}>
        <Text style={[s.btnText, { color: tint ? '#FFFFFF' : c.accent }]}>{props.label}</Text>
      </Glass>
    </Pressable>
  );
}

export function ToggleRow(props: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { s } = useTheme();
  return (
    <View style={s.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={s.rowLabel}>{props.label}</Text>
        {props.hint ? <Text style={s.hint}>{props.hint}</Text> : null}
      </View>
      <Switch value={props.value} onValueChange={props.onChange} />
    </View>
  );
}

export function Stepper(props: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  const { c, s } = useTheme();
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { flex: 1 }]}>{props.label}</Text>
      <Text style={s.stepValue}>{props.value}</Text>
      <View style={s.stepper}>
        <Pressable accessibilityLabel={`${props.label}: меньше`} onPress={props.onMinus} style={s.step}>
          <Text style={s.stepText}>−</Text>
        </Pressable>
        <View style={{ width: StyleSheet.hairlineWidth, height: 20, backgroundColor: c.dim }} />
        <Pressable accessibilityLabel={`${props.label}: больше`} onPress={props.onPlus} style={s.step}>
          <Text style={s.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ScoreRing({ score, size = 190 }: { score: number; size?: number }) {
  const { c } = useTheme();
  const stroke = size * 0.11;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const color = scoreColor(score, c);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeOpacity={0.18} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${(len * score) / 100} ${len}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ color: c.text, fontSize: size * 0.34, fontWeight: '700', ...ROUNDED }}>{score}</Text>
      <Text style={{ color: c.dim, fontSize: size * 0.075, fontWeight: '600', marginTop: -4 }}>из 100</Text>
    </View>
  );
}

/** Мягкая цветная заливка вверху экрана, как в сводке «Здоровья». */
export function TopWash({ width, color }: { width: number; color: string }) {
  const { c } = useTheme();
  return (
    <Svg width={width} height={340} style={{ position: 'absolute', top: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={c.dark ? 0.38 : 0.3} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={340} fill="url(#wash)" />
    </Svg>
  );
}

const ORDER: Stage[] = ['awake', 'rem', 'light', 'deep'];

/** График фаз, как в «Здоровье»: строка на фазу, сверху бодрствование; розовая полоса внизу — храп. */
export function Hypnogram(props: { segments: StageSegment[]; snore?: SnoreEpisode[]; width: number }) {
  const { c, s } = useTheme();
  const { segments, snore, width } = props;
  if (!segments.length) return null;
  const from = segments[0].start;
  const to = segments[segments.length - 1].end;
  const span = Math.max(MIN, to - from);
  const rowH = 26;
  const x = (t: number) => ((t - from) / span) * width;
  return (
    <View>
      <Svg width={width} height={rowH * 4 + 12}>
        {ORDER.map((_, i) => (
          <Line key={i} x1={0} x2={width} y1={(i + 1) * rowH} y2={(i + 1) * rowH} stroke={c.line} strokeWidth={1} />
        ))}
        {segments.map((seg, i) => (
          <Rect
            key={i}
            x={x(seg.start)}
            y={ORDER.indexOf(seg.stage) * rowH + 4}
            width={Math.max(2, x(seg.end) - x(seg.start))}
            height={rowH - 8}
            rx={5}
            fill={c[seg.stage]}
          />
        ))}
        {(snore ?? []).map((e, i) => (
          <Rect key={`s${i}`} x={x(e.start)} y={rowH * 4 + 6} width={Math.max(3, x(e.end) - x(e.start))} height={4} rx={2} fill={c.snore} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={s.hint}>{fmtTime(from)}</Text>
        <Text style={s.hint}>{fmtTime(to)}</Text>
      </View>
    </View>
  );
}

export function StageBar(props: { stage: Stage; minutes: number; total: number }) {
  const { c, s } = useTheme();
  const share = props.total > 0 ? props.minutes / props.total : 0;
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c[props.stage], marginRight: 8 }} />
        <Text style={[s.rowLabel, { flex: 1 }]}>{STAGE_NAME[props.stage]}</Text>
        <Text style={[s.hint, ROUNDED]}>
          {Math.floor(props.minutes / 60)} ч {props.minutes % 60} мин · {Math.round(share * 100)}%
        </Text>
      </View>
      <View style={s.barBg}>
        <View style={{ width: `${Math.round(share * 100)}%`, backgroundColor: c[props.stage], height: 8, borderRadius: 4 }} />
      </View>
    </View>
  );
}

/** Запасные значки вкладок для браузера, где нет SF Symbols. */
export function TabGlyph({ id, color }: { id: string; color: string }) {
  const p = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {id === 'today' ? <Path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" {...p} fill={color} /> : null}
      {id === 'sleep' ? (
        <>
          <Circle cx={12} cy={13} r={7.5} {...p} />
          <Path d="M12 9v4l2.5 2M5 4 3 6M19 4l2 2" {...p} />
        </>
      ) : null}
      {id === 'history' ? <Path d="M5 20v-7M12 20V5M19 20v-10" {...p} strokeWidth={3.5} /> : null}
      {id === 'settings' ? (
        <>
          <Circle cx={12} cy={12} r={3} {...p} />
          <Path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" {...p} />
        </>
      ) : null}
    </Svg>
  );
}
