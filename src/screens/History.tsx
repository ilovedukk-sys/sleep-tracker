import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fmtDuration, type Night } from '../lib/types';
import { useStore } from '../store';
import { Button, Card, Hint, ROUNDED, Title, scoreColor, useTheme } from '../ui/kit';
import { NightDetails } from './Today';

const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function dateLabel(night: Night): string {
  const d = new Date(night.wake);
  return `${DAYS[d.getDay()]}, ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function History({ width }: { width: number }) {
  const { nights } = useStore();
  const { c: C, s } = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = nights.find((n) => n.id === openId);

  if (open) {
    return (
      <>
        <Button kind="ghost" label={`← Назад · ${dateLabel(open)}`} onPress={() => setOpenId(null)} />
        <View style={{ height: 12 }} />
        <NightDetails night={open} width={width} />
      </>
    );
  }
  if (!nights.length) {
    return (
      <Card>
        <Title icon="chart.bar.fill">История пуста</Title>
        <Hint>Здесь появятся ваши ночи.</Hint>
      </Card>
    );
  }

  const week = nights.slice(0, 7).reverse();
  const avg = Math.round(week.reduce((a, n) => a + n.score.total, 0) / week.length);
  const avgSleep = week.reduce((a, n) => a + n.score.sleepMin, 0) / week.length;

  return (
    <>
      <Card>
        <Title icon="chart.bar.fill">Последние {week.length} ноч.</Title>
        <Hint>
          Средняя оценка {avg} · средний сон {fmtDuration(avgSleep)}
        </Hint>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, marginTop: 14, gap: 8 }}>
          {week.map((n) => (
            <View key={n.id} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[s.hint, { marginBottom: 4 }]}>{n.score.total}</Text>
              <View
                style={{
                  width: '100%',
                  height: Math.max(4, n.score.total * 0.8),
                  backgroundColor: scoreColor(n.score.total, C),
                  borderRadius: 7,
                }}
              />
              <Text style={[s.hint, { marginTop: 4 }]}>{DAYS[new Date(n.wake).getDay()]}</Text>
            </View>
          ))}
        </View>
      </Card>
      {nights.map((n) => (
        <Pressable key={n.id} accessibilityRole="button" onPress={() => setOpenId(n.id)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{dateLabel(n)}</Text>
              <Hint>
                {fmtDuration(n.score.sleepMin)}
                {n.snore ? ` · храп ${Math.round(n.snore.totalMin)} мин` : ''}
              </Hint>
            </View>
            <Text style={{ color: scoreColor(n.score.total, C), fontSize: 28, fontWeight: '700', ...ROUNDED }}>{n.score.total}</Text>
            <Text style={{ color: C.dim, fontSize: 22, marginLeft: 10 }}>›</Text>
          </Card>
        </Pressable>
      ))}
    </>
  );
}
