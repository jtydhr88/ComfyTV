import * as THREE from 'three'

import type { PrevizActorKind, PrevizPose } from './types'

const mat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })
const flatMat = (c: number) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true })
const envMat = () => new THREE.MeshStandardMaterial({ color: 0x7d786c, roughness: 0.9 })

export interface CharacterRig {
  body: THREE.Group
  spine: THREE.Group
  neck: THREE.Group
  shL: THREE.Group
  elL: THREE.Group
  wristL: THREE.Group
  shR: THREE.Group
  elR: THREE.Group
  wristR: THREE.Group
  hipL: THREE.Group
  kneeL: THREE.Group
  ankleL: THREE.Group
  hipR: THREE.Group
  kneeR: THREE.Group
  ankleR: THREE.Group
}

export const POSE_JOINTS: Record<string, Record<string, number>> = {
  stand: {},
  sit: {
    bodyY: -0.75,
    spineX: 8,
    hipLX: -84,
    hipRX: -84,
    kneeL: 22,
    kneeR: 22,
    shLX: -20,
    shRX: -20,
    elL: -30,
    elR: -30
  },
  crouch: {
    bodyY: -0.55,
    spineX: 42,
    hipLX: -100,
    hipRX: -100,
    kneeL: 125,
    kneeR: 125,
    shLX: -40,
    shRX: -40,
    elL: -60,
    elR: -60
  },
  lie: { bodyRotX: -90, bodyY: 0.14 },
  ride: {
    bodyY: -0.92,
    spineX: 6,
    hipLX: -55,
    hipRX: -55,
    hipLZ: -42,
    hipRZ: 42,
    kneeL: 70,
    kneeR: 70,
    shLX: -32,
    shRX: -32,
    elL: -55,
    elR: -55
  }
}

export const HORSE_RIDE_JOINTS: Record<string, number> = {
  ...POSE_JOINTS.ride,
  bodyY: -0.82,
  hipLZ: -46,
  hipRZ: 46,
  kneeL: 72,
  kneeR: 72
}

export const CHAR_COLORS = [0x2f6bff, 0xf0445e, 0xffd43b, 0x38c793, 0x9a6bff, 0xff8a3d]

