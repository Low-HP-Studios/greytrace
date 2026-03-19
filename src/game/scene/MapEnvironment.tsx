import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { loadGlbAsset } from "../AssetLoader";
import type { PracticeMapDefinition } from "./practice-maps";
import { RANGE_PRACTICE_MAP } from "./practice-maps";
import { createNightSkyTexture } from "./Textures";
import type { StressModeCount } from "../types";
import {
  OCEAN_LEVEL_Y,
  OCEAN_SIZE,
} from "./scene-constants";
import {
  createGrassTexture,
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
const FLOOR_GRID_DIVISIONS = 16;
const SAND_STRIP_SIZE = 320;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function blendColor(from: THREE.Color, to: THREE.Color, amount: number) {
  return new THREE.Color().copy(from).lerp(to, clamp01(amount));
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
  const skyTexture = useMemo(() => createSkyTexture(), []);
  const floorGridRef = useRef<THREE.GridHelper>(null);

  useEffect(() => {
    return () => {
      skyTexture?.dispose();
      grassTexture?.dispose();
    };
  }, [grassTexture, skyTexture]);

  const liveTheme = clamp01(theme);
  const textureReveal = clamp01((liveTheme - 0.52) / 0.48);
  const allowTextures = textureReveal > 0.001;
  const shadowEnabled = shadows && liveTheme > 0.6;
  const walkableCenterX = (worldBounds.minX + worldBounds.maxX) / 2;
  const walkableCenterZ = (worldBounds.minZ + worldBounds.maxZ) / 2;
  const walkableSizeX = worldBounds.maxX - worldBounds.minX;
  const walkableSizeZ = worldBounds.maxZ - worldBounds.minZ;

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

  const nightSkyTexture = useMemo(() => createNightSkyTexture(), []);

  useEffect(() => {
    return () => {
      nightSkyTexture?.dispose();
    };
  }, [nightSkyTexture]);

  return (
    <group>
      {/* Sky sphere */}
      <mesh>
        <sphereGeometry args={[560, 48, 32]} />
        <meshBasicMaterial
          color={blendColor(VOID_SKY, LIVE_SKY, textureReveal)}
          map={allowTextures ? skyTexture ?? undefined : (nightSkyTexture ?? undefined)}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/* Sand strip beyond walkable area */}
      <mesh
        position={[walkableCenterX, -0.12, walkableCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        userData={{ bulletHittable: true }}
      >
        <planeGeometry args={[SAND_STRIP_SIZE, SAND_STRIP_SIZE]} />
        <meshStandardMaterial
          color={blendColor(SAND_COLOR_VOID, SAND_COLOR_LIVE, liveTheme)}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Water plane */}
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

      {/* Walkable grassy floor */}
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

export function StressBoxes({ count, shadows }: { count: StressModeCount; shadows: boolean }) {
  void count;
  void shadows;
  return null;
}

function normalizeGlbMapMaterial(material: THREE.Material): THREE.Material {
  const clone = material.clone();

  if ((clone as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
    const standard = clone as THREE.MeshStandardMaterial;
    if (standard.map) {
      standard.map.colorSpace = THREE.SRGBColorSpace;
    }
    if (standard.emissiveMap) {
      standard.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    }
    standard.roughness = Math.min(1, Math.max(standard.roughness, 0.72));
    standard.metalness *= 0.65;
    standard.toneMapped = true;
    standard.needsUpdate = true;
    return standard;
  }

  if ((clone as THREE.MeshPhongMaterial).isMeshPhongMaterial) {
    const phong = clone as THREE.MeshPhongMaterial;
    if (phong.map) {
      phong.map.colorSpace = THREE.SRGBColorSpace;
    }
    phong.emissive.addScalar(0.08);
    phong.needsUpdate = true;
    return phong;
  }

  return clone;
}

function GlbMapLighting({
  practiceMap,
}: {
  practiceMap: PracticeMapDefinition;
}) {
  const centerX = (practiceMap.worldBounds.minX + practiceMap.worldBounds.maxX) / 2;
  const centerZ = (practiceMap.worldBounds.minZ + practiceMap.worldBounds.maxZ) / 2;

  return (
    <>
      <ambientLight intensity={0.38} color="#fff1e0" />
      <hemisphereLight args={["#dcecff", "#6d5438", 0.52]} />
      <directionalLight
        position={[centerX + 18, 24, centerZ + 14]}
        intensity={0.62}
        color="#ffe4bf"
      />
      <directionalLight
        position={[centerX - 22, 14, centerZ - 18]}
        intensity={0.34}
        color="#8dcfff"
      />
    </>
  );
}

function InvisibleWorldOccluders({
  practiceMap,
}: {
  practiceMap: PracticeMapDefinition;
}) {
  return (
    <group>
      <mesh
        position={[
          (practiceMap.worldBounds.minX + practiceMap.worldBounds.maxX) / 2,
          0,
          (practiceMap.worldBounds.minZ + practiceMap.worldBounds.maxZ) / 2,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
        userData={{ bulletHittable: true }}
      >
        <planeGeometry
          args={[
            practiceMap.worldBounds.maxX - practiceMap.worldBounds.minX,
            practiceMap.worldBounds.maxZ - practiceMap.worldBounds.minZ,
          ]}
        />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>

      {practiceMap.occluderVolumes.map((occluder, index) => (
        <mesh
          key={`${practiceMap.id}-occluder-${index}`}
          position={occluder.center}
          userData={{ bulletHittable: true }}
        >
          <boxGeometry args={occluder.size} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export function GlbMapEnvironment({
  practiceMap,
}: {
  practiceMap: PracticeMapDefinition;
}) {
  const [mapSource, setMapSource] = useState<THREE.Group | null>(null);
  const modelUrl = practiceMap.environment.kind === "glb-scene"
    ? practiceMap.environment.modelUrl
    : null;

  useEffect(() => {
    if (!modelUrl) {
      setMapSource(null);
      return;
    }

    let cancelled = false;
    void loadGlbAsset(modelUrl).then((asset) => {
      if (!cancelled) {
        setMapSource(asset);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  const mapInstance = useMemo(() => {
    if (!mapSource) {
      return null;
    }

    return mapSource.clone(true);
  }, [mapSource]);

  useEffect(() => {
    if (!mapInstance) {
      return;
    }

    mapInstance.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) {
        return;
      }

      const mesh = child as THREE.Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.bulletHittable = false;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((material) =>
          normalizeGlbMapMaterial(material),
        );
      } else {
        mesh.material = normalizeGlbMapMaterial(mesh.material);
      }
    });
  }, [mapInstance]);

  if (practiceMap.environment.kind !== "glb-scene") {
    return null;
  }

  return (
    <group>
      <GlbMapLighting practiceMap={practiceMap} />
      <InvisibleWorldOccluders practiceMap={practiceMap} />
      {mapInstance ? (
        <group
          position={practiceMap.environment.transform.position}
          rotation={[0, practiceMap.environment.transform.rotationY, 0]}
          scale={practiceMap.environment.transform.scale}
        >
          <primitive object={mapInstance} />
        </group>
      ) : null}
    </group>
  );
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
  if (practiceMap.environment.kind === "glb-scene") {
    return <GlbMapEnvironment practiceMap={practiceMap} />;
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
