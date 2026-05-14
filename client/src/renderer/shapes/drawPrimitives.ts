import type {
  RectangleShape,
  CircleShape,
  DiamondShape,
  TextShape,
  DatabaseShape,
  CylinderShape,
} from '../../types/shapes';

function applyFillStroke(
  ctx: CanvasRenderingContext2D,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number
): void {
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.fill();
  ctx.stroke();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  cx: number,
  cy: number,
  fontSize = 13
): void {
  if (!label) return;
  ctx.save();
  ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
  ctx.restore();
}

export function drawRectangle(ctx: CanvasRenderingContext2D, s: RectangleShape): void {
  ctx.beginPath();
  ctx.roundRect(s.x, s.y, s.width, s.height, 4);
  applyFillStroke(ctx, s.fillColor, s.strokeColor, s.strokeWidth);
  drawLabel(ctx, s.label, s.x + s.width / 2, s.y + s.height / 2);
}

export function drawCircle(ctx: CanvasRenderingContext2D, s: CircleShape): void {
  const rx = s.width / 2;
  const ry = s.height / 2;
  ctx.beginPath();
  ctx.ellipse(s.x + rx, s.y + ry, rx, ry, 0, 0, Math.PI * 2);
  applyFillStroke(ctx, s.fillColor, s.strokeColor, s.strokeWidth);
  drawLabel(ctx, s.label, s.x + rx, s.y + ry);
}

export function drawDiamond(ctx: CanvasRenderingContext2D, s: DiamondShape): void {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  ctx.beginPath();
  ctx.moveTo(cx, s.y);
  ctx.lineTo(s.x + s.width, cy);
  ctx.lineTo(cx, s.y + s.height);
  ctx.lineTo(s.x, cy);
  ctx.closePath();
  applyFillStroke(ctx, s.fillColor, s.strokeColor, s.strokeWidth);
  drawLabel(ctx, s.label, cx, cy);
}

export function drawText(ctx: CanvasRenderingContext2D, s: TextShape): void {
  ctx.save();
  ctx.font = `${s.fontSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = s.strokeColor;
  ctx.textBaseline = 'top';
  ctx.fillText(s.label, s.x, s.y);
  ctx.restore();
}

export function drawDatabase(ctx: CanvasRenderingContext2D, s: DatabaseShape): void {
  const rx = s.width / 2;
  const ry = 10;
  const cx = s.x + rx;
  const top = s.y;
  const bottom = s.y + s.height;

  ctx.beginPath();
  ctx.ellipse(cx, top + ry, rx, ry, 0, 0, Math.PI * 2);
  applyFillStroke(ctx, s.fillColor, s.strokeColor, s.strokeWidth);

  ctx.beginPath();
  ctx.moveTo(s.x, top + ry);
  ctx.lineTo(s.x, bottom - ry);
  // Arc from left (PI) clockwise through bottom to right (2*PI) so we end at the right edge
  // counterclockwise from PI (left) → PI/2 (bottom) → 0 (right) — ends at right edge
  ctx.ellipse(cx, bottom - ry, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(s.x + s.width, top + ry);
  applyFillStroke(ctx, s.fillColor, s.strokeColor, s.strokeWidth);

  drawLabel(ctx, s.label, cx, top + s.height / 2 + ry);
}

export function drawCylinder(ctx: CanvasRenderingContext2D, s: CylinderShape): void {
  const rx = s.width / 2;
  const ry = 8;
  const cx = s.x + rx;
  const top = s.y;
  const bottom = s.y + s.height;

  ctx.beginPath();
  ctx.moveTo(s.x, top + ry);
  ctx.lineTo(s.x, bottom - ry);
  // counterclockwise from PI (left) → PI/2 (bottom) → 0 (right) — ends at right edge
  ctx.ellipse(cx, bottom - ry, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(s.x + s.width, top + ry);
  ctx.closePath();
  applyFillStroke(ctx, s.fillColor, s.strokeColor, s.strokeWidth);

  ctx.beginPath();
  ctx.ellipse(cx, top + ry, rx, ry, 0, 0, Math.PI * 2);
  applyFillStroke(ctx, s.fillColor, s.strokeColor, s.strokeWidth);

  drawLabel(ctx, s.label, cx, top + s.height / 2 + ry);
}
