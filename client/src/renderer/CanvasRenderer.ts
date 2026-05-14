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
import { drawSelectionOverlay } from './shapes/selectionOverlay';

export interface MarqueeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderState {
  scene: Scene;
  objects: Record<string, Shape>;
  selectedIds: Set<string>;
  ghostShape: Shape | null;
  marqueeRect: MarqueeRect | null;
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

    // Draw all shapes (no selection decoration yet)
    for (const id of scene.objectIds) {
      const shape = objects[id];
      if (!shape) continue;
      this.drawShape(shape);
    }

    if (ghostShape) {
      ctx.globalAlpha = 0.5;
      this.drawShape(ghostShape);
      ctx.globalAlpha = 1;
    }

    // Draw selection overlays + resize handles on top of everything
    for (const id of selectedIds) {
      const shape = objects[id];
      if (!shape) continue;
      drawSelectionOverlay(ctx, shape, scene.zoom);
    }

    // Marquee selection rectangle
    const { marqueeRect } = this.state;
    if (marqueeRect) {
      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1 / scene.zoom;
      ctx.setLineDash([4 / scene.zoom, 3 / scene.zoom]);
      ctx.fillStyle = 'rgba(37, 99, 235, 0.06)';
      ctx.fillRect(marqueeRect.x, marqueeRect.y, marqueeRect.w, marqueeRect.h);
      ctx.strokeRect(marqueeRect.x, marqueeRect.y, marqueeRect.w, marqueeRect.h);
      ctx.setLineDash([]);
      ctx.restore();
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

  private drawShape(shape: Shape): void {
    const { ctx } = this;
    switch (shape.type) {
      case 'line':       return drawLine(ctx, shape);
      case 'arrow':      return drawArrow(ctx, shape);
      case 'rectangle':  return drawRectangle(ctx, shape);
      case 'circle':     return drawCircle(ctx, shape);
      case 'diamond':    return drawDiamond(ctx, shape);
      case 'text':       return drawText(ctx, shape);
      case 'database':   return drawDatabase(ctx, shape);
      case 'cylinder':   return drawCylinder(ctx, shape);
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

  hitTest(
    worldX: number,
    worldY: number,
    objectIds: string[],
    objects: Record<string, Shape>
  ): string | null {
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

  toWorldCoords(
    clientX: number,
    clientY: number,
    scene: Scene
  ): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - scene.viewportX) / scene.zoom,
      y: (clientY - rect.top  - scene.viewportY) / scene.zoom,
    };
  }
}
