export interface ColorStop {
  offset: number
  color: [number, number, number]
}

export const TEMP_STOPS: ColorStop[] = [
  { offset: 0, color: [80, 150, 255] },
  { offset: 0.5, color: [200, 200, 200] },
  { offset: 1, color: [255, 170, 60] },
]

export const TINT_STOPS: ColorStop[] = [
  { offset: 0, color: [230, 80, 200] },
  { offset: 0.5, color: [200, 200, 200] },
  { offset: 1, color: [90, 210, 90] },
]

export const HUE_STOPS: ColorStop[] = [
  { offset: 0, color: [255, 0, 0] },
  { offset: 1 / 6, color: [255, 255, 0] },
  { offset: 2 / 6, color: [0, 255, 0] },
  { offset: 3 / 6, color: [0, 255, 255] },
  { offset: 4 / 6, color: [0, 0, 255] },
  { offset: 5 / 6, color: [255, 0, 255] },
  { offset: 1, color: [255, 0, 0] },
]
