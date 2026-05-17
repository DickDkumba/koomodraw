import type { StrokeDash } from '../../types/shapes';

export function applyDash(
  ctx: CanvasRenderingContext2D,
  dash: StrokeDash | undefined,
  strokeWidth: number
): void {
  if (!dash || dash === 'solid') {
    ctx.setLineDash([]);
  } else if (dash === 'dashed') {
    ctx.setLineDash([strokeWidth * 5, strokeWidth * 4]);
    ctx.lineCap = 'butt';
  } else if (dash === 'dotted') {
    ctx.setLineDash([strokeWidth * 1.5, strokeWidth * 3]);
    ctx.lineCap = 'round';
  }
}