export function makeCharacter(color = 0x2f6bff): THREE.Group {
  const g = new THREE.Group()
  const primary = mat(color)
  const featureMat = mat(0x121826)
  const whiteMat = mat(0xffffff)
  const jointRing = (name: string, radius: number, colorMaterial = featureMat) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.012, 6, 14), colorMaterial)
    ring.name = name
    return ring
  }
  const body = new THREE.Group()
  body.name = 'bodyRoot'
  g.add(body)
  const rig = { body } as CharacterRig
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.135, 0.22, 8), primary)
  pelvis.name = 'pelvis'
  pelvis.position.y = 1.0
  pelvis.castShadow = true
  body.add(pelvis)
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.153, 0.153, 0.035, 10), featureMat)
  belt.name = 'waistMarker'
  belt.position.y = 1.085
  body.add(belt)
  const spine = new THREE.Group()
  spine.name = 'spine'
  spine.position.y = 1.06
  body.add(spine)
  rig.spine = spine
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.14, 0.5, 8), primary)
  chest.name = 'torso'
  chest.position.y = 0.28
  chest.castShadow = true
  spine.add(chest)
  const shoulderLine = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.075, 0.17), primary)
  shoulderLine.name = 'shoulderLine'
  shoulderLine.position.y = 0.48
  spine.add(shoulderLine)
  const forward = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.11, 3), whiteMat)
  forward.name = 'torsoForwardMarker'
  forward.position.set(0, 0.31, 0.151)
  forward.rotation.x = Math.PI / 2
  spine.add(forward)
  const neck = new THREE.Group()
  neck.name = 'neck'
  neck.position.y = 0.54
  spine.add(neck)
  rig.neck = neck
  const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 7), primary)
  neckM.name = 'neckMesh'
  neckM.position.y = 0.04
  neck.add(neckM)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 9), primary)
  head.name = 'head'
  head.position.y = 0.17
  head.scale.y = 1.15
  head.castShadow = true
  neck.add(head)
  const face = new THREE.Group()
  face.name = 'face'
  neck.add(face)
  const named = (mesh: THREE.Mesh, name: string) => {
    mesh.name = name
    face.add(mesh)
    return mesh
  }
  const eye = (side: number, name: string) => {
    const white = named(new THREE.Mesh(new THREE.SphereGeometry(0.031, 10, 7), whiteMat), name)
    white.position.set(side * 0.047, 0.198, 0.106)
    white.scale.set(1.08, 0.68, 0.48)
    const pupil = named(
      new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), featureMat),
      name === 'eyeL' ? 'pupilL' : 'pupilR'
    )
    pupil.position.set(side * 0.047, 0.198, 0.127)
    pupil.scale.set(0.92, 1, 0.52)
    const brow = named(
      new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.012, 0.01), featureMat),
      name === 'eyeL' ? 'browL' : 'browR'
    )
    brow.position.set(side * 0.049, 0.238, 0.116)
    brow.rotation.z = side * 0.1
  }
  eye(-1, 'eyeL')
  eye(1, 'eyeR')
  const nose = named(new THREE.Mesh(new THREE.ConeGeometry(0.021, 0.07, 6), featureMat), 'nose')
  nose.position.set(0, 0.163, 0.143)
  nose.rotation.x = Math.PI / 2
  const mouth = named(new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.014, 0.011), featureMat), 'mouth')
  mouth.position.set(0, 0.119, 0.126)
  const earL = named(new THREE.Mesh(new THREE.SphereGeometry(0.029, 8, 6), featureMat), 'earL')
  earL.position.set(-0.124, 0.17, 0)
  earL.scale.set(0.58, 1, 0.45)
  const earR = named(earL.clone(), 'earR')
  earR.position.x = 0.122
  const arm = (side: 'L' | 'R') => {
    const s = side === 'L' ? -1 : 1
    const sh = new THREE.Group()
    sh.name = `shoulder${side}`
    sh.position.set(s * 0.225, 0.48, 0)
    spine.add(sh)
    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.074, 8, 7), primary)
    shoulderBall.name = `shoulderBall${side}`
    sh.add(shoulderBall)
    sh.add(jointRing(`shoulderMarker${side}`, 0.078, whiteMat))
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.057, 0.05, 0.3, 7), primary)
    up.name = `upperArm${side}`
    up.position.y = -0.17
    up.castShadow = true
    sh.add(up)
    const el = new THREE.Group()
    el.name = `elbow${side}`
    el.position.y = -0.33
    sh.add(el)
    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.054, 8, 7), primary)
    elbowBall.name = `elbowBall${side}`
    el.add(elbowBall)
    el.add(jointRing(`elbowMarker${side}`, 0.057))
    const fo = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.042, 0.27, 7), primary)
    fo.name = `forearm${side}`
    fo.position.y = -0.155
    fo.castShadow = true
    el.add(fo)
    const wrist = new THREE.Group()
    wrist.name = `wrist${side}`
    wrist.position.y = -0.29
    el.add(wrist)
    const wristBall = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 7), primary)
    wristBall.name = `wristBall${side}`
    wrist.add(wristBall)
    wrist.add(jointRing(`wristMarker${side}`, 0.045, whiteMat))
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 7), primary)
    hand.name = `hand${side}`
    hand.position.y = -0.03
    hand.scale.set(0.8, 1.25, 0.8)
    wrist.add(hand)
    return { sh, el, wrist }
  }
  const aL = arm('L')
  const aR = arm('R')
  rig.shL = aL.sh
  rig.elL = aL.el
  rig.wristL = aL.wrist
  rig.shR = aR.sh
  rig.elR = aR.el
  rig.wristR = aR.wrist
  const leg = (side: 'L' | 'R') => {
    const s = side === 'L' ? -1 : 1
    const hip = new THREE.Group()
    hip.name = `hip${side}`
    hip.position.set(s * 0.1, 0.98, 0)
    body.add(hip)
    const hipBall = new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 7), primary)
    hipBall.name = `hipBall${side}`
    hip.add(hipBall)
    hip.add(jointRing(`hipMarker${side}`, 0.075))
    const th = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.46, 7), primary)
    th.name = `thigh${side}`
    th.position.y = -0.25
    th.castShadow = true
    hip.add(th)
    const kn = new THREE.Group()
    kn.name = `knee${side}`
    kn.position.y = -0.48
    hip.add(kn)
    const kneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.064, 8, 7), primary)
    kneeBall.name = `kneeBall${side}`
    kn.add(kneeBall)
    kn.add(jointRing(`kneeMarker${side}`, 0.067, whiteMat))
    const ca = new THREE.Mesh(new THREE.CylinderGeometry(0.057, 0.044, 0.42, 7), primary)
    ca.name = `lowerLeg${side}`
    ca.position.y = -0.23
    ca.castShadow = true
    kn.add(ca)
    const ankle = new THREE.Group()
    ankle.name = `ankle${side}`
    ankle.position.y = -0.43
    kn.add(ankle)
    const ankleBall = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 7), primary)
    ankleBall.name = `ankleBall${side}`
    ankle.add(ankleBall)
    ankle.add(jointRing(`ankleMarker${side}`, 0.048))
    const ft = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.078, 0.25), primary)
    ft.name = `foot${side}`
    ft.position.set(0, -0.0325, 0.065)
    ft.castShadow = true
    ankle.add(ft)
    return { hip, kn, ankle }
  }
  const lL = leg('L')
  const lR = leg('R')
  rig.hipL = lL.hip
  rig.kneeL = lL.kn
  rig.ankleL = lL.ankle
  rig.hipR = lR.hip
  rig.kneeR = lR.kn
  rig.ankleR = lR.ankle
  g.userData.rig = rig
  g.userData.labelY = 2.15
  g.userData.lockTargetY = 1.1
  return g
}

