import { create } from 'zustand';
import type { Point, ShapeEvent } from '../types/shapes';

export interface Keyframe {
  t: number;           // ms from timeline epoch (absolute position)
  objectId: string;
  x: number;
  y: number;
  points?: [Point, Point];   // only for line / arrow / squiggle
}

export const MAX_RECORDING_MS = 600_000; // 10 minutes

interface RecordingStore {
  // Persistent recording data
  keyframes: Keyframe[];
  duration: number;          // ms — grows as recording/playback progresses

  // Mode flags
  isRecording: boolean;
  isPlaying: boolean;

  // Current scrubber position (ms)
  currentTime: number;

  // Session internals (recording or playback)
  epochStart: number;        // Date.now() when this session started
  timeOffset: number;        // currentTime when this session started

  // User-configurable timeline length (ms); default 30 s
  timelineDuration: number;

  // Player events (like YouTube events but for the scene player)
  playerEvents: ShapeEvent[];

  // Actions
  startRecording:     (timeOffset: number) => void;
  stopRecording:      () => void;
  addKeyframe:        (kf: Keyframe) => void;
  startPlayback:      () => void;
  stopPlayback:       () => void;
  seek:               (t: number) => void;
  stepBack:           () => void;
  stepForward:        () => void;
  setCurrentTime:     (t: number) => void;
  setDuration:        (d: number) => void;
  setTimelineDuration:(ms: number) => void;
  setPlayerEvents: (events: ShapeEvent[]) => void;
}

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  keyframes:        [],
  duration:         0,
  isRecording:      false,
  isPlaying:        false,
  currentTime:      0,
  epochStart:       0,
  timeOffset:       0,
  timelineDuration: 30_000,  // default 30 seconds
  playerEvents: [],

  startRecording: (timeOffset) => set({
    isRecording: true,
    isPlaying:   false,
    epochStart:  Date.now(),
    timeOffset,
    currentTime: timeOffset,
  }),

  stopRecording: () => set({ isRecording: false }),

  addKeyframe: (kf) => set((s) => ({
    keyframes: [...s.keyframes, kf],
    duration:  Math.min(Math.max(s.duration, kf.t), MAX_RECORDING_MS),
  })),

  startPlayback: () => set((s) => ({
    isPlaying:   true,
    isRecording: false,
    epochStart:  Date.now(),
    timeOffset:  s.currentTime,
  })),

  stopPlayback: () => set({ isPlaying: false }),

  // seek also pauses — caller is responsible for re-applying playback state
  seek: (t) => {
    const clamped = Math.max(0, Math.min(t, get().duration));
    set({ currentTime: clamped, isPlaying: false });
  },

  stepBack:    () => { get().seek(0); },
  stepForward: () => { get().seek(Math.min(get().duration, get().currentTime + 5_000)); },

  setCurrentTime:     (t) => set({ currentTime: t }),
  setDuration:        (d) => set({ duration: d }),
  setTimelineDuration:(ms) => set({ timelineDuration: Math.max(5_000, Math.min(ms, MAX_RECORDING_MS)) }),
  setPlayerEvents: (events) => set({ playerEvents: events }),
}));

// ─── Held objects (objects being actively dragged — skip during playback) ─────

const _heldIds = new Set<string>();

export function setHeldObjectIds(ids: Iterable<string>): void {
  _heldIds.clear();
  for (const id of ids) _heldIds.add(id);
}

export function clearHeldObjectIds(): void {
  _heldIds.clear();
}

export function getHeldObjectIds(): ReadonlySet<string> {
  return _heldIds;
}

// ─── Interpolation ────────────────────────────────────────────────────────────

function lerp(a: number, b: number, r: number) { return a + (b - a) * r; }

export function computePlaybackState(
  keyframes: Keyframe[],
  t: number
): Map<string, { x: number; y: number; points?: [Point, Point] }> {
  // Group by objectId
  const byObj = new Map<string, Keyframe[]>();
  for (const kf of keyframes) {
    if (!byObj.has(kf.objectId)) byObj.set(kf.objectId, []);
    byObj.get(kf.objectId)!.push(kf);
  }

  const result = new Map<string, { x: number; y: number; points?: [Point, Point] }>();

  for (const [objectId, kfs] of byObj) {
    // Find nearest before / after (kfs may not be perfectly sorted across sessions)
    let before: Keyframe | null = null;
    let after:  Keyframe | null = null;

    for (const kf of kfs) {
      if (kf.t <= t) {
        if (!before || kf.t >= before.t) before = kf;
      } else {
        if (!after  || kf.t <  after.t)  after  = kf;
      }
    }

    if (!before) continue;  // no data before t — skip

    if (!after) {
      result.set(objectId, { x: before.x, y: before.y, points: before.points });
      continue;
    }

    const span  = after.t - before.t;
    const ratio = span > 0 ? (t - before.t) / span : 1;
    const x     = lerp(before.x, after.x, ratio);
    const y     = lerp(before.y, after.y, ratio);
    let points: [Point, Point] | undefined;

    if (before.points && after.points) {
      points = [
        { x: lerp(before.points[0].x, after.points[0].x, ratio),
          y: lerp(before.points[0].y, after.points[0].y, ratio) },
        { x: lerp(before.points[1].x, after.points[1].x, ratio),
          y: lerp(before.points[1].y, after.points[1].y, ratio) },
      ];
    }

    result.set(objectId, { x, y, points });
  }

  return result;
}
