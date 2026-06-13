import {
  STATUS_COLOR, OFFLINE_COLOR, NEW_ARRIVAL_CAR_COLOR, CAR_COLOR, NEW_ARRIVAL_MINUTES,
  BATTERY_LEVELS, RSSI_LEVELS, NO_DATA_COLOR,
} from '../scene/colors'
import { useStore } from '../store/store'

const statusItems: [string, string][] = [
  ['空位', STATUS_COLOR.Available],
  ['在席', STATUS_COLOR.Occupied],
  ['維護', STATUS_COLOR.Maintenance],
  ['離線', OFFLINE_COLOR],
]

function Row({ color, label, chip }: { color: string; label: string; chip?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#cbd5e1' }}>
      <span style={chip
        ? { width: 16, height: 9, borderRadius: 3, background: color, border: '1px solid rgba(255,255,255,0.25)' }
        : { width: 12, height: 12, borderRadius: 3, background: color }} />
      {label}
    </div>
  )
}

export function Legend() {
  const viewMode = useStore((s) => s.viewMode)

  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 16, zIndex: 11,
      display: 'flex', flexDirection: 'column', gap: 6, padding: 12,
      background: 'rgba(2,6,23,0.7)', borderRadius: 12, backdropFilter: 'blur(4px)',
    }}>
      {viewMode === 'status' && (
        <>
          {statusItems.map(([label, color]) => <Row key={label} color={color} label={label} />)}
          <div style={{ height: 1, background: '#1e293b', margin: '2px 0' }} />
          <Row color={NEW_ARRIVAL_CAR_COLOR} label={`剛停入（${NEW_ARRIVAL_MINUTES} 分內）`} chip />
          <Row color={CAR_COLOR} label="在席車輛" chip />
        </>
      )}
      {viewMode === 'battery' && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>電量</div>
          {BATTERY_LEVELS.map((l) => (
            <Row key={l.label} color={l.color} label={l.blink ? `${l.label}（閃爍）` : l.label} />
          ))}
          <Row color={NO_DATA_COLOR} label="無資料" />
        </>
      )}
      {viewMode === 'signal' && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>訊號 RSSI（dBm）</div>
          {RSSI_LEVELS.map((l) => (
            <Row key={l.label} color={l.color} label={`${l.label}　${l.range}`} />
          ))}
          <Row color={NO_DATA_COLOR} label="無資料" />
        </>
      )}
    </div>
  )
}
