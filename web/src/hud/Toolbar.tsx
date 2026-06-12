import type { ViewPreset } from '../scene/Scene'

interface Props {
  preset: ViewPreset
  setPreset: (p: ViewPreset) => void
  autoRotate: boolean
  setAutoRotate: (v: boolean) => void
  showLabels: boolean
  setShowLabels: (v: boolean) => void
}

const btn = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px', fontSize: 13, cursor: 'pointer',
  background: active ? '#2563eb' : 'rgba(15,23,42,0.85)',
  color: active ? '#fff' : '#cbd5e1',
  border: '1px solid #1e293b', borderRadius: 8,
})

export function Toolbar({ preset, setPreset, autoRotate, setAutoRotate, showLabels, setShowLabels }: Props) {
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 11, display: 'flex', gap: 8, padding: 8,
      background: 'rgba(2,6,23,0.7)', borderRadius: 12, backdropFilter: 'blur(4px)',
    }}>
      <button style={btn(preset === 'iso')} onClick={() => setPreset('iso')}>立體</button>
      <button style={btn(preset === 'top')} onClick={() => setPreset('top')}>俯視</button>
      <button style={btn(preset === 'entrance')} onClick={() => setPreset('entrance')}>入口</button>
      <div style={{ width: 1, background: '#1e293b' }} />
      <button style={btn(autoRotate)} onClick={() => setAutoRotate(!autoRotate)}>環繞</button>
      <button style={btn(showLabels)} onClick={() => setShowLabels(!showLabels)}>編號</button>
    </div>
  )
}
