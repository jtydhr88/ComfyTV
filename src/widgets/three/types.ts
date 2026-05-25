export interface CameraState {
  azimuth: number
  elevation: number
  distance: number
  imageUrl: string | null
}

export interface CameraWidgetOptions {
  container: HTMLElement
  initialState?: Partial<CameraState>
  onStateChange?: (state: CameraState) => void
}

export interface AppExposed {
  updateImage: (url: string | null) => void
  setCameraView: (enabled: boolean) => void
  setState: (state: Partial<CameraState>) => void
  cleanup: () => void
}
