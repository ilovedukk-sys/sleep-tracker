import type { SFSymbol } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { History } from './src/screens/History';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { Sleep } from './src/screens/Sleep';
import { Today } from './src/screens/Today';
import { StoreProvider, useStore } from './src/store';
import { Button, Card, Glass, Hint, Icon, TabGlyph, TopWash, useTheme } from './src/ui/kit';

const TABS: { id: TabId; label: string; icon: SFSymbol }[] = [
  { id: 'today', label: 'Сегодня', icon: 'moon.stars.fill' },
  { id: 'sleep', label: 'Сон', icon: 'alarm.fill' },
  { id: 'history', label: 'История', icon: 'chart.bar.fill' },
  { id: 'settings', label: 'Настройки', icon: 'gearshape.fill' },
];
type TabId = 'today' | 'sleep' | 'history' | 'settings';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

function Shell() {
  const { c } = useTheme();
  const { ready, tracking, message, dismissMessage } = useStore();
  const [tab, setTab] = useState<TabId>('today');
  const dims = useWindowDimensions();
  const width = Math.min(dims.width, 520);
  // Пока идёт ночь или звонит будильник, показываем экран сна.
  const active: TabId = tracking.phase === 'idle' ? tab : 'sleep';
  const top = Platform.OS === 'ios' ? 64 : 28;
  const bottom = Platform.OS === 'ios' ? 28 : 14;
  const now = new Date();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center' }}>
      <StatusBar style="auto" />
      <View style={{ flex: 1, width }}>
        <TopWash width={width} color={active === 'settings' ? c.dim : c.sleep} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: top, paddingBottom: 120 }}>
          <Text style={{ color: c.dim, fontSize: 13, fontWeight: '600', textTransform: 'uppercase' }}>
            {WEEKDAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}
          </Text>
          <Text style={{ color: c.text, fontSize: 34, fontWeight: '800', marginBottom: 16 }}>
            {TABS.find((t) => t.id === active)?.label}
          </Text>
          {message ? (
            <Card>
              <Hint>{message}</Hint>
              <Button kind="ghost" label="Понятно" onPress={dismissMessage} />
            </Card>
          ) : null}
          {!ready ? null : active === 'today' ? (
            <Today width={width} />
          ) : active === 'sleep' ? (
            <Sleep />
          ) : active === 'history' ? (
            <History width={width} />
          ) : (
            <SettingsScreen />
          )}
        </ScrollView>

        {tracking.phase === 'idle' ? (
          // Плавающая стеклянная панель вкладок: содержимое прокручивается под ней.
          <View style={{ position: 'absolute', left: 20, right: 20, bottom }}>
            <Glass
              style={{
                flexDirection: 'row',
                borderRadius: 34,
                padding: 5,
                shadowColor: '#000',
                shadowOpacity: 0.14,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              {TABS.map((t) => {
                const on = t.id === active;
                const color = on ? c.accent : c.dim;
                return (
                  <Pressable
                    key={t.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => setTab(t.id)}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: on ? (c.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)') : 'transparent',
                    }}
                  >
                    <Icon name={t.icon} color={color} size={24} fallback={<TabGlyph id={t.id} color={color} />} />
                    <Text style={{ color, fontSize: 10, fontWeight: '600', marginTop: 2 }}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </Glass>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
