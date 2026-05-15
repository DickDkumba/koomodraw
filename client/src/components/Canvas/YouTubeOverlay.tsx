import { useEffect, useRef, useCallback, useState } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useObjectStore } from '../../store/objectStore';
import type { YouTubeShape } from '../../types/shapes';
import { dispatchYouTubeEvents, onYouTubeCommand, registerYouTubePlayer, unregisterYouTubePlayer } from '../../store/youtubeEventDispatcher';

// ── YouTube IFrame API types ──────────────────────────────────────────────────

interface YTPlayer {
  destroy(): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  cueVideoById(opts: { videoId: string; startSeconds?: number }): void;
}

interface YTPlayerEvent {
  target: YTPlayer;
  data: number;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: string | HTMLElement,
        opts: {
          width?: number;
          height?: number;
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: Record<string, (e: YTPlayerEvent) => void>;
        },
      ) => YTPlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let apiLoaded = false;
let apiReady = false;
const readyCallbacks: (() => void)[] = [];

function ensureYTApi(cb: () => void): void {
  if (apiReady) { cb(); return; }
  readyCallbacks.push(cb);
  if (apiLoaded) return;
  apiLoaded = true;
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    prev?.();
    apiReady = true;
    readyCallbacks.forEach((fn) => fn());
    readyCallbacks.length = 0;
  };
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

function extractVideoId(url: string): string | null {
  if (!url) return null;
  const short = url.match(/youtu\.be\/([^?&]+)/);
  if (short) return short[1];
  const long = url.match(/[?&]v=([^&]+)/);
  if (long) return long[1];
  const embed = url.match(/embed\/([^?&]+)/);
  if (embed) return embed[1];
  if (/^[\w-]{11}$/.test(url)) return url;
  return null;
}

// ── Single YouTube player overlay ────────────────────────────────────────────

interface PlayerOverlayProps {
  shape: YouTubeShape;
  left: number;
  top: number;
  width: number;
  height: number;
  isActive: boolean;
  isSelected: boolean;
}

function PlayerOverlay({ shape, left, top, width, height, isActive, isSelected }: PlayerOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const currentVideoId = useRef<string | null>(null);
  const firedTimeEvents = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  const videoId = extractVideoId(shape.videoUrl);

  useEffect(() => {
    if (!videoId) {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        currentVideoId.current = null;
      }
      return;
    }

    function createPlayer() {
      if (!containerRef.current || !window.YT) return;
      if (playerRef.current) {
        if (currentVideoId.current !== videoId) {
          playerRef.current.cueVideoById({ videoId: videoId!, startSeconds: shape.startTime });
          currentVideoId.current = videoId;
        }
        return;
      }

      const el = document.createElement('div');
      containerRef.current.appendChild(el);

      playerRef.current = new window.YT.Player(el, {
        width: Math.round(width),
        height: Math.round(height),
        videoId: videoId!,
        playerVars: {
          start: shape.startTime,
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            setReady(true);
            registerYouTubePlayer(shape.id, playerRef.current!);
            dispatchYouTubeEvents(shape.events, 'load', undefined, shape.id);
          },
          onStateChange: (e: YTPlayerEvent) => {
            const evts = useObjectStore.getState().objects[shape.id] as YouTubeShape | undefined;
            const events = evts?.events ?? shape.events;
            if (e.data === window.YT!.PlayerState.PLAYING) {
              setPlaying(true);
              dispatchYouTubeEvents(events, 'play', undefined, shape.id);
              startTimePoll(events);
            } else if (e.data === window.YT!.PlayerState.PAUSED) {
              setPlaying(false);
              dispatchYouTubeEvents(events, 'pause', undefined, shape.id);
              stopTimePoll();
            } else if (e.data === window.YT!.PlayerState.ENDED) {
              setPlaying(false);
              dispatchYouTubeEvents(events, 'ended', undefined, shape.id);
              stopTimePoll();
            }
          },
        },
      });
      currentVideoId.current = videoId;
    }

    ensureYTApi(createPlayer);
    return () => { stopTimePoll(); };
  }, [videoId]);

  useEffect(() => {
    const iframe = containerRef.current?.querySelector('iframe');
    if (iframe) {
      iframe.style.width = `${Math.round(width)}px`;
      iframe.style.height = `${Math.round(height)}px`;
    }
  }, [width, height]);

  const startTimePoll = useCallback((events: YouTubeShape['events']) => {
    stopTimePoll();
    firedTimeEvents.current.clear();
    pollRef.current = setInterval(() => {
      if (!playerRef.current) return;
      const t = playerRef.current.getCurrentTime();
      const latest = useObjectStore.getState().objects[shape.id] as YouTubeShape | undefined;
      const evts = latest?.events ?? events;
      for (const evt of evts) {
        if (evt.trigger !== 'time' || evt.triggerTime === undefined) continue;
        if (firedTimeEvents.current.has(evt.id)) continue;
        if (Math.abs(t - evt.triggerTime) <= 0.5) {
          firedTimeEvents.current.add(evt.id);
          dispatchYouTubeEvents([evt], 'time', t, shape.id);
        }
      }
    }, 250);
  }, [shape.id]);

  function stopTimePoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      stopTimePoll();
      unregisterYouTubePlayer(shape.id);
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []);

  // Listen for play/pause commands from event dispatcher (e.g. start_youtube action)
  useEffect(() => {
    return onYouTubeCommand((cmd, targetId) => {
      if (targetId && targetId !== shape.id) return;
      if (!playerRef.current) return;
      if (cmd === 'play') playerRef.current.playVideo();
      if (cmd === 'pause') playerRef.current.pauseVideo();
    });
  }, [shape.id]);

  const handlePlayPause = useCallback(() => {
    if (!playerRef.current) return;
    if (playing) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [playing]);

  const handleBack = useCallback(() => {
    if (!playerRef.current) return;
    const t = playerRef.current.getCurrentTime();
    playerRef.current.seekTo(Math.max(0, t - 10), true);
  }, []);

  const handleForward = useCallback(() => {
    if (!playerRef.current) return;
    const t = playerRef.current.getCurrentTime();
    playerRef.current.seekTo(t + 10, true);
  }, []);

  return (
    <div
      className="yt-overlay-wrapper"
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {/* The actual player iframe */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          borderRadius: 4,
          pointerEvents: isActive ? 'auto' : 'none',
        }}
      />

      {/* Visual border when selected or active */}
      {(isSelected || isActive) && (
        <div
          className={`yt-overlay-border${isActive ? ' yt-overlay-border--active' : ''}`}
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: 6,
            pointerEvents: 'none',
          }}
        >
          <div className="yt-handle yt-handle--tl" />
          <div className="yt-handle yt-handle--tr" />
          <div className="yt-handle yt-handle--bl" />
          <div className="yt-handle yt-handle--br" />
        </div>
      )}

      {/* Floating control bar — always visible when player is ready */}
      {!isActive && ready && (
        <div className="yt-controls" style={{ pointerEvents: 'auto' }}>
          <button
            className="yt-controls__btn"
            title="Back 10s"
            onClick={handleBack}
          >
            ⏪
          </button>
          <button
            className="yt-controls__btn yt-controls__play"
            title={playing ? 'Pause' : 'Play'}
            onClick={handlePlayPause}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            className="yt-controls__btn"
            title="Forward 10s"
            onClick={handleForward}
          >
            ⏩
          </button>
        </div>
      )}

      {/* Exit label when in active/interactive mode */}
      {isActive && (
        <div
          className="yt-shield-label yt-shield-label--active"
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          Click outside to exit
        </div>
      )}
    </div>
  );
}