export function applyJointsToRig(rig: CharacterRig, j: Record<string, number>): void {
  const d = Math.PI / 180
  rig.body.position.y = j.bodyY || 0
  rig.body.rotation.x = (j.bodyRotX || 0) * d
  rig.neck.rotation.set((j.neckX || 0) * d, (j.neckY || 0) * d, 0)
  rig.spine.rotation.set((j.spineX || 0) * d, (j.spineY || 0) * d, (j.spineZ || 0) * d)
  rig.shL.rotation.set((j.shLX || 0) * d, 0, (j.shLZ || 0) * d)
  rig.shR.rotation.set((j.shRX || 0) * d, 0, (j.shRZ || 0) * d)
  rig.elL.rotation.x = (j.elL || 0) * d
  rig.elR.rotation.x = (j.elR || 0) * d
  rig.wristL.rotation.set((j.wristLX || 0) * d, 0, (j.wristLZ || 0) * d)
  rig.wristR.rotation.set((j.wristRX || 0) * d, 0, (j.wristRZ || 0) * d)
  rig.hipL.rotation.set((j.hipLX || 0) * d, 0, (j.hipLZ || 0) * d)
  rig.hipR.rotation.set((j.hipRX || 0) * d, 0, (j.hipRZ || 0) * d)
  rig.kneeL.rotation.x = (j.kneeL || 0) * d
  rig.kneeR.rotation.x = (j.kneeR || 0) * d
  rig.ankleL.rotation.set((j.ankleLX || 0) * d, 0, (j.ankleLZ || 0) * d)
  rig.ankleR.rotation.set((j.ankleRX || 0) * d, 0, (j.ankleRZ || 0) * d)
}

export function poseJoints(pose: PrevizPose, mountKind?: string): Record<string, number> {
  if (pose === 'ride' && mountKind === 'horse') return { ...HORSE_RIDE_JOINTS }
  return { ...(POSE_JOINTS[pose] || {}) }
}

export function makeCar(): THREE.Group {
  const g = new THREE.Group()
  const m = mat(0xe8e8e8)
  const dk = mat(0x24272c)
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.42, 1.8), m)
  chassis.position.y = 0.55
  chassis.castShadow = true
  const bodyM = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.46, 1.76), m)
  bodyM.position.y = 0.99
  bodyM.castShadow = true
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.58, 1.66), m)
  cabin.position.set(-0.25, 1.5, 0)
  cabin.castShadow = true
  const winF = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 1.56), dk)
  winF.position.set(0.85, 1.46, 0)
  winF.rotation.z = 0.42
  const winB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 1.56), dk)
  winB.position.set(-1.36, 1.46, 0)
  winB.rotation.z = -0.5
  const winS = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 1.7), dk)
  winS.position.set(-0.25, 1.52, 0)
  const bpF = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 1.86), dk)
  bpF.position.set(2.18, 0.52, 0)
  const bpB = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 1.86), dk)
  bpB.position.set(-2.18, 0.52, 0)
  const lampL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.34), mat(0xf2ecc8))
  lampL.position.set(2.16, 1.02, 0.6)
  const lampR = lampL.clone()
  lampR.position.z = -0.6
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.23, 0.8), dk)
  grille.position.set(2.295, 0.8, 0)
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.3), mat(0xb3312c))
  tailL.position.set(-2.17, 1.02, 0.62)
  const tailR = tailL.clone()
  tailR.position.z = -0.62
  const mirror = (z: number) => {
    const x = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.08), dk)
    x.position.set(0.52, 1.55, z)
    return x
  }
  g.add(
    chassis, bodyM, cabin, winF, winB, winS, bpF, bpB,
    lampL, lampR, grille, tailL, tailR, mirror(0.91), mirror(-0.91)
  )
  const wheels: Array<[number, number, number]> = [
    [-1.42, 0.38, 0.92],
    [1.42, 0.38, 0.92],
    [-1.42, 0.38, -0.92],
    [1.42, 0.38, -0.92]
  ]
  wheels.forEach((p) => {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.24, 16), dk)
    tire.rotation.x = Math.PI / 2
    tire.position.set(...p)
    tire.castShadow = true
    g.add(tire)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.26, 10), mat(0x9a9a9a))
    hub.rotation.x = Math.PI / 2
    hub.position.set(...p)
    g.add(hub)
  })
  g.userData.seatY = 1.3
  g.userData.labelY = 2.2
  g.userData.lockTargetY = 0.9
  return g
}

