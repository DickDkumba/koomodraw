import type { Shape, ShapeType, Point } from '../../types/shapes';
import { DEFAULT_LAYER_ID } from '../../types/scene';
import { useObjectStore } from '../../store/objectStore';

const DEFAULTS = {
  strokeColor: '#334155',
  fillColor: '#f8fafc',
  strokeWidth: 1.5,
  strokeDash: 'solid' as const,
};

function nextName(type: ShapeType): string {
  const objects = useObjectStore.getState().objects;
  let count = 0;
  for (const obj of Object.values(objects)) {
    if (obj.type === type) count++;
  }
  return count === 0 ? type : `${type}_${count + 1}`;
}

export function makeShape(type: ShapeType, x: number, y: number, w?: number, h?: number): Shape {
  const id = crypto.randomUUID();
  const width = w ?? defaultWidth(type);
  const height = h ?? defaultHeight(type);
  const base = {
    id,
    x,
    y,
    width,
    height,
    name: nextName(type),
    label: '',
    layerId: DEFAULT_LAYER_ID,
    selected: false,
    opacity: 1,
    ...DEFAULTS,
  };

  if (type === 'line' || type === 'arrow' || type === 'squiggle') {
    const p1: Point = { x, y };
    const p2: Point = { x: x + width, y: y + height };
    return { ...base, type, points: [p1, p2] } as Shape;
  }
  if (type === 'freedraw') {
    return { ...base, type, pathPoints: [] } as Shape;
  }
  if (type === 'text') {
    return { ...base, type, fontSize: 14, fillColor: 'transparent', label: 'Text' } as Shape;
  }
  if (type === 'youtube') {
    return { ...base, type, videoUrl: '', startTime: 0, events: [], fillColor: '#0f0f0f' } as Shape;
  }
  return { ...base, type } as Shape;
}

function defaultWidth(type: ShapeType): number {
  switch (type) {
    case 'line':
    case 'arrow':
    case 'squiggle':  return 120;
    case 'freedraw':  return 0;
    case 'text':      return 80;
    case 'circle':    return 80;
    case 'diamond':
    case 'triangle':  return 100;
    case 'database':
    case 'cylinder':  return 80;
    case 'youtube':   return 320;
    default:          return 120;
  }
}

function defaultHeight(type: ShapeType): number {
  switch (type) {
    case 'line':
    case 'arrow':     return 0;
    case 'squiggle':  return 40;   // diagonal so the wave is visible immediately
    case 'freedraw':  return 0;
    case 'text':      return 20;
    case 'circle':    return 80;
    case 'diamond':
    case 'triangle':  return 80;
    case 'database':
    case 'cylinder':  return 90;
    case 'youtube':   return 180;
    default:          return 70;
  }
}
