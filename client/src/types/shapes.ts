export type ShapeType =
  | 'line'
  | 'arrow'
  | 'squiggle'
  | 'rectangle'
  | 'circle'
  | 'diamond'
  | 'triangle'
  | 'text'
  | 'database'
  | 'cylinder';

export interface Point {
  x: number;
  y: number;
}

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  label: string;
  layerId: string;
  selected: boolean;
  rotation?:    number;   // degrees; undefined → 0
  visibleFrom?: number;   // ms on the timeline; undefined → always visible
}

export interface LineShape extends BaseShape {
  type: 'line';
  points: [Point, Point];
}

export interface ArrowShape extends BaseShape {
  type: 'arrow';
  points: [Point, Point];
}

export interface SquiggleShape extends BaseShape {
  type: 'squiggle';
  points: [Point, Point];
}

export interface RectangleShape extends BaseShape {
  type: 'rectangle';
}

export interface CircleShape extends BaseShape {
  type: 'circle';
}

export interface DiamondShape extends BaseShape {
  type: 'diamond';
}

export interface TriangleShape extends BaseShape {
  type: 'triangle';
}

export interface TextShape extends BaseShape {
  type: 'text';
  fontSize: number;
}

export interface DatabaseShape extends BaseShape {
  type: 'database';
}

export interface CylinderShape extends BaseShape {
  type: 'cylinder';
}

export type Shape =
  | LineShape
  | ArrowShape
  | SquiggleShape
  | RectangleShape
  | CircleShape
  | DiamondShape
  | TriangleShape
  | TextShape
  | DatabaseShape
  | CylinderShape;
