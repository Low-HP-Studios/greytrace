import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Perf } from "r3f-perf";
import * as THREE from "three";
import { AudioManager, type AudioVolumeSettings } from "./Audio";
import { usePlayerController, type PlayerControllerApi } from "./PlayerController";
import {
  Targets,
  createDefaultTargets,
  raycastTargets,
  resetTargets,
  RESPAWN_DELAY_MS,
  type TargetRaycastHit,
} from "./Targets";
import {
  WeaponSystem,
  type SniperRechamberState,
  type WeaponKind,
  type WeaponShotEvent,
} from "./Weapon";
import type {
  CollisionRect,
  GameSettings,
  PerfMetrics,
  PlayerSnapshot,
  StressModeCount,
  TargetState,
  WorldBounds,
} from "./types";

type SceneProps = {
  settings: GameSettings;
  audioVolumes: AudioVolumeSettings;
  stressCount: StressModeCount;
  onPlayerSnapshot: (snapshot: PlayerSnapshot) => void;
  onPerfMetrics: (metrics: PerfMetrics) => void;
  onHitMarker: (kind: HitMarkerKind) => void;
  onWeaponEquippedChange: (equipped: boolean) => void;
  onActiveWeaponChange: (weapon: WeaponKind) => void;
  onSniperRechamberChange: (state: SniperRechamberState) => void;
};

export type HitMarkerKind = "body" | "head" | "kill";

const WORLD_BOUNDS: WorldBounds = {
  minX: -80,
  maxX: 80,
  minZ: -80,
  maxZ: 80,
};
const WALKABLE_CENTER_X = (WORLD_BOUNDS.minX + WORLD_BOUNDS.maxX) / 2;
const WALKABLE_CENTER_Z = (WORLD_BOUNDS.minZ + WORLD_BOUNDS.maxZ) / 2;
const WALKABLE_SIZE_X = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
const WALKABLE_SIZE_Z = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
const SHORE_SHELF_PADDING = 28;
const SHORE_SHELF_Y = -0.42;
const SHORE_FOAM_RING_PADDING = 10;
const OCEAN_LEVEL_Y = -2.7;
const OCEAN_SIZE = 1600;
const CLIFF_HEIGHT = 0.7;
const CLIFF_THICKNESS = 1.15;

const BUILDING_CENTER = new THREE.Vector3(8, 0, -4);
const BUILDING_WIDTH = 10;
const BUILDING_DEPTH = 8;
const BUILDING_HEIGHT = 3.2;
const WALL_THICKNESS = 0.35;
const DOOR_GAP_WIDTH = 2.2;
const DOOR_HEIGHT = 2.2;
const TRACER_DISTANCE = 260;
const TARGET_FLASH_MS = 180;
const MAX_BULLET_IMPACT_MARKS = 160;
const BULLET_IMPACT_LIFETIME_MS = 5000;
const BULLET_IMPACT_CLEANUP_INTERVAL_MS = 250;
const BULLET_IMPACT_MARK_RADIUS = 0.05;
const BULLET_IMPACT_MARK_SURFACE_OFFSET = 0.01;
const BULLET_HIT_EPSILON = 0.0001;

type BulletImpactMark = {
  id: number;
  expiresAt: number;
  position: [number, number, number];
  quaternion: [number, number, number, number];
};

type WorldRaycastHit = {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
};

const STATIC_COLLIDERS: CollisionRect[] = [
  boxRect({ x: -14, z: -12 }, 2.8, 2.4),
  boxRect({ x: 18, z: -22 }, 4.0, 2.6),
  boxRect({ x: -26, z: 16 }, 3.2, 2.4),
  boxRect({ x: 28, z: 24 }, 3.8, 2.8),
  boxRect({ x: 0, z: -36 }, 5.5, 2.8),
];

