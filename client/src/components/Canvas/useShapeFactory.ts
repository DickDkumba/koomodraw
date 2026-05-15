import type { Shape, ShapeType, Point } from '../../types/shapes';
import { DEFAULT_LAYER_ID } from '../../types/scene';

const DEFAULTS = {
  strokeColor: '#334155',
  fillColor: '#f8fafc',
  strokeWidth: 1.5,
};

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
    label: '',
    layerId: DEFAULT_LAYER_ID,
    selected: false,
    ...DEFAULTS,
  };

  if (type === 'line' || type === 'arrow' || type === 'squiggle') {
    const p1: Point = { x, y };
    const p2: Point = { x: x + width, y: y + height };
    return { ...base, type, points: [p1, p2] } as Shape;
  }
  if (type === 'text') {
    return { ...base, type, fontSize: 14, fillColor: 'transparent', label: 'Text' } as Shape;
  }
  return { ...base, type } as Shape;
}

function defaultWidth(type: ShapeType): number {
  switch (type) {
    case 'line':
    case 'arrow':
    case 'squiggle':  return 120;
    case 'text':      return 80;
    case 'circle':    return 80;
    case 'diamond':
    case 'triangle':  return 100;
    case 'database':
    case 'cylinder':  return 80;
    default:          return 120;
  }
}

function defaultHeight(type: ShapeType): number {
  switch (type) {
    case 'line':
    case 'arrow':     return 0;
    case 'squiggle':  return 40;   // diagonal so the wave is visible immediately
    case 'text':      return 20;
    case 'circle':    return 80;
    case 'diamond':
    case 'triangle':  return 80;
    case 'database':
    case 'cylinder':  return 90;
    default:          return 70;
  }
}