export function makeHorse(): THREE.Group {
  const g = new THREE.Group()
  const coat = new THREE.MeshStandardMaterial({ color: 0xf5f5f2, roughness: 0.9, metalness: 0 })
  const coatShade = new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.92, metalness: 0 })
  const maneMat = new THREE.MeshStandardMaterial({
    color: 0x77736d,
    roughness: 0.95,
    side: THREE.DoubleSide
  })
  const hoofMat = mat(0x292827)
  const tackMat = mat(0x4f3527)
  const blanketMat = mat(0x756b5c)
  const eyeMat = mat(0x111214)
  const muzzleMat = mat(0xc8c4bc)
  const named = <T extends THREE.Object3D>(obj: T, name: string, parent: THREE.Object3D = g): T => {
    obj.name = name
    if ((obj as unknown as THREE.Mesh).isMesh) {
      obj.castShadow = true
      obj.receiveShadow = true
    }
    parent.add(obj)
    return obj
  }
  const ellipsoid = (
    name: string,
    pos: [number, number, number],
    scale: [number, number, number],
    material: THREE.Material = coat,
    parent: THREE.Object3D = g
  ) => {
    const mesh = named(new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18), material), name, parent)
    mesh.position.set(...pos)
    mesh.scale.set(...scale)
    return mesh
  }
  interface Ring {
    z: number
    y: number
    rx: number
    ry: number
  }
  const ringForm = (
    name: string,
    rings: Ring[],
    pos: [number, number, number],
    scale: [number, number, number],
    material: THREE.Material = coat,
    parent: THREE.Object3D = g
  ) => {
    const sides = 24
    const verts: number[] = []
    const indices: number[] = []
    rings.forEach((r) => {
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2
        verts.push(Math.cos(a) * r.rx, r.y + Math.sin(a) * r.ry, r.z)
      }
    })
    for (let r = 0; r < rings.length - 1; r++)
      for (let i = 0; i < sides; i++) {
        const a = r * sides + i
        const b = r * sides + ((i + 1) % sides)
        const c = (r + 1) * sides + i
        const d = (r + 1) * sides + ((i + 1) % sides)
        indices.push(a, b, c, b, d, c)
      }
    const rear = verts.length / 3
    const front = rear + 1
    verts.push(0, rings[0].y, rings[0].z, 0, rings[rings.length - 1].y, rings[rings.length - 1].z)
    for (let i = 0; i < sides; i++) {
      const n = (i + 1) % sides
      indices.push(rear, n, i, front, (rings.length - 1) * sides + i, (rings.length - 1) * sides + n)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    const mesh = named(new THREE.Mesh(geo, material), name, parent)
    mesh.position.set(...pos)
    mesh.scale.set(...scale)
    return mesh
  }
  ringForm(
    'horseBody',
    [
      { z: -0.52, y: 0.03, rx: 0.18, ry: 0.24 },
      { z: -0.42, y: 0.04, rx: 0.48, ry: 0.48 },
      { z: -0.22, y: 0.03, rx: 0.5, ry: 0.5 },
      { z: 0, y: 0, rx: 0.46, ry: 0.46 },
      { z: 0.22, y: 0.02, rx: 0.42, ry: 0.47 },
      { z: 0.39, y: 0.05, rx: 0.43, ry: 0.52 },
      { z: 0.52, y: 0.02, rx: 0.22, ry: 0.3 }
    ],
    [0, 1.23, -0.05],
    [0.76, 0.7, 1.95]
  )
  ellipsoid('horseChest', [0, 1.21, 0.72], [0.48, 0.55, 0.3], coatShade)
  ellipsoid('horseRump', [0, 1.24, -0.78], [0.54, 0.56, 0.34], coatShade)
  ellipsoid('horseWithers', [0, 1.5, 0.42], [0.5, 0.25, 0.38], coatShade)
  ;[-1, 1].forEach((side, i) => {
    const m = ellipsoid('horseShoulder' + i, [side * 0.27, 1.21, 0.57], [0.24, 0.58, 0.38], coatShade)
    m.rotation.x = -0.18
  })
  ;[-1, 1].forEach((side, i) => {
    const m = ellipsoid('horseHaunch' + i, [side * 0.28, 1.21, -0.67], [0.27, 0.62, 0.42], coatShade)
    m.rotation.x = 0.14
  })
  const neck = named(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.24, 0.9, 16), coat), 'horseNeck')
  neck.position.set(0, 1.68, 0.7)
  neck.rotation.x = 0.72
  neck.scale.x = 0.88
  const upperNeck = named(
    new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 0.62, 16), coatShade),
    'horseUpperNeck'
  )
  upperNeck.position.set(0, 2, 1.05)
  upperNeck.rotation.x = 0.45
  upperNeck.scale.x = 0.86
  const headRig = new THREE.Group()
  headRig.name = 'horseHeadRig'
  headRig.position.set(0, 2.12, 1.5)
  headRig.rotation.x = 0.14
  g.add(headRig)
  ringForm(
    'horseHead',
    [
      { z: -0.5, y: 0.08, rx: 0.32, ry: 0.34 },
      { z: -0.28, y: 0.05, rx: 0.48, ry: 0.48 },
      { z: 0, y: 0, rx: 0.38, ry: 0.4 },
      { z: 0.28, y: -0.04, rx: 0.29, ry: 0.29 },
      { z: 0.5, y: -0.08, rx: 0.31, ry: 0.24 }
    ],
    [0, 0, 0],
    [0.31, 0.33, 0.74],
    coat,
    headRig
  )
  ellipsoid('horseCheek', [0, 0, -0.23], [0.23, 0.25, 0.22], coatShade, headRig)
  ellipsoid('horseJaw', [0, -0.12, 0.14], [0.15, 0.1, 0.22], muzzleMat, headRig)
  const muzzle = ellipsoid('horseMuzzle', [0, -0.08, 0.38], [0.18, 0.12, 0.22], muzzleMat, headRig)
  muzzle.rotation.x = -0.03
  const ear = (x: number, name: string, tilt: number) => {
    const e = named(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.17, 8), coatShade), name, headRig)
    e.position.set(x, 0.25, -0.24)
    e.rotation.set(-0.12, 0, tilt)
  }
  ear(-0.065, 'horseEarL', -0.1)
  ear(0.065, 'horseEarR', 0.1)
  const eye = (x: number, name: string) => {
    const e = named(new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 8), eyeMat), name, headRig)
    e.position.set(x, 0.07, -0.02)
    e.scale.set(0.72, 1, 0.45)
  }
  eye(-0.124, 'horseEyeL')
  eye(0.124, 'horseEyeR')
  const nostril = (x: number, name: string) => {
    const n = named(new THREE.Mesh(new THREE.SphereGeometry(0.0055, 9, 6), eyeMat), name, headRig)
    n.position.set(x, -0.06, 0.49)
    n.scale.set(1.3, 0.65, 0.38)
  }
  nostril(-0.064, 'horseNostrilL')
  nostril(0.064, 'horseNostrilR')
  const maneSection = (i: number, y0: number, z0: number, y1: number, z1: number) => {
    const geo = new THREE.BufferGeometry()
    const verts = new Float32Array([0, y0, z0, 0, y1, z1, 0, y1 + 0.015, z1 - 0.105, 0, y0 + 0.015, z0 - 0.085])
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    geo.setIndex([0, 1, 2, 0, 2, 3])
    geo.computeVertexNormals()
    named(new THREE.Mesh(geo, maneMat), 'horseMane' + i)
  }
  maneSection(0, 1.4, 0.38, 1.64, 0.52)
  maneSection(1, 1.62, 0.53, 1.87, 0.71)
  maneSection(2, 1.85, 0.72, 2.08, 0.9)
  maneSection(3, 2.06, 0.91, 2.25, 1.08)
  const tailTube = (name: string, points: Array<[number, number, number]>, radius: number) =>
    named(
      new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
          12,
          radius,
          7,
          false
        ),
        maneMat
      ),
      name
    )
  tailTube('horseTailStem', [[0, 1.29, -1.03], [0, 1.16, -1.16], [-0.015, 1.01, -1.25]], 0.033)
  tailTube('horseTailMid', [[-0.015, 1.02, -1.25], [0.015, 0.83, -1.34], [0.035, 0.63, -1.38]], 0.043)
  tailTube('horseTailTuft', [[0.035, 0.64, -1.38], [0, 0.42, -1.4], [-0.04, 0.22, -1.34]], 0.056)
  ellipsoid('horseSaddleBlanket', [0, 1.525, -0.07], [0.55, 0.03, 0.58], blanketMat)
  ellipsoid('horseSaddle', [0, 1.555, -0.04], [0.38, 0.04, 0.42], tackMat)
  ellipsoid('horseSaddlePommel', [0, 1.575, 0.16], [0.24, 0.035, 0.06], tackMat)
  ellipsoid('horseSaddleCantle', [0, 1.58, -0.25], [0.26, 0.04, 0.065], tackMat)
  const bridle = named(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 7, 24), tackMat), 'horseBridle', headRig)
  bridle.position.set(0, -0.07, 0.4)
  bridle.scale.set(0.72, 0.66, 1)
  const bit = named(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 8), tackMat), 'horseBit', headRig)
  bit.position.set(0, -0.115, 0.32)
  bit.rotation.z = Math.PI / 2
  const axisY = new THREE.Vector3(0, 1, 0)
  const segment = (
    parent: THREE.Object3D,
    a: THREE.Vector3,
    b: THREE.Vector3,
    ra: number,
    rb: number,
    name: string
  ) => {
    const delta = b.clone().sub(a)
    const mesh = named(
      new THREE.Mesh(new THREE.CylinderGeometry(ra, rb, delta.length(), 8), coat),
      name,
      parent
    )
    mesh.position.copy(a).add(b).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(axisY, delta.normalize())
  }
  const joint = (parent: THREE.Object3D, p: THREE.Vector3, r: number, name: string) => {
    const j = named(new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), coatShade), name, parent)
    j.position.copy(p)
    j.scale.set(1, 0.55, 0.72)
  }
  const leg = (key: string, x: number, z: number, hind = false) => {
    const root = new THREE.Group()
    root.name = 'horseLeg' + key
    root.position.set(x, 1.3, z)
    g.add(root)
    const V = (vx: number, vy: number, vz: number) => new THREE.Vector3(vx, vy, vz)
    const points = hind
      ? [V(0, 0, 0), V(0, -0.34, 0.14), V(0, -0.72, -0.14), V(0, -1, -0.1), V(0, -1.205, 0.07)]
      : [V(0, 0, 0), V(0, -0.42, -0.03), V(0, -0.88, 0.015), V(0, -1.205, 0.075)]
    const radii = hind
      ? [[0.09, 0.065], [0.061, 0.042], [0.041, 0.027], [0.028, 0.02]]
      : [[0.068, 0.052], [0.047, 0.03], [0.029, 0.02]]
    points.slice(1).forEach((p, i) => segment(root, points[i], p, radii[i][0], radii[i][1], 'horseBone' + key + i))
    points.slice(1, -1).forEach((p, i) =>
      joint(root, p, hind ? (i === 0 ? 0.055 : i === 1 ? 0.04 : 0.028) : i === 0 ? 0.04 : 0.028, 'horseJoint' + key + i)
    )
    const hoof = named(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.073, 0.1, 8), hoofMat), 'horseHoof' + key, root)
    hoof.position.set(0, -1.242, 0.095)
    hoof.rotation.x = -0.06
    hoof.scale.z = 1.45
    return root
  }
  const FL = leg('FL', -0.25, 0.63)
  const FR = leg('FR', 0.25, 0.63)
  const BL = leg('BL', -0.26, -0.67, true)
  const BR = leg('BR', 0.26, -0.67, true)
  g.userData.horseLegs = { FL, FR, BL, BR }
  g.userData.seatY = 1.555
  g.userData.seatZ = -0.05
  g.userData.labelY = 2.35
  g.userData.lockTargetY = 1.2
  return g
}

