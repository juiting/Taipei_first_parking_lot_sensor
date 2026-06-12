import { memo } from 'react'

interface Props {
  length: number // 沿車身長軸（local +x）
  width: number
  color: string
  bus?: boolean
}

// 低面數車輛：車身 + 車頂 + 四輪。local +x 為車頭方向。
export const Car = memo(function Car({ length, width, color, bus }: Props) {
  const h = bus ? 1.6 : 0.7
  const cabinH = bus ? 0.6 : 0.5
  const bodyL = length * 0.94
  const bodyW = width * 0.86
  const wheelR = bus ? 0.45 : 0.32
  const wy = wheelR
  const wx = bodyL * 0.3
  const wz = bodyW / 2
  return (
    <group position={[0, 0.06, 0]}>
      {/* 車身 */}
      <mesh position={[0, wy + h / 2, 0]} castShadow>
        <boxGeometry args={[bodyL, h, bodyW]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
      </mesh>
      {/* 車頂 / 車廂 */}
      <mesh position={[bus ? 0 : -bodyL * 0.05, wy + h + cabinH / 2, 0]}>
        <boxGeometry args={[bodyL * (bus ? 0.9 : 0.5), cabinH, bodyW * 0.86]} />
        <meshStandardMaterial color={color} metalness={0.2} roughness={0.6} />
      </mesh>
      {/* 四輪 */}
      {[
        [wx, -wz], [wx, wz], [-wx, -wz], [-wx, wz],
      ].map(([px, pz], i) => (
        <mesh key={i} position={[px, wy, pz]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[wheelR, wheelR, 0.2, 12]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      ))}
    </group>
  )
})
