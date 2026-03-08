export type PixelRatioScale = 0.5 | 0.75 | 1;
export type StressModeCount = 0 | 50 | 100 | 200;

export type ExperiencePhase =
  | "menu"
  | "entering"
  | "playing"
  | "returning";

export type AimSensitivitySettings = {
  look: number;
  rifleAds: number;
  sniperAds: number;
  vertical: number;
};

export const DEFAULT_AIM_SENSITIVITY_SETTINGS: AimSensitivitySettings = {
  look: 0.5,
  rifleAds: 0.5,
  sniperAds: 0.5,
  vertical: 0.5,
};

export type ControlBindings = {
  moveForward: string;
  moveBackward: string;
  moveLeft: string;
  moveRight: string;
  sprint: string;
  jump: string;
  pickup: string;
  drop: string;
  reset: string;
  equipRifle: string;
  equipSniper: string;
  toggleView: string;
  shoulderLeft: string;
  shoulderRight: string;
};

export const DEFAULT_CONTROL_BINDINGS: ControlBindings = {
  moveForward: "KeyW",
  moveBackward: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  sprint: "ShiftLeft",
  jump: "Space",
  pickup: "KeyF",
  drop: "KeyG",
  reset: "KeyR",
  equipRifle: "Digit1",
  equipSniper: "Digit2",
  toggleView: "KeyV",
  shoulderLeft: "KeyQ",
  shoulderRight: "KeyE",
};

export type HudOverlayToggles = {
  practice: boolean;
  controls: boolean;
  settings: boolean;
  performance: boolean;
};

export const DEFAULT_HUD_OVERLAY_TOGGLES: HudOverlayToggles = {
  practice: false,
  controls: false,
  settings: false,
  performance: true,
};

export type WeaponAlignmentOffset = {
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
};

export const DEFAULT_WEAPON_ALIGNMENT: WeaponAlignmentOffset = {
  posX: 0.150,
  posY: 0.240,
  posZ: 0.040,
  rotX: -2.96,
  rotY: 0.13,
  rotZ: -1.23,
};

export type CrosshairColor =
  | "white"
  | "green"
  | "red"
  | "yellow"
  | "cyan"
  | "magenta";

export type CrosshairCenterDotSettings = {
  enabled: boolean;
  size: number;
  thickness: number;
};

export type CrosshairLineSettings = {
  enabled: boolean;
  length: number;
  thickness: number;
  gap: number;
};

export type CrosshairOutlineSettings = {
  enabled: boolean;
  thickness: number;
  opacity: number;
};

export type CrosshairDynamicSettings = {
  enabled: boolean;
  idleSpread: number;
  walkSpread: number;
  runSpread: number;
  shotKick: number;
  recoveryPerSecond: number;
};

export type CrosshairWeaponModifierSettings = {
  rifleGapMultiplier: number;
  sniperGapMultiplier: number;
};

export type CrosshairAdsSettings = {
  rifleDotSize: number;
  rifleDotColor: CrosshairColor;
  sniperDotSize: number;
  sniperDotColor: CrosshairColor;
};

export type CrosshairSettings = {
  color: CrosshairColor;
  centerDot: CrosshairCenterDotSettings;
  innerLines: CrosshairLineSettings;
  outerLines: CrosshairLineSettings;
  outline: CrosshairOutlineSettings;
  dynamic: CrosshairDynamicSettings;
  weaponModifiers: CrosshairWeaponModifierSettings;
  ads: CrosshairAdsSettings;
};

export type WeaponRecoilProfile = {
  recoilPitchBase: number;
  recoilPitchRamp: number;
  recoilYawRange: number;
  recoilYawDrift: number;
  moveSpreadBase: number;
  moveSpreadSprint: number;
};

export type WeaponRecoilProfiles = {
  rifle: WeaponRecoilProfile;
  sniper: WeaponRecoilProfile;
};

export type MovementProfileSettings = {
  rifleWalkSpeedScale: number;
  rifleJogSpeedScale: number;
  rifleRunSpeedScale: number;
  rifleFirePrepSpeedScale: number;
  rifleRunStaminaMaxMs: number;
  rifleRunStaminaDrainPerSec: number;
  rifleRunStaminaRegenPerSec: number;
  rifleRunStartMs: number;
  rifleRunStopMs: number;
  rifleRunForwardThreshold: number;
  rifleRunLateralThreshold: number;
};

