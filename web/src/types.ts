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