export function makeProp(): THREE.Group {
  const g = new THREE.Group()
  const wood = mat(0x9b633d)
  const trim = mat(0x5c3826)
  const metal = mat(0x35383d)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.82, 0.84), wood)
  body.position.y = 0.41
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.07, 0.94), trim)
  lid.position.y = 0.855
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.84, 0.82, 0.84)),
    new THREE.LineBasicMaterial({ color: 0x4b2d20 })
  )
  edge.position.y = 0.41
  g.add(body, lid, edge)
  ;[-1, 1].forEach((x) =>
    [-1, 1].forEach((z) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.84, 0.075), trim)
      p.position.set(x * 0.405, 0.42, z * 0.405)
      g.add(p)
    })
  )
  const braces: Array<[number, number]> = [[-0.455, 0.62], [0.455, -0.62]]
  braces.forEach(([z, r]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.68, 0.055), trim)
    b.position.set(0, 0.43, z)
    b.rotation.z = r
    g.add(b)
  })
  ;[-1, 1].forEach((side) => {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.014, 6, 14, Math.PI), metal)
    h.position.set(side * 0.455, 0.52, 0)
    h.rotation.y = Math.PI / 2
    h.rotation.z = side < 0 ? Math.PI / 2 : -Math.PI / 2
    g.add(h)
  })
  ;[-0.3, 0, 0.3].forEach((x) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.035, 0.88), wood)
    s.position.set(x, 0.905, 0)
    g.add(s)
  })
  g.userData.labelY = 1.5
  g.userData.lockTargetY = 0.5
  return g
}

