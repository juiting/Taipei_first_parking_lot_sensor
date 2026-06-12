import { useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import type { Vector3 } from 'three'
import { useStore } from '../store/store'
import { ParkingSpace } from './ParkingSpace'

// OrbitControls 實例的最小型別（避免相依 three-stdlib 匯出路徑）
interface OrbitControlsImpl {
  target: Vector3
  autoRotate: boolean
  update: () => void
}

export type ViewPreset = 'top' | 'iso' | 'entrance'

function useCenter() {
  const spaces = useStore((s) => s.spaces)
  return useMemo(() => {
    if (!spaces.length) return { cx: 0, cy: 0, w: 100, h: 100 }
    const xs = spaces.map((s) => s.x)
    const ys = spaces.map((s) => s.y)
    const minx = Math.min(...xs), maxx = Math.max(...xs)
    const miny = Math.min(...ys), maxy = Math.max(...ys)
    return {
      cx: (minx + maxx) / 2,
      cy: (miny + maxy) / 2,
      w: maxx - minx,
      h: maxy - miny,
    }
  }, [spaces.length])
}

// 控制相機飛到預設視角；orbit 自動環繞
function CameraRig({
  preset, autoRotate, dims, controlsRef,
}: {
  preset: ViewPreset
  autoRotate: boolean
  dims: { w: number; h: number }
  controlsRef: React.RefObject<OrbitControlsImpl | null>
}) {
  const { camera } = useThree()
  const span = Math.max(dims.w, dims.h)
  useEffect(() => {
    const c = controlsRef.current
    if (preset === 'top') camera.position.set(0, span * 1.1, 0.01)
    else if (preset === 'iso') camera.position.set(span * 0.55, span * 0.7, span * 0.75)
    else camera.position.set(0, span * 0.35, span * 0.95)
    camera.lookAt(0, 0, 0)
    if (c) { c.target.set(0, 0, 0); c.update() }
  }, [preset, span, camera, controlsRef])

  useEffect(() => {
    const c = controlsRef.current
    if (c) c.autoRotate = autoRotate
  }, [autoRotate, controlsRef])
  return null
}

export function Scene({
  preset, autoRotate, showLabels,
}: {
  preset: ViewPreset
  autoRotate: boolean
  showLabels: boolean
}) {
  const spaces = useStore((s) => s.spaces)
  const selected = useStore((s) => s.selected)
  const setSelected = useStore((s) => s.setSelected)
  const { cx, cy, w, h } = useCenter()
  // drei 的 OrbitControls ref 型別為其內部類別，這裡用 any 接、再以最小介面在 CameraRig 使用
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const span = Math.max(w, h, 40)

  return (
    <Canvas shadows camera={{ position: [span * 0.55, span * 0.7, span * 0.75], fov: 45, far: span * 6 }}>
      <color attach="background" args={['#0b1220']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[span, span * 1.4, span * 0.6]} intensity={1.1} castShadow />
      <hemisphereLight args={['#94a3b8', '#0b1220', 0.4]} />

      {/* 地面 + 網格 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow
        onClick={() => setSelected(null)}>
        <planeGeometry args={[span * 2, span * 2]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <Grid
        position={[0, 0, 0]}
        args={[span * 2, span * 2]}
        cellSize={5}
        cellColor="#1e293b"
        sectionSize={25}
        sectionColor="#334155"
        infiniteGrid
        fadeDistance={span * 3}
      />

      {spaces.map((s) => (
        <ParkingSpace
          key={s.name}
          space={s}
          cx={cx}
          cy={cy}
          showLabel={showLabels}
          selected={selected === s.name}
          onSelect={setSelected}
        />
      ))}

      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        autoRotateSpeed={0.6}
        maxPolarAngle={Math.PI / 2.05}
        enableDamping
      />
      <CameraRig preset={preset} autoRotate={autoRotate} dims={{ w, h }} controlsRef={controlsRef} />
    </Canvas>
  )
}

// 提供給 App 切換視角的小工具列狀態 hook
export function useViewState() {
  const [preset, setPreset] = useState<ViewPreset>('iso')
  const [autoRotate, setAutoRotate] = useState(false)
  const [showLabels, setShowLabels] = useState(false)
  return { preset, setPreset, autoRotate, setAutoRotate, showLabels, setShowLabels }
}
