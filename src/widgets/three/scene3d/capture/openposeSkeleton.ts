import * as THREE from 'three'


const COCO_KEYPOINT_BONES: ReadonlyMap<number, string> = new Map([
  [0, 'head'],
  [1, 'neck_01'],
  [2, 'upperarm_r'],
  [3, 'lowerarm_r'],
  [4, 'hand_r'],
  [5, 'upperarm_l'],
  [6, 'lowerarm_l'],
  [7, 'hand_l'],
  [8, 'thigh_r'],
  [9, 'calf_r'],
  [10, 'foot_r'],
  [11, 'thigh_l'],
  [12, 'calf_l'],
  [13, 'foot_l']
])

const COCO_KEYPOINT_SUFFIXES: ReadonlyMap<number, string> = new Map([
  [0, 'Head'],
  [1, 'Neck'],
  [2, 'RightArm'],
  [3, 'RightForeArm'],
  [4, 'RightHand'],
  [5, 'LeftArm'],
  [6, 'LeftForeArm'],
  [7, 'LeftHand'],
  [8, 'RightUpLeg'],
  [9, 'RightLeg'],
  [10, 'RightFoot'],
  [11, 'LeftUpLeg'],
  [12, 'LeftLeg'],
  [13, 'LeftFoot']
])

const MIN_MAPPED_KEYPOINTS = 8

export const LIMBS: ReadonlyArray<readonly [number, number]> = [
  [2, 3], [2, 6], [3, 4], [4, 5], [6, 7], [7, 8], [2, 9], [9, 10],
  [10, 11], [2, 12], [12, 13], [13, 14], [2, 1]
]
export const COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0], [170, 255, 0],
  [85, 255, 0], [0, 255, 0], [0, 255, 85], [0, 255, 170], [0, 255, 255],
  [0, 170, 255], [0, 85, 255], [0, 0, 255], [85, 0, 255], [170, 0, 255],
  [255, 0, 170], [255, 0, 255], [255, 0, 85]
]

export function mapCharacterKeypoints(
  root: THREE.Object3D
): Map<number, THREE.Object3D> | null {
  const byName = new Map<string, THREE.Object3D[]>()
  root.traverse((object) => {
    const list = byName.get(object.name)
    if (list) list.push(object)
    else byName.set(object.name, [object])
  })

  const exact = new Map<number, THREE.Object3D>()
  for (const [coco, bone] of COCO_KEYPOINT_BONES) {
    const candidates = byName.get(bone)
    if (candidates?.length) exact.set(coco, candidates[0])
  }
  if (exact.size >= MIN_MAPPED_KEYPOINTS) return exact

  const bySuffix = new Map<number, THREE.Object3D>()
  for (const [coco, suffix] of COCO_KEYPOINT_SUFFIXES) {
    const candidates: THREE.Object3D[] = []
    for (const [name, objects] of byName) {
      if (name.endsWith(suffix) && !name.includes('IKTarget')) {
        candidates.push(...objects)
      }
    }
    if (candidates.length) {
      candidates.sort((a, b) => a.name.localeCompare(b.name))
      bySuffix.set(coco, candidates[0])
    }
  }
  return bySuffix.size >= MIN_MAPPED_KEYPOINTS ? bySuffix : null
}

export function projectKeypoints(
  keypoints: ReadonlyMap<number, THREE.Object3D>,
  camera: THREE.Camera,
  width: number,
  height: number
): Map<number, readonly [number, number]> {
  const projected = new Map<number, readonly [number, number]>()
  const world = new THREE.Vector3()
  const view = new THREE.Vector3()
  camera.updateMatrixWorld(true)
  for (const [coco, bone] of keypoints) {
    bone.getWorldPosition(world)
    view.copy(world).applyMatrix4(camera.matrixWorldInverse)
    if (-view.z <= 1e-4) continue
    world.project(camera)
    projected.set(coco, [
      (world.x + 1) * 0.5 * width,
      (1 - world.y) * 0.5 * height
    ])
  }
  return projected
}

export function drawPoseFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  characters: ReadonlyArray<ReadonlyMap<number, readonly [number, number]>>
): void {
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)
  const stick = Math.max(2, Math.round(Math.min(width, height) / 128))
  ctx.lineWidth = stick
  ctx.lineCap = 'round'
  for (const points of characters) {
    LIMBS.forEach(([a, b], limbIndex) => {
      const pa = points.get(a - 1)
      const pb = points.get(b - 1)
      if (!pa || !pb) return
      const [r, g, bl] = COLORS[limbIndex]
      ctx.strokeStyle = `rgb(${r},${g},${bl})`
      ctx.beginPath()
      ctx.moveTo(pa[0], pa[1])
      ctx.lineTo(pb[0], pb[1])
      ctx.stroke()
    })
    for (const [coco, [x, y]] of points) {
      const [r, g, bl] = COLORS[coco % COLORS.length]
      ctx.fillStyle = `rgb(${r},${g},${bl})`
      ctx.beginPath()
      ctx.arc(x, y, stick, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
