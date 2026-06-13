import { useEffect, useState, useCallback } from 'react'
import { useStore } from '../store/store'

interface IssueItem {
  name: string
  zone: string | null
  imei: string | null
  mac: string | null
  battery: number | null
  rssi: number | null
  remark: string | null
  flags: string[]
  primary: string
  detail: Record<string, string>
}
interface Category { key: string; label: string; hint: string; count: number; names: string[] }
interface IssuesReport {
  generated_at: string
  brickcom_enabled: boolean
  total_issues: number
  categories: Category[]
  items: IssueItem[]
}

const CAT_COLOR: Record<string, string> = {
  mac_mismatch: '#ef4444',
  offline: '#94a3b8',
  low_battery: '#fb923c',
  weak_signal: '#eab308',
  remark_flag: '#84cc16',
}

export function useIssues(pollMs = 30000) {
  const [report, setReport] = useState<IssuesReport | null>(null)
  const load = useCallback(() => {
    fetch('/api/issues').then((r) => r.json()).then(setReport).catch(() => {})
  }, [])
  useEffect(() => {
    load()
    const t = setInterval(load, pollMs)
    return () => clearInterval(t)
  }, [load, pollMs])
  return report
}

export function IssuesPanel({ report, onClose }: { report: IssuesReport; onClose: () => void }) {
  const setSelected = useStore((s) => s.setSelected)
  const [active, setActive] = useState<string>(report.categories.find((c) => c.count > 0)?.key ?? 'mac_mismatch')

  const items = report.items.filter((it) => it.flags.includes(active))
  const activeCat = report.categories.find((c) => c.key === active)

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30, display: 'flex',
      background: 'rgba(2,6,23,0.78)', backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        margin: 'auto', width: 'min(900px, 94vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        background: '#0b1220', border: '1px solid #1e293b', borderRadius: 14, color: '#e2e8f0', overflow: 'hidden',
      }}>
        {/* 標頭 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>現場設備異常</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            共 {report.total_issues} 格 · 更新 {report.generated_at}
            {!report.brickcom_enabled && <span style={{ color: '#f59e0b' }}> · 未啟用 Brickcom（僅斷線類）</span>}
          </div>
          <div style={{ flex: 1 }} />
          <a href="/api/export/issues" style={{
            padding: '6px 12px', fontSize: 13, color: '#cbd5e1', textDecoration: 'none',
            background: 'rgba(15,23,42,0.85)', border: '1px solid #1e293b', borderRadius: 8,
          }}>⬇ 匯出報表</a>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {/* 分類頁籤 */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 18px', flexWrap: 'wrap' }}>
          {report.categories.map((c) => (
            <button key={c.key} onClick={() => setActive(c.key)} style={{
              padding: '6px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8,
              border: `1px solid ${active === c.key ? CAT_COLOR[c.key] : '#1e293b'}`,
              background: active === c.key ? CAT_COLOR[c.key] : 'rgba(15,23,42,0.85)',
              color: active === c.key ? '#0b1220' : '#cbd5e1', fontWeight: active === c.key ? 700 : 400,
            }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: CAT_COLOR[c.key], marginRight: 6 }} />
              {c.label}　{c.count}
            </button>
          ))}
        </div>

        {activeCat && <div style={{ padding: '0 18px 8px', fontSize: 12, color: '#94a3b8' }}>{activeCat.hint}</div>}

        {/* 明細列表 */}
        <div style={{ overflowY: 'auto', padding: '0 18px 18px' }}>
          {items.length === 0 && <div style={{ color: '#475569', padding: '20px 0', textAlign: 'center' }}>此類別目前無異常</div>}
          {items.map((it) => (
            <div key={it.name} onClick={() => { setSelected(it.name); onClose() }}
              title="點擊在 3D 圖中定位此車格"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', cursor: 'pointer',
                borderBottom: '1px solid #131c2b', borderRadius: 6,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(30,41,59,0.5)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontWeight: 700, fontSize: 16, minWidth: 56 }}>{it.name}</span>
              <span style={{ fontSize: 12, color: '#94a3b8', minWidth: 40 }}>{it.zone || ''}</span>
              <span style={{ flex: 1, fontSize: 13, color: '#cbd5e1' }}>{it.detail[active] || ''}</span>
              <span style={{ display: 'flex', gap: 4 }}>
                {it.flags.map((f) => (
                  <span key={f} style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLOR[f] }} title={f} />
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
