export interface AimPoint {
  x: number
  y: number
  z: number
}

export interface AimSpringState {
  steps: number
  aim: AimPoint
  vel: AimPoint
}

export const AIM_RESPONSE_SECONDS = 0.35
export const AIM_LEAD_SECONDS = 0.25

export function initAimSpring(target: AimPoint): AimSpringState {
  return {
    steps: 0,
    aim: { ...target },
    vel: { x: 0, y: 0, z: 0 }
  }
}

export function advanceAimSpring(
  state: AimSpringState,
  targetAt: (seconds: number) => AimPoint,
  toStep: number,
  fps: number,
  response = AIM_RESPONSE_SECONDS,
  lead = AIM_LEAD_SECONDS
): AimSpringState {
  const dt = 1 / fps
  const omega = 4.6 / Math.max(0.05, response)
  const { aim, vel } = state
  for (let step = state.steps + 1; step <= toStep; step++) {
    const target = targetAt(step * dt + lead)
    const ax = omega * omega * (target.x - aim.x) - 2 * omega * vel.x
    const ay = omega * omega * (target.y - aim.y) - 2 * omega * vel.y
    const az = omega * omega * (target.z - aim.z) - 2 * omega * vel.z
    vel.x += ax * dt
    vel.y += ay * dt
    vel.z += az * dt
    aim.x += vel.x * dt
    aim.y += vel.y * dt
    aim.z += vel.z * dt
  }
  state.steps = Math.max(state.steps, toStep)
  return state
}
