import React from 'react';
import { Text, View } from 'react-native';
import { fmtDuration, fmtTime, type Night } from '../lib/types';
import { useStore } from '../store';
import { Big, Button, Card, Hint, Hypnogram, ROUNDED, ScoreRing, StageBar, Title, scoreColor, useTheme } from '../ui/kit';

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
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <ScoreRing score={sc.total} />
        <Text style={{ color: scoreColor(sc.total, c), fontSize: 22, fontWeight: '700', marginTop: 14 }}>{sc.label}</Text>
        <Hint>{SOURCE[night.source]}</Hint>
      </Card>

      <View style={{ flexDirection: 'row', gap: 14 }}>
        <Card style={{ flex: 1 }}>
          <Title icon="bed.double.fill">Время сна</Title>
          <Big size={30} parts={[String(Math.floor(sc.sleepMin / 60)), 'ч', String(sc.sleepMin % 60), 'мин']} />
          <Hint>
            {fmtTime(night.bedtime)} – {fmtTime(night.wake)}
          </Hint>
        </Card>
        {night.hr ? (
          <Card style={{ flex: 1 }}>
            <Title icon="heart.fill" color={c.heart}>
              Пульс во сне
            </Title>
            <Big size={30} parts={[String(night.hr.avg), 'уд/мин']} />
            <Hint>минимум {night.hr.min}</Hint>
          </Card>
        ) : null}
      </View>

      <Card>
        <Title icon="chart.bar.xaxis">Фазы сна</Title>
        <Hypnogram segments={night.segments} snore={night.snore?.episodes} width={width - 64} />
        <StageBar stage="awake" minutes={sc.awakeMin} total={sc.inBedMin} />
        {sc.hasStages ? (
          <>
            <StageBar stage="rem" minutes={sc.remMin} total={sc.inBedMin} />
            <StageBar stage="light" minutes={sc.lightMin} total={sc.inBedMin} />
            <StageBar stage="deep" minutes={sc.deepMin} total={sc.inBedMin} />
          </>
        ) : (
          <StageBar stage="light" minutes={sc.sleepMin} total={sc.inBedMin} />
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

      <Card>
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

      <Card>
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

export function Today({ width }: { width: number }) {
  const { nights, settings, syncHealth, loadDemo } = useStore();
  const night = nights[0];
  if (!night) {
    return (
      <Card>
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
  return (
    <>
      <NightDetails night={night} width={width} />
      {settings.healthRead ? <Button kind="ghost" label="Обновить из «Здоровья»" onPress={() => void syncHealth()} /> : null}
    </>
  );
}
