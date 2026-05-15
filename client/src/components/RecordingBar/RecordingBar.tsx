import { useEffect, useRef, useState, useCallback } from 'react';
import {
  useRecordingStore,
  computePlaybackState,
  MAX_RECORDING_MS,
} from '../../store/recordingStore';
import { useSceneStore } from '../../store/sceneStore';
import { useObjectStore } from '../../store/objectStore';
import type { Shape } from '../../types/shapes';
import './RecordingBar.css';

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmt(ms: number): string {
  const s   = Math.floor(ms / 1000);
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  const t   = Math.floor((ms % 1000) / 100);
  return `${m}:${sec.toString().padStart(2, '0')}.${t}`;
}

// Apply interpolated positions to the objectStore
function applyPlayback(t: number): void {
  const { keyframes } = useRecordingStore.getState();
  if (keyframes.length === 0) return;
  const positions = computePlaybackState(keyframes, t);
  const { updateObject } = useObjectStore.getState();
  for (const [id, state] of positions) {
    updateObject(id, state as Partial<Shape>);
  }
}

// Snapshot all current objects in the active scene as keyframes at time t
function snapshotScene(t: number): void {
  const { scene }   = useSceneStore.getState();
  const { objects } = useObjectStore.getState();
  const { addKeyframe } = useRecordingStore.getState();

  for (const id of scene.objectIds) {
    const s = objects[id];
    if (!s) continue;
    const kf = { t, objectId: id, x: s.x, y: s.y } as Parameters<typeof addKeyframe>[0];
    if ('points' in s) kf.points = (s as any).points;
    addKeyframe(kf);
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RecordingBar() {
  const {
    keyframes, duration, isRecording, isPlaying, currentTime,
    epochStart, timeOffset, timelineDuration,
    startRecording, stopRecording,
    startPlayback, stopPlayback,
    seek, stepBack, stepForward,
    setCurrentTime, setDuration, setTimelineDuration,
  } = useRecordingStore();

  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef       = useRef<number | null>(null);
  const timelineRef  = useRef<HTMLDivElement>(null);

  const hasRecording = keyframes.length > 0 || duration > 0;

  // The visible timeline range: at least the user-set duration
  const timelineMax = Math.max(duration, timelineDuration);

  // ── RAF: advance currentTime during recording ─────────────────────────────
  useEffect(() => {
    if (!isRecording) return;
    function tick() {
      const st = useRecordingStore.getState();
      const t  = st.timeOffset + (Date.now() - st.epochStart);
      if (t >= MAX_RECORDING_MS) {
        useRecordingStore.getState().stopRecording();
        return;
      }
      setCurrentTime(t);
      setDuration(Math.max(useRecordingStore.getState().duration, t));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isRecording]);

  // ── RAF: advance currentTime + apply positions during playback ───────────
  useEffect(() => {
    if (!isPlaying) return;
    function tick() {
      const st  = useRecordingStore.getState();
      const t   = st.timeOffset + (Date.now() - st.epochStart);
      const end = st.duration;

      if (t >= end) {
        setCurrentTime(end);
        applyPlayback(end);
        useRecordingStore.getState().stopPlayback();
        return;
      }
      setCurrentTime(t);
      applyPlayback(t);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying]);

  // ── Controls ──────────────────────────────────────────────────────────────

  function handleRecord() {
    if (countdown !== null) {
      // Cancel countdown
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(null);
      return;
    }
    if (isRecording) {
      stopRecording();
      return;
    }
    if (isPlaying) stopPlayback();

    // 3-second countdown then start recording
    setCountdown(3);
    let n = 3;
    countdownRef.current = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        setCountdown(null);
        const { currentTime: ct } = useRecordingStore.getState();
        snapshotScene(ct);
        startRecording(ct);
      } else {
        setCountdown(n);
      }
    }, 1000);
  }

  function handlePlay() {
    if (isRecording) return;
    if (isPlaying) return;
    applyPlayback(currentTime);
    startPlayback();
  }

  function handlePause() {
    stopPlayback();
  }

  function handleStepBack() {
    stopPlayback();
    stepBack();
    applyPlayback(0);
  }

  function handleStepForward() {
    stopPlayback();
    stepForward();
    applyPlayback(useRecordingStore.getState().currentTime);
  }

  // ── Timeline drag ─────────────────────────────────────────────────────────

  const handleTimelineMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rect = timelineRef.current!.getBoundingClientRect();
    const tMax = useRecordingStore.getState().timelineDuration;
    const dur  = useRecordingStore.getState().duration;
    const max  = Math.max(dur, tMax);

    function scrub(clientX: number) {
      const ratio   = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const t       = Math.round(ratio * max);
      const clamped = Math.max(0, Math.min(t, dur));
      useRecordingStore.getState().seek(clamped);
      applyPlayback(clamped);
    }

    scrub(e.clientX);

    function onMove(ev: MouseEvent) { scrub(ev.clientX); }
    function onUp()  {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const filledPct  = duration   > 0 ? (duration   / timelineMax) * 100 : 0;
  const handlePct  = timelineMax > 0 ? (currentTime / timelineMax) * 100 : 0;

  return (
    <>
      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="rec-countdown">
          <span className="rec-countdown__num">{countdown}</span>
        </div>
      )}

      <div className="rec-bar">
        {/* Controls row */}
        <div className="rec-bar__controls">
          <button
            className="rec-btn"
            title="Back to start"
            onClick={handleStepBack}
            disabled={!hasRecording}
          >⏮</button>

          <button
            className={`rec-btn rec-btn--record ${isRecording ? 'rec-btn--active' : ''}`}
            title={isRecording ? 'Stop recording' : 'Record'}
            onClick={handleRecord}
          >
            {countdown !== null ? countdown : isRecording ? '⏹' : '⏺'}
          </button>

          <button
            className="rec-btn"
            title="Play"
            onClick={handlePlay}
            disabled={!hasRecording || isRecording || isPlaying}
          >▶</button>

          <button
            className="rec-btn"
            title="Pause"
            onClick={handlePause}
            disabled={!isPlaying}
          >⏸</button>

          <button
            className="rec-btn"
            title="Stop — pause and return to start"
            onClick={() => { stopPlayback(); seek(0); applyPlayback(0); }}
            disabled={!hasRecording}
          >⏹</button>

          <button
            className="rec-btn"
            title="Forward 5 s"
            onClick={handleStepForward}
            disabled={!hasRecording}
          >⏭</button>

          <span className="rec-bar__time">
            {fmt(currentTime)}
          </span>
          <span className="rec-bar__sep">/</span>
          <span className="rec-bar__duration">{fmt(duration)}</span>

          {isRecording && <span className="rec-bar__rec-dot" />}

          <span className="rec-bar__maxlabel">Max</span>
          <input
            className="rec-bar__maxinput"
            type="number"
            min="5"
            max="600"
            step="5"
            title="Timeline length in seconds"
            value={Math.round(timelineDuration / 1000)}
            onChange={(e) => {
              const s = parseFloat(e.target.value);
              if (!isNaN(s) && s >= 5) setTimelineDuration(Math.round(s * 1000));
            }}
          />
          <span className="rec-bar__maxunit">s</span>
        </div>

        {/* Timeline */}
        <div
          className="rec-bar__timeline"
          ref={timelineRef}
          onMouseDown={handleTimelineMouseDown}
        >
          <div className="rec-bar__track">
            <div className="rec-bar__filled" style={{ width: `${filledPct}%` }} />
            <div
              className="rec-bar__handle"
              style={{ left: `${handlePct}%` }}
            >
              <span className="rec-bar__handle-label">{fmt(currentTime)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