export function makeWall(): THREE.Group {
  const g = new THREE.Group()
  const w = new THREE.Mesh(new THREE.BoxGeometry(4, 2.8, 0.25), envMat())
  w.position.y = 1.4
  w.castShadow = true
  w.receiveShadow = true
  g.add(w)
  g.userData.labelY = 3.3
  g.userData.lockTargetY = 1.4
  return g
}

export function makePillar(): THREE.Group {
  const g = new THREE.Group()
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 3.6, 14), envMat())
  p.position.y = 1.8
  p.castShadow = true
  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 0.24, 1), envMat())
  base.position.y = 0.12
  base.castShadow = true
  g.add(p, base)
  g.userData.labelY = 4.1
  g.userData.lockTargetY = 1.8
  return g
}

export function jitterGeo(geo: THREE.BufferGeometry, amp: number, minY: number): THREE.BufferGeometry {
  const p = geo.attributes.position as THREE.BufferAttribute
  const h = (x: number, y: number, z: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
    return s - Math.floor(s)
  }
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    if (y < minY) continue
    p.setXYZ(i, x + (h(x, y, z) - 0.5) * amp, y + (h(y, z, x) - 0.5) * amp * 0.5, z + (h(z, x, y) - 0.5) * amp)
  }
  geo.computeVertexNormals()
  return geo
}

