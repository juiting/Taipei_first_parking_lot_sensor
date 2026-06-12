import { STATUS_COLOR, OFFLINE_COLOR, NEW_ARRIVAL_CAR_COLOR, CAR_COLOR, NEW_ARRIVAL_MINUTES } from '../scene/colors'

const items: [string, string][] = [
  ['空位', STATUS_COLOR.Available],
  ['在席', STATUS_COLOR.Occupied],
  ['維護', STATUS_COLOR.Maintenance],
  ['離線', OFFLINE_COLOR],
]

// 車身造型小圖示（圓角長方形），對應 3D 車輛顏色
function CarChip({ color }: { color: string }) {
  return <span style={{ width: 16, height: 9, borderRadius: 3, background: color, border: '1px solid rgba(255,255,255,0.25)' }} />
}

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
      <div style={{ height: 1, background: '#1e293b', margin: '2px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#cbd5e1' }}>
        <CarChip color={NEW_ARRIVAL_CAR_COLOR} />
        剛停入（{NEW_ARRIVAL_MINUTES} 分內）
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#cbd5e1' }}>
        <CarChip color={CAR_COLOR} />
        在席車輛
      </div>
    </div>
  )
}
