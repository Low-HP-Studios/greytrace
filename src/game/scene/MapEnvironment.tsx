import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  getWalkableSurfaceThickness,
  type BlockingVolume,
  type WalkableSurface,
} from "../map-layout";
import type { StressModeCount } from "../types";
import type { PracticeMapDefinition } from "./practice-maps";
import { RANGE_PRACTICE_MAP } from "./practice-maps";
import { OCEAN_LEVEL_Y, OCEAN_SIZE } from "./scene-constants";
import {
  createGrassTexture,
  createNightSkyTexture,
  createSkyTexture,
} from "./Textures";

const VOID_SKY = new THREE.Color("#0a1628");
const LIVE_SKY = new THREE.Color("#b8d4e8");
const VOID_WALKABLE = new THREE.Color("#1c1a14");
const LIVE_WALKABLE = new THREE.Color("#4d8f44");
const GRID_MAJOR_COLOR = new THREE.Color("#8fb3ff");
const GRID_MINOR_COLOR = new THREE.Color("#ffffff");
const SAND_COLOR_VOID = new THREE.Color("#1e1a10");
const SAND_COLOR_LIVE = new THREE.Color("#c4a96a");
const WATER_COLOR_VOID = new THREE.Color("#0a1520");
const WATER_COLOR_LIVE = new THREE.Color("#1e4a61");
const SCHOOL_BASE_VOID = new THREE.Color("#191919");
const SCHOOL_BASE_LIVE = new THREE.Color("#64615b");
const FLOOR_GRID_DIVISIONS = 16;
const SAND_STRIP_SIZE = 320;

const POOL_MIN_X = 34;
const POOL_MAX_X = 40;
const POOL_MIN_Z = 16;
const POOL_MAX_Z = 34;
const POOL_WATER_Y = -1.1;
const POOL_FLOOR_Y = -1.75;
const POOL_WALL_HEIGHT = 1.6;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function blendColor(from: THREE.Color, to: THREE.Color, amount: number) {
  return new THREE.Color().copy(from).lerp(to, clamp01(amount));
}

type SurfacePalette = {
  color: string;
  roughness: number;
  metalness: number;
};

const SURFACE_PALETTE: Record<
  NonNullable<WalkableSurface["material"]>,
  SurfacePalette
> = {
  yard: { color: "#6d675d", roughness: 1, metalness: 0.02 },
  interior: { color: "#a49a88", roughness: 0.96, metalness: 0.01 },
  upper: { color: "#c2b8a4", roughness: 0.94, metalness: 0.01 },
  poolDeck: { color: "#d0c7b0", roughness: 0.9, metalness: 0.02 },
  stair: { color: "#968e81", roughness: 0.96, metalness: 0.02 },
};

const BLOCKING_PALETTE: Record<
  NonNullable<BlockingVolume["material"]>,
  SurfacePalette
> = {
  wall: { color: "#7f7567", roughness: 0.95, metalness: 0.02 },
  railing: { color: "#4f555c", roughness: 0.7, metalness: 0.12 },
  cover: { color: "#6a4f39", roughness: 0.92, metalness: 0.02 },
};

