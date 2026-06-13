import { create } from 'zustand'
import type { Space, Summary, Change, SiteFeatures, HealthEntry } from '../types'
import type { ViewMode } from '../scene/colors'

interface State {
  spaces: Space[]
  byName: Record<string, Space>
  summary: Summary | null
  connected: boolean
  fetchedAt: string | null
  selected: string | null
  recentChanges: Change[]
  features: SiteFeatures | null
  nowTick: number
  viewMode: ViewMode
  setViewMode: (m: ViewMode) => void
  loadLayout: () => Promise<void>
  setSelected: (name: string | null) => void
  _applySnapshot: (spaces: Space[], summary: Summary | null, fetchedAt: string | null) => void
  _applyUpdate: (changes: Change[], summary: Summary | null, fetchedAt: string | null) => void
  _applyHealth: (health: Record<string, HealthEntry>) => void
  _setConnected: (v: boolean) => void
}

export const useStore = create<State>((set) => ({
  spaces: [],
  byName: {},
  summary: null,
  connected: false,
  fetchedAt: null,
  selected: null,
  recentChanges: [],
  features: null,
  nowTick: Date.now(),
  viewMode: 'status' as ViewMode,

  setViewMode: (m) => set({ viewMode: m }),

  loadLayout: async () => {
    try {
      const r = await fetch('/api/layout')
      const d = await r.json()
      set({ features: d.features ?? null })
    } catch {
      // 佈局載入失敗不影響即時狀態，僅缺環境裝飾
    }
  },

  setSelected: (name) => set({ selected: name }),

  _applySnapshot: (spaces, summary, fetchedAt) =>
    set(() => ({
      spaces,
      byName: Object.fromEntries(spaces.map((s) => [s.name, s])),
      summary,
      fetchedAt,
    })),

  _applyUpdate: (changes, summary, fetchedAt) =>
    set((state) => {
      if (!changes.length) {
        return { summary: summary ?? state.summary, fetchedAt }
      }
      const byName = { ...state.byName }
      for (const c of changes) {
        const prev = byName[c.name]
        if (prev) {
          byName[c.name] = { ...prev, status: c.new_status, event_time: c.event_time ?? prev.event_time }
        }
      }
      const recent = [...changes.map((c) => ({ ...c })), ...state.recentChanges].slice(0, 30)
      return {
        byName,
        spaces: state.spaces.map((s) => byName[s.name] ?? s),
        summary: summary ?? state.summary,
        fetchedAt,
        recentChanges: recent,
      }
    }),

  _applyHealth: (health) =>
    set((state) => {
      const byName = { ...state.byName }
      for (const [name, h] of Object.entries(health)) {
        const prev = byName[name]
        if (prev) {
          byName[name] = {
            ...prev,
            battery: h.battery ?? null,
            battery_at: h.battery_at ?? prev.battery_at,
            rssi: h.rssi ?? prev.rssi ?? null,
            rssi_at: h.rssi_at ?? prev.rssi_at,
          }
        }
      }
      return { byName, spaces: state.spaces.map((s) => byName[s.name] ?? s) }
    }),

  _setConnected: (v) => set({ connected: v }),
}))

// 每 15 秒更新時鐘，讓「剛停入(<5分)」的紅色車身逾時自動回灰
setInterval(() => useStore.setState({ nowTick: Date.now() }), 15000)

// ---- WebSocket 自動重連 ----
let ws: WebSocket | null = null
let retry = 0

export function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const url = `${proto}://${location.host}/ws`
  ws = new WebSocket(url)

  ws.onopen = () => {
    retry = 0
    useStore.getState()._setConnected(true)
  }
  ws.onclose = () => {
    useStore.getState()._setConnected(false)
    retry = Math.min(retry + 1, 10)
    setTimeout(connectWS, 1000 * retry) // 線性退避，最多 10s
  }
  ws.onerror = () => ws?.close()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    const st = useStore.getState()
    if (msg.type === 'snapshot') {
      st._applySnapshot(msg.spaces, msg.summary, msg.fetched_at)
    } else if (msg.type === 'update' || msg.type === 'tick') {
      st._applyUpdate(msg.changes ?? [], msg.summary, msg.fetched_at)
    } else if (msg.type === 'health') {
      st._applyHealth(msg.spaces ?? {})
    }
  }
  // 心跳，避免代理層斷線
  const ping = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) ws.send('ping')
    else clearInterval(ping)
  }, 25000)
}