// ── Main overlay container ──────────────────────────────────────────────────

// Active player ID stored here and shared with DrawingCanvas via module-level getter/setter
let _activePlayerId: string | null = null;
const _listeners = new Set<() => void>();

export function getActiveYouTubeId(): string | null { return _activePlayerId; }

export function setActiveYouTubeId(id: string | null): void {
  if (id === _activePlayerId) return;
  _activePlayerId = id;
  _listeners.forEach((fn) => fn());
}

function useActivePlayerId(): string | null {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const cb = () => forceUpdate((n) => n + 1);
    _listeners.add(cb);
    return () => { _listeners.delete(cb); };
  }, []);
  return _activePlayerId;
}

export function YouTubeOverlay() {
  const scene = useSceneStore((s) => s.scene);
  const objects = useObjectStore((s) => s.objects);
  const selectedIds = useSceneStore((s) => s.selectedIds);
  const activePlayerId = useActivePlayerId();

  // Click anywhere outside the active player deactivates it
  useEffect(() => {
    if (!activePlayerId) return;
    function handleClick(e: MouseEvent) {
      const wrappers = document.querySelectorAll('.yt-overlay-wrapper');
      for (const w of wrappers) {
        if (w.contains(e.target as Node)) return;
      }
      setActiveYouTubeId(null);
    }
    window.addEventListener('mousedown', handleClick, true);
    return () => window.removeEventListener('mousedown', handleClick, true);
  }, [activePlayerId]);

  // Deactivate if selection changes away
  useEffect(() => {
    if (activePlayerId && !selectedIds.has(activePlayerId)) {
      setActiveYouTubeId(null);
    }
  }, [selectedIds, activePlayerId]);

  const youtubeShapes: { shape: YouTubeShape; left: number; top: number; width: number; height: number }[] = [];

  for (const id of scene.objectIds) {
    const obj = objects[id];
    if (!obj || obj.type !== 'youtube') continue;
    const yt = obj as YouTubeShape;
    if (!yt.videoUrl) continue;

    const left = yt.x * scene.zoom + scene.viewportX;
    const top = yt.y * scene.zoom + scene.viewportY;
    const width = yt.width * scene.zoom;
    const height = yt.height * scene.zoom;

    youtubeShapes.push({ shape: yt, left, top, width, height });
  }

  if (youtubeShapes.length === 0) return null;

  return (
    <>
      {youtubeShapes.map(({ shape, left, top, width, height }) => (
        <PlayerOverlay
          key={shape.id}
          shape={shape}
          left={left}
          top={top}
          width={width}
          height={height}
          isActive={activePlayerId === shape.id}
          isSelected={selectedIds.has(shape.id)}
        />
      ))}
    </>
  );
}