export function makeTree(): THREE.Group {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.21, 1.5, 9), mat(0x6b5a4a))
  trunk.position.y = 0.75
  trunk.castShadow = true
  g.add(trunk)
  const clump = (x: number, y: number, z: number, r: number, col: number) => {
    const s = new THREE.Mesh(jitterGeo(new THREE.SphereGeometry(r, 9, 7), r * 0.22, -99), flatMat(col))
    s.position.set(x, y, z)
    s.castShadow = true
    g.add(s)
  }
  clump(0, 2.3, 0, 1.15, 0x66754f)
  clump(0.55, 3.05, 0.25, 0.75, 0x71805a)
  clump(-0.5, 2.7, -0.3, 0.65, 0x5f6e4a)
  g.userData.labelY = 4.4
  g.userData.lockTargetY = 2
  return g
}

export function makeMountain(): THREE.Group {
  const g = new THREE.Group()
  const peak = (r: number, h: number, x: number, z: number, col: number) => {
    const m = new THREE.Mesh(jitterGeo(new THREE.ConeGeometry(r, h, 9, 4), r * 0.16, -h / 2 + 0.05), flatMat(col))
    m.position.set(x, h / 2, z)
    m.castShadow = true
    g.add(m)
  }
  peak(7, 6.5, 0, 0, 0x75716a)
  peak(4.2, 3.8, 4, 1.8, 0x7d7972)
  g.userData.labelY = 7.2
  g.userData.lockTargetY = 3
  return g
}

export function makeHouse(): THREE.Group {
  const g = new THREE.Group()
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.18, 3.5), mat(0x6e6a60))
  base.position.y = 0.09
  const body = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 3.2), envMat())
  body.position.y = 1.48
  body.castShadow = true
  body.receiveShadow = true
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 2.95, 1.7, 4), flatMat(0x5f5a52))
  roof.position.y = 3.62
  roof.rotation.y = Math.PI / 4
  roof.castShadow = true
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.9, 0.34), mat(0x6a655d))
  chimney.position.set(-1.2, 3.9, 0.5)
  chimney.castShadow = true
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.5, 0.08), mat(0x4a4440))
  door.position.set(-0.9, 0.93, 1.63)
  const win = (x: number) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.06), mat(0x2c3038))
    w.position.set(x, 1.75, 1.64)
    return w
  }
  g.add(base, body, roof, chimney, door, win(0.4), win(1.4))
  g.userData.labelY = 5
  g.userData.lockTargetY = 2
  return g
}

export function makeRock(): THREE.Group {
  const g = new THREE.Group()
  const r = new THREE.Mesh(jitterGeo(new THREE.DodecahedronGeometry(0.75), 0.18, -99), flatMat(0x82807c))
  r.position.y = 0.48
  r.scale.set(1.35, 0.75, 1)
  r.rotation.y = 0.5
  r.castShadow = true
  g.add(r)
  g.userData.labelY = 1.7
  g.userData.lockTargetY = 0.6
  return g
}

