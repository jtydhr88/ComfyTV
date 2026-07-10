import type { EventManagerInterface } from './interfaces'

export interface TimelineDurationChange {
  totalFrames: number
  fps: number
  hasContent: boolean
}

export interface TimelineTimeUpdate {
  frame: number
  time: number
}

export class TimelineController {
  private currentTime = 0
  private playing = false
  private readonly fps = 24
  private loopPlayback = true
  private durationSeconds = 0

  private eventManager: EventManagerInterface

  constructor(eventManager: EventManagerInterface) {
    this.eventManager = eventManager
  }

  get totalDuration(): number {
    return this.durationSeconds
  }

  get totalFrames(): number {
    return Math.max(1, Math.round(this.durationSeconds * this.fps))
  }

  getFps(): number {
    return this.fps
  }

  setTimelineDuration(seconds: number): void {
    const next = Math.max(0, seconds)
    if (next === this.durationSeconds) return
    this.durationSeconds = next
    this.clampTime()
    this.emitDurationChange()
  }

  hasContent(): boolean {
    return this.durationSeconds > 0
  }

  play(): void {
    if (this.durationSeconds <= 0) return
    if (this.currentTime >= this.durationSeconds) {
      this.currentTime = 0
    }
    this.playing = true
    this.emitStateChange()
  }

  pause(): void {
    if (!this.playing) return
    this.playing = false
    this.emitStateChange()
  }

  togglePlayPause(): void {
    if (this.playing) this.pause()
    else this.play()
  }

  isPlayingNow(): boolean {
    return this.playing
  }

  seekToTime(seconds: number): void {
    this.currentTime = Math.max(0, Math.min(seconds, this.durationSeconds))
    this.emitTimeUpdate()
  }

  seekToFrame(frame: number): void {
    this.seekToTime(frame / this.fps)
  }

  getCurrentTime(): number {
    return this.currentTime
  }

  getCurrentFrame(): number {
    return Math.round(this.currentTime * this.fps)
  }

  update(deltaTime: number): void {
    if (!this.playing || this.durationSeconds <= 0) return

    this.currentTime += deltaTime
    if (this.currentTime >= this.durationSeconds) {
      if (this.loopPlayback) {
        this.currentTime = 0
      } else {
        this.currentTime = this.durationSeconds
        this.pause()
      }
    }

    this.emitTimeUpdate()
  }

  setLoopPlayback(loop: boolean): void {
    if (this.loopPlayback === loop) return
    this.loopPlayback = loop
    this.emitStateChange()
  }

  getLoopPlayback(): boolean {
    return this.loopPlayback
  }

  reset(): void {
    this.playing = false
    this.currentTime = 0
    this.durationSeconds = 0
    this.loopPlayback = true
    this.emitDurationChange()
  }

  private clampTime(): void {
    if (
      this.durationSeconds > 0 &&
      this.currentTime > this.durationSeconds
    ) {
      this.currentTime = this.durationSeconds
    }
  }

  private emitTimeUpdate(): void {
    this.eventManager.emitEvent<TimelineTimeUpdate>('timelineTimeUpdate', {
      frame: this.getCurrentFrame(),
      time: this.currentTime
    })
  }

  private emitStateChange(): void {
    this.eventManager.emitEvent('timelineStateChange', {
      playing: this.playing,
      loop: this.loopPlayback
    })
  }

  private emitDurationChange(): void {
    this.eventManager.emitEvent<TimelineDurationChange>(
      'timelineDurationChange',
      {
        totalFrames: this.totalFrames,
        fps: this.fps,
        hasContent: this.hasContent()
      }
    )
  }
}
