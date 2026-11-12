import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/** Пружины в духе iOS: мягкая для крупных движений и быстрая для отклика на нажатие. */
export const SPRING = { damping: 20, stiffness: 190, mass: 1 } as const;
export const SNAPPY = { damping: 16, stiffness: 420, mass: 0.6 } as const;
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

const canBuzz = Platform.OS === 'ios' || Platform.OS === 'android';

/** Тактильный отклик. В браузере ничего не делает. */
export const haptic = {
  select: () => canBuzz && void Haptics.selectionAsync().catch(() => {}),
  tap: () => canBuzz && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  press: () => canBuzz && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  heavy: () => canBuzz && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  success: () => canBuzz && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warn: () => canBuzz && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};

/** Появление снизу с затуханием; i — порядковый номер для каскада. */
export function enter(i = 0) {
  return FadeInDown.delay(Math.min(i, 8) * 55)
    .springify()
    .damping(18)
    .stiffness(160);
}

/** Обёртка, которая выезжает снизу при появлении. */
export function Appear({ i = 0, children, style }: { i?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={enter(i)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Нажимаемый элемент, который пружинисто сжимается под пальцем. */
export function PressScale(
  props: Omit<PressableProps, 'style' | 'children'> & {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Насколько сжимать: 0.96 — кнопки, 0.98 — крупные карточки. */
    scaleTo?: number;
    feedback?: keyof typeof haptic | null;
  },
) {
  const { children, style, scaleTo = 0.96, feedback = 'tap', onPress, onPressIn, onPressOut, disabled, ...rest } = props;
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, SNAPPY);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (feedback) haptic[feedback]();
        onPress?.(e);
      }}
    >
      <Animated.View style={[style, anim, disabled ? { opacity: 0.5 } : null]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Число, которое плавно «досчитывает» до нового значения. */
export function useCountUp(target: number, duration = 900): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);
  const from = useRef(reduce ? target : 0);
  useEffect(() => {
    if (reduce) {
      from.current = target;
      setValue(target);
      return;
    }
    const start = Date.now();
    const a = from.current;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(a + (target - a) * eased);
      from.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);
  return value;
}

/** Анимированная доля 0…1, которая заполняется при появлении и при смене значения. */
export function useFill(share: number, delay = 0) {
  const v = useSharedValue(0);
  useEffect(() => {
    const id = setTimeout(() => {
      v.value = withTiming(share, { duration: 800, easing: EASE_OUT });
    }, delay);
    return () => clearTimeout(id);
  }, [share, delay, v]);
  return v;
}
