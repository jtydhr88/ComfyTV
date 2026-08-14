export interface FilmCameraPose {
  x: number
  y: number
  z: number
  fovDeg: number
}

export interface FilmSubject {
  x: number
  y: number
  z: number
  heightM: number
  facingYaw: number | null
}

export interface ShotDescription {
  sizeLabel: string
  levelLabel: string
  viewLabel: string | null
  focalMm: number
  text: string
}

const SIZE_LADDER: Array<[number, string]> = [
  [1.1, 'extreme close-up'],
  [0.65, 'close-up'],
  [0.42, 'medium close-up'],
  [0.26, 'medium shot'],
  [0.15, 'medium wide shot'],
  [0.07, 'wide shot'],
  [0, 'extreme wide shot']
]

const FOCAL_LADDER = [14, 20, 24, 35, 50, 85, 135]
const SENSOR_HEIGHT_MM = 24

export function shotSizeLabel(
  distance: number,
  fovDeg: number,
  subjectHeight: number
): string {
  const frameHeight = 2 * Math.max(0.1, distance) * Math.tan((fovDeg * Math.PI) / 360)
  const fraction = subjectHeight / Math.max(0.01, frameHeight)
  for (const [threshold, label] of SIZE_LADDER) {
    if (fraction >= threshold) return label
  }
  return 'extreme wide shot'
}

export function shotLevelLabel(cameraY: number, subjectEyeY: number): string {
  const delta = cameraY - subjectEyeY
  if (delta < -0.9) return 'ground level'
  if (delta < -0.25) return 'low angle'
  if (delta <= 0.6) return 'eye level'
  if (delta <= 2.2) return 'high angle'
  return "bird's-eye view"
}

export function shotViewLabel(
  camera: { x: number; z: number },
  subject: { x: number; z: number; facingYaw: number | null }
): string | null {
  if (subject.facingYaw === null) return null
  const toCamera = Math.atan2(camera.x - subject.x, camera.z - subject.z)
  let diff = Math.abs(toCamera - subject.facingYaw)
  diff = diff % (Math.PI * 2)
  if (diff > Math.PI) diff = Math.PI * 2 - diff
  const deg = (diff * 180) / Math.PI
  if (deg <= 30) return 'front view'
  if (deg <= 75) return 'front three-quarter view'
  if (deg <= 105) return 'profile view'
  if (deg <= 150) return 'rear three-quarter view'
  return 'view from behind'
}

export function fovToFocalMm(fovDeg: number): number {
  const focal = SENSOR_HEIGHT_MM / 2 / Math.tan((fovDeg * Math.PI) / 360)
  let best = FOCAL_LADDER[0]
  for (const candidate of FOCAL_LADDER) {
    if (Math.abs(candidate - focal) < Math.abs(best - focal)) best = candidate
  }
  return best
}

const MOVE_PHRASES: Array<[RegExp, string]> = [
  [/push/, 'a push-in toward the subject'],
  [/pull/, 'a pull-back away from the subject'],
  [/dolly/, 'a dolly move'],
  [/zoom/, 'a zoom'],
  [/contra/, 'a dolly-zoom'],
  [/orbit|360/, 'an orbit around the subject'],
  [/crane/, 'a crane move'],
  [/pan/, 'a panning move'],
  [/slide|track/, 'a tracking move'],
  [/handheld|shake/, 'a handheld camera'],
  [/rise|up/, 'a rising move'],
  [/down|fall/, 'a descending move']
]

export function movementPhrase(
  presetId: string | null,
  locked: boolean
): string {
  if (presetId) {
    const id = presetId.toLowerCase()
    for (const [pattern, phrase] of MOVE_PHRASES) {
      if (pattern.test(id)) {
        return locked ? `${phrase}, tracking the subject` : phrase
      }
    }
    return locked
      ? `a ${id.replace(/_/g, ' ')} camera move, tracking the subject`
      : `a ${id.replace(/_/g, ' ')} camera move`
  }
  return locked ? 'the camera tracking the subject' : 'a locked-off camera'
}

export function describeShotPose(
  camera: FilmCameraPose,
  subject: FilmSubject,
  presetId: string | null,
  locked: boolean
): ShotDescription {
  const distance = Math.hypot(
    camera.x - subject.x,
    camera.y - (subject.y + subject.heightM / 2),
    camera.z - subject.z
  )
  const sizeLabel = shotSizeLabel(distance, camera.fovDeg, subject.heightM)
  const levelLabel = shotLevelLabel(
    camera.y,
    subject.y + subject.heightM * 0.94
  )
  const viewLabel = shotViewLabel(camera, subject)
  const focalMm = fovToFocalMm(camera.fovDeg)
  const parts = [
    sizeLabel,
    levelLabel,
    ...(viewLabel ? [viewLabel] : []),
    `${focalMm}mm lens`,
    movementPhrase(presetId, locked)
  ]
  return { sizeLabel, levelLabel, viewLabel, focalMm, text: parts.join(', ') }
}
