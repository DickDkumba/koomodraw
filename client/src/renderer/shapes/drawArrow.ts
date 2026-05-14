import type { ArrowShape } from '../../types/shapes';

const HEAD_LEN = 14;
const HEAD_ANGLE = Math.PI / 6;

export function drawArrow(ctx: CanvasRenderingContext2D, shape: ArrowShape): void {
  const [p1, p2] = shape.points;
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = shape.strokeColor;
  ctx.lineWidth = shape.strokeWidth;
  ctx.stroke();

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
}
