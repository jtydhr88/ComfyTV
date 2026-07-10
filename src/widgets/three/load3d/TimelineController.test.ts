import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TimelineController } from '@/widgets/three/load3d/TimelineController'

function makeController() {
  const eventManager = {
    emitEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
  return { controller: new TimelineController(eventManager), eventManager }
}

describe('TimelineController', () => {
  let controller: TimelineController
  let eventManager: ReturnType<typeof makeController>['eventManager']

  beforeEach(() => {
    ;({ controller, eventManager } = makeController())
  })

  it('has no duration and refuses to play before a duration is set', () => {
    expect(controller.totalDuration).toBe(0)
    expect(controller.hasContent()).toBe(false)
    controller.play()
    expect(controller.isPlayingNow()).toBe(false)
  })

  it('derives frame count from the duration at the fixed fps', () => {
    controller.setTimelineDuration(2)
    expect(controller.totalDuration).toBe(2)
    expect(controller.totalFrames).toBe(48)
    expect(controller.getFps()).toBe(24)
    expect(controller.hasContent()).toBe(true)
  })

  it('setTimelineDuration is a no-op (no event) when unchanged', () => {
    controller.setTimelineDuration(2)
    eventManager.emitEvent.mockClear()
    controller.setTimelineDuration(2)
    expect(eventManager.emitEvent).not.toHaveBeenCalled()
  })

  it('update advances time and wraps when loop playback is on', () => {
    controller.setTimelineDuration(1)
    controller.play()
    controller.update(0.75)
    expect(controller.getCurrentTime()).toBe(0.75)
    controller.update(0.5)
    expect(controller.getCurrentTime()).toBe(0)
    expect(controller.isPlayingNow()).toBe(true)
  })

  it('update pauses at the end when loop playback is off', () => {
    controller.setTimelineDuration(1)
    controller.setLoopPlayback(false)
    controller.play()
    controller.update(2)
    expect(controller.getCurrentTime()).toBe(1)
    expect(controller.isPlayingNow()).toBe(false)
  })

  it('play from the end restarts the timeline', () => {
    controller.setTimelineDuration(1)
    controller.setLoopPlayback(false)
    controller.play()
    controller.update(2)
    controller.play()
    expect(controller.getCurrentTime()).toBe(0)
    expect(controller.isPlayingNow()).toBe(true)
  })

  it('seekToFrame clamps into the valid range', () => {
    controller.setTimelineDuration(1)
    controller.seekToFrame(100)
    expect(controller.getCurrentFrame()).toBe(24)
    controller.seekToFrame(-5)
    expect(controller.getCurrentFrame()).toBe(0)
  })

  it('shrinking the duration clamps the current time', () => {
    controller.setTimelineDuration(4)
    controller.seekToTime(3)
    controller.setTimelineDuration(1)
    expect(controller.getCurrentTime()).toBe(1)
  })

  it('emits duration changes when the duration is set', () => {
    controller.setTimelineDuration(2)
    expect(eventManager.emitEvent).toHaveBeenCalledWith(
      'timelineDurationChange',
      { totalFrames: 48, fps: 24, hasContent: true }
    )
  })

  it('emits time updates while playing', () => {
    controller.setTimelineDuration(2)
    controller.play()
    eventManager.emitEvent.mockClear()
    controller.update(0.5)
    expect(eventManager.emitEvent).toHaveBeenCalledWith('timelineTimeUpdate', {
      frame: 12,
      time: 0.5
    })
  })
})
