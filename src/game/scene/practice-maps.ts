import type {
  BlockingVolume,
  BlockingVolumeMaterial,
  WalkableSurface,
  WalkableSurfaceMaterial,
} from "../map-layout";
import type { CollisionRect, MapId, TargetState, WorldBounds } from "../types";
import { createDefaultTargets } from "../Targets";
import type { StaticGroundSpawn } from "../inventory/inventory-data";

export type OccluderVolume = {
  center: [number, number, number];
  size: [number, number, number];
};

export type PracticeMapEnvironment =
  | {
      kind: "range-procedural";
    }
  | {
      kind: "school-blockout";
    };

export type PracticeMapDefinition = {
  id: MapId;
  label: string;
  description: string;
  supportsStressMode: boolean;
  worldBounds: WorldBounds;
  collisionRects: readonly CollisionRect[];
  occluderVolumes: readonly OccluderVolume[];
  playerSpawn: {
    position: [number, number, number];
    yaw: number;
    pitch: number;
  };
  targets: readonly TargetState[];
  groundSpawns: readonly StaticGroundSpawn[];
  walkableSurfaces?: readonly WalkableSurface[];
  blockingVolumes?: readonly BlockingVolume[];
  environment: PracticeMapEnvironment;
};

const DEFAULT_PLAYER_PITCH = -0.05;
const SCHOOL_SECOND_FLOOR_Y = 6;
const POOL_FLOOR_Y = -1.75;

const RANGE_WORLD_BOUNDS: WorldBounds = {
  minX: -80,
  maxX: 80,
  minZ: -80,
  maxZ: 80,
};

const RANGE_COLLIDERS: readonly CollisionRect[] = [
  { minX: -62, maxX: -58, minZ: -42, maxZ: -38 },
  { minX: 53, maxX: 57, minZ: 38, maxZ: 42 },
];

const RANGE_GROUND_SPAWNS: readonly StaticGroundSpawn[] = [
  { itemId: "weapon_rifle", quantity: 1, position: [1.4, 0.05, 3.5] },
  { itemId: "weapon_sniper", quantity: 1, position: [1.9, 0.05, 3.5] },
  { itemId: "ammo_rifle", quantity: 150, position: [0.95, 0.14, 3.85] },
  { itemId: "ammo_sniper", quantity: 30, position: [2.35, 0.14, 3.85] },
];

const SCHOOL_WORLD_BOUNDS: WorldBounds = {
  minX: -48,
  maxX: 48,
  minZ: -52,
  maxZ: 64,
};

const TDM_COLLIDERS: readonly CollisionRect[] = [];

const TDM_OCCLUDERS: readonly OccluderVolume[] = [];

function slab(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  y: number,
  material: WalkableSurfaceMaterial,
  thickness = 0.6,
): WalkableSurface {
  return {
    kind: "slab",
    minX,
    maxX,
    minZ,
    maxZ,
    y,
    material,
    thickness,
  };
}

function ramp(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  axis: "x" | "z",
  startY: number,
  endY: number,
  material: WalkableSurfaceMaterial,
  thickness = 0.6,
): WalkableSurface {
  return {
    kind: "ramp",
    minX,
    maxX,
    minZ,
    maxZ,
    axis,
    startY,
    endY,
    material,
    thickness,
  };
}

function volume(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number,
  material: BlockingVolumeMaterial = "wall",
): BlockingVolume {
  return {
    center: [
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2,
    ],
    size: [maxX - minX, maxY - minY, maxZ - minZ],
    material,
  };
}

const SCHOOL_WALKABLE_SURFACES: readonly WalkableSurface[] = [
  // Yard — split to avoid overlapping pool-deck slabs (prevents z-fighting)
  slab(-48, 28, 18, 64, 0, "yard"),        // top-yard left of pool wing
  slab(46, 48, 18, 64, 0, "yard"),          // top-yard right sliver past pool wall
  slab(28, 46, 40, 64, 0, "yard"),          // top-yard above pool wing
  slab(-48, 48, -52, -18, 0, "yard"),       // bottom yard (unchanged)
  slab(-48, -24, -18, 18, 0, "yard"),       // left yard (unchanged)
  slab(24, 48, -18, 10, 0, "yard"),         // right yard (unchanged)

  // Interior building
  slab(-24, 24, -18, 18, 0, "interior"),

  // Pool deck — fill the gap at x=[24,30] z=[10,12] by extending south edge
  slab(24, 30, 10, 18, 0, "poolDeck"),      // was z=[12,18], now z=[10,18]
  slab(30, 46, 10, 16, 0, "poolDeck"),
  slab(28, 46, 34, 40, 0, "poolDeck"),
  slab(28, 34, 16, 34, 0, "poolDeck"),
  slab(40, 46, 16, 34, 0, "poolDeck"),
  // Fill gap behind pool wall at x=[46,48] z=[10,18]
  slab(46, 48, 10, 18, 0, "yard"),

  // Pool floor — prevents infinite fall if player jumps over railings
  slab(34, 40, 16, 34, POOL_FLOOR_Y, "poolDeck"),

  // Upper floor & ramps
  slab(-24, 24, -18, 18, SCHOOL_SECOND_FLOOR_Y, "upper"),
  ramp(-24, -18, -8, 8, "x", 0, SCHOOL_SECOND_FLOOR_Y, "stair"),
  ramp(18, 24, -8, 8, "x", SCHOOL_SECOND_FLOOR_Y, 0, "stair"),
];

