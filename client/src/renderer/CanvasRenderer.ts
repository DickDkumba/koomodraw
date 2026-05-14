import type { Shape } from '../types/shapes';
import type { Scene } from '../types/scene';
import { drawLine } from './shapes/drawLine';
import { drawArrow } from './shapes/drawArrow';
import {
  drawRectangle,
  drawCircle,
  drawDiamond,
  drawText,
  drawDatabase,
  drawCylinder,
} from './shapes/drawPrimitives';

export interface RenderState {
  scene: Scene;
  objects: Record<string, Shape>;
  selectedIds: Set<string>;
  ghostShape: Shape | null;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: RenderState | null = null;
  private rafId: number | null = null;
  private dirty = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  update(state: RenderState): void {
    this.state = state;
    this.dirty = true;
    this.scheduleRender();
  }

  private scheduleRender(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      if (this.dirty) {
        this.render();
        this.dirty = false;
      }
    });
  }

  private render(): void {
    if (!this.state) return;
    const { scene, objects, selectedIds, ghostShape } = this.state;
    const { ctx, canvas } = this;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    ctx.save();
    ctx.translate(scene.viewportX, scene.viewportY);
    ctx.scale(scene.zoom, scene.zoom);

    this.drawGrid();

    for (const id of scene.objectIds) {
      const shape = objects[id];
      if (!shape) continue;
      this.drawShape(shape, selectedIds.has(id));
    }

    if (ghostShape) {
      ctx.globalAlpha = 0.5;
      this.drawShape(ghostShape, false);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private drawGrid(): void {
    const { ctx, canvas } = this;
    const step = 20;
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x < w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawShape(shape: Shape, selected: boolean): void {
    const { ctx } = this;
    switch (shape.type) {
      case 'line':       return drawLine(ctx, shape, selected);
      case 'arrow':      return drawArrow(ctx, shape, selected);
      case 'rectangle':  return drawRectangle(ctx, shape, selected);
      case 'circle':     return drawCircle(ctx, shape, selected);
      case 'diamond':    return drawDiamond(ctx, shape, selected);
      case 'text':       return drawText(ctx, shape, selected);
      case 'database':   return drawDatabase(ctx, shape, selected);
      case 'cylinder':   return drawCylinder(ctx, shape, selected);
    }
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    this.dirty = true;
    this.scheduleRender();
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  hitTest(worldX: number, worldY: number, objectIds: string[], objects: Record<string, Shape>): string | null {
    for (let i = objectIds.length - 1; i >= 0; i--) {
      const shape = objects[objectIds[i]];
      if (!shape) continue;
      if (
        worldX >= shape.x &&
        worldX <= shape.x + shape.width &&
        worldY >= shape.y &&
        worldY <= shape.y + shape.height
      ) {
        return shape.id;
      }
    }
    return null;
  }

  toWorldCoords(clientX: number, clientY: number, scene: Scene): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    return {
      x: (canvasX - scene.viewportX) / scene.zoom,
      y: (canvasY - scene.viewportY) / scene.zoom,
    };
  }
}
