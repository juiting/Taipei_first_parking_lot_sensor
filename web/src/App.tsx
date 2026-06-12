import { useEffect } from 'react'
import { connectWS, useStore } from './store/store'
import { Scene, useViewState } from './scene/Scene'
import { StatsBar } from './hud/StatsBar'
import { DetailPanel } from './hud/DetailPanel'
import { Toolbar } from './hud/Toolbar'
import { Legend } from './hud/Legend'

export default function App() {
  const view = useViewState()
  const spaces = useStore((s) => s.spaces)
  const loadLayout = useStore((s) => s.loadLayout)

  useEffect(() => {
    connectWS()
    loadLayout()
  }, [loadLayout])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b1220', overflow: 'hidden' }}>
      <StatsBar />
      {spaces.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: '#64748b', fontSize: 16,
        }}>
          連線中，載入車格資料…
        </div>
      )}
      <Scene preset={view.preset} autoRotate={view.autoRotate} showLabels={view.showLabels} />
      <Legend />
      <DetailPanel />
      <Toolbar
        preset={view.preset} setPreset={view.setPreset}
        autoRotate={view.autoRotate} setAutoRotate={view.setAutoRotate}
        showLabels={view.showLabels} setShowLabels={view.setShowLabels}
      />
    </div>
  )
}
