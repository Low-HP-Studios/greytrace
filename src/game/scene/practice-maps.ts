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
      kind: "glb-scene";
      modelUrl: string;
      transform: {
        position: [number, number, number];
        rotationY: number;
        scale: number;
      };
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
  environment: PracticeMapEnvironment;
};

const DEFAULT_PLAYER_PITCH = -0.05;

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

export const TDM_MAP_MODEL_URL = "/assets/map/school.glb";

const TDM_WORLD_BOUNDS: WorldBounds = {
  minX: -8,
  maxX: 248,
  minZ: -225,
  maxZ: 32,
};

function rectToOccluder(
  rect: CollisionRect,
  height: number,
  centerY = height / 2,
): OccluderVolume {
  return {
    center: [
      (rect.minX + rect.maxX) / 2,
      centerY,
      (rect.minZ + rect.maxZ) / 2,
    ],
    size: [rect.maxX - rect.minX, height, rect.maxZ - rect.minZ],
  };
}

const TDM_COLLIDERS: readonly CollisionRect[] = [
  { minX: -7.4, maxX: -4.8, minZ: -6.2, maxZ: 6.9 },
  { minX: -2.2, maxX: 4.9, minZ: -11.5, maxZ: -5.0 },
  { minX: -1.5, maxX: 1.4, minZ: 0.2, maxZ: 6.9 },
  { minX: -7.6, maxX: -3.8, minZ: 7.8, maxZ: 11.2 },
  { minX: -1.9, maxX: 1.8, minZ: 10.9, maxZ: 11.9 },
];

const TDM_OCCLUDERS: readonly OccluderVolume[] = [
  rectToOccluder(TDM_COLLIDERS[0], 2.6),
  rectToOccluder(TDM_COLLIDERS[1], 5.2),
  rectToOccluder(TDM_COLLIDERS[2], 2.9),
  rectToOccluder(TDM_COLLIDERS[3], 4.2),
  rectToOccluder(TDM_COLLIDERS[4], 1.8, 0.9),
];

const TDM_PLAYER_SPAWN = {
  position: [6, 8.15, 8] as [number, number, number],
  yaw: -Math.PI / 2,
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
  description: "Traversal-only school blockout with coarse blockers, bounds, and no loot clutter.",
  supportsStressMode: false,
  worldBounds: TDM_WORLD_BOUNDS,
  collisionRects: TDM_COLLIDERS,
  occluderVolumes: TDM_OCCLUDERS,
  playerSpawn: TDM_PLAYER_SPAWN,
  targets: [],
  groundSpawns: [],
  environment: {
    kind: "glb-scene",
    modelUrl: TDM_MAP_MODEL_URL,
    transform: {
      position: [0, 0, 0],
      rotationY: 0,
      scale: 1,
    },
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
