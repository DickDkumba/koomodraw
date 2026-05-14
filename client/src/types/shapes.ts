export type ShapeType =
  | 'line'
  | 'arrow'
  | 'rectangle'
  | 'circle'
  | 'diamond'
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
}

export interface LineShape extends BaseShape {
  type: 'line';
  points: [Point, Point];
}

export interface ArrowShape extends BaseShape {
  type: 'arrow';
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
  | RectangleShape
  | CircleShape
  | DiamondShape
  | TextShape
  | DatabaseShape
  | CylinderShape;
