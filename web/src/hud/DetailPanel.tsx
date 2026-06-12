import { useEffect, useState } from 'react'
import { useStore } from '../store/store'
import { STATUS_LABEL, colorFor } from '../scene/colors'
import type { Change } from '../types'

export function DetailPanel() {
  const selected = useStore((s) => s.selected)
  const byName = useStore((s) => s.byName)
  const setSelected = useStore((s) => s.setSelected)
  const [history, setHistory] = useState<Change[]>([])

  const space = selected ? byName[selected] : null

  useEffect(() => {
    if (!selected) return
    setHistory([])
    fetch(`/api/spaces/${encodeURIComponent(selected)}/history?limit=20`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .catch(() => setHistory([]))
  }, [selected])

  if (!space) return null
  const color = colorFor(space.status, space.offline)

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #1e293b' }}>
      <span style={{ color: '#94a3b8' }}>{k}</span>
      <span style={{ color: '#e2e8f0', textAlign: 'right' }}>{v}</span>
    </div>
  )

  return (
    <div style={{
      position: 'absolute', top: 72, right: 16, width: 280, zIndex: 11,
      background: 'rgba(2,6,23,0.92)', border: '1px solid #1e293b', borderRadius: 12,
      padding: 16, color: '#e2e8f0', backdropFilter: 'blur(4px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>車格 {space.name}</div>
        <button onClick={() => setSelected(null)}
          style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>×</button>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: '8px 0 12px' }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
        <span style={{ fontWeight: 600 }}>{space.offline ? '感測器離線' : STATUS_LABEL[space.status]}</span>
      </div>
      <Row k="類型" v={space.type === 'bus' ? '大客車' : '小型車'} />
      <Row k="標籤" v={space.tags?.join(' ') || '—'} />
      <Row k="IMEI" v={space.imei || '—'} />
      <Row k="狀態變更" v={space.event_time || '—'} />
      <Row k="最後回報" v={space.last_heartbeat || '—'} />

      <div style={{ marginTop: 14, fontSize: 12, color: '#94a3b8' }}>近期狀態變化</div>
      <div style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto' }}>
        {history.length === 0 && <div style={{ fontSize: 12, color: '#475569' }}>尚無紀錄</div>}
        {history.map((h, i) => (
          <div key={i} style={{ fontSize: 12, padding: '3px 0', color: '#cbd5e1' }}>
            <span style={{ color: '#64748b' }}>{(h as Change & { detected_at?: string }).detected_at}</span>{' '}
            {STATUS_LABEL[h.old_status] ?? h.old_status} → {STATUS_LABEL[h.new_status] ?? h.new_status}
          </div>
        ))}
      </div>
    </div>
  )
}
