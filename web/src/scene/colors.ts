import type { Status } from '../types'

export const STATUS_COLOR: Record<Status, string> = {
  Available: '#22c55e',   // 綠：空位
  Occupied: '#ef4444',    // 紅：在席
  Allocated: '#eab308',   // 黃：已分配
  Maintenance: '#64748b', // 灰：維護
  Unknown: '#334155',     // 深灰：無資料
}

export const OFFLINE_COLOR = '#a855f7' // 紫：感測器離線

// 「剛停入」高亮：狀態變更為在席後 N 分鐘內，車身整車紅色
export const NEW_ARRIVAL_MINUTES = 5
export const NEW_ARRIVAL_CAR_COLOR = '#ef4444'
export const CAR_COLOR = '#aeb6c2'
export const BUS_COLOR = '#b8c0cc'

/** status 變更時間在 N 分鐘內（容忍 1 分鐘時鐘誤差） */
export function isNewArrival(eventTime: string | null | undefined, now: number): boolean {
  if (!eventTime) return false
  const t = new Date(eventTime.replace(' ', 'T')).getTime()
  if (Number.isNaN(t)) return false
  const diff = now - t
  return diff > -60_000 && diff < NEW_ARRIVAL_MINUTES * 60_000
}

export const STATUS_LABEL: Record<Status, string> = {
  Available: '空位',
  Occupied: '在席',
  Allocated: '已分配',
  Maintenance: '維護',
  Unknown: '無資料',
}

// ---- 電量色階（≥95 綠、80–95 淺綠、50–80 黃、30–50 淺紅、10–30 紅、<10 閃紅）----
export const NO_DATA_COLOR = '#334155'

export interface BatteryLevel {
  label: string
  color: string
  blink?: boolean
  match: (b: number) => boolean
}

export const BATTERY_LEVELS: BatteryLevel[] = [
  { label: '≥95%',   color: '#22c55e', match: (b) => b >= 95 },
  { label: '80–95%', color: '#86efac', match: (b) => b >= 80 },
  { label: '50–80%', color: '#eab308', match: (b) => b >= 50 },
  { label: '30–50%', color: '#f87171', match: (b) => b >= 30 },
  { label: '10–30%', color: '#dc2626', match: (b) => b >= 10 },
  { label: '<10%',   color: '#dc2626', blink: true, match: () => true },
]

export function batteryLevel(b: number | null | undefined): BatteryLevel | null {
  if (b === null || b === undefined) return null
  return BATTERY_LEVELS.find((l) => l.match(b)) ?? null
}

export function batteryColor(b: number | null | undefined): { color: string; blink: boolean } {
  const l = batteryLevel(b)
  return l ? { color: l.color, blink: !!l.blink } : { color: NO_DATA_COLOR, blink: false }
}

// ---- RSSI 分級（NB-IoT，dBm）----
export interface RssiLevel {
  label: string
  range: string
  color: string
  match: (r: number) => boolean
}

export const RSSI_LEVELS: RssiLevel[] = [
  { label: '優', range: '≥ -85',      color: '#22c55e', match: (r) => r >= -85 },
  { label: '良', range: '-85～-95',   color: '#86efac', match: (r) => r >= -95 },
  { label: '中', range: '-95～-105',  color: '#eab308', match: (r) => r >= -105 },
  { label: '差', range: '< -105',     color: '#ef4444', match: () => true },
]

export function rssiLevel(r: number | null | undefined): RssiLevel | null {
  if (r === null || r === undefined) return null
  return RSSI_LEVELS.find((l) => l.match(r)) ?? null
}

export function rssiColor(r: number | null | undefined): string {
  return rssiLevel(r)?.color ?? NO_DATA_COLOR
}

export type ViewMode = 'status' | 'battery' | 'signal'

export function colorFor(status: Status, offline: boolean): string {
  if (offline) return OFFLINE_COLOR
  return STATUS_COLOR[status] ?? STATUS_COLOR.Unknown
}
