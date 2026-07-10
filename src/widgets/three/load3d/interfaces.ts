import type * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

export type MaterialMode =
  | 'original'
  | 'pointCloud'
  | 'normal'
  | 'wireframe'
  | 'depth'
export type UpDirection = 'original' | '-x' | '+x' | '-y' | '+y' | '-z' | '+z'
export type CameraType = 'perspective' | 'orthographic'
export type BackgroundRenderModeType = 'tiled' | 'panorama'

interface CameraQuaternion {
  x: number
  y: number
  z: number
  w: number
}

interface CameraFrustum {
  left: number
  right: number
  top: number
  bottom: number
}

export interface CameraState {
  position: THREE.Vector3
  target: THREE.Vector3
  zoom: number
  cameraType: CameraType
  quaternion?: CameraQuaternion
  fov?: number
  aspect?: number
  near?: number
  far?: number
  frustum?: CameraFrustum
}

export interface Model3DTransform {
  position: { x: number; y: number; z: number }
  quaternion: { x: number; y: number; z: number; w: number }
  scale: { x: number; y: number; z: number }
}

export type Model3DInfo = Model3DTransform[]

export interface SceneConfig {
  showGrid: boolean
  backgroundColor: string
  backgroundImage?: string
  backgroundRenderMode?: BackgroundRenderModeType
  models?: Model3DInfo
}

export type GizmoMode = 'translate' | 'rotate' | 'scale'

export interface GizmoConfig {
  enabled: boolean
  mode: GizmoMode
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
}

export interface ModelConfig {
  upDirection: UpDirection
  materialMode: MaterialMode
  showSkeleton: boolean
  gizmo?: GizmoConfig
}

export interface CameraConfig {
  cameraType: CameraType
  fov: number
  state?: CameraState
}

export interface CameraPresetTuning {
  fovScale?: number
  reverse?: boolean
  positionOffset?: { x: number; y: number; z: number }
  yawDegrees?: number
  pathScale?: number
  rollDegrees?: number
}

export interface CameraPresetConfig {
  presetId: string | null
  file: string | null
  tuning: CameraPresetTuning
  cameraSpeed: number
  loopPlayback: boolean
}

export interface LightConfig {
  intensity: number
  hdri?: HDRIConfig
}

export interface HDRIConfig {
  enabled: boolean
  hdriPath: string
  showAsBackground: boolean
  intensity: number
}

export interface EventCallback<T = unknown> {
  (data: T): void
}

export interface Load3DOptions {
  width?: number
  height?: number

  getDimensions?: () => { width: number; height: number } | null

  getZoomScale?: () => number

  isViewerMode?: boolean

  onContextMenu?: (event: MouseEvent) => void
}

export interface CaptureResult {
  scene: string
  mask: string
  normal: string
}

interface BaseManager {
  init(): void
  dispose(): void
  reset(): void
}

export interface AnimationItem {
  name: string
  index: number
}

export interface SceneManagerInterface extends BaseManager {
  scene: THREE.Scene
  gridHelper: THREE.GridHelper
  toggleGrid(showGrid: boolean): void
  setBackgroundColor(color: string): void
  setBackgroundImage(uploadPath: string): Promise<void>
  removeBackgroundImage(): void
  setBackgroundRenderMode(mode: BackgroundRenderModeType): void
  handleResize(width: number, height: number): void
  captureScene(width: number, height: number): Promise<CaptureResult>
}

export interface CameraManagerInterface extends BaseManager {
  activeCamera: THREE.Camera
  perspectiveCamera: THREE.PerspectiveCamera
  orthographicCamera: THREE.OrthographicCamera
  getCurrentCameraType(): CameraType
  toggleCamera(cameraType?: CameraType): void
  setFOV(fov: number): void
  setCameraState(state: CameraState): void
  getCameraState(): CameraState
  handleResize(width: number, height: number): void
  setControls(controls: OrbitControls): void
}

export interface ControlsManagerInterface extends BaseManager {
  controls: OrbitControls
  handleResize(): void
}

export interface LightingManagerInterface extends BaseManager {
  lights: THREE.Light[]
  setLightIntensity(intensity: number): void
}

export interface ViewHelperManagerInterface extends BaseManager {
  viewHelper: ViewHelper
  viewHelperContainer: HTMLDivElement
  createViewHelper(container: Element | HTMLElement): void
  update(delta: number): void
  handleResize(): void
}

export interface EventManagerInterface {
  addEventListener<T>(event: string, callback: EventCallback<T>): void
  removeEventListener<T>(event: string, callback: EventCallback<T>): void
  emitEvent<T>(event: string, data: T): void
}

export interface AnimationManagerInterface extends BaseManager {
  currentAnimation: THREE.AnimationMixer | null
  animationActions: THREE.AnimationAction[]
  animationClips: THREE.AnimationClip[]
  selectedAnimationIndex: number
  isAnimationPlaying: boolean
  animationSpeed: number

  setupModelAnimations(
    model: THREE.Object3D,
    originalModel: THREE.Object3D | THREE.BufferGeometry | GLTF | null
  ): void
  updateAnimationList(): void
  setAnimationSpeed(speed: number): void
  updateSelectedAnimation(index: number): void
  toggleAnimation(play?: boolean): void
  update(delta: number): void
  getAnimationTime(): number
  getAnimationDuration(): number
  setAnimationTime(time: number): void
}

export interface ModelManagerInterface {
  originalFileName: string | null
  originalURL: string | null
  currentModel: THREE.Object3D | null
  originalModel: THREE.Object3D | THREE.BufferGeometry | GLTF | null
  originalRotation: THREE.Euler | null
  currentUpDirection: UpDirection

  init(): void
  dispose(): void
  clearModel(): void
  reset(): void
  setupModel(model: THREE.Object3D): Promise<void>
  addModelToScene(model: THREE.Object3D): void
  setOriginalModel(model: THREE.Object3D | THREE.BufferGeometry | GLTF): void
  setUpDirection(direction: UpDirection): void
  materialMode: MaterialMode
  originalMaterials: WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>
  normalMaterial: THREE.MeshNormalMaterial
  standardMaterial: THREE.MeshStandardMaterial
  wireframeMaterial: THREE.MeshBasicMaterial
  depthMaterial: THREE.MeshDepthMaterial
  setMaterialMode(mode: MaterialMode): void
  setupModelMaterials(model: THREE.Object3D): void
}

export interface LoadModelOptions {
  silentOnNotFound?: boolean
}

export interface SceneOverlay {
  attach(scene: THREE.Scene): void
  detach(): void
  update?(deltaSeconds: number): void
  onActiveCameraChange?(camera: THREE.Camera): void
  dispose(): void
}

export interface LoaderManagerInterface {
  init(): void
  dispose(): void
  loadModel(
    url: string,
    originalFileName?: string,
    options?: LoadModelOptions
  ): Promise<void>
}
