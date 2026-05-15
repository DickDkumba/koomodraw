import type { Shape, ArrowShape, RectangleShape, DatabaseShape, CylinderShape, TextShape } from '../types/shapes';
import type { Scene } from '../types/scene';

export interface ExampleDoc {
  name: string;
  description: string;
  scenes: Scene[];
  objects: Record<string, Shape>;
}

const L = 'default';
const LAYERS = [{ id: L, name: 'Default', visible: true, locked: false }];

function arrow(
  id: string,
  x1: number, y1: number,
  x2: number, y2: number,
  color = '#94a3b8',
): ArrowShape {
  return {
    id, type: 'arrow',
    x: Math.min(x1, x2), y: Math.min(y1, y2),
    width: Math.max(2, Math.abs(x2 - x1)),
    height: Math.max(2, Math.abs(y2 - y1)),
    points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
    strokeColor: color, fillColor: 'transparent', strokeWidth: 2,
    name: id, label: '', layerId: L, selected: false, opacity: 1,
  };
}

function rect(
  id: string, x: number, y: number, w: number, h: number,
  label: string, stroke: string, fill: string,
): RectangleShape {
  return {
    id, type: 'rectangle', x, y, width: w, height: h, label,
    strokeColor: stroke, fillColor: fill, strokeWidth: 2,
    name: id, layerId: L, selected: false, opacity: 1,
  };
}

function db(id: string, x: number, y: number, w: number, h: number, label: string, stroke: string, fill: string): DatabaseShape {
  return { id, type: 'database', x, y, width: w, height: h, label, strokeColor: stroke, fillColor: fill, strokeWidth: 2, name: id, layerId: L, selected: false, opacity: 1 };
}

function cyl(id: string, x: number, y: number, w: number, h: number, label: string, stroke: string, fill: string): CylinderShape {
  return { id, type: 'cylinder', x, y, width: w, height: h, label, strokeColor: stroke, fillColor: fill, strokeWidth: 2, name: id, layerId: L, selected: false, opacity: 1 };
}

function txt(id: string, x: number, y: number, w: number, label: string, size = 12): TextShape {
  return {
    id, type: 'text', x, y, width: w, height: 26, label,
    strokeColor: '#94a3b8', fillColor: 'transparent', strokeWidth: 0,
    name: id, layerId: L, selected: false, opacity: 1, fontSize: size,
  };
}

// ── Design Twitter ────────────────────────────────────────────────────────────
//
// Layout (top-left coords):
//
//              [Client]          x=300 y=40  w=200 h=52
//                 ↓
//           [API Gateway]        x=180 y=160 w=340 h=52
//          ↙        ↓        ↘
//   [Tweet Svc] [User Svc] [Feed Svc]  y=300
//        ↓                      ↓
//  [PostgreSQL]  [Precalc]  [Redis]    y=450
//                   ↗           ↑
//              (tweet triggers fan-out → cache)

const twObjs: Record<string, Shape> = {
  // ── Arrows (rendered first so shapes appear on top) ───────────────────────
  'tw-a-c-gw':  arrow('tw-a-c-gw',  400,  92, 350, 160),   // Client → API GW
  'tw-a-gw-tw': arrow('tw-a-gw-tw', 350, 212, 130, 300),   // API GW → Tweet
  'tw-a-gw-us': arrow('tw-a-gw-us', 350, 212, 350, 300),   // API GW → User
  'tw-a-gw-fs': arrow('tw-a-gw-fs', 350, 212, 570, 300),   // API GW → Feed
  'tw-a-tw-db': arrow('tw-a-tw-db', 130, 352, 120, 450),   // Tweet → Postgres
  'tw-a-tw-pc': arrow('tw-a-tw-pc', 130, 352, 330, 450),   // Tweet → Precalc
  'tw-a-pc-rd': arrow('tw-a-pc-rd', 420, 476, 450, 490),   // Precalc → Redis
  'tw-a-fs-rd': arrow('tw-a-fs-rd', 570, 352, 520, 450),   // Feed → Redis (read)

  // ── Nodes ─────────────────────────────────────────────────────────────────
  'tw-client':  rect('tw-client',  300,  40, 200, 52, 'Client',          '#0284c7', '#e0f2fe'),
  'tw-apigw':   rect('tw-apigw',   180, 160, 340, 52, 'API Gateway',     '#d97706', '#fef3c7'),
  'tw-tsvc':    rect('tw-tsvc',     50, 300, 160, 52, 'Tweet Service',   '#16a34a', '#f0fdf4'),
  'tw-usvc':    rect('tw-usvc',    270, 300, 160, 52, 'User Service',    '#16a34a', '#f0fdf4'),
  'tw-fsvc':    rect('tw-fsvc',    490, 300, 160, 52, 'Feed Service',    '#16a34a', '#f0fdf4'),
  'tw-db':      db(  'tw-db',       50, 450, 140, 90, 'PostgreSQL',      '#7c3aed', '#faf5ff'),
  'tw-cache':   cyl( 'tw-cache',   450, 450, 140, 80, 'Redis Cache',     '#dc2626', '#fef2f2'),
  'tw-precalc': rect('tw-precalc', 240, 450, 180, 52, 'Precalc Service', '#ea580c', '#fff7ed'),

  // ── Text annotations ──────────────────────────────────────────────────────
  'tw-t-rest':   txt('tw-t-rest',   420,  94, 120, 'REST / HTTPS'),
  'tw-t-fanout': txt('tw-t-fanout', 175, 390, 150, 'fanout on write'),
  'tw-t-reads':  txt('tw-t-reads',  492, 390,  80, 'reads'),
};

const twScene: Scene = {
  id: 'tw-scene-1',
  name: 'System Overview',
  objectIds: Object.keys(twObjs),
  layers: LAYERS,
  activeLayerId: L,
  viewportX: 0,
  viewportY: 0,
  zoom: 1,
};

// ── Exported examples list ────────────────────────────────────────────────────

export const EXAMPLES: ExampleDoc[] = [
  {
    name: 'Design Twitter',
    description:
      'Classic Twitter/X system design — API Gateway routing to Tweet, User, and Feed services, backed by PostgreSQL and a Redis cache with fan-out on write.',
    scenes: [twScene],
    objects: twObjs,
  },
];
