import { useMemo } from 'react'
import { useStore } from '../store/store'
import { STATUS_COLOR, OFFLINE_COLOR, BATTERY_LEVELS, batteryLevel, NO_DATA_COLOR } from '../scene/colors'

// 迷你電量分布條：六段色帶寬度依格數比例，懸停看明細，點擊切到電量檢視
function BatteryDistribution() {
  const spaces = useStore((s) => s.spaces)
  const setViewMode = useStore((s) => s.setViewMode)
  const dist = useMemo(() => {
    const counts = BATTERY_LEVELS.map(() => 0)
    let none = 0
    for (const s of spaces) {
      const l = batteryLevel(s.battery)
      if (l) counts[BATTERY_LEVELS.indexOf(l)] += 1
      else none += 1
    }
    return { counts, none, total: spaces.length }
  }, [spaces])

  if (!dist.total || dist.none === dist.total) return null  // 尚無電量資料時不顯示

  const low = dist.counts[3] + dist.counts[4] + dist.counts[5]  // <50% 總數
  return (
    <div
      onClick={() => setViewMode('battery')}
      title={BATTERY_LEVELS.map((l, i) => `${l.label}: ${dist.counts[i]} 格`).join('\n')
        + (dist.none ? `\n無資料: ${dist.none} 格` : '')}
      style={{ cursor: 'pointer', minWidth: 150, flexShrink: 0 }}
    >
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', width: 150 }}>
        {BATTERY_LEVELS.map((l, i) => dist.counts[i] > 0 && (
          <div key={l.label} style={{
            flexGrow: dist.counts[i], minWidth: 3, background: l.color,
          }} />
        ))}
        {dist.none > 0 && <div style={{ flexGrow: dist.none, minWidth: 3, background: NO_DATA_COLOR }} />}
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, textAlign: 'center' }}>
        電量分布{low > 0 && <span style={{ color: '#f87171' }}>（低電量 {low} 格）</span>}
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 56, flexShrink: 0 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: color ?? '#f1f5f9', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export function StatsBar() {
  const summary = useStore((s) => s.summary)
  const connected = useStore((s) => s.connected)
  const fetchedAt = useStore((s) => s.fetchedAt)
  if (!summary) return null
  const c = summary.counts
  const occRate = summary.total ? Math.round((c.Occupied / summary.total) * 100) : 0

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
      display: 'flex', alignItems: 'center', gap: 20, padding: '12px 20px',
      background: 'linear-gradient(180deg, rgba(2,6,23,0.92), rgba(2,6,23,0.55))',
      backdropFilter: 'blur(4px)', color: '#e2e8f0',
    }}>
      <div style={{ marginRight: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>第一停車場 · 地磁即時監控</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>共 {summary.total} 格 · 佔用率 {occRate}%</div>
      </div>
      <Stat label="空位" value={c.Available ?? 0} color={STATUS_COLOR.Available} />
      <Stat label="在席" value={c.Occupied ?? 0} color={STATUS_COLOR.Occupied} />
      <Stat label="維護" value={c.Maintenance ?? 0} color={STATUS_COLOR.Maintenance} />
      <Stat label="離線" value={summary.offline} color={OFFLINE_COLOR} />
      <BatteryDistribution />
      <div style={{ flex: 1 }} />
      <div style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          <span style={{
            width: 9, height: 9, borderRadius: '50%',
            background: connected && summary.consecutive_failures === 0 ? '#22c55e' : '#ef4444',
            boxShadow: connected ? '0 0 8px #22c55e' : 'none',
          }} />
          <span style={{ fontSize: 12 }}>{connected ? '即時連線中' : '連線中斷，重連中…'}</span>
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          更新：{fetchedAt ?? '—'}
          {summary.consecutive_failures > 0 && (
            <span style={{ color: '#f59e0b' }}> · 來源異常 ×{summary.consecutive_failures}</span>
          )}
        </div>
      </div>
    </div>
  )
}