export function Scene({
  settings,
  audioVolumes,
  stressCount,
  onPlayerSnapshot,
  onPerfMetrics,
  onHitMarker,
  onWeaponEquippedChange,
  onActiveWeaponChange,
  onSniperRechamberChange,
}: SceneProps) {
  const [targets, setTargets] = useState<TargetState[]>(() => createDefaultTargets());
  const resetTimeoutsRef = useRef<Map<string, number>>(new Map());

  const dpr = useMemo(() => {
    const devicePixelRatio =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    return Math.min(2, Math.max(0.5, devicePixelRatio * settings.pixelRatioScale));
  }, [settings.pixelRatioScale]);

  const handleTargetHit = useCallback((targetId: string, damage: number, nowMs: number) => {
    startTransition(() => {
      setTargets((previousTargets) =>
        previousTargets.map((target) => {
          if (target.id !== targetId) return target;
          const newHp = Math.max(0, target.hp - damage);
          const destroyed = newHp <= 0;
          return {
            ...target,
            hp: newHp,
            disabled: destroyed,
            hitUntil: nowMs + TARGET_FLASH_MS,
          };
        }),
      );
    });

    setTargets((prev) => {
      const target = prev.find((t) => t.id === targetId);
      if (target && target.hp - damage <= 0) {
        const existing = resetTimeoutsRef.current.get(targetId);
        if (existing !== undefined) {
          window.clearTimeout(existing);
        }
        const timeoutId = window.setTimeout(() => {
          resetTimeoutsRef.current.delete(targetId);
          startTransition(() => {
            setTargets((previousTargets) =>
              previousTargets.map((t) =>
                t.id === targetId ? { ...t, disabled: false, hp: t.maxHp } : t,
              ),
            );
          });
        }, RESPAWN_DELAY_MS);
        resetTimeoutsRef.current.set(targetId, timeoutId);
      }
      return prev;
    });
  }, []);

  const handleResetTargets = useCallback(() => {
    for (const timeoutId of resetTimeoutsRef.current.values()) {
      window.clearTimeout(timeoutId);
    }
    resetTimeoutsRef.current.clear();
    startTransition(() => {
      setTargets((previousTargets) => resetTargets(previousTargets));
    });
  }, []);

  useEffect(() => {
    const timeoutMap = resetTimeoutsRef.current;
    return () => {
      for (const timeoutId of timeoutMap.values()) {
        window.clearTimeout(timeoutId);
      }
      timeoutMap.clear();
    };
  }, []);

  return (
    <Canvas
      className="game-canvas"
      shadows={settings.shadows ? "percentage" : false}
      dpr={dpr}
      camera={{ fov: 65, near: 0.1, far: 650, position: [0, 3.5, 12] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#c8654e"]} />
      <fog attach="fog" args={["#d67a5f", 82, 520]} />
      <hemisphereLight args={["#ffb986", "#5a4a3d", 0.7]} />
      <ambientLight intensity={0.34} />
      <directionalLight
        position={[92, 24, -108]}
        intensity={2.35}
        color="#ffb46f"
        castShadow={settings.shadows}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
      />
      <MapEnvironment shadows={settings.shadows} />
      <Targets targets={targets} shadows={settings.shadows} />
      <StressBoxes count={stressCount} shadows={settings.shadows} />
      <GameplayRuntime
        collisionRects={STATIC_COLLIDERS}
        worldBounds={WORLD_BOUNDS}
        audioVolumes={audioVolumes}
        sensitivity={settings.sensitivity}
        keybinds={settings.keybinds}
        targets={targets}
        onTargetHit={handleTargetHit}
        onResetTargets={handleResetTargets}
        onPlayerSnapshot={onPlayerSnapshot}
        onPerfMetrics={onPerfMetrics}
        onHitMarker={onHitMarker}
        onWeaponEquippedChange={onWeaponEquippedChange}
        onActiveWeaponChange={onActiveWeaponChange}
        onSniperRechamberChange={onSniperRechamberChange}
      />
      {settings.showR3fPerf ? <Perf position="top-left" minimal /> : null}
    </Canvas>
  );
}

type GameplayRuntimeProps = {
  collisionRects: CollisionRect[];
  worldBounds: WorldBounds;
  audioVolumes: AudioVolumeSettings;
  sensitivity: GameSettings["sensitivity"];
  keybinds: GameSettings["keybinds"];
  targets: TargetState[];
  onTargetHit: (targetId: string, damage: number, nowMs: number) => void;
  onResetTargets: () => void;
  onPlayerSnapshot: (snapshot: PlayerSnapshot) => void;
  onPerfMetrics: (metrics: PerfMetrics) => void;
  onHitMarker: (kind: HitMarkerKind) => void;
  onWeaponEquippedChange: (equipped: boolean) => void;
  onActiveWeaponChange: (weapon: WeaponKind) => void;
  onSniperRechamberChange: (state: SniperRechamberState) => void;
};

function GameplayRuntime({
  collisionRects,
  worldBounds,
  audioVolumes,
  sensitivity,
  keybinds,
  targets,
  onTargetHit,
  onResetTargets,
  onPlayerSnapshot,
  onPerfMetrics,
  onHitMarker,
  onWeaponEquippedChange,
  onActiveWeaponChange,
  onSniperRechamberChange,
}: GameplayRuntimeProps) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);

  const weaponRef = useRef<WeaponSystem>(new WeaponSystem());
  const audioRef = useRef<AudioManager>(new AudioManager());
  const controllerRef = useRef<PlayerControllerApi | null>(null);
  const targetsRef = useRef(targets);
  const [impactMarks, setImpactMarks] = useState<BulletImpactMark[]>([]);

  const playerSnapshotCallbackRef = useRef(onPlayerSnapshot);
  const perfCallbackRef = useRef(onPerfMetrics);
  const targetHitCallbackRef = useRef(onTargetHit);
  const resetTargetsCallbackRef = useRef(onResetTargets);
  const hitMarkerCallbackRef = useRef(onHitMarker);
  const weaponEquippedCallbackRef = useRef(onWeaponEquippedChange);
  const activeWeaponCallbackRef = useRef(onActiveWeaponChange);
  const sniperRechamberCallbackRef = useRef(onSniperRechamberChange);

  const perfAccumulatorRef = useRef(0);
  const fpsFrameCountRef = useRef(0);
  const fpsTimeRef = useRef(0);
  const lastWeaponEquippedRef = useRef<boolean | null>(null);
  const lastActiveWeaponRef = useRef<WeaponKind | null>(null);

  const worldGunRef = useRef<THREE.Group>(null);
  const playerCharacterRef = useRef<THREE.Group>(null);
  const characterWeaponRef = useRef<THREE.Group>(null);
  const characterMuzzleRef = useRef<THREE.Mesh>(null);
  const tracerRef = useRef<THREE.Mesh>(null);

  const tempEndRef = useRef(new THREE.Vector3());
  const tempMidRef = useRef(new THREE.Vector3());
  const tempTracerDirRef = useRef(new THREE.Vector3());
  const tempLookDirRef = useRef(new THREE.Vector3());
  const tempTracerOriginRef = useRef(new THREE.Vector3());
  const tempImpactNormalRef = useRef(new THREE.Vector3());
  const tempImpactNormalMatrixRef = useRef(new THREE.Matrix3());
  const tempImpactQuaternionRef = useRef(new THREE.Quaternion());
  const tempImpactPositionRef = useRef(new THREE.Vector3());
  const raycasterRef = useRef(new THREE.Raycaster());
  const impactIdRef = useRef(0);
  const lastImpactCleanupAtRef = useRef(0);
  const lastSniperRechamberActiveRef = useRef<boolean | null>(null);
  const lastSniperRechamberProgressStepRef = useRef(-1);

  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  useEffect(() => {
    playerSnapshotCallbackRef.current = onPlayerSnapshot;
  }, [onPlayerSnapshot]);

  useEffect(() => {
    perfCallbackRef.current = onPerfMetrics;
  }, [onPerfMetrics]);

  useEffect(() => {
    targetHitCallbackRef.current = onTargetHit;
  }, [onTargetHit]);

  useEffect(() => {
    resetTargetsCallbackRef.current = onResetTargets;
  }, [onResetTargets]);

  useEffect(() => {
    hitMarkerCallbackRef.current = onHitMarker;
  }, [onHitMarker]);

  useEffect(() => {
    weaponEquippedCallbackRef.current = onWeaponEquippedChange;
  }, [onWeaponEquippedChange]);

  useEffect(() => {
    activeWeaponCallbackRef.current = onActiveWeaponChange;
  }, [onActiveWeaponChange]);

  useEffect(() => {
    sniperRechamberCallbackRef.current = onSniperRechamberChange;
  }, [onSniperRechamberChange]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio.dispose();
    };
  }, []);

  useEffect(() => {
    audioRef.current.setVolumes(audioVolumes);
  }, [audioVolumes]);

  const pushImpactMark = useCallback((point: THREE.Vector3, normal: THREE.Vector3) => {
    const safeNormal = tempImpactNormalRef.current;
    safeNormal.copy(normal);
    if (safeNormal.lengthSq() < 1e-6) {
      safeNormal.set(0, 1, 0);
    } else {
      safeNormal.normalize();
    }

    const position = tempImpactPositionRef.current
      .copy(point)
      .addScaledVector(safeNormal, BULLET_IMPACT_MARK_SURFACE_OFFSET);
    const quaternion = tempImpactQuaternionRef.current.setFromUnitVectors(Z_AXIS, safeNormal);
    const nowMs = performance.now();
    const nextMark: BulletImpactMark = {
      id: impactIdRef.current,
      expiresAt: nowMs + BULLET_IMPACT_LIFETIME_MS,
      position: [position.x, position.y, position.z],
      quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    };
    impactIdRef.current += 1;

    startTransition(() => {
      setImpactMarks((previous) => {
        const alive = previous.filter((mark) => mark.expiresAt > nowMs);
        if (alive.length >= MAX_BULLET_IMPACT_MARKS) {
          return [...alive.slice(1), nextMark];
        }
        return [...alive, nextMark];
      });
    });
  }, []);

  const controller = usePlayerController({
    collisionRects,
    worldBounds,
    sensitivity,
    keybinds,
    onAction: (action) => {
      const weapon = weaponRef.current;
      if (action === "equipRifle") {
        weapon.switchWeapon("rifle");
        return;
      }
      if (action === "equipSniper") {
        weapon.switchWeapon("sniper");
        return;
      }
      if (action === "reset") {
        resetTargetsCallbackRef.current();
        return;
      }

      const playerPosition = controllerRef.current?.getPosition();
      if (!playerPosition) {
        return;
      }

      if (action === "pickup") {
        if (weapon.tryPickup(playerPosition)) {
          weaponEquippedCallbackRef.current(true);
        }
        return;
      }

      if (action === "drop") {
        camera.getWorldDirection(tempLookDirRef.current);
        if (weapon.drop(playerPosition, tempLookDirRef.current)) {
          weaponEquippedCallbackRef.current(false);
        }
        return;
      }

    },
    onPlayerSnapshot: (snapshot) => {
      const playerPosition = controllerRef.current?.getPosition();
      const canInteract = playerPosition
        ? weaponRef.current.canPickup(playerPosition)
        : false;
      playerSnapshotCallbackRef.current({
        ...snapshot,
        canInteract,
      });
    },
    onTriggerChange: (firing) => {
      weaponRef.current.setTriggerHeld(firing);
    },
    onUserGesture: () => {
      audioRef.current.ensureStarted();
    },
    getActiveWeapon: () => weaponRef.current.getActiveWeapon(),
  });

  controllerRef.current = controller;

  useFrame((_, delta) => {
    const clampedDelta = Math.min(delta, 1 / 20);
    const nowMs = performance.now();
    const weapon = weaponRef.current;
    const audio = audioRef.current;

    if (nowMs - lastImpactCleanupAtRef.current >= BULLET_IMPACT_CLEANUP_INTERVAL_MS) {
      lastImpactCleanupAtRef.current = nowMs;
      setImpactMarks((previous) => {
        const alive = previous.filter((mark) => mark.expiresAt > nowMs);
        return alive.length === previous.length ? previous : alive;
      });
    }

    const sniperRechamber = weapon.getSniperRechamberState(nowMs);
    const sniperRechamberProgressStep = Math.floor(sniperRechamber.progress * 100);
    if (
      lastSniperRechamberActiveRef.current !== sniperRechamber.active ||
      lastSniperRechamberProgressStepRef.current !== sniperRechamberProgressStep
    ) {
      lastSniperRechamberActiveRef.current = sniperRechamber.active;
      lastSniperRechamberProgressStepRef.current = sniperRechamberProgressStep;
      sniperRechamberCallbackRef.current(sniperRechamber);
    }

    audio.update(
      nowMs / 1000,
      controller.isMoving() && controller.isGrounded(),
      controller.isSprinting(),
    );

    const firstPerson = controller.isFirstPerson();
    const playerChar = playerCharacterRef.current;
    if (playerChar) {
      const pos = controller.getPosition();
      playerChar.position.set(pos.x, pos.y, pos.z);
      playerChar.rotation.y = controller.getYaw();
      playerChar.visible = !firstPerson;
      // Keep child world transforms current before we sample muzzle position for tracers.
      playerChar.updateMatrixWorld(true);
    }

    const shots = weapon.update(clampedDelta, nowMs, camera);
    for (const shot of shots) {
      audio.playGunshot(shot.weaponType);
      // Keep hit-registration debugging deterministic for now (no recoil kick applied to camera).
      if (shot.recoilPitchRadians !== 0 || shot.recoilYawRadians !== 0) {
        controller.addRecoil(shot.recoilPitchRadians, shot.recoilYawRadians);
      }

      const targetHit = raycastTargets(shot.origin, shot.direction, targetsRef.current);
      const worldHit = raycastBulletWorld(
        scene,
        shot.origin,
        shot.direction,
        raycasterRef.current,
        tempImpactNormalRef.current,
        tempImpactNormalMatrixRef.current,
      );

      const targetVisible =
        !!targetHit &&
        (!worldHit || targetHit.distance <= worldHit.distance + BULLET_HIT_EPSILON);

      const tracerOrigin = tempTracerOriginRef.current;
      tracerOrigin.copy(shot.origin);

      if (targetHit && targetVisible) {
        tempEndRef.current.copy(targetHit.point);
        pushImpactMark(targetHit.point, targetHit.normal);
        const resolvedDamage = resolveShotDamage(shot, targetHit);
        const targetBeforeHit = targetsRef.current.find((target) => target.id === targetHit.id);
        const killed = targetBeforeHit ? targetBeforeHit.hp - resolvedDamage <= 0 : false;
        const hitType = targetHit.zone === "head" ? "head" : "body";

        targetHitCallbackRef.current(targetHit.id, resolvedDamage, nowMs);
        hitMarkerCallbackRef.current(killed ? "kill" : hitType);
        audio.playHit(hitType);
        if (killed) {
          audio.playKill();
        }
      } else if (worldHit) {
        tempEndRef.current.copy(worldHit.point);
        pushImpactMark(worldHit.point, worldHit.normal);
      } else {
        tempEndRef.current
          .copy(shot.origin)
          .addScaledVector(shot.direction, TRACER_DISTANCE);
      }

      weapon.setTracer(tracerOrigin, tempEndRef.current, nowMs);
    }

    updateWorldGunMesh(worldGunRef.current, weapon, nowMs);
    updateCharacterWeaponMesh(characterWeaponRef.current, characterMuzzleRef.current, weapon, nowMs);
    updateTracerMesh(tracerRef.current, weapon, nowMs, tempMidRef.current, tempTracerDirRef.current);

    const equipped = weapon.isEquipped();
    if (lastWeaponEquippedRef.current !== equipped) {
      lastWeaponEquippedRef.current = equipped;
      weaponEquippedCallbackRef.current(equipped);
    }

    const activeWeapon = weapon.getActiveWeapon();
    if (lastActiveWeaponRef.current !== activeWeapon) {
      lastActiveWeaponRef.current = activeWeapon;
      activeWeaponCallbackRef.current(activeWeapon);
    }

    perfAccumulatorRef.current += clampedDelta;
    fpsTimeRef.current += clampedDelta;
    fpsFrameCountRef.current += 1;

    if (perfAccumulatorRef.current >= 0.2) {
      const fps = fpsTimeRef.current > 0 ? fpsFrameCountRef.current / fpsTimeRef.current : 0;
      perfCallbackRef.current({
        fps,
        frameMs: clampedDelta * 1000,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      });
      perfAccumulatorRef.current = 0;
      fpsTimeRef.current = 0;
      fpsFrameCountRef.current = 0;
    }
  });

  return (
    <>
      <group ref={playerCharacterRef}>
        {/* Torso */}
        <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.4, 0.55, 0.25]} />
          <meshStandardMaterial color="#4a6b82" roughness={0.7} metalness={0.1} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.48, 0]} castShadow receiveShadow>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color="#e8c9a4" roughness={0.85} metalness={0} />
        </mesh>
        {/* Left leg */}
        <mesh position={[-0.1, 0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.14, 0.6, 0.16]} />
          <meshStandardMaterial color="#3a4d5c" roughness={0.8} metalness={0.05} />
        </mesh>
        {/* Right leg */}
        <mesh position={[0.1, 0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.14, 0.6, 0.16]} />
          <meshStandardMaterial color="#3a4d5c" roughness={0.8} metalness={0.05} />
        </mesh>
        {/* Left arm */}
        <mesh position={[-0.28, 0.92, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.48, 0.12]} />
          <meshStandardMaterial color="#4a6b82" roughness={0.7} metalness={0.1} />
        </mesh>
        {/* Right arm */}
        <mesh position={[0.28, 0.92, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.48, 0.12]} />
          <meshStandardMaterial color="#4a6b82" roughness={0.7} metalness={0.1} />
        </mesh>

        {/* Character-held weapon */}
        <group ref={characterWeaponRef} position={[0.34, 0.82, -0.2]} visible={false}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.55, 0.09, 0.13]} />
            <meshStandardMaterial color="#30363c" roughness={0.55} metalness={0.4} />
          </mesh>
          <mesh position={[0.16, -0.08, 0.01]} rotation={[0.15, 0, -0.2]}>
            <boxGeometry args={[0.18, 0.17, 0.05]} />
            <meshStandardMaterial color="#4d463f" roughness={0.85} metalness={0.1} />
          </mesh>
          <mesh position={[-0.24, 0.015, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.015, 0.015, 0.42, 8]} />
            <meshStandardMaterial color="#20262b" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh ref={characterMuzzleRef} position={[-0.44, 0.02, 0]} visible={false}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color="#ffd085" transparent opacity={0.9} />
          </mesh>
        </group>
      </group>

      {/* World gun (dropped state) */}
      <group ref={worldGunRef} visible>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.7, 0.12, 0.18]} />
          <meshStandardMaterial color="#30363c" roughness={0.6} metalness={0.35} />
        </mesh>
        <mesh position={[0.22, -0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.18, 0.06]} />
          <meshStandardMaterial color="#514942" roughness={0.85} metalness={0.1} />
        </mesh>
        <mesh position={[-0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.55, 10]} />
          <meshStandardMaterial color="#1e2328" roughness={0.5} metalness={0.55} />
        </mesh>
      </group>

      <mesh ref={tracerRef} visible={false}>
        <boxGeometry args={[0.02, 0.02, 1]} />
        <meshBasicMaterial color="#ff3b30" transparent opacity={0.9} />
      </mesh>

      <BulletImpactMarks impacts={impactMarks} />
    </>
  );
}

