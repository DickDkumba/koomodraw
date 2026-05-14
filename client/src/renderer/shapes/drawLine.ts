import type { LineShape } from '../../types/shapes';

export function drawLine(ctx: CanvasRenderingContext2D, shape: LineShape): void {
  const [p1, p2] = shape.points;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = shape.strokeColor;
  ctx.lineWidth = shape.strokeWidth;
  ctx.stroke();
}
