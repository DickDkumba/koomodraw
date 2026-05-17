import type { ShapeEvent, EventTrigger } from '../types/shapes';
import { useRecordingStore, computePlaybackState } from './recordingStore';
import { useSceneStore } from './sceneStore';
import { useObjectStore } from './objectStore';
import { useEventLogStore } from './eventLogStore';
import type { Shape } from '../types/shapes';

function applyPlayback(t: number): void {
  const { keyframes } = useRecordingStore.getState();
  if (keyframes.length === 0) return;
  const positions = computePlaybackState(keyframes, t);
  const { updateObject } = useObjectStore.getState();
  for (const [id, state] of positions) {
    updateObject(id, state as Partial<Shape>);
  }
}

export function dispatchShapeEvents(
  events: ShapeEvent[],
  trigger: EventTrigger,
  currentVideoTime?: number,
  sourceId?: string,
): void {
  const objects = useObjectStore.getState().objects;
  const source = sourceId ? objects[sourceId] : null;
  const sourceName = source?.name || source?.type || 'unknown';

  for (const evt of events) {
    if (evt.trigger !== trigger) continue;
    if ((trigger === 'time' || trigger === 'player_time') && evt.triggerTime !== undefined && currentVideoTime !== undefined) {
      if (Math.abs(currentVideoTime - evt.triggerTime) > 0.5) continue;
    }

    // Log the event
    const target = evt.actionTarget ? objects[evt.actionTarget] : null;
    const triggerLabel = (trigger === 'time' || trigger === 'player_time') ? `${trigger} @${evt.triggerTime}s` : trigger;
    useEventLogStore.getState().addEntry({
      trigger: triggerLabel,
      action: evt.action,
      sourceName,
      targetName: target?.name || target?.type,
    });

    executeAction(evt);
  }
}

// Backward-compat alias
export const dispatchYouTubeEvents = dispatchShapeEvents;

function executeAction(evt: ShapeEvent): void {
  const rec = useRecordingStore.getState();
  const scene = useSceneStore.getState();

  switch (evt.action) {
    case 'start_player':
      if (!rec.isPlaying) {
        // Ensure there's a duration so playback doesn't immediately stop
        if (rec.duration === 0) {
          rec.setDuration(rec.timelineDuration);
        }
        rec.startPlayback();
      }
      break;

    case 'stop_player':
      if (rec.isPlaying) rec.stopPlayback();
      break;

    case 'seek_player': {
      const t = (evt.actionValue ?? 0) * 1000;
      rec.seek(t);
      applyPlayback(t);
      break;
    }

    case 'navigate_scene': {
      const idx = evt.actionValue ?? 0;
      const target = scene.scenes[idx];
      if (target) scene.activateScene(target.id);
      break;
    }

    case 'start_youtube': {
      controlYouTubePlayer('play', evt.actionTarget ?? '');
      break;
    }

    case 'stop_youtube': {
      controlYouTubePlayer('pause', evt.actionTarget ?? '');
      break;
    }

    case 'set_opacity': {
      const tid = evt.actionTarget;
      if (tid) {
        const s = useObjectStore.getState();
        const o = s.objects[tid];
        if (o) {
          const opacity = Math.max(0, Math.min(1, evt.actionValue ?? 1));
          s.setObjects({ ...s.objects, [tid]: { ...o, opacity } as Shape });
        }
      }
      break;
    }
  }
}

// Simple event bus for YouTube player commands
type YTCommandHandler = (cmd: 'play' | 'pause', targetId: string) => void;
const _ytBus = new Set<YTCommandHandler>();
export function onYouTubeCommand(fn: YTCommandHandler): () => void {
  _ytBus.add(fn);
  return () => { _ytBus.delete(fn); };
}

// Direct player registry — players register themselves so we can call playVideo synchronously
type PlayerHandle = { playVideo(): void; pauseVideo(): void };
const _playerRegistry = new Map<string, PlayerHandle>();

export function registerYouTubePlayer(id: string, handle: PlayerHandle): void {
  _playerRegistry.set(id, handle);
}

export function unregisterYouTubePlayer(id: string): void {
  _playerRegistry.delete(id);
}

export function controlYouTubePlayer(cmd: 'play' | 'pause', targetId: string): void {
  if (targetId) {
    const p = _playerRegistry.get(targetId);
    if (p) { cmd === 'play' ? p.playVideo() : p.pauseVideo(); return; }
  }
  // No target or not found — control all
  for (const p of _playerRegistry.values()) {
    cmd === 'play' ? p.playVideo() : p.pauseVideo();
  }
}
