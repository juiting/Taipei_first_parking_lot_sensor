import { useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { Vector3 } from 'three'
import { useStore } from '../store/store'
import { ParkingSpace } from './ParkingSpace'
import { SiteFeatures } from './SiteFeatures'

// OrbitControls 實例的最小型別（避免相依 three-stdlib 匯出路徑）
interface OrbitControlsImpl {
  target: Vector3
  autoRotate: boolean
  update: () => void
}

export type ViewPreset = 'top' | 'iso' | 'entrance'

function useCenter() {
  const spaces = useStore((s) => s.spaces)
  const features = useStore((s) => s.features)
  return useMemo(() => {
    // 優先以場區範圍置中（含綠地與環境），否則退回車格外接框
    if (features?.lot) {
      const [x1, y1, x2, y2] = features.lot
      return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, w: x2 - x1, h: y2 - y1 }
    }
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
  }, [spaces.length, features])
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
  const features = useStore((s) => s.features)
  const viewMode = useStore((s) => s.viewMode)
  const { cx, cy, w, h } = useCenter()
  // drei 的 OrbitControls ref 型別為其內部類別，這裡用 any 接、再以最小介面在 CameraRig 使用
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const span = Math.max(w, h, 40)

  return (
    <Canvas shadows camera={{ position: [span * 0.55, span * 0.7, span * 0.75], fov: 45, far: span * 6 }}>
      <color attach="background" args={['#0b1220']} />
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[span * 0.6, span * 0.9, span * 0.35]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
        shadow-camera-near={1}
        shadow-camera-far={span * 4}
      />
      <hemisphereLight args={['#94a3b8', '#0b1220', 0.45]} />

      {/* 基底地面（場區外的街廓） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow
        onClick={() => setSelected(null)}>
        <planeGeometry args={[span * 2.4, span * 2.4]} />
        <meshStandardMaterial color="#10151c" />
      </mesh>

      {/* 場域環境：瀝青、道路、綠地、機車區、建物、圍牆、樹、出入口 */}
      {features && <SiteFeatures features={features} cx={cx} cy={cy} />}

      {spaces.map((s) => (
        <ParkingSpace
          key={s.name}
          space={s}
          cx={cx}
          cy={cy}
          mode={viewMode}
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
