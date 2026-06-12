import { STATUS_COLOR, OFFLINE_COLOR } from '../scene/colors'

const items: [string, string][] = [
  ['空位', STATUS_COLOR.Available],
  ['在席', STATUS_COLOR.Occupied],
  ['維護', STATUS_COLOR.Maintenance],
  ['離線', OFFLINE_COLOR],
]

export function Legend() {
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 16, zIndex: 11,
      display: 'flex', flexDirection: 'column', gap: 6, padding: 12,
      background: 'rgba(2,6,23,0.7)', borderRadius: 12, backdropFilter: 'blur(4px)',
    }}>
      {items.map(([label, color]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#cbd5e1' }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
          {label}
        </div>
      ))}
    </div>
  )
}
