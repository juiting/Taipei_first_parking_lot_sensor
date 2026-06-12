import { useStore } from '../store/store'
import { STATUS_COLOR, OFFLINE_COLOR } from '../scene/colors'

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