export const DEFAULT_CROSSHAIR_SETTINGS: CrosshairSettings = {
  color: "white",
  centerDot: {
    enabled: true,
    size: 4,
    thickness: 3,
  },
  innerLines: {
    enabled: true,
    length: 9,
    thickness: 2,
    gap: 6,
  },
  outerLines: {
    enabled: false,
    length: 7,
    thickness: 2,
    gap: 13,
  },
  outline: {
    enabled: true,
    thickness: 1,
    opacity: 0.85,
  },
  dynamic: {
    enabled: true,
    idleSpread: 0,
    walkSpread: 2.2,
    runSpread: 5.2,
    shotKick: 1.4,
    recoveryPerSecond: 12,
  },
  weaponModifiers: {
    rifleGapMultiplier: 1,
    sniperGapMultiplier: 1.25,
  },
  ads: {
    rifleDotSize: 5,
    rifleDotColor: "red",
    sniperDotSize: 6,
    sniperDotColor: "red",
  },
};

export const DEFAULT_WEAPON_RECOIL_PROFILES: WeaponRecoilProfiles = {
  rifle: {
    recoilPitchBase: 0.0007,
    recoilPitchRamp: 0.00015,
    recoilYawRange: 0.003,
    recoilYawDrift: 0.000005,
    moveSpreadBase: 0.1,
    moveSpreadSprint: 0.1,
  },
  sniper: {
    recoilPitchBase: 0.05,
    recoilPitchRamp: 0,
    recoilYawRange: 0.05,
    recoilYawDrift: 0.0005,
    moveSpreadBase: 0.05,
    moveSpreadSprint: 0.05,
  },
};

export const DEFAULT_MOVEMENT_SETTINGS: MovementProfileSettings = {
  rifleWalkSpeedScale: 0.56,
  rifleJogSpeedScale: 0.82,
  rifleRunSpeedScale: 1.42,
  rifleFirePrepSpeedScale: 0.38,
  rifleRunStaminaMaxMs: 2600,
  rifleRunStaminaDrainPerSec: 1,
  rifleRunStaminaRegenPerSec: 0.55,
  rifleRunStartMs: 220,
  rifleRunStopMs: 220,
  rifleRunForwardThreshold: 0.42,
  rifleRunLateralThreshold: 0.2,
};

export type EnemyOutlineColor = "red" | "yellow" | "cyan" | "magenta";

export type EnemyOutlineSettings = {
  enabled: boolean;
  color: EnemyOutlineColor;
  thickness: number;
  opacity: number;
};

export const DEFAULT_ENEMY_OUTLINE_SETTINGS: EnemyOutlineSettings = {
  enabled: true,
  color: "red",
  thickness: 3,
  opacity: 0.88,
};

export type GameSettings = {
  shadows: boolean;
  pixelRatioScale: PixelRatioScale;
  showR3fPerf: boolean;
  sensitivity: AimSensitivitySettings;
  keybinds: ControlBindings;
  fov: number;
  weaponAlignment: WeaponAlignmentOffset;
  crosshair: CrosshairSettings;
  enemyOutline: EnemyOutlineSettings;
  movement: MovementProfileSettings;
  weaponRecoilProfiles: WeaponRecoilProfiles;
};

export type PerfMetrics = {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
};

export const DEFAULT_PERF_METRICS: PerfMetrics = {
  fps: 0,
  frameMs: 0,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
};

export type PlayerSnapshot = {
  x: number;
  y: number;
  z: number;
  speed: number;
  sprinting: boolean;
  moving: boolean;
  grounded: boolean;
  pointerLocked: boolean;
  canInteract: boolean;
};

export const DEFAULT_PLAYER_SNAPSHOT: PlayerSnapshot = {
  x: 0,
  y: 0,
  z: 6,
  speed: 0,
  sprinting: false,
  moving: false,
  grounded: true,
  pointerLocked: false,
  canInteract: false,
};

export type CollisionRect = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type CollisionCircle = {
  x: number;
  z: number;
  radius: number;
};

export type WorldBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type ScenePresentation = {
  phase: ExperiencePhase;
  phaseProgress: number;
  worldTheme: number;
  pickupReveal: number;
  targetReveal: number;
  inputEnabled: boolean;
  killPulse: number;
};

export type TargetState = {
  id: string;
  position: [number, number, number];
  facingYaw: number;
  radius: number;
  hitUntil: number;
  disabled: boolean;
  hp: number;
  maxHp: number;
};
