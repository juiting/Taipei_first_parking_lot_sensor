import type { Status } from '../types'

export const STATUS_COLOR: Record<Status, string> = {
  Available: '#22c55e',   // 綠：空位
  Occupied: '#ef4444',    // 紅：在席
  Allocated: '#eab308',   // 黃：已分配
  Maintenance: '#64748b', // 灰：維護
  Unknown: '#334155',     // 深灰：無資料
}

export const OFFLINE_COLOR = '#a855f7' // 紫：感測器離線

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
