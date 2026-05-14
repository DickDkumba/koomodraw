import type { ArrowShape } from '../../types/shapes';

const HEAD_LEN = 14;
const HEAD_ANGLE = Math.PI / 6;

export function drawArrow(ctx: CanvasRenderingContext2D, shape: ArrowShape, selected: boolean): void {
  const [p1, p2] = shape.points;
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = shape.strokeColor;
  ctx.lineWidth = shape.strokeWidth;
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(p2.x, p2.y);
  ctx.lineTo(
    p2.x - HEAD_LEN * Math.cos(angle - HEAD_ANGLE),
    p2.y - HEAD_LEN * Math.sin(angle - HEAD_ANGLE)
  );
  ctx.moveTo(p2.x, p2.y);
  ctx.lineTo(
    p2.x - HEAD_LEN * Math.cos(angle + HEAD_ANGLE),
    p2.y - HEAD_LEN * Math.sin(angle + HEAD_ANGLE)
  );
  ctx.stroke();

  if (selected) {
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(shape.x - 4, shape.y - 4, shape.width + 8, shape.height + 8);
    ctx.setLineDash([]);
  }
}