type MapEnvironmentProps = {
  shadows: boolean;
};

function MapEnvironment({ shadows }: MapEnvironmentProps) {
  const sandTexture = useMemo(() => createSandTexture(), []);
  const oceanTexture = useMemo(() => createOceanTexture(), []);

  useEffect(() => {
    return () => {
      sandTexture?.dispose();
      oceanTexture?.dispose();
    };
  }, [oceanTexture, sandTexture]);

  useFrame((_, delta) => {
    if (!oceanTexture) {
      return;
    }
    oceanTexture.offset.x = (oceanTexture.offset.x + delta * 0.012) % 1;
    oceanTexture.offset.y = (oceanTexture.offset.y + delta * 0.006) % 1;
  });

  const shelfSizeX = WALKABLE_SIZE_X + SHORE_SHELF_PADDING * 2;
  const shelfSizeZ = WALKABLE_SIZE_Z + SHORE_SHELF_PADDING * 2;
  const foamRingSizeX = WALKABLE_SIZE_X + SHORE_FOAM_RING_PADDING * 2;
  const foamRingSizeZ = WALKABLE_SIZE_Z + SHORE_FOAM_RING_PADDING * 2;
  const cliffY = 0 - CLIFF_HEIGHT / 2;

  return (
    <group>
      <mesh position={[128, 20, -148]}>
        <sphereGeometry args={[8.6, 20, 20]} />
        <meshBasicMaterial color="#ffb66d" />
      </mesh>
      <mesh position={[128, 20, -148]}>
        <sphereGeometry args={[13.5, 20, 20]} />
        <meshBasicMaterial color="#ff7f4e" transparent opacity={0.17} depthWrite={false} />
      </mesh>

      <EveningClouds />

      <mesh
        position={[WALKABLE_CENTER_X, OCEAN_LEVEL_Y, WALKABLE_CENTER_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[OCEAN_SIZE, OCEAN_SIZE]} />
        <meshStandardMaterial
          color="#2b5f77"
          map={oceanTexture ?? undefined}
          roughness={0.28}
          metalness={0.1}
        />
      </mesh>
      <mesh
        position={[WALKABLE_CENTER_X, OCEAN_LEVEL_Y + 0.06, WALKABLE_CENTER_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[OCEAN_SIZE, OCEAN_SIZE]} />
        <meshBasicMaterial color="#80cae4" transparent opacity={0.07} depthWrite={false} />
      </mesh>

      <mesh
        position={[WALKABLE_CENTER_X, SHORE_SHELF_Y, WALKABLE_CENTER_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow={shadows}
        userData={{ bulletHittable: true }}
      >
        <planeGeometry args={[shelfSizeX, shelfSizeZ]} />
        <meshStandardMaterial color="#b79059" roughness={0.98} metalness={0.01} />
      </mesh>

      <mesh
        position={[WALKABLE_CENTER_X, SHORE_SHELF_Y + 0.03, WALKABLE_CENTER_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[foamRingSizeX, foamRingSizeZ]} />
        <meshBasicMaterial color="#f7dcb8" transparent opacity={0.08} depthWrite={false} />
      </mesh>

      <mesh
        position={[WALKABLE_CENTER_X, 0, WALKABLE_CENTER_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow={shadows}
        userData={{ bulletHittable: true }}
      >
        <planeGeometry args={[WALKABLE_SIZE_X, WALKABLE_SIZE_Z]} />
        <meshStandardMaterial
          color="#d1ad72"
          map={sandTexture ?? undefined}
          roughness={0.99}
          metalness={0}
        />
      </mesh>

      <mesh
        position={[WALKABLE_CENTER_X, cliffY, WORLD_BOUNDS.maxZ + CLIFF_THICKNESS / 2]}
        castShadow={shadows}
        receiveShadow={shadows}
        userData={{ bulletHittable: true }}
      >
        <boxGeometry args={[WALKABLE_SIZE_X + CLIFF_THICKNESS, CLIFF_HEIGHT, CLIFF_THICKNESS]} />
        <meshStandardMaterial color="#7d6445" roughness={0.93} metalness={0.02} />
      </mesh>
      <mesh
        position={[WALKABLE_CENTER_X, cliffY, WORLD_BOUNDS.minZ - CLIFF_THICKNESS / 2]}
        castShadow={shadows}
        receiveShadow={shadows}
        userData={{ bulletHittable: true }}
      >
        <boxGeometry args={[WALKABLE_SIZE_X + CLIFF_THICKNESS, CLIFF_HEIGHT, CLIFF_THICKNESS]} />
        <meshStandardMaterial color="#775f42" roughness={0.93} metalness={0.02} />
      </mesh>
      <mesh
        position={[WORLD_BOUNDS.maxX + CLIFF_THICKNESS / 2, cliffY, WALKABLE_CENTER_Z]}
        castShadow={shadows}
        receiveShadow={shadows}
        userData={{ bulletHittable: true }}
      >
        <boxGeometry args={[CLIFF_THICKNESS, CLIFF_HEIGHT, WALKABLE_SIZE_Z + CLIFF_THICKNESS * 2]} />
        <meshStandardMaterial color="#7a6245" roughness={0.93} metalness={0.02} />
      </mesh>
      <mesh
        position={[WORLD_BOUNDS.minX - CLIFF_THICKNESS / 2, cliffY, WALKABLE_CENTER_Z]}
        castShadow={shadows}
        receiveShadow={shadows}
        userData={{ bulletHittable: true }}
      >
        <boxGeometry args={[CLIFF_THICKNESS, CLIFF_HEIGHT, WALKABLE_SIZE_Z + CLIFF_THICKNESS * 2]} />
        <meshStandardMaterial color="#6f593f" roughness={0.93} metalness={0.02} />
      </mesh>

      <CoverBlock position={[-14, 1.2, -12]} size={[2.8, 2.4, 2.4]} shadows={shadows} color="#b7bcc3" />
      <CoverBlock position={[18, 1.3, -22]} size={[4, 2.6, 2.6]} shadows={shadows} color="#a8b6c0" />
      <CoverBlock position={[-26, 1.2, 16]} size={[3.2, 2.4, 2.4]} shadows={shadows} color="#bcc7d0" />
      <CoverBlock position={[28, 1.4, 24]} size={[3.8, 2.8, 2.8]} shadows={shadows} color="#c9c1b0" />
      <CoverBlock position={[0, 1.4, -36]} size={[5.5, 2.8, 2.8]} shadows={shadows} color="#d2c9b8" />

      <mesh position={[0, 0.02, -58]} receiveShadow={shadows} userData={{ bulletHittable: true }}>
        <boxGeometry args={[42, 0.05, 16]} />
        <meshStandardMaterial color="#7f8d95" roughness={0.95} metalness={0} />
      </mesh>
    </group>
  );
}

type CloudClusterSpec = {
  position: [number, number, number];
  scale: number;
  yaw: number;
  color: string;
};

const EVENING_CLOUDS: CloudClusterSpec[] = [
  { position: [-96, 40, -156], scale: 10, yaw: 0.2, color: "#f6c4a4" },
  { position: [-34, 47, -118], scale: 12, yaw: -0.35, color: "#ffd2b4" },
  { position: [34, 52, -176], scale: 13, yaw: 0.45, color: "#ffcab0" },
  { position: [102, 42, -114], scale: 10.5, yaw: -0.25, color: "#efb090" },
  { position: [148, 33, -208], scale: 15, yaw: 0.1, color: "#e99874" },
  { position: [-150, 36, -78], scale: 9.5, yaw: -0.1, color: "#f1ba97" },
];

function EveningClouds() {
  return (
    <group>
      {EVENING_CLOUDS.map((cloud) => (
        <CloudCluster key={`${cloud.position[0]}-${cloud.position[2]}`} cloud={cloud} />
      ))}
    </group>
  );
}

function CloudCluster({ cloud }: { cloud: CloudClusterSpec }) {
  const puffs: Array<{
    position: [number, number, number];
    scale: [number, number, number];
  }> = [
    { position: [-0.65, 0.02, 0.12], scale: [0.9, 0.45, 0.75] },
    { position: [-0.2, 0.12, -0.08], scale: [1, 0.52, 0.9] },
    { position: [0.25, 0.1, 0.05], scale: [0.95, 0.48, 0.82] },
    { position: [0.72, 0, -0.12], scale: [0.78, 0.4, 0.7] },
    { position: [0.05, -0.05, 0.28], scale: [0.9, 0.35, 0.65] },
  ];

  return (
    <group
      position={cloud.position}
      rotation={[0, cloud.yaw, 0]}
      scale={[cloud.scale, cloud.scale * 0.6, cloud.scale]}
    >
      {puffs.map((puff, index) => (
        <mesh
          key={`${index}-${puff.position[0]}`}
          position={puff.position}
          scale={puff.scale}
        >
          <sphereGeometry args={[1, 14, 12]} />
          <meshStandardMaterial
            color={cloud.color}
            roughness={1}
            metalness={0}
            transparent
            opacity={0.88}
          />
        </mesh>
      ))}
    </group>
  );
}

function createSandTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const rng = createSeededRandom(90210);
  ctx.fillStyle = "#cda66a";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2600; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const radius = 0.35 + rng() * 1.1;
    const alpha = 0.08 + rng() * 0.18;
    const tone = rng();
    const r = tone > 0.7 ? 244 : tone > 0.35 ? 214 : 158;
    const g = tone > 0.7 ? 218 : tone > 0.35 ? 179 : 129;
    const b = tone > 0.7 ? 170 : tone > 0.35 ? 126 : 84;
    ctx.beginPath();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 42; i += 1) {
    const y = rng() * size;
    const amplitude = 2 + rng() * 4;
    const wavelength = 20 + rng() * 28;
    const phase = rng() * Math.PI * 2;
    ctx.beginPath();
    ctx.lineWidth = 1 + rng() * 1.5;
    ctx.strokeStyle = `rgba(255, 236, 205, ${0.03 + rng() * 0.04})`;

    for (let x = -8; x <= size + 8; x += 6) {
      const rippleY = y + Math.sin(x / wavelength + phase) * amplitude;
      if (x <= -8) {
        ctx.moveTo(x, rippleY);
      } else {
        ctx.lineTo(x, rippleY);
      }
    }

    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.needsUpdate = true;
  return texture;
}

function createOceanTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const rng = createSeededRandom(404);
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#2a5f76");
  gradient.addColorStop(0.5, "#326e84");
  gradient.addColorStop(1, "#1e4a61");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 64; i += 1) {
    const y = rng() * size;
    const amplitude = 1.5 + rng() * 4;
    const wavelength = 10 + rng() * 22;
    const phase = rng() * Math.PI * 2;
    ctx.beginPath();
    ctx.lineWidth = 1 + rng() * 1.2;
    ctx.strokeStyle = `rgba(184, 233, 246, ${0.035 + rng() * 0.05})`;

    for (let x = -8; x <= size + 8; x += 5) {
      const waveY = y + Math.sin(x / wavelength + phase) * amplitude;
      if (x <= -8) {
        ctx.moveTo(x, waveY);
      } else {
        ctx.lineTo(x, waveY);
      }
    }

    ctx.stroke();
  }

  for (let i = 0; i < 850; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const alpha = 0.02 + rng() * 0.05;
    ctx.fillStyle = `rgba(220, 250, 255, ${alpha})`;
    ctx.fillRect(x, y, 1 + rng() * 1.5, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  texture.needsUpdate = true;
  return texture;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

type CoverBlockProps = {
  position: [number, number, number];
  size: [number, number, number];
  shadows: boolean;
  color: string;
};

function CoverBlock({ position, size, shadows, color }: CoverBlockProps) {
  return (
    <mesh position={position} castShadow={shadows} receiveShadow={shadows} userData={{ bulletHittable: true }}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.86} metalness={0.08} />
    </mesh>
  );
}

function BuildingShell({ shadows }: { shadows: boolean }) {
  const leftSouthWidth = (BUILDING_WIDTH - DOOR_GAP_WIDTH) / 2;
  const rightSouthWidth = leftSouthWidth;

  return (
    <group position={[BUILDING_CENTER.x, 0, BUILDING_CENTER.z]}>
      <mesh position={[0, 0.01, 0]} receiveShadow={shadows} userData={{ bulletHittable: true }}>
        <boxGeometry args={[BUILDING_WIDTH, 0.02, BUILDING_DEPTH]} />
        <meshStandardMaterial color="#a6a295" roughness={0.98} metalness={0} />
      </mesh>

      <mesh
        position={[-BUILDING_WIDTH / 2 + WALL_THICKNESS / 2, BUILDING_HEIGHT / 2, 0]}
        castShadow={shadows}
        receiveShadow={shadows}
        userData={{ bulletHittable: true }}
      >
        <boxGeometry args={[WALL_THICKNESS, BUILDING_HEIGHT, BUILDING_DEPTH]} />
        <meshStandardMaterial color="#ddd0b7" roughness={0.82} metalness={0.03} />
      </mesh>
      <mesh
        position={[BUILDING_WIDTH / 2 - WALL_THICKNESS / 2, BUILDING_HEIGHT / 2, 0]}
        castShadow={shadows}
        receiveShadow={shadows}
        userData={{ bulletHittable: true }}
      >
        <boxGeometry args={[WALL_THICKNESS, BUILDING_HEIGHT, BUILDING_DEPTH]} />
        <meshStandardMaterial color="#ddd0b7" roughness={0.82} metalness={0.03} />
      </mesh>
      <mesh
        position={[0, BUILDING_HEIGHT / 2, -BUILDING_DEPTH / 2 + WALL_THICKNESS / 2]}
        castShadow={shadows}
        receiveShadow={shadows}
        userData={{ bulletHittable: true }}
      >
        <boxGeometry args={[BUILDING_WIDTH, BUILDING_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#ddd0b7" roughness={0.82} metalness={0.03} />
      </mesh>
      <mesh
        position={[
          -DOOR_GAP_WIDTH / 2 - leftSouthWidth / 2,
          BUILDING_HEIGHT / 2,
          BUILDING_DEPTH / 2 - WALL_THICKNESS / 2,
        ]}
        castShadow={shadows}
        receiveShadow={shadows}
        userData={{ bulletHittable: true }}
      >
        <boxGeometry args={[leftSouthWidth, BUILDING_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#ddd0b7" roughness={0.82} metalness={0.03} />
      </mesh>
      <mesh
        position={[
          DOOR_GAP_WIDTH / 2 + rightSouthWidth / 2,
          BUILDING_HEIGHT / 2,
          BUILDING_DEPTH / 2 - WALL_THICKNESS / 2,
        ]}
        castShadow={shadows}
        receiveShadow={shadows}
        userData={{ bulletHittable: true }}
      >
        <boxGeometry args={[rightSouthWidth, BUILDING_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#ddd0b7" roughness={0.82} metalness={0.03} />
      </mesh>

      <mesh
        position={[0, BUILDING_HEIGHT + 0.1, 0]}
        castShadow={shadows}
        receiveShadow={shadows}
        userData={{ bulletHittable: true }}
      >
        <boxGeometry args={[BUILDING_WIDTH + 0.5, 0.2, BUILDING_DEPTH + 0.5]} />
        <meshStandardMaterial color="#af8868" roughness={0.86} metalness={0.04} />
      </mesh>

      <mesh
        position={[0, DOOR_HEIGHT / 2, BUILDING_DEPTH / 2 - 0.03]}
        castShadow={shadows}
        receiveShadow={shadows}
        userData={{ bulletHittable: true }}
      >
        <boxGeometry args={[DOOR_GAP_WIDTH - 0.15, DOOR_HEIGHT, 0.05]} />
        <meshStandardMaterial
          color="#8a7a66"
          roughness={0.7}
          metalness={0.12}
          transparent
          opacity={0.45}
        />
      </mesh>
    </group>
  );
}
void BuildingShell;

function StressBoxes({ count, shadows }: { count: StressModeCount; shadows: boolean }) {
  const instances = useMemo(() => {
    if (count === 0) {
      return [] as Array<{
        position: [number, number, number];
        scale: [number, number, number];
        color: string;
      }>;
    }

    const next: Array<{
      position: [number, number, number];
      scale: [number, number, number];
      color: string;
    }> = [];
    const side = Math.ceil(Math.sqrt(count));
    for (let i = 0; i < count; i += 1) {
      const row = Math.floor(i / side);
      const col = i % side;
      const x = -18 + col * 1.8;
      const z = 10 + row * 1.8;
      const height = 0.4 + ((i % 5) * 0.22 + 0.2);
      next.push({
        position: [x, height / 2, z],
        scale: [0.9, height, 0.9],
        color: i % 2 === 0 ? "#a3b6c0" : "#b8c7c7",
      });
    }
    return next;
  }, [count]);

  if (instances.length === 0) {
    return null;
  }

  return (
    <group>
      {instances.map((instance, index) => (
        <mesh
          key={`${index}-${instance.position[0]}-${instance.position[2]}`}
          position={instance.position}
          castShadow={shadows}
          receiveShadow={shadows}
          userData={{ bulletHittable: true }}
        >
          <boxGeometry args={instance.scale} />
          <meshStandardMaterial color={instance.color} roughness={0.8} metalness={0.08} />
        </mesh>
      ))}
    </group>
  );
}

function BulletImpactMarks({ impacts }: { impacts: BulletImpactMark[] }) {
  if (impacts.length === 0) {
    return null;
  }

  return (
    <group>
      {impacts.map((impact) => (
        <mesh
          key={impact.id}
          position={impact.position}
          quaternion={impact.quaternion}
          renderOrder={3}
        >
          <circleGeometry args={[BULLET_IMPACT_MARK_RADIUS, 10]} />
          <meshBasicMaterial color="#ff2d20" transparent opacity={0.95} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function resolveShotDamage(shot: WeaponShotEvent, targetHit: TargetRaycastHit): number {
  if (shot.weaponType === "sniper") {
    if (targetHit.zone === "head") {
      return 200;
    }
    if (targetHit.zone === "leg") {
      return 70;
    }
    return shot.damage;
  }

  if (targetHit.zone === "head") {
    const oneShotRange = 16;
    const falloffEndRange = 58;
    const t = clamp01((targetHit.distance - oneShotRange) / (falloffEndRange - oneShotRange));
    const headDamage = THREE.MathUtils.lerp(125, 62, t);
    return Math.round(headDamage);
  }

  if (targetHit.zone === "leg") {
    return Math.max(1, Math.round(shot.damage * 0.84));
  }

  return shot.damage;
}

function updateWorldGunMesh(
  mesh: THREE.Group | null,
  weapon: WeaponSystem,
  nowMs: number,
) {
  if (!mesh) {
    return;
  }

  const visible = !weapon.isEquipped();
  mesh.visible = visible;
  if (!visible) {
    return;
  }

  const droppedPosition = weapon.getDroppedPosition();
  mesh.position.set(
    droppedPosition.x,
    droppedPosition.y + Math.sin(nowMs * 0.006) * 0.04,
    droppedPosition.z,
  );
  mesh.rotation.set(0.2, nowMs * 0.0016, 0);
}

function updateCharacterWeaponMesh(
  weaponGroup: THREE.Group | null,
  muzzleFlashMesh: THREE.Mesh | null,
  weapon: WeaponSystem,
  nowMs: number,
) {
  if (!weaponGroup) {
    return;
  }

  const equipped = weapon.isEquipped();
  weaponGroup.visible = equipped;
  if (!equipped) {
    if (muzzleFlashMesh) {
      muzzleFlashMesh.visible = false;
    }
    return;
  }

  if (muzzleFlashMesh) {
    muzzleFlashMesh.visible = weapon.hasMuzzleFlash(nowMs);
  }
}

function updateTracerMesh(
  tracerMesh: THREE.Mesh | null,
  weapon: WeaponSystem,
  nowMs: number,
  tempMid: THREE.Vector3,
  tempDir: THREE.Vector3,
) {
  if (!tracerMesh) {
    return;
  }

  const tracer = weapon.getActiveTracer(nowMs);
  if (!tracer) {
    tracerMesh.visible = false;
    return;
  }

  tempDir.copy(tracer.to).sub(tracer.from);
  const length = tempDir.length();
  if (length <= 0.0001) {
    tracerMesh.visible = false;
    return;
  }

  tracerMesh.visible = true;
  tempMid.copy(tracer.from).lerp(tracer.to, 0.5);
  tracerMesh.position.copy(tempMid);
  tracerMesh.scale.set(1, 1, length);
  tracerMesh.quaternion.setFromUnitVectors(Z_AXIS, tempDir.normalize());
}

function raycastBulletWorld(
  scene: THREE.Scene,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  raycaster: THREE.Raycaster,
  tempNormal: THREE.Vector3,
  tempNormalMatrix: THREE.Matrix3,
): WorldRaycastHit | null {
  raycaster.set(origin, direction);
  const intersections = raycaster.intersectObjects(scene.children, true);

  for (const intersection of intersections) {
    const object = intersection.object;
    if (!(object instanceof THREE.Mesh)) {
      continue;
    }
    if (object.userData?.bulletHittable !== true) {
      continue;
    }
    if (intersection.distance <= 0) {
      continue;
    }

    if (intersection.face) {
      tempNormal.copy(intersection.face.normal);
      tempNormalMatrix.getNormalMatrix(object.matrixWorld);
      tempNormal.applyMatrix3(tempNormalMatrix).normalize();
    } else {
      tempNormal.set(0, 1, 0);
    }

    return {
      point: intersection.point.clone(),
      normal: tempNormal.clone(),
      distance: intersection.distance,
    };
  }

  return null;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function boxRect(center: { x: number; z: number }, width: number, depth: number): CollisionRect {
  const halfW = width / 2;
  const halfD = depth / 2;
  return {
    minX: center.x - halfW,
    maxX: center.x + halfW,
    minZ: center.z - halfD,
    maxZ: center.z + halfD,
  };
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);
