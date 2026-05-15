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
  | 'cylinder'
  | 'group'
  | 'youtube';

export interface Point {
  x: number;
  y: number;
}

// ── Event system (all shapes) ──────────────────────────────────────────────

export type EventTrigger =
  | 'click'      // fires when shape is clicked in play mode
  | 'time'       // fires when YouTube playback reaches a specific second
  | 'play'       // fires when YouTube video starts playing
  | 'pause'      // fires when YouTube video is paused
  | 'ended'      // fires when YouTube video ends
  | 'load';      // fires when YouTube video is loaded/ready

export type EventAction =
  | 'start_player'     // start the scene recording player
  | 'stop_player'      // stop/pause the scene recording player
  | 'seek_player'      // seek the scene player to a time
  | 'navigate_scene'   // navigate to a specific scene
  | 'start_youtube'    // start a YouTube player (actionTarget = youtube shape id)
  | 'stop_youtube'     // pause a YouTube player
  | 'hide_object'      // hide an object (actionTarget = object id)
  | 'show_object';     // show an object (actionTarget = object id)

export interface ShapeEvent {
  id: string;
  trigger: EventTrigger;
  triggerTime?: number;       // seconds — only for 'time' trigger
  action: EventAction;
  actionValue?: number;       // target seconds for seek_player, scene index for navigate_scene
  actionTarget?: string;      // target object id for start_youtube, hide_object, etc.
}

// Keep backward compat alias
export type YouTubeEvent = ShapeEvent;
export type YouTubeTrigger = EventTrigger;

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
  name: string;
  label: string;
  layerId: string;
  selected: boolean;
  rotation?:    number;   // degrees; undefined → 0
  visibleFrom?: number;   // ms on the timeline; undefined → always visible
  visible?: boolean;      // runtime flag — false hides the shape; undefined/true = visible
  events?: ShapeEvent[];
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

export interface GroupShape extends BaseShape {
  type: 'group';
  childIds: string[];
}

export interface YouTubeShape extends BaseShape {
  type: 'youtube';
  videoUrl: string;
  startTime: number;
  events: ShapeEvent[];  // override to make non-optional for YouTube
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
  | CylinderShape
  | GroupShape
  | YouTubeShape;
