// Генерирует assets/alarm.wav (мягкий нарастающий сигнал, 28 с — предел для звука уведомления iOS — 30 с)
// и assets/silence.wav (тишина, держит приложение активным ночью, когда микрофон выключен).
import { writeFileSync } from 'node:fs';

const RATE = 22050;

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // моно
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const seconds = 28;
const notes = [523.25, 659.25, 783.99, 659.25]; // до-ми-соль-ми
const alarm = new Array(RATE * seconds).fill(0).map((_, i) => {
  const t = i / RATE;
  const beat = t % 2; // один такт — 2 секунды
  const note = notes[Math.min(3, Math.floor(beat / 0.4))];
  const inNote = beat < 1.6 ? (beat % 0.4) / 0.4 : 1;
  const env = beat < 1.6 ? Math.sin(Math.PI * inNote) ** 0.6 : 0;
  const rampUp = Math.min(1, 0.25 + t / 16); // громкость плавно растёт
  return env * rampUp * 0.6 * (Math.sin(2 * Math.PI * note * t) + 0.3 * Math.sin(4 * Math.PI * note * t));
});

writeFileSync(new URL('../assets/alarm.wav', import.meta.url), wav(alarm));
writeFileSync(new URL('../assets/silence.wav', import.meta.url), wav(new Array(RATE * 5).fill(0)));
console.log('ok');
