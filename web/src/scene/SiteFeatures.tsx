import { memo } from 'react'
import { Text } from '@react-three/drei'
import type { SiteFeatures as Features } from '../types'

const DEG = Math.PI / 180

interface Props {
  features: Features
  cx: number
  cy: number
}

// rect = [x1, y1, x2, y2]（場域座標，y 向南）→ 置中後的平面
function Rect({ r, cx, cy, color, y = 0.01, opacity = 1 }: {
  r: number[]; cx: number; cy: number; color: string; y?: number; opacity?: number
}) {
  const [x1, y1, x2, y2] = r
  return (
    <mesh position={[(x1 + x2) / 2 - cx, y, (y1 + y2) / 2 - cy]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[x2 - x1, y2 - y1]} />
      <meshStandardMaterial color={color} roughness={1} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  )
}

function Tree({ x, z, blossom }: { x: number; z: number; blossom?: boolean }) {
  const canopy = blossom ? '#b78bbf' : '#3e7d4a'
  const canopy2 = blossom ? '#a376ab' : '#346a3f'
  const s = blossom ? 0.8 : 1
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.8 * s, 0]}>
        <cylinderGeometry args={[0.14, 0.2, 1.6 * s, 6]} />
        <meshStandardMaterial color="#6b4a2b" />
      </mesh>
      <mesh position={[0, 1.9 * s, 0]}>
        <sphereGeometry args={[1.35 * s, 10, 8]} />
        <meshStandardMaterial color={canopy} roughness={0.9} />
      </mesh>
      <mesh position={[0.5 * s, 2.5 * s, 0.3 * s]}>
        <sphereGeometry args={[0.9 * s, 8, 6]} />
        <meshStandardMaterial color={canopy2} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Gate({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, -rot * DEG, 0]}>
      {/* 崗亭 */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <boxGeometry args={[2.2, 2.6, 2.4]} />
        <meshStandardMaterial color="#e7e9ee" roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.75, 0]}>
        <boxGeometry args={[2.6, 0.16, 2.8]} />
        <meshStandardMaterial color="#39424f" />
      </mesh>
      {/* 柵欄桿 */}
      <mesh position={[3.6, 1.0, 0]}>
        <boxGeometry args={[4.4, 0.12, 0.12]} />
        <meshStandardMaterial color="#f2c200" emissive="#f2c200" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[1.5, 0.55, 0]}>
        <boxGeometry args={[0.3, 1.1, 0.3]} />
        <meshStandardMaterial color="#39424f" />
      </mesh>
    </group>
  )
}

export const SiteFeatures = memo(function SiteFeatures({ features: f, cx, cy }: Props) {
  return (
    <group>
      {/* 場區瀝青 */}
      {f.lot && <Rect r={f.lot} cx={cx} cy={cy} color="#262d37" y={0.005} />}

      {/* 周邊道路 */}
      {f.roads?.map((r, i) => <Rect key={`rd${i}`} r={r} cx={cx} cy={cy} color="#151a21" y={0.004} />)}

      {/* 第一綠地（草皮 + 四邊綠籬） */}
      {f.grass?.map((r, i) => {
        const [x1, y1, x2, y2] = r
        const mx = (x1 + x2) / 2 - cx
        const mz = (y1 + y2) / 2 - cy
        const w = x2 - x1
        const d = y2 - y1
        return (
          <group key={`g${i}`}>
            <Rect r={r} cx={cx} cy={cy} color="#33703e" y={0.012} />
            {[
              [mx, mz - d / 2, w, 0.5], [mx, mz + d / 2, w, 0.5],
              [mx - w / 2, mz, 0.5, d], [mx + w / 2, mz, 0.5, d],
            ].map(([hx, hz, hw, hd], j) => (
              <mesh key={j} position={[hx, 0.3, hz]}>
                <boxGeometry args={[hw, 0.6, hd]} />
                <meshStandardMaterial color="#2c5e35" roughness={1} />
              </mesh>
            ))}
          </group>
        )
      })}

      {/* 機車停放區 */}
      {f.moto?.map((r, i) => (
        <group key={`m${i}`}>
          <Rect r={r} cx={cx} cy={cy} color="#2e3642" y={0.011} />
          <Text
            position={[(r[0] + r[2]) / 2 - cx, 0.05, (r[1] + r[3]) / 2 - cy]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={2.4}
            color="#73809a"
            anchorX="center"
            anchorY="middle"
          >
            機車停放區
          </Text>
        </group>
      ))}

      {/* 周邊建物（鄰地，非監控範圍） */}
      {f.buildings?.map((b, i) => {
        const [x1, y1, x2, y2, h = 12] = b
        return (
          <mesh key={`b${i}`} position={[(x1 + x2) / 2 - cx, h / 2, (y1 + y2) / 2 - cy]} castShadow>
            <boxGeometry args={[x2 - x1, h, y2 - y1]} />
            <meshStandardMaterial color="#8d96a6" roughness={0.85} />
          </mesh>
        )
      })}

      {/* 紅磚圍牆 */}
      {f.walls?.map((w, i) => {
        const [x1, y1, x2, y2] = w
        return (
          <mesh key={`w${i}`} position={[(x1 + x2) / 2 - cx, 1.1, (y1 + y2) / 2 - cy]}>
            <boxGeometry args={[Math.max(x2 - x1, 0.5), 2.2, Math.max(y2 - y1, 0.5)]} />
            <meshStandardMaterial color="#94402e" roughness={0.9} />
          </mesh>
        )
      })}

      {/* 樹木 */}
      {f.trees?.map(([x, y], i) => <Tree key={`t${i}`} x={x - cx} z={y - cy} />)}
      {f.street_trees?.map(([x, y], i) => <Tree key={`st${i}`} x={x - cx} z={y - cy} blossom />)}

      {/* 出入口崗亭 */}
      {f.gates?.map(([x, y, rot], i) => <Gate key={`gt${i}`} x={x - cx} z={y - cy} rot={rot ?? 0} />)}
    </group>
  )
})
