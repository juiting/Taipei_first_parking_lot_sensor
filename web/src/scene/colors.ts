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

export function colorFor(status: Status, offline: boolean): string {
  if (offline) return OFFLINE_COLOR
  return STATUS_COLOR[status] ?? STATUS_COLOR.Unknown
}
