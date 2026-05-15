import type { SquiggleShape } from '../../types/shapes';

export function drawSquiggle(ctx: CanvasRenderingContext2D, s: SquiggleShape): void {
  const [p1, p2] = s.points;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;

  const ux = dx / len;   // unit vector along line
  const uy = dy / len;
  const nx = -uy;        // perpendicular (left-hand normal)
  const ny = ux;

  const amp = 12;
  // Even number of half-waves so the line ends on the main axis
  const segments = Math.max(2, Math.round(len / 24) * 2);

  ctx.save();
  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);

  for (let i = 0; i < segments; i++) {
    const cpT  = (i + 0.5) / segments;
    const endT = (i + 1)   / segments;
    const dir  = i % 2 === 0 ? 1 : -1;

    ctx.quadraticCurveTo(
      p1.x + ux * len * cpT  + nx * amp * dir,
      p1.y + uy * len * cpT  + ny * amp * dir,
      p1.x + ux * len * endT,
      p1.y + uy * len * endT,
    );
  }

  ctx.stroke();
  ctx.restore();
}