function WorldBackdrop({
  theme,
  worldBounds,
}: {
  theme: number;
  worldBounds: PracticeMapDefinition["worldBounds"];
}) {
  const skyTexture = useMemo(() => createSkyTexture(), []);
  const nightSkyTexture = useMemo(() => createNightSkyTexture(), []);
  const liveTheme = clamp01(theme);
  const textureReveal = clamp01((liveTheme - 0.52) / 0.48);
  const allowTextures = textureReveal > 0.001;
  const walkableCenterX = (worldBounds.minX + worldBounds.maxX) / 2;
  const walkableCenterZ = (worldBounds.minZ + worldBounds.maxZ) / 2;

  useEffect(() => {
    return () => {
      skyTexture?.dispose();
      nightSkyTexture?.dispose();
    };
  }, [nightSkyTexture, skyTexture]);

  return (
    <group>
      <mesh>
        <sphereGeometry args={[560, 48, 32]} />
        <meshBasicMaterial
          color={blendColor(VOID_SKY, LIVE_SKY, textureReveal)}
          map={allowTextures ? skyTexture ?? undefined : nightSkyTexture ?? undefined}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      <mesh
        position={[walkableCenterX, -0.12, walkableCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[SAND_STRIP_SIZE, SAND_STRIP_SIZE]} />
        <meshStandardMaterial
          color={blendColor(SAND_COLOR_VOID, SAND_COLOR_LIVE, liveTheme)}
          roughness={1}
          metalness={0}
        />
      </mesh>

      <mesh
        position={[walkableCenterX, OCEAN_LEVEL_Y, walkableCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[OCEAN_SIZE, OCEAN_SIZE]} />
        <meshStandardMaterial
          color={blendColor(WATER_COLOR_VOID, WATER_COLOR_LIVE, liveTheme)}
          roughness={1}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

export type MapEnvironmentProps = {
  shadows: boolean;
  theme: number;
  floorGridOpacity: number;
  worldBounds?: PracticeMapDefinition["worldBounds"];
};

export function MapEnvironment({
  shadows,
  theme,
  floorGridOpacity,
  worldBounds = RANGE_PRACTICE_MAP.worldBounds,
}: MapEnvironmentProps) {
  const grassTexture = useMemo(() => createGrassTexture(), []);
  const floorGridRef = useRef<THREE.GridHelper>(null);
  const liveTheme = clamp01(theme);
  const textureReveal = clamp01((liveTheme - 0.52) / 0.48);
  const allowTextures = textureReveal > 0.001;
  const shadowEnabled = shadows && liveTheme > 0.6;
  const walkableCenterX = (worldBounds.minX + worldBounds.maxX) / 2;
  const walkableCenterZ = (worldBounds.minZ + worldBounds.maxZ) / 2;
  const walkableSizeX = worldBounds.maxX - worldBounds.minX;
  const walkableSizeZ = worldBounds.maxZ - worldBounds.minZ;

  useEffect(() => {
    return () => {
      grassTexture?.dispose();
    };
  }, [grassTexture]);

  useEffect(() => {
    const helper = floorGridRef.current;
    if (!helper) {
      return;
    }

    const materials = Array.isArray(helper.material)
      ? helper.material
      : [helper.material];

    for (const material of materials) {
      const lineMaterial = material as THREE.LineBasicMaterial;
      lineMaterial.transparent = true;
      lineMaterial.opacity = floorGridOpacity;
      lineMaterial.depthWrite = false;
      lineMaterial.needsUpdate = true;
    }
  }, [floorGridOpacity]);

  return (
    <group>
      <WorldBackdrop theme={theme} worldBounds={worldBounds} />

      <mesh
        position={[walkableCenterX, 0, walkableCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow={shadowEnabled}
        userData={{ bulletHittable: true }}
      >
        <planeGeometry args={[walkableSizeX, walkableSizeZ]} />
        <meshStandardMaterial
          color={blendColor(VOID_WALKABLE, LIVE_WALKABLE, liveTheme)}
          map={allowTextures ? grassTexture ?? undefined : undefined}
          roughness={THREE.MathUtils.lerp(1, 0.85, liveTheme)}
          metalness={THREE.MathUtils.lerp(0, 0.02, liveTheme)}
        />
      </mesh>

      {floorGridOpacity > 0.001 ? (
        <gridHelper
          ref={floorGridRef}
          args={[
            walkableSizeX,
            FLOOR_GRID_DIVISIONS,
            GRID_MAJOR_COLOR,
            GRID_MINOR_COLOR,
          ]}
          position={[walkableCenterX, 0.05, walkableCenterZ]}
          renderOrder={5}
        />
      ) : null}
    </group>
  );
}

function SchoolSurface({
  surface,
  shadows,
}: {
  surface: WalkableSurface;
  shadows: boolean;
}) {
  const thickness = getWalkableSurfaceThickness(surface);
  const palette = SURFACE_PALETTE[surface.material ?? "interior"];

  if (surface.kind === "slab") {
    return (
      <mesh
        position={[
          (surface.minX + surface.maxX) / 2,
          surface.y - thickness / 2,
          (surface.minZ + surface.maxZ) / 2,
        ]}
        receiveShadow={shadows}
        userData={{ bulletHittable: true }}
      >
        <boxGeometry
          args={[
            surface.maxX - surface.minX,
            thickness,
            surface.maxZ - surface.minZ,
          ]}
        />
        <meshStandardMaterial {...palette} />
      </mesh>
    );
  }

  const run = surface.axis === "x"
    ? surface.maxX - surface.minX
    : surface.maxZ - surface.minZ;
  const rise = surface.endY - surface.startY;
  const angle = Math.atan2(rise, run);
  const length = Math.hypot(run, rise);
  const centerY = (surface.startY + surface.endY) / 2 -
    (thickness / 2) * Math.cos(angle);
  const centerX = (surface.minX + surface.maxX) / 2;
  const centerZ = (surface.minZ + surface.maxZ) / 2;

  return (
    <mesh
      position={[centerX, centerY, centerZ]}
      rotation={surface.axis === "x" ? [0, 0, angle] : [-angle, 0, 0]}
      receiveShadow={shadows}
      userData={{ bulletHittable: true }}
    >
      <boxGeometry
        args={surface.axis === "x"
          ? [length, thickness, surface.maxZ - surface.minZ]
          : [surface.maxX - surface.minX, thickness, length]}
      />
      <meshStandardMaterial {...palette} />
    </mesh>
  );
}

function SchoolBlocker({
  blocker,
  shadows,
}: {
  blocker: BlockingVolume;
  shadows: boolean;
}) {
  const palette = BLOCKING_PALETTE[blocker.material ?? "wall"];

  return (
    <mesh
      position={blocker.center}
      castShadow={shadows}
      receiveShadow={shadows}
      userData={{ bulletHittable: true }}
    >
      <boxGeometry args={blocker.size} />
      <meshStandardMaterial {...palette} />
    </mesh>
  );
}

function PoolDetails({ shadows }: { shadows: boolean }) {
  const centerX = (POOL_MIN_X + POOL_MAX_X) / 2;
  const centerZ = (POOL_MIN_Z + POOL_MAX_Z) / 2;
  const width = POOL_MAX_X - POOL_MIN_X;
  const depth = POOL_MAX_Z - POOL_MIN_Z;

  return (
    <group>
      <mesh position={[centerX, POOL_FLOOR_Y, centerZ]} receiveShadow={shadows}>
        <boxGeometry args={[width, 0.25, depth]} />
        <meshStandardMaterial color="#325365" roughness={0.95} metalness={0.04} />
      </mesh>

      <mesh position={[centerX, POOL_WATER_Y, centerZ]}>
        <boxGeometry args={[width - 0.2, 0.12, depth - 0.2]} />
        <meshStandardMaterial
          color="#2f7ea1"
          roughness={0.2}
          metalness={0.08}
          transparent
          opacity={0.86}
        />
      </mesh>

      <mesh position={[centerX, POOL_WATER_Y - POOL_WALL_HEIGHT / 2, POOL_MIN_Z]}>
        <boxGeometry args={[width, POOL_WALL_HEIGHT, 0.35]} />
        <meshStandardMaterial color="#9ba7aa" roughness={0.9} metalness={0.04} />
      </mesh>
      <mesh position={[centerX, POOL_WATER_Y - POOL_WALL_HEIGHT / 2, POOL_MAX_Z]}>
        <boxGeometry args={[width, POOL_WALL_HEIGHT, 0.35]} />
        <meshStandardMaterial color="#9ba7aa" roughness={0.9} metalness={0.04} />
      </mesh>
      <mesh position={[POOL_MIN_X, POOL_WATER_Y - POOL_WALL_HEIGHT / 2, centerZ]}>
        <boxGeometry args={[0.35, POOL_WALL_HEIGHT, depth]} />
        <meshStandardMaterial color="#9ba7aa" roughness={0.9} metalness={0.04} />
      </mesh>
      <mesh position={[POOL_MAX_X, POOL_WATER_Y - POOL_WALL_HEIGHT / 2, centerZ]}>
        <boxGeometry args={[0.35, POOL_WALL_HEIGHT, depth]} />
        <meshStandardMaterial color="#9ba7aa" roughness={0.9} metalness={0.04} />
      </mesh>
    </group>
  );
}

function SchoolBlockoutEnvironment({
  practiceMap,
  shadows,
  theme,
}: {
  practiceMap: PracticeMapDefinition;
  shadows: boolean;
  theme: number;
}) {
  const worldBounds = practiceMap.worldBounds;
  const surfaces = practiceMap.walkableSurfaces ?? [];
  const blockers = practiceMap.blockingVolumes ?? [];
  const centerX = (worldBounds.minX + worldBounds.maxX) / 2;
  const centerZ = (worldBounds.minZ + worldBounds.maxZ) / 2;
  const sizeX = worldBounds.maxX - worldBounds.minX;
  const sizeZ = worldBounds.maxZ - worldBounds.minZ;
  const liveTheme = clamp01(theme);

  return (
    <group>
      <WorldBackdrop theme={theme} worldBounds={worldBounds} />

      <mesh
        position={[centerX, -0.18, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[sizeX + 28, sizeZ + 28]} />
        <meshStandardMaterial
          color={blendColor(SCHOOL_BASE_VOID, SCHOOL_BASE_LIVE, liveTheme)}
          roughness={1}
          metalness={0.01}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      <ambientLight intensity={0.46} color="#fff2de" />
      <hemisphereLight args={["#dcecff", "#6b5438", 0.58]} />
      <directionalLight
        position={[centerX + 20, 28, centerZ + 12]}
        intensity={0.74}
        color="#ffe0b8"
      />
      <directionalLight
        position={[centerX - 16, 14, centerZ - 18]}
        intensity={0.28}
        color="#9fcbff"
      />

      {surfaces.map((surface, index) => (
        <SchoolSurface
          key={`${practiceMap.id}-surface-${index}`}
          surface={surface}
          shadows={shadows}
        />
      ))}

      {blockers.map((blocker, index) => (
        <SchoolBlocker
          key={`${practiceMap.id}-blocker-${index}`}
          blocker={blocker}
          shadows={shadows}
        />
      ))}

      <PoolDetails shadows={shadows} />
    </group>
  );
}

export function StressBoxes({ count, shadows }: { count: StressModeCount; shadows: boolean }) {
  void count;
  void shadows;
  return null;
}

export function PracticeMapEnvironment({
  practiceMap,
  shadows,
  theme,
  floorGridOpacity,
}: {
  practiceMap: PracticeMapDefinition;
  shadows: boolean;
  theme: number;
  floorGridOpacity: number;
}) {
  if (practiceMap.environment.kind === "school-blockout") {
    return (
      <SchoolBlockoutEnvironment
        practiceMap={practiceMap}
        shadows={shadows}
        theme={theme}
      />
    );
  }

  return (
    <MapEnvironment
      shadows={shadows}
      theme={theme}
      floorGridOpacity={floorGridOpacity}
      worldBounds={practiceMap.worldBounds}
    />
  );
}
