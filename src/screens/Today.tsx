import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { nextAlarmTime } from '../lib/smartAlarm';
import { MIN, dayId, fmtDuration, fmtTime, type Night } from '../lib/types';
import { useStore } from '../store';
import { Big, Button, Card, Hint, Hypnogram, ROUNDED, ScoreRing, StageBar, Title, scoreColor, useTheme } from '../ui/kit';
import { Label, MiniBars, MiniDots, MiniRing, MiniStages, SectionHeader, SummaryCard, Value } from '../ui/summary';
import { Detail, dateLabel } from './History';

const SOURCE: Record<Night['source'], string> = {
  health: 'Браслет через «Здоровье»',
  band: 'Свой трекинг с пульсом браслета',
  phone: 'Свой трекинг телефоном',
};

const WOKE: Record<NonNullable<Night['wokeBy']>, string> = {
  smart: 'Умный будильник, лёгкая фаза',
  deadline: 'Будильник в назначенное время',
  manual: 'Проснулись сами',
};

export function NightDetails({ night, width }: { night: Night; width: number }) {
  const { c } = useTheme();
  const sc = night.score;
  return (
    <>
      <Card i={0} style={{ alignItems: 'center', paddingVertical: 22 }}>
        <ScoreRing score={sc.total} />
        <Text style={{ color: scoreColor(sc.total, c), fontSize: 22, fontWeight: '700', marginTop: 14 }}>{sc.label}</Text>
        <Hint>{SOURCE[night.source]}</Hint>
      </Card>

      <View style={{ flexDirection: 'row', gap: 14 }}>
        <Card i={1} style={{ flex: 1 }}>
          <Title icon="bed.double.fill">Время сна</Title>
          <Big size={30} parts={[String(Math.floor(sc.sleepMin / 60)), 'ч', String(sc.sleepMin % 60), 'мин']} />
          <Hint>
            {fmtTime(night.bedtime)} – {fmtTime(night.wake)}
          </Hint>
        </Card>
        {night.hr ? (
          <Card i={2} style={{ flex: 1 }}>
            <Title icon="heart.fill" color={c.heart}>
              Пульс во сне
            </Title>
            <Big size={30} parts={[String(night.hr.avg), 'уд/мин']} />
            <Hint>минимум {night.hr.min}</Hint>
          </Card>
        ) : null}
      </View>

      <Card i={3}>
        <Title icon="chart.bar.xaxis">Фазы сна</Title>
        <Hypnogram segments={night.segments} snore={night.snore?.episodes} width={width - 64} />
        <StageBar stage="awake" minutes={sc.awakeMin} total={sc.inBedMin} />
        {sc.hasStages ? (
          <>
            <StageBar stage="rem" minutes={sc.remMin} total={sc.inBedMin} delay={120} />
            <StageBar stage="light" minutes={sc.lightMin} total={sc.inBedMin} delay={240} />
            <StageBar stage="deep" minutes={sc.deepMin} total={sc.inBedMin} delay={360} />
          </>
        ) : (
          <StageBar stage="light" minutes={sc.sleepMin} total={sc.inBedMin} delay={120} />
        )}
        {night.source !== 'health' ? (
          <View style={{ marginTop: 12 }}>
            <Hint>
              {sc.hasStages
                ? 'Фазы оценены приложением по пульсу и движениям — это приближение.'
                : 'Без пульса браслета фазы не различаются: видно только сон и пробуждения.'}
            </Hint>
          </View>
        ) : null}
      </Card>

      <Card i={4}>
        <Title icon="star.fill" color={c.warn}>
          Из чего сложилась оценка
        </Title>
        <Line label="Длительность" value={sc.parts.duration} max={40} />
        <Line label="Эффективность" value={sc.parts.efficiency} max={20} />
        {sc.hasStages ? (
          <>
            <Line label="Глубокий сон" value={sc.parts.deep} max={15} />
            <Line label="REM" value={sc.parts.rem} max={15} />
          </>
        ) : null}
        <Line label={`Непрерывность · пробуждений: ${sc.awakenings}`} value={sc.parts.continuity} max={10} />
        {night.snore ? <Line label="Храп" value={-sc.parts.snorePenalty} /> : null}
        {!sc.hasStages ? <Hint>Фазы неизвестны, поэтому сумма приведена к шкале 100.</Hint> : null}
      </Card>

      <Card i={5}>
        <Title icon="waveform" color={c.snore}>
          Храп и пробуждение
        </Title>
        {night.snore ? (
          <Line label="Храп" text={`${fmtDuration(night.snore.totalMin)} · эпизодов: ${night.snore.episodes.length}`} />
        ) : (
          <Line label="Храп" text="не отслеживался" />
        )}
        {night.wokeBy ? <Line label="Пробуждение" text={WOKE[night.wokeBy]} /> : null}
        {night.exportedToHealth ? <Line label="«Здоровье»" text="ночь записана" /> : null}
      </Card>
    </>
  );
}

function Line(props: { label: string; value?: number; max?: number; text?: string }) {
  const { c, s } = useTheme();
  return (
    <View style={[s.row, { minHeight: 44 }]}>
      <Text style={[s.rowLabel, { flex: 1, paddingRight: 8 }]}>{props.label}</Text>
      {props.text != null ? (
        <Text style={[s.hint, { maxWidth: '58%', textAlign: 'right', fontSize: 15 }]}>{props.text}</Text>
      ) : (
        <Text style={{ color: c.text, fontSize: 17, fontWeight: '600', ...ROUNDED }}>
          {props.value}
          {props.max != null ? <Text style={{ color: c.dim, fontSize: 13, fontWeight: '500' }}>{` из ${props.max}`}</Text> : null}
        </Text>
      )}
    </View>
  );
}

