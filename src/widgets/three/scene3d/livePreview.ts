import * as THREE from 'three'

import { COLORS, LIMBS, mapCharacterKeypoints } from './capture/openposeSkeleton'


const DEPTH_PREVIEW_VERTEX =  `
#include <common>
#include <skinning_pars_vertex>
varying vec3 vViewPosition;
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vViewPosition = mvPosition.xyz;
}
`

const DEPTH_PREVIEW_FRAGMENT =  `
uniform float uMin;
uniform float uMax;
varying vec3 vViewPosition;
void main() {
  float d = length(vViewPosition);
  float v = clamp((uMax - d) / max(uMax - uMin, 1e-4), 0.0, 1.0);
  gl_FragColor = vec4(vec3(v), 1.0);
}
`

export function createDepthPreviewMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: DEPTH_PREVIEW_VERTEX,
    fragmentShader: DEPTH_PREVIEW_FRAGMENT,
    side: THREE.DoubleSide,
    uniforms: { uMin: { value: 0.1 }, uMax: { value: 20 } }
  })
}

const _box = new THREE.Box3()
const _sphere = new THREE.Sphere()
const _camPos = new THREE.Vector3()

export function updateDepthPreviewRange(
  material: THREE.ShaderMaterial,
  camera: THREE.Camera,
  objects: readonly THREE.Object3D[]
): void {
  camera.getWorldPosition(_camPos)
  let min = Infinity
  let max = -Infinity
  for (const object of objects) {
    _box.setFromObject(object)
    if (_box.isEmpty()) continue
    _box.getBoundingSphere(_sphere)
    const distance = _camPos.distanceTo(_sphere.center)
    min = Math.min(min, Math.max(distance - _sphere.radius, 0.01))
    max = Math.max(max, distance + _sphere.radius)
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0.1
    max = 20
  }
  material.uniforms.uMin.value = min
  material.uniforms.uMax.value = Math.max(max, min + 0.01)
}

const MAX_POSE_CHARACTERS = 16

export class PosePreview {
  readonly scene = new THREE.Scene()
  private readonly lines: THREE.LineSegments
  private readonly points: THREE.Points
  private readonly linePositions: Float32Array
  private readonly lineColors: Float32Array
  private readonly pointPositions: Float32Array
  private readonly pointColors: Float32Array
  private readonly keypointCache = new Map<
    string,
    Map<number, THREE.Object3D> | null
  >()

  constructor() {
    this.scene.background = new THREE.Color(0x000000)

    const lineVerts = MAX_POSE_CHARACTERS * LIMBS.length * 2
    this.linePositions = new Float32Array(lineVerts * 3)
    this.lineColors = new Float32Array(lineVerts * 3)
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.linePositions, 3)
    )
    lineGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.lineColors, 3)
    )
    this.lines = new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({ vertexColors: true })
    )
    this.lines.frustumCulled = false
    this.scene.add(this.lines)

    const pointVerts = MAX_POSE_CHARACTERS * 18
    this.pointPositions = new Float32Array(pointVerts * 3)
    this.pointColors = new Float32Array(pointVerts * 3)
    const pointGeometry = new THREE.BufferGeometry()
    pointGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.pointPositions, 3)
    )
    pointGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.pointColors, 3)
    )
    this.points = new THREE.Points(
      pointGeometry,
      new THREE.PointsMaterial({ vertexColors: true, size: 6, sizeAttenuation: false })
    )
    this.points.frustumCulled = false
    this.scene.add(this.points)
  }

  update(roots: readonly THREE.Object3D[]): void {
    const world = new THREE.Vector3()
    let lineVert = 0
    let pointVert = 0

    for (const root of roots) {
      const cacheKey = root.uuid
      let keypoints = this.keypointCache.get(cacheKey)
      if (keypoints === undefined) {
        keypoints = mapCharacterKeypoints(root)
        this.keypointCache.set(cacheKey, keypoints)
      }
      if (!keypoints) continue
      if (lineVert / (LIMBS.length * 2) >= MAX_POSE_CHARACTERS) break

      root.updateMatrixWorld(true)
      const positions = new Map<number, THREE.Vector3>()
      for (const [coco, bone] of keypoints) {
        bone.getWorldPosition(world)
        positions.set(coco, world.clone())
      }

      LIMBS.forEach(([a, b], limbIndex) => {
        const pa = positions.get(a - 1)
        const pb = positions.get(b - 1)
        if (!pa || !pb) return
        const [r, g, bl] = COLORS[limbIndex]
        for (const p of [pa, pb]) {
          this.linePositions.set([p.x, p.y, p.z], lineVert * 3)
          this.lineColors.set([r / 255, g / 255, bl / 255], lineVert * 3)
          lineVert += 1
        }
      })

      for (const [coco, p] of positions) {
        if (pointVert >= MAX_POSE_CHARACTERS * 18) break
        const [r, g, bl] = COLORS[coco % COLORS.length]
        this.pointPositions.set([p.x, p.y, p.z], pointVert * 3)
        this.pointColors.set([r / 255, g / 255, bl / 255], pointVert * 3)
        pointVert += 1
      }
    }

    const lineGeometry = this.lines.geometry
    lineGeometry.setDrawRange(0, lineVert)
    lineGeometry.attributes.position.needsUpdate = true
    lineGeometry.attributes.color.needsUpdate = true
    const pointGeometry = this.points.geometry
    pointGeometry.setDrawRange(0, pointVert)
    pointGeometry.attributes.position.needsUpdate = true
    pointGeometry.attributes.color.needsUpdate = true
  }

  invalidateCache(): void {
    this.keypointCache.clear()
  }

  dispose(): void {
    this.lines.geometry.dispose()
    ;(this.lines.material as THREE.Material).dispose()
    this.points.geometry.dispose()
    ;(this.points.material as THREE.Material).dispose()
  }
}
