import { memo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import type { Mesh, MeshStandardMaterial } from 'three'
import type { Space } from '../types'
import { colorFor } from './colors'
import { Car } from './Car'

const DEG = Math.PI / 180

interface Props {
  space: Space
  cx: number
  cy: number
  showLabel: boolean
  selected: boolean
  onSelect: (name: string) => void
}

// local +x = facing 方向；pad 長 d 沿 x、寬 w 沿 z。
export const ParkingSpace = memo(function ParkingSpace({
  space, cx, cy, showLabel, selected, onSelect,
}: Props) {
  const padMat = useRef<MeshStandardMaterial>(null)
  const padRef = useRef<Mesh>(null)
  const color = colorFor(space.status, space.offline)
  const occupied = space.status === 'Occupied'
  const isBus = space.type === 'bus'

  // 離線：閃爍；被選取：脈動抬升
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (space.offline && padMat.current) {
      padMat.current.emissiveIntensity = 0.4 + 0.4 * Math.sin(t * 4)
    }
    if (selected && padRef.current) {
      padRef.current.position.y = 0.04 + 0.05 * (0.5 + 0.5 * Math.sin(t * 5))
    }
  })

  const wx = space.x - cx
  const wz = space.y - cy

  return (
    <group position={[wx, 0, wz]} rotation={[0, -space.rot * DEG, 0]}>
      {/* 狀態地墊 */}
      <mesh
        ref={padRef}
        position={[0, 0.04, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(space.name) }}
      >
        <boxGeometry args={[space.d * 0.95, 0.08, space.w * 0.92]} />
        <meshStandardMaterial
          ref={padMat}
          color={color}
          emissive={color}
          emissiveIntensity={space.offline ? 0.6 : occupied ? 0.15 : 0.45}
          roughness={0.6}
        />
      </mesh>

      {/* 選取外框 */}
      {selected && (
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[space.d * 1.05, 0.02, space.w * 1.02]} />
          <meshBasicMaterial color="#ffffff" wireframe />
        </mesh>
      )}

      {/* 有車則顯示車輛 */}
      {occupied && (
        <Car length={space.d * 0.9} width={space.w * 0.88} color={isBus ? '#dc2626' : '#cbd5e1'} bus={isBus} />
      )}

      {/* 編號（縮放近或選取時顯示） */}
      {(showLabel || selected) && (
        <Text
          position={[0, isBus ? 3.2 : 1.6, 0]}
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
