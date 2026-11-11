import { Platform } from 'react-native';
import type { BleManager, Device, Subscription } from 'react-native-ble-plx';

/**
 * Прямое подключение к браслету по Bluetooth.
 *
 * У Xiaomi Smart Band 9 нет открытого протокола для выгрузки сохранённого сна,
 * поэтому здесь используется стандартный профиль Bluetooth «Heart Rate» (0x180D):
 * браслет отдаёт пульс в реальном времени, если на нём включить
 * Настройки → «Трансляция пульса». Авторизация и Mi Fitness для этого не нужны,
 * и такое подключение не конфликтует с Mi Fitness.
 */
const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HR_CHAR = '00002a37-0000-1000-8000-00805f9b34fb';
const BATTERY_SERVICE = '0000180f-0000-1000-8000-00805f9b34fb';
const BATTERY_CHAR = '00002a19-0000-1000-8000-00805f9b34fb';

export interface FoundBand {
  id: string;
  name: string;
  rssi: number | null;
}

export type BandStatus = 'off' | 'connecting' | 'connected' | 'lost';

let manager: BleManager | null = null;

function ble(): BleManager | null {
  if (Platform.OS === 'web') return null;
  if (!manager) {
    try {
      const { BleManager: Manager } = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
      manager = new Manager();
    } catch {
      return null;
    }
  }
  return manager;
}

export function bleAvailable(): boolean {
  return ble() != null;
}

function decodeBase64(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Разбор характеристики Heart Rate Measurement (0x2A37). */
export function parseHeartRate(bytes: Uint8Array): number | null {
  if (bytes.length < 2) return null;
  const is16bit = (bytes[0] & 0x01) === 1;
  if (is16bit && bytes.length < 3) return null;
  const bpm = is16bit ? bytes[1] | (bytes[2] << 8) : bytes[1];
  return bpm > 0 ? bpm : null;
}

/** Ищет устройства, транслирующие пульс. Возвращает функцию остановки поиска. */
export function scanForBands(onFound: (band: FoundBand) => void, onError: (message: string) => void): () => void {
  const m = ble();
  if (!m) {
    onError('Bluetooth недоступен на этом устройстве');
    return () => {};
  }
  const sub = m.onStateChange((state) => {
    if (state === 'PoweredOn') {
      sub.remove();
      m.startDeviceScan([HR_SERVICE], null, (error, device) => {
        if (error) return onError(error.message);
        if (device) onFound({ id: device.id, name: device.name ?? device.localName ?? 'Без имени', rssi: device.rssi });
      });
    } else if (state === 'Unauthorized') onError('Нет разрешения на Bluetooth');
    else if (state === 'PoweredOff') onError('Bluetooth выключен');
  }, true);
  return () => {
    sub.remove();
    void m.stopDeviceScan();
  };
}

/**
 * Держит соединение с браслетом и передаёт пульс. При обрыве переподключается
 * каждые 15 секунд, пока не вызвана stop().
 */
export class BandLink {
  private stopped = false;
  private hrSub: Subscription | null = null;
  private dcSub: Subscription | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly deviceId: string,
    private readonly onHeartRate: (bpm: number, t: number) => void,
    private readonly onStatus: (status: BandStatus) => void,
  ) {}

  start(): void {
    void this.connect();
  }

  private async connect(): Promise<void> {
    const m = ble();
    if (!m || this.stopped) return;
    this.onStatus('connecting');
    try {
      let device: Device = await m.connectToDevice(this.deviceId, { timeout: 15_000 });
      device = await device.discoverAllServicesAndCharacteristics();
      if (this.stopped) return void m.cancelDeviceConnection(this.deviceId).catch(() => {});
      this.onStatus('connected');
      this.hrSub = device.monitorCharacteristicForService(HR_SERVICE, HR_CHAR, (error, ch) => {
        if (error || !ch?.value) return;
        const bpm = parseHeartRate(decodeBase64(ch.value));
        if (bpm) this.onHeartRate(bpm, Date.now());
      });
      this.dcSub = m.onDeviceDisconnected(this.deviceId, () => this.scheduleRetry());
    } catch {
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    this.cleanup();
    if (this.stopped) return;
    this.onStatus('lost');
    this.retry = setTimeout(() => void this.connect(), 15_000);
  }

  private cleanup(): void {
    this.hrSub?.remove();
    this.dcSub?.remove();
    this.hrSub = this.dcSub = null;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
  }

  stop(): void {
    this.stopped = true;
    this.cleanup();
    this.onStatus('off');
    void ble()
      ?.cancelDeviceConnection(this.deviceId)
      .catch(() => {});
  }
}

/** Заряд браслета в процентах, если он отдаёт стандартный сервис батареи. */
export async function readBattery(deviceId: string): Promise<number | null> {
  try {
    const ch = await ble()?.readCharacteristicForDevice(deviceId, BATTERY_SERVICE, BATTERY_CHAR);
    return ch?.value ? decodeBase64(ch.value)[0] : null;
  } catch {
    return null;
  }
}
