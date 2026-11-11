// Проверка логики без телефона: npm test
import assert from 'node:assert/strict';
import { demoEpochs, demoNights } from '../src/lib/demo';
import { buildNight, mergeNights } from '../src/lib/night';
import { computeScore } from '../src/lib/score';
import { decideWake, isLightSleepNow, nextAlarmTime } from '../src/lib/smartAlarm';
import { SnoreDetector, snoreMinutes } from '../src/lib/snore';
import { estimateStages } from '../src/lib/staging';
import { MIN, type Epoch, type StageSegment } from '../src/lib/types';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok  ${name}`);
}

const T0 = new Date(2026, 10, 10, 23, 0, 0).getTime();
const seg = (startMin: number, lenMin: number, stage: StageSegment['stage']): StageSegment => ({
  start: T0 + startMin * MIN,
  end: T0 + (startMin + lenMin) * MIN,
  stage,
});

test('оценка: идеальная ночь даёт 100', () => {
  const segments = [seg(0, 250, 'light'), seg(250, 90, 'deep'), seg(340, 100, 'rem'), seg(440, 40, 'light')];
  const s = computeScore(segments, T0, T0 + 480 * MIN, 480);
  assert.equal(s.total, 100);
  assert.equal(s.sleepMin, 480);
  assert.equal(s.label, 'Отличный сон');
});

test('оценка: короткий рваный сон оценивается низко', () => {
  const segments = [
    seg(0, 60, 'awake'), seg(60, 60, 'light'), seg(120, 20, 'awake'), seg(140, 60, 'light'),
    seg(200, 15, 'awake'), seg(215, 50, 'light'), seg(265, 10, 'awake'), seg(275, 40, 'light'),
  ];
  const s = computeScore(segments, T0, T0 + 315 * MIN, 480);
  assert.equal(s.awakenings, 3);
  assert.ok(s.total < 50, `получено ${s.total}`);
  assert.equal(s.hasStages, false);
});

test('оценка: храп снижает балл, но не больше чем на 10', () => {
  const segments = [seg(0, 250, 'light'), seg(250, 90, 'deep'), seg(340, 100, 'rem'), seg(440, 40, 'light')];
  const clean = computeScore(segments, T0, T0 + 480 * MIN, 480, 0).total;
  assert.equal(computeScore(segments, T0, T0 + 480 * MIN, 480, 48).total, clean - 5);
  assert.equal(computeScore(segments, T0, T0 + 480 * MIN, 480, 400).total, clean - 10);
});

test('оценка: пустая ночь не падает и даёт 0', () => {
  assert.equal(computeScore([], T0, T0, 480).total, 0);
});

test('фазы: демо-ночь содержит все фазы в правдоподобных долях', () => {
  const epochs = demoEpochs(T0, 480, 3);
  const segments = estimateStages(epochs);
  assert.equal(segments[0].stage, 'awake', 'ночь начинается с засыпания');
  assert.equal(segments[0].start, T0);
  assert.equal(segments[segments.length - 1].end, T0 + 480 * MIN);
  const s = computeScore(segments, T0, T0 + 480 * MIN, 480);
  assert.ok(s.deepMin > 30 && s.deepMin < 200, `глубокий ${s.deepMin}`);
  assert.ok(s.remMin > 30 && s.remMin < 200, `REM ${s.remMin}`);
  assert.ok(s.lightMin > s.deepMin, 'лёгкого сна больше, чем глубокого');
});

test('фазы: без пульса REM не выдумывается', () => {
  const epochs = demoEpochs(T0, 300, 2).map((e) => ({ ...e, hr: undefined }));
  const stages = new Set(estimateStages(epochs).map((s) => s.stage));
  assert.ok(!stages.has('rem'));
});

test('храп: ритмичные звуки распознаются, одиночный шум — нет', () => {
  const run = (pattern: (t: number) => boolean) => {
    const d = new SnoreDetector();
    for (let t = 0; t < 120_000; t += 150) d.feed(pattern(t) ? -30 : -55, t);
    return d.finish();
  };
  // Храп: 1 секунда звука каждые 4 секунды, с 20-й по 80-ю секунду.
  const snore = run((t) => t >= 20_000 && t < 80_000 && t % 4000 < 1000);
  assert.equal(snore.length, 1);
  const len = snore[0].end - snore[0].start;
  assert.ok(len > 50_000 && len < 62_000, `длина эпизода ${len}`);
  assert.ok(snoreMinutes(snore) >= 0.9);
  // Один хлопок и один долгий шум (6 с) — не храп.
  assert.equal(run((t) => (t >= 10_000 && t < 10_600) || (t >= 40_000 && t < 46_000)).length, 0);
});

test('будильник: время переносится на завтра, если уже прошло', () => {
  const evening = new Date(2026, 10, 10, 23, 30).getTime();
  const t = new Date(nextAlarmTime(evening, 7, 30));
  assert.deepEqual([t.getDate(), t.getHours(), t.getMinutes()], [11, 7, 30]);
  const early = new Date(2026, 10, 11, 5, 0).getTime();
  assert.equal(new Date(nextAlarmTime(early, 7, 30)).getDate(), 11);
});

test('будильник: будит в окне только при лёгком сне и всегда — в назначенное время', () => {
  const target = T0 + 480 * MIN;
  const still: Epoch[] = Array.from({ length: 30 }, (_, i) => ({ t: T0 + i * MIN, hr: 52, motion: 0, sound: 0 }));
  const moving: Epoch[] = [...still.slice(0, 28), { t: 0, hr: 58, motion: 2, sound: 1 }, { t: 0, hr: 60, motion: 1, sound: 0 }];
  const hrRise: Epoch[] = [...still.slice(0, 29), { t: 0, hr: 58, motion: 0, sound: 0 }];

  assert.equal(isLightSleepNow(still), false);
  assert.equal(isLightSleepNow(moving), true);
  assert.equal(isLightSleepNow(hrRise), true);
  assert.equal(decideWake(target - 20 * MIN, target, 30, still), 'wait', 'глубокий сон в окне — ждём');
  assert.equal(decideWake(target - 20 * MIN, target, 30, moving), 'smart');
  assert.equal(decideWake(target - 40 * MIN, target, 30, moving), 'wait', 'до окна не будим');
  assert.equal(decideWake(target, target, 30, still), 'deadline');
});

test('ночь: сборка, порог 20 минут и объединение со «Здоровьем»', () => {
  assert.equal(buildNight(demoEpochs(T0, 10), T0, T0 + 10 * MIN, null, 480, 'manual'), null);
  const episodes = [{ start: T0 + 60 * MIN, end: T0 + 84 * MIN, peakDb: -28 }];
  const own = buildNight(demoEpochs(T0, 450), T0, T0 + 450 * MIN, episodes, 480, 'smart')!;
  assert.equal(own.source, 'band');
  assert.equal(own.snore?.totalMin, 24);
  assert.ok(own.hr && own.hr.min >= 50 && own.hr.avg < 70);

  const segments = [seg(5, 240, 'light'), seg(245, 80, 'deep'), seg(325, 90, 'rem'), seg(415, 30, 'light')];
  const health = { ...own, source: 'health' as const, snore: undefined, wokeBy: undefined, segments,
    score: computeScore(segments, T0, T0 + 450 * MIN, 480) };
  const [merged] = mergeNights([own], [health], 480);
  assert.equal(merged.source, 'health', 'фазы берутся из «Здоровья»');
  assert.equal(merged.snore?.totalMin, 24, 'храп сохраняется из своего трекинга');
  assert.equal(merged.wokeBy, 'smart');
  assert.ok(merged.score.total < health.score.total, 'храп учтён в оценке');
});

test('демо: 7 ночей с оценками от 0 до 100', () => {
  const nights = demoNights(480);
  assert.equal(nights.length, 7);
  assert.equal(new Set(nights.map((n) => n.id)).size, 7);
  for (const n of nights) assert.ok(n.score.total > 0 && n.score.total <= 100);
});

console.log(`\nвсе тесты пройдены: ${passed}`);
