import type { SFSymbol } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOutUp,
  SlideInDown,
  SlideInUp,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { History } from './src/screens/History';
import { NightScreen } from './src/screens/NightScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { Sleep } from './src/screens/Sleep';
import { Today } from './src/screens/Today';
import { StoreProvider, useStore } from './src/store';
import { Glass, Hint, Icon, TabGlyph, TopWash, WASH, useTheme } from './src/ui/kit';
import { ProfileButton } from './src/ui/summary';
import { PressScale, SNAPPY, SPRING, haptic } from './src/ui/motion';

const TABS: { id: TabId; label: string; icon: SFSymbol }[] = [
  { id: 'today', label: 'Сводка', icon: 'moon.stars.fill' },
  { id: 'sleep', label: 'Сон', icon: 'alarm.fill' },
  { id: 'history', label: 'История', icon: 'chart.bar.fill' },
];
type TabId = 'today' | 'sleep' | 'history';


/** Кнопка вкладки: значок подпрыгивает, когда вкладку выбирают. */
function TabButton(props: { tab: (typeof TABS)[number]; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const bounce = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (props.on) bounce.value = withSequence(withTiming(0.8, { duration: 90 }), withSpring(1, { damping: 7, stiffness: 260 }));
  }, [props.on, bounce]);
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: bounce.value }] }));
  const color = props.on ? c.accent : c.dim;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={props.tab.label}
      accessibilityState={{ selected: props.on }}
      onPress={props.onPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 56 }}
    >
      <Animated.View style={icon}>
        <Icon name={props.tab.icon} color={color} size={24} fallback={<TabGlyph id={props.tab.id} color={color} />} />
      </Animated.View>
      <Text style={{ color, fontSize: 10, fontWeight: '600', marginTop: 2 }}>{props.tab.label}</Text>
    </Pressable>
  );
}

/** Плавающая стеклянная панель вкладок с подсветкой, которая переезжает на пружине. */
function TabBar(props: { active: TabId; onSelect: (id: TabId) => void; bottom: number; width: number }) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const idx = TABS.findIndex((t) => t.id === props.active);
  const x = useSharedValue(0);
  const stretch = useSharedValue(1);
  const tabW = (w - 10) / TABS.length;
  useEffect(() => {
    if (!w) return;
    x.value = withSpring(idx * tabW, SPRING);
    stretch.value = withSequence(withTiming(1.18, { duration: 110 }), withSpring(1, SNAPPY));
  }, [idx, tabW, w, x, stretch]);
  const pill = useAnimatedStyle(() => ({
    width: tabW,
    transform: [{ translateX: x.value }, { scaleX: stretch.value }],
  }));
  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18).stiffness(160)}
      style={{ position: 'absolute', left: 0, right: 0, bottom: props.bottom, alignItems: 'center' }}
    >
      <View style={{ width: props.width }}>
      <Glass
        style={{
          borderRadius: 34,
          padding: 5,
          shadowColor: '#000',
          shadowOpacity: 0.14,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        <View accessibilityRole="tablist" style={{ flexDirection: 'row' }} onLayout={(e) => setW(e.nativeEvent.layout.width + 10)}>
          {w ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  borderRadius: 28,
                  backgroundColor: c.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)',
                },
                pill,
              ]}
            />
          ) : null}
          {TABS.map((t) => (
            <TabButton key={t.id} tab={t} on={t.id === props.active} onPress={() => props.onSelect(t.id)} />
          ))}
        </View>
      </Glass>
      </View>
    </Animated.View>
  );
}

/** Настройки — системным листом снизу, как профиль в «Здоровье». Смахивается вниз. */
function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const { message, dismissMessage } = useStore();
  const insets = useSafeAreaInsets();
  const sheet = Platform.OS === 'ios';
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ paddingTop: sheet ? 14 : insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }} />
          <Text accessibilityRole="header" style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>
            Настройки
          </Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <PressScale accessibilityLabel="Готово" onPress={onClose} scaleTo={0.9}>
              <Text style={{ color: c.accent, fontSize: 17, fontWeight: '600' }}>Готово</Text>
            </PressScale>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
          <SettingsScreen />
        </ScrollView>
        {message ? <Toast text={message} onClose={dismissMessage} top={sheet ? 8 : insets.top + 6} /> : null}
      </View>
    </Modal>
  );
}