const h = (min: number) => String(Math.floor(Math.round(min) / 60));
const m = (min: number) => String(Math.round(min) % 60);

/** Время на карточке: для сегодняшней ночи — час пробуждения, для прошлых — дата. */
function stamp(night: Night): string {
  return night.id === dayId(Date.now()) ? fmtTime(night.wake) : dateLabel(night);
}

/** «Сводка» в духе «Здоровья»: карточки последней ночи и будильника. */
export function Today(props: { width: number; onNavigate?: () => void; goTo?: (tab: 'sleep' | 'history') => void }) {
  const { nights, settings, syncHealth, loadDemo } = useStore();
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const night = nights[0];

  if (!night) {
    return (
      <Card i={0}>
        <Title icon="moon.zzz.fill">Пока нет данных о сне</Title>
        <Hint>
          Подключите «Здоровье» в настройках, чтобы получать сон с Xiaomi Smart Band 9 через Mi Fitness, или начните
          ночь на вкладке «Сон» — приложение отследит её само.
        </Hint>
        {settings.healthRead ? <Button label="Обновить из «Здоровья»" onPress={() => void syncHealth()} /> : null}
        <Button kind="ghost" label="Показать на примере" onPress={() => void loadDemo()} />
      </Card>
    );
  }

  if (open) {
    return (
      <Detail
        night={night}
        width={props.width}
        backLabel="Сводка"
        onBack={() => {
          setOpen(false);
          props.onNavigate?.();
        }}
      />
    );
  }

  const show = () => {
    setOpen(true);
    props.onNavigate?.();
  };
  const sc = night.score;
  const week = nights.slice(0, 7).reverse();
  const pulses = week.filter((n) => n.hr).map((n) => n.hr!.avg);
  const t = stamp(night);
  const target = nextAlarmTime(now, settings.alarmHour, settings.alarmMinute);

  return (
    <>
      <SectionHeader title="Последняя ночь" action="Все ночи" onAction={() => props.goTo?.('history')} />
      <SummaryCard
        i={1}
        icon="star.circle.fill"
        title="Оценка сна"
        color={scoreColor(sc.total, c)}
        time={t}
        onPress={show}
        accessory={<MiniRing share={sc.total / 100} color={scoreColor(sc.total, c)} />}
      >
        <Value parts={[String(sc.total), 'из 100']} sub={sc.label} />
      </SummaryCard>
      <SummaryCard
        i={2}
        icon="bed.double.fill"
        title="Сон"
        color={c.sleep}
        time={t}
        onPress={show}
        accessory={<MiniBars values={week.map((n) => n.score.sleepMin)} color={c.sleep} />}
      >
        <Label>Время сна</Label>
        <Value parts={[h(sc.sleepMin), 'ч', m(sc.sleepMin), 'мин']} />
      </SummaryCard>
      <SummaryCard
        i={3}
        icon="chart.bar.xaxis"
        title="Фазы сна"
        color={c.deep}
        time={t}
        onPress={show}
        accessory={<MiniStages segments={night.segments} />}
      >
        {sc.hasStages ? (
          <>
            <Label>Глубокий</Label>
            <Value parts={[h(sc.deepMin), 'ч', m(sc.deepMin), 'мин']} sub={`REM ${fmtDuration(sc.remMin)}`} />
          </>
        ) : (
          <>
            <Label>Пробуждений</Label>
            <Value parts={[String(sc.awakenings), 'раз']} />
          </>
        )}
      </SummaryCard>
      {night.hr ? (
        <SummaryCard
          i={4}
          icon="heart.fill"
          title="Пульс во сне"
          color={c.heart}
          time={t}
          onPress={show}
          accessory={pulses.length > 1 ? <MiniDots values={pulses} color={c.heart} /> : null}
        >
          <Label>Средний</Label>
          <Value parts={[String(night.hr.avg), 'уд/мин']} />
        </SummaryCard>
      ) : null}
      {night.snore ? (
        <SummaryCard
          i={5}
          icon="waveform"
          title="Храп"
          color={c.snore}
          time={t}
          onPress={show}
          accessory={<MiniBars values={week.map((n) => n.snore?.totalMin ?? 0)} color={c.snore} />}
        >
          <Value parts={[String(Math.round(night.snore.totalMin)), 'мин']} sub={`эпизодов: ${night.snore.episodes.length}`} />
        </SummaryCard>
      ) : null}

      <SectionHeader i={6} title="Будильник" />
      <SummaryCard
        i={7}
        icon="alarm.fill"
        title="Умный будильник"
        color={c.warn}
        time={settings.alarmEnabled ? 'Вкл.' : 'Выкл.'}
        onPress={() => props.goTo?.('sleep')}
      >
        {settings.alarmEnabled ? (
          <Value
            parts={[fmtTime(target), '']}
            sub={`Окно ${settings.windowMin} мин · через ${fmtDuration((target - now) / MIN)}`}
          />
        ) : (
          <Value parts={['Выключен', '']} sub="Нажмите, чтобы настроить" color={c.dim} />
        )}
      </SummaryCard>

      {settings.healthRead ? <Button kind="ghost" label="Обновить из «Здоровья»" onPress={() => void syncHealth()} /> : null}
    </>
  );
}