export function makeBush(): THREE.Group {
  const g = new THREE.Group()
  const base = new THREE.Mesh(jitterGeo(new THREE.SphereGeometry(0.55, 9, 7), 0.12, -99), flatMat(0x5f7f4d))
  base.position.y = 0.45
  base.scale.set(1.35, 0.72, 1.05)
  base.castShadow = true
  const lobeL = new THREE.Mesh(jitterGeo(new THREE.SphereGeometry(0.38, 8, 6), 0.1, -99), flatMat(0x6f8c59))
  lobeL.position.set(-0.42, 0.62, 0.06)
  lobeL.scale.set(1, 0.72, 0.82)
  lobeL.castShadow = true
  const lobeR = lobeL.clone()
  lobeR.position.x = 0.42
  lobeR.position.z = -0.05
  g.add(base, lobeL, lobeR)
  g.userData.labelY = 1.35
  g.userData.lockTargetY = 0.5
  return g
}

export function makeDog(color = 0x9a6b42): THREE.Group {
  const g = new THREE.Group()
  const coat = flatMat(color)
  const dark = flatMat(0x2d2520)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 0.92), coat)
  body.position.y = 0.45
  body.castShadow = true
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), coat)
  chest.position.set(0, 0.5, 0.36)
  chest.scale.set(1, 0.9, 0.82)
  chest.castShadow = true
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), coat)
  head.position.set(0, 0.72, 0.72)
  head.scale.set(0.9, 1, 0.82)
  head.castShadow = true
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.18), coat)
  muzzle.position.set(0, 0.68, 0.88)
  muzzle.castShadow = true
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), dark)
  nose.position.set(0, 0.69, 0.99)
  const ear = (x: number) => {
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.24, 6), dark)
    e.position.set(x, 0.91, 0.69)
    e.rotation.z = x < 0 ? 0.45 : -0.45
    e.castShadow = true
    return e
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.42, 7), coat)
  tail.position.set(0, 0.62, -0.58)
  tail.rotation.x = -0.8
  tail.castShadow = true
  ;[-0.16, 0.16].forEach((x) =>
    [-0.28, 0.32].forEach((z) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.42, 7), coat)
      leg.position.set(x, 0.21, z)
      leg.castShadow = true
      g.add(leg)
    })
  )
  g.add(body, chest, head, muzzle, nose, ear(-0.11), ear(0.11), tail)
  g.userData.labelY = 1.05
  g.userData.lockTargetY = 0.5
  return g
}

export function makeRoad(): THREE.Group {
  const g = new THREE.Group()
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3d4147, roughness: 0.98, metalness: 0 })
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xd8d0aa })
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.05, 14), roadMat)
  deck.position.y = 0.025
  deck.receiveShadow = true
  for (let z = -5; z <= 5; z += 2.5) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.9), stripeMat)
    stripe.position.set(0, 0.061, z)
    g.add(stripe)
  }
  g.add(deck)
  g.userData.collisionExempt = true
  g.userData.labelY = 0.45
  g.userData.lockTargetY = 0.5
  return g
}

export function makeActorObject(kind: PrevizActorKind, charColor = 0x2f6bff): THREE.Group {
  switch (kind) {
    case 'char':
      return makeCharacter(charColor)
    case 'horse':
      return makeHorse()
    case 'car':
      return makeCar()
    case 'dog':
      return makeDog()
    case 'tree':
      return makeTree()
    case 'mount':
      return makeMountain()
    case 'house':
      return makeHouse()
    case 'rock':
      return makeRock()
    case 'bush':
      return makeBush()
    case 'road':
      return makeRoad()
    case 'wall':
      return makeWall()
    case 'pillar':
      return makePillar()
    default:
      return makeProp()
  }
}

export function makeLabelSprite(text: string): THREE.Sprite {
  const cv = document.createElement('canvas')
  cv.width = 128
  cv.height = 48
  const c = cv.getContext('2d')
  if (c) {
    c.fillStyle = '#111318d9'
    c.beginPath()
    if (c.roundRect) c.roundRect(10, 7, 108, 34, 7)
    else c.rect(10, 7, 108, 34)
    c.fill()
    c.fillStyle = '#f2f3f5'
    c.font = `600 ${text.length > 3 ? 16 : 20}px sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(text, 64, 24)
  }
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false })
  )
  s.scale.set(1, 0.36, 1)
  s.renderOrder = 99
  s.userData = { isLabel: true, textLen: text.length }
  return s
}

export function labelHeight(obj: THREE.Object3D): number {
  return Number.isFinite(obj.userData.labelY) ? obj.userData.labelY : 2.2
}
