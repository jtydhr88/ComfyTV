export interface DropdownOption {
  key: string
  value: number
}

export const AZIMUTH_OPTIONS: DropdownOption[] = [
  { key: 'frontView', value: 0 },
  { key: 'frontRightQuarterView', value: 45 },
  { key: 'rightSideView', value: 90 },
  { key: 'backRightQuarterView', value: 135 },
  { key: 'backView', value: 180 },
  { key: 'backLeftQuarterView', value: 225 },
  { key: 'leftSideView', value: 270 },
  { key: 'frontLeftQuarterView', value: 315 },
]

export const ELEVATION_OPTIONS: DropdownOption[] = [
  { key: 'lowAngleShot', value: -30 },
  { key: 'eyeLevelShot', value: 0 },
  { key: 'elevatedShot', value: 30 },
  { key: 'highAngleShot', value: 60 },
]

export const DISTANCE_OPTIONS: DropdownOption[] = [
  { key: 'wideShot', value: 1 },
  { key: 'mediumShot', value: 4 },
  { key: 'closeUp', value: 8 },
]

export function findClosestOption(value: number, options: DropdownOption[], isAzimuth = false): number {
  let closest = options[0].value
  let minDiff = Math.abs(value - options[0].value)
  for (const opt of options) {
    let diff = Math.abs(value - opt.value)
    if (isAzimuth) {
      diff = Math.min(diff, Math.abs(value - opt.value - 360), Math.abs(value - opt.value + 360))
    }
    if (diff < minDiff) {
      minDiff = diff
      closest = opt.value
    }
  }
  return closest
}

export function findClosestDistanceOption(dist: number): number {
  if (dist < 2) return 1
  if (dist < 6) return 4
  return 8
}
