import type { Shape, LineShape, ArrowShape, Point } from '../../types/shapes';

// For box shapes: 8 handles indexed 0–7
// 0=NW  1=N  2=NE
// 7=W        3=E
// 6=SW  5=S  4=SE
//
// For linear shapes: 2 handles — 0=p1 endpoint, 1=p2 endpoint
export type HandleIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

const HANDLE_SCREEN_PX = 8;
const HIT_RADIUS_PX = 10;

export function isLinear(shape: Shape): shape is LineShape | ArrowShape {
  return shape.type === 'line' || shape.type === 'arrow';
}

// ─── Box shapes ──────────────────────────────────────────────────────────────

function getBoxHandleCoords(shape: Shape): Array<{ x: number; y: number }> {
  const { x, y, width: w, height: h } = shape;
  return [
    { x,        y        },  // 0 NW
    { x: x+w/2, y        },  // 1 N
    { x: x+w,   y        },  // 2 NE
    { x: x+w,   y: y+h/2 },  // 3 E
    { x: x+w,   y: y+h   },  // 4 SE
    { x: x+w/2, y: y+h   },  // 5 S
    { x,        y: y+h   },  // 6 SW
    { x,        y: y+h/2 },  // 7 W
  ];
}

function drawBoxOverlay(ctx: CanvasRenderingContext2D, shape: Shape, zoom: number): void {
  const { x, y, width: w, height: h } = shape;
  const hs = HANDLE_SCREEN_PX / zoom;
  const pad = 4 / zoom;

  ctx.save();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([5 / zoom, 3 / zoom]);
  ctx.strokeRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
  ctx.setLineDash([]);

  for (const { x: hx, y: hy } of getBoxHandleCoords(shape)) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.rect(hx - hs / 2, hy - hs / 2, hs, hs);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Linear shapes ───────────────────────────────────────────────────────────

function getLinearHandleCoords(shape: LineShape | ArrowShape): [Point, Point] {
  return [shape.points[0], shape.points[1]];
}

function drawLinearOverlay(ctx: CanvasRenderingContext2D, shape: LineShape | ArrowShape, zoom: number): void {
  const [p1, p2] = getLinearHandleCoords(shape);
  const r = (HANDLE_SCREEN_PX / 2) / zoom;

  ctx.save();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5 / zoom;

  for (const p of [p1, p2]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function drawSelectionOverlay(ctx: CanvasRenderingContext2D, shape: Shape, zoom: number): void {
  if (isLinear(shape)) {
    drawLinearOverlay(ctx, shape, zoom);
  } else {
    drawBoxOverlay(ctx, shape, zoom);
  }
}

export function hitTestHandle(
  worldX: number,
  worldY: number,
  shape: Shape,
  zoom: number
): HandleIndex | null {
  const r = HIT_RADIUS_PX / zoom;

  if (isLinear(shape)) {
    const [p1, p2] = getLinearHandleCoords(shape);
    if (Math.hypot(worldX - p1.x, worldY - p1.y) <= r) return 0;
    if (Math.hypot(worldX - p2.x, worldY - p2.y) <= r) return 1;
    return null;
  }

  const handles = getBoxHandleCoords(shape);
  for (let i = 0; i < handles.length; i++) {
    const { x, y } = handles[i];
    if (Math.abs(worldX - x) <= r && Math.abs(worldY - y) <= r) {
      return i as HandleIndex;
    }
  }
  return null;
}

// Move a single endpoint of a line/arrow; recomputes bounding box
export function applyEndpointMove(
  shape: LineShape | ArrowShape,
  handleIndex: 0 | 1,
  worldX: number,
  worldY: number
): { x: number; y: number; width: number; height: number; points: [Point, Point] } {
  const [p1, p2] = shape.points;
  const newPoints: [Point, Point] =
    handleIndex === 0
      ? [{ x: worldX, y: worldY }, p2]
      : [p1, { x: worldX, y: worldY }];

  const minX = Math.min(newPoints[0].x, newPoints[1].x);
  const minY = Math.min(newPoints[0].y, newPoints[1].y);
  const maxX = Math.max(newPoints[0].x, newPoints[1].x);
  const maxY = Math.max(newPoints[0].y, newPoints[1].y);

  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
    points: newPoints,
  };
}

// Resize a box shape given a handle index and world-space delta
export function applyResize(
  orig: { x: number; y: number; width: number; height: number },
  handle: HandleIndex,
  dx: number,
  dy: number
): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = orig;
  const MIN = 20;

  switch (handle) {
    case 0: x += dx; y += dy; width -= dx; height -= dy; break;
    case 1:          y += dy;              height -= dy; break;
    case 2:          y += dy; width += dx; height -= dy; break;
    case 3:                   width += dx;               break;
    case 4:                   width += dx; height += dy; break;
    case 5:                               height += dy;  break;
    case 6: x += dx;          width -= dx; height += dy; break;
    case 7: x += dx;          width -= dx;               break;
  }

  if (width < MIN) {
    if (handle === 0 || handle === 6 || handle === 7) x -= MIN - width;
    width = MIN;
  }
  if (height < MIN) {
    if (handle === 0 || handle === 1 || handle === 2) y -= MIN - height;
    height = MIN;
  }

  return { x, y, width, height };
}

export function handleCursor(handle: HandleIndex): string {
  const cursors = ['nw-resize', 'n-resize', 'ne-resize', 'e-resize', 'se-resize', 's-resize', 'sw-resize', 'w-resize'];
  return cursors[handle] ?? 'crosshair';
}
