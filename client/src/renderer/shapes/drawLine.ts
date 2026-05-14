import type { LineShape } from '../../types/shapes';

export function drawLine(ctx: CanvasRenderingContext2D, shape: LineShape, selected: boolean): void {
  const [p1, p2] = shape.points;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = shape.strokeColor;
  ctx.lineWidth = shape.strokeWidth;
  ctx.stroke();

  if (selected) drawSelectionHandles(ctx, shape.x, shape.y, shape.width, shape.height);
}

function drawSelectionHandles(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
): void {
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
  ctx.setLineDash([]);
}
