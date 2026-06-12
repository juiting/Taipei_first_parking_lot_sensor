export type Status = 'Available' | 'Allocated' | 'Occupied' | 'Maintenance' | 'Unknown'

export interface Space {
  name: string
  no: number | null
  x: number
  y: number
  rot: number
  w: number
  d: number
  type: 'car' | 'bus' | string
  zone: string | null
  status: Status
  offline: boolean
  event_time?: string | null
  last_heartbeat?: string | null
  imei?: string | null
  tags?: string[]
}

export interface Summary {
  total: number
  counts: Record<string, number>
  offline: number
  zones: Record<string, { total: number; available: number; occupied: number }>
  last_success_at: string | null
  consecutive_failures: number
}

export interface Change {
  name: string
  old_status: Status
  new_status: Status
  event_time?: string | null
}

// 場域環境特徵（rect = [x1, y1, x2, y2]，building 多帶高度，gate = [x, y, rot]，
// lane = [x1, y1, x2, y2, dir(行車方向角度), two_way?]）
export interface SiteFeatures {
  lot?: number[]
  grass?: number[][]
  moto?: number[][]
  roads?: number[][]
  buildings?: number[][]
  walls?: number[][]
  lanes?: number[][]
  trees?: number[][]
  street_trees?: number[][]
  gates?: number[][]
}
