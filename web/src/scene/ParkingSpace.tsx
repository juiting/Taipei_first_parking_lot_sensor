import { memo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { CanvasTexture } from 'three'
import type { Mesh, MeshStandardMaterial } from 'three'
import type { Space } from '../types'
import {
  colorFor, isNewArrival, NEW_ARRIVAL_CAR_COLOR, CAR_COLOR, BUS_COLOR,
  batteryColor, rssiColor, type ViewMode,
} from './colors'
import { useStore } from '../store/store'
import { Car } from './Car'

const DEG = Math.PI / 180

// 共用的「白色畫線車格框」貼圖（一次產生，所有車格共用）
let stallTex: CanvasTexture | null = null
function getStallTexture(): CanvasTexture {
  if (stallTex) return stallTex
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 256, 128)
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 7
  ctx.strokeRect(4, 4, 248, 120)
  stallTex = new CanvasTexture(c)
  return stallTex
}

interface Props {
  space: Space
  cx: number
  cy: number
  mode: ViewMode
  showLabel: boolean
  selected: boolean
  onSelect: (name: string) => void
}

// local +x = facing 方向；格深 d 沿 x、格寬 w 沿 z。
export const ParkingSpace = memo(function ParkingSpace({
  space, cx, cy, mode, showLabel, selected, onSelect,
}: Props) {
  const padMat = useRef<MeshStandardMaterial>(null)
  const padRef = useRef<Mesh>(null)
  const nowTick = useStore((s) => s.nowTick)
  const occupied = space.status === 'Occupied'
  const isBus = space.type === 'bus'
  // 剛停入（5 分鐘內變為在席）→ 整車紅色，逾時隨 nowTick 自動回灰（僅狀態模式）
  const newArrival = mode === 'status' && occupied && isNewArrival(space.event_time, nowTick)

  // 依檢視模式決定地墊顏色與閃爍：狀態=離線閃紫、電量=<10% 閃紅
  let color: string
  let blink = false
  if (mode === 'battery') {
    const b = batteryColor(space.battery)
    color = b.color
    blink = b.blink
  } else if (mode === 'signal') {
    color = rssiColor(space.rssi)
  } else {
    color = colorFor(space.status, space.offline)
    blink = space.offline
  }

  // 閃爍 / 被選取：脈動抬升
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (blink && padMat.current) {
      padMat.current.emissiveIntensity = 0.4 + 0.4 * Math.sin(t * 4)
    }
    if (selected && padRef.current) {
      padRef.current.position.y = 0.04 + 0.05 * (0.5 + 0.5 * Math.sin(t * 5))
    }
  })

  const wx = space.x - cx
  const wz = space.y - cy

  // 特殊格地面底色（對應現場標線：充電=綠、婦幼/身障=藍）
  const tags = space.tags ?? []
  const specialTint = tags.includes('Elect') ? '#1f8a4c'
    : (tags.includes('Women') || tags.includes('DP')) ? '#2563b8'
    : null

  return (
    <group position={[wx, 0, wz]} rotation={[0, -space.rot * DEG, 0]}>
      {/* 特殊格底色 */}
      {specialTint && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[space.d * 0.98, space.w * 0.95]} />
          <meshStandardMaterial color={specialTint} transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}

      {/* 白色畫線格框（貼地） */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[space.d, space.w]} />
        <meshBasicMaterial map={getStallTexture()} transparent depthWrite={false} />
      </mesh>

      {/* 狀態地墊（內縮，露出白線） */}
      <mesh
        ref={padRef}
        position={[0, 0.04, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(space.name) }}
      >
        <boxGeometry args={[space.d * 0.8, 0.06, space.w * 0.72]} />
        <meshStandardMaterial
          ref={padMat}
          color={color}
          emissive={color}
          emissiveIntensity={blink ? 0.6 : mode !== 'status' ? 0.4 : occupied ? 0.12 : 0.4}
          roughness={0.6}
          transparent
          opacity={mode !== 'status' ? 0.92 : occupied ? 0.55 : 0.92}
        />
      </mesh>

      {/* 選取外框 */}
      {selected && (
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[space.d * 1.08, 0.02, space.w * 1.08]} />
          <meshBasicMaterial color="#ffffff" wireframe />
        </mesh>
      )}

      {/* 有車則顯示車輛（剛停入 5 分鐘內整車紅色）；電量/訊號巡檢模式隱藏車輛避免遮蔽色階 */}
      {mode === 'status' && occupied && (
        <Car
          length={space.d * 0.9}
          width={space.w * 0.88}
          color={newArrival ? NEW_ARRIVAL_CAR_COLOR : isBus ? BUS_COLOR : CAR_COLOR}
          bus={isBus}
          glow={newArrival}
        />
      )}

      {/* 編號（縮放近或選取時顯示） */}
      {(showLabel || selected) && (
        <Text
          position={[0, isBus ? 3.6 : 1.8, 0]}
          rotation={[0, space.rot * DEG, 0]}
          fontSize={isBus ? 1.6 : 1.1}
          color="#f1f5f9"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#0f172a"
        >
          {space.name}
        </Text>
      )}
    </group>
  )
})