const SCHOOL_BLOCKING_VOLUMES: readonly BlockingVolume[] = [
  volume(-24, -6, 0, 4.2, 17.5, 18.5),
  volume(6, 24, 0, 4.2, 17.5, 18.5),
  volume(-24, 24, 4.2, 8.8, 17.5, 18.5),
  volume(-24, -6, 0, 4.2, -18.5, -17.5),
  volume(6, 24, 0, 4.2, -18.5, -17.5),
  volume(-24, 24, 4.2, 8.8, -18.5, -17.5),
  volume(-24.5, -23.5, 0, 8.8, -18, 18),
  volume(23.5, 24.5, 0, 8.8, -18, 10),
  volume(23.5, 24.5, 4.2, 8.8, 10, 18),
  volume(-24, -12, 0, 3.4, -4.5, -3.5),
  volume(-8, 8, 0, 3.4, -4.5, -3.5),
  volume(12, 24, 0, 3.4, -4.5, -3.5),
  volume(-24, -12, 0, 3.4, 3.5, 4.5),
  volume(-8, 8, 0, 3.4, 3.5, 4.5),
  volume(12, 24, 0, 3.4, 3.5, 4.5),
  volume(-24, -12, SCHOOL_SECOND_FLOOR_Y, SCHOOL_SECOND_FLOOR_Y + 3.2, -4.5, -3.5),
  volume(-8, 8, SCHOOL_SECOND_FLOOR_Y, SCHOOL_SECOND_FLOOR_Y + 3.2, -4.5, -3.5),
  volume(12, 24, SCHOOL_SECOND_FLOOR_Y, SCHOOL_SECOND_FLOOR_Y + 3.2, -4.5, -3.5),
  volume(-24, -12, SCHOOL_SECOND_FLOOR_Y, SCHOOL_SECOND_FLOOR_Y + 3.2, 3.5, 4.5),
  volume(-8, 8, SCHOOL_SECOND_FLOOR_Y, SCHOOL_SECOND_FLOOR_Y + 3.2, 3.5, 4.5),
  volume(12, 24, SCHOOL_SECOND_FLOOR_Y, SCHOOL_SECOND_FLOOR_Y + 3.2, 3.5, 4.5),
  volume(30, 46, 0, 2.6, 9.5, 10.5),
  volume(30, 46, 0, 2.6, 39.5, 40.5),
  volume(45.5, 46.5, 0, 2.6, 10, 40),
  volume(34, 40, 0, 1.25, 15.5, 16.5, "railing"),
  volume(34, 40, 0, 1.25, 33.5, 34.5, "railing"),
  volume(33.5, 34.5, 0, 1.25, 16, 34, "railing"),
  volume(39.5, 40.5, 0, 1.25, 16, 34, "railing"),
  volume(-14, -10, 0, 1.6, 30, 34, "cover"),
  volume(10, 14, 0, 1.6, 44, 48, "cover"),
  volume(-4, 4, 0, 1.8, -34, -30, "cover"),
];

const TDM_PLAYER_SPAWN = {
  position: [0, 0, 34] as [number, number, number],
  yaw: 0,
  pitch: DEFAULT_PLAYER_PITCH,
};

export const RANGE_PRACTICE_MAP: PracticeMapDefinition = {
  id: "range",
  label: "Range",
  description: "Procedural practice range with the existing stress-box load test.",
  supportsStressMode: true,
  worldBounds: RANGE_WORLD_BOUNDS,
  collisionRects: RANGE_COLLIDERS,
  occluderVolumes: [],
  playerSpawn: {
    position: [0, 0, 6],
    yaw: 0,
    pitch: DEFAULT_PLAYER_PITCH,
  },
  targets: createDefaultTargets(),
  groundSpawns: RANGE_GROUND_SPAWNS,
  environment: {
    kind: "range-procedural",
  },
};

export const TDM_PRACTICE_MAP: PracticeMapDefinition = {
  id: "tdm",
  label: "School",
  description: "Movement-first school blockout with a 2-floor main building and pool wing.",
  supportsStressMode: false,
  worldBounds: SCHOOL_WORLD_BOUNDS,
  collisionRects: TDM_COLLIDERS,
  occluderVolumes: TDM_OCCLUDERS,
  playerSpawn: TDM_PLAYER_SPAWN,
  targets: [],
  groundSpawns: [],
  walkableSurfaces: SCHOOL_WALKABLE_SURFACES,
  blockingVolumes: SCHOOL_BLOCKING_VOLUMES,
  environment: {
    kind: "school-blockout",
  },
};

export const PRACTICE_MAPS: Record<MapId, PracticeMapDefinition> = {
  range: RANGE_PRACTICE_MAP,
  tdm: TDM_PRACTICE_MAP,
};

export const PRACTICE_MAP_OPTIONS = [
  {
    id: RANGE_PRACTICE_MAP.id,
    label: RANGE_PRACTICE_MAP.label,
    description: RANGE_PRACTICE_MAP.description,
  },
  {
    id: TDM_PRACTICE_MAP.id,
    label: TDM_PRACTICE_MAP.label,
    description: TDM_PRACTICE_MAP.description,
  },
] as const;

export function getPracticeMapById(mapId: MapId) {
  return PRACTICE_MAPS[mapId];
}

export function clonePracticeMapTargets(
  targets: readonly TargetState[],
): TargetState[] {
  return targets.map((target) => ({
    ...target,
    position: [...target.position] as [number, number, number],
  }));
}