/** Сообщение, которое выезжает сверху и само исчезает через несколько секунд. */
function Toast({ text, onClose, top }: { text: string; onClose: () => void; top: number }) {
  const { c } = useTheme();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    haptic.warn();
    const id = setTimeout(() => close.current(), 9000);
    return () => clearTimeout(id);
  }, [text]);
  return (
    <Animated.View
      key={text}
      entering={SlideInUp.springify().damping(18)}
      exiting={FadeOutUp.duration(220)}
      style={{ position: 'absolute', top, left: 12, right: 12, zIndex: 20 }}
    >
      <PressScale accessibilityRole="alert" accessibilityHint="Нажмите, чтобы скрыть" scaleTo={0.98} onPress={onClose}>
        <Glass
          style={{
            borderRadius: 22,
            padding: 14,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          <Icon name="info.circle.fill" color={c.accent} size={22} />
          <View style={{ flex: 1 }}>
            <Hint style={{ color: c.text, fontSize: 14 }}>{text}</Hint>
          </View>
          <Text style={{ color: c.accent, fontSize: 15, fontWeight: '600' }}>Ок</Text>
        </Glass>
      </PressScale>
    </Animated.View>
  );
}

function Shell() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, tracking, message, dismissMessage, settings, syncHealth } = useStore();
  const [tab, setTab] = useState<TabId>('today');
  const [dir, setDir] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dims = useWindowDimensions();
  const width = Math.min(dims.width, 520);
  const night = tracking.phase !== 'idle';
  const active = tab;
  const title = TABS.find((t) => t.id === active)?.label ?? '';

  const scroller = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);

  // Утром, когда ночь закончилась, сразу показываем её оценку. Экран создаётся
  // заново и открывается с самого верха, поэтому и шапку возвращаем в начало.
  const wasNight = useRef(night);
  useEffect(() => {
    if (night) scrollY.value = 0;
    if (wasNight.current && !night) {
      setDir(-1);
      setTab('today');
    }
    wasNight.current = night;
  }, [night, scrollY]);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const toTop = () => scroller.current?.scrollTo({ y: 0, animated: false });

  const select = (id: TabId) => {
    if (id === tab) {
      // Повторное нажатие на вкладку — прокрутка наверх, как в iOS.
      scroller.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    haptic.select();
    setDir(TABS.findIndex((t) => t.id === id) > TABS.findIndex((t) => t.id === tab) ? 1 : -1);
    setTab(id);
    toTop();
  };

  // Компактная шапка проявляется, когда крупный заголовок уезжает под неё.
  const compact = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [30, 60], [0, 1], 'clamp'),
  }));
  const compactTitle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [30, 70], [8, 0], 'clamp') }],
  }));
  // Крупный заголовок: при оттягивании вниз чуть увеличивается, при прокрутке гаснет.
  const large = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 45], [1, 0], 'clamp'),
    transform: [
      { translateX: interpolate(scrollY.value, [-120, 0], [14, 0], 'clamp') },
      { scale: interpolate(scrollY.value, [-120, 0], [1.12, 1], 'clamp') },
    ],
  }));

  const refresh = async () => {
    setRefreshing(true);
    try {
      await syncHealth();
    } finally {
      setRefreshing(false);
    }
  };

  const enterScreen = (dir > 0 ? FadeInRight : FadeInLeft).springify().damping(20).stiffness(180);

  return (
    <View style={{ flex: 1, backgroundColor: night ? '#05061A' : c.bg, alignItems: 'center' }}>
      <StatusBar style={night ? 'light' : 'auto'} animated />
      {night ? (
        <NightScreen />
      ) : (
        <Animated.View entering={FadeIn.duration(500)} style={{ flex: 1, width }}>
          <TopWash width={width} colors={WASH[active]} scrollY={scrollY} />
          <Animated.ScrollView
            ref={scroller}
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ padding: 16, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 120 }}
            refreshControl={
              active === 'today' && settings.healthRead ? (
                <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.sleep} progressViewOffset={insets.top} />
              ) : undefined
            }
          >
            <Animated.View style={[{ transformOrigin: 'left center' }, large]}>
              <View style={{ alignItems: 'flex-end', marginBottom: 6 }}>
                <ProfileButton
                  onPress={() => {
                    haptic.tap();
                    setSettingsOpen(true);
                  }}
                />
              </View>
              <Animated.Text
                key={active}
                entering={FadeIn.duration(250)}
                accessibilityRole="header"
                style={{ color: c.text, fontSize: 34, fontWeight: '800', letterSpacing: 0.3, marginBottom: 14, marginLeft: 4 }}
              >
                {title}
              </Animated.Text>
            </Animated.View>
            {ready ? (
              <Animated.View key={active} entering={enterScreen}>
                {active === 'today' ? (
                  <Today width={width} onNavigate={toTop} goTo={select} />
                ) : active === 'sleep' ? (
                  <Sleep />
                ) : (
                  <History width={width} onNavigate={toTop} />
                )}
              </Animated.View>
            ) : null}
          </Animated.ScrollView>

          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 44 }, compact]}
          >
            <Glass style={[StyleSheet.absoluteFill, { borderWidth: 0, borderRadius: 0 }]} />
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />
            <Animated.Text
              style={[
                { position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', color: c.text, fontSize: 17, fontWeight: '600' },
                compactTitle,
              ]}
            >
              {title}
            </Animated.Text>
          </Animated.View>

          {message ? <Toast text={message} onClose={dismissMessage} top={insets.top + 6} /> : null}

          <TabBar active={active} onSelect={select} bottom={Math.max(insets.bottom, 14)} width={Math.min(width - 72, 320)} />
          <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </Animated.View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
