# Assets

## Current State

- **Character model**: Trooper FBX (`public/assets/models/character/Trooper/tactical guy.fbx`) with manual texture loading from `.fbm` folder
- **Animations**: Mixamo FBX files grouped by movement mode and rifle stance
- **Practice maps**: selectable procedural `Range` plus bundled `TDM` GLB (`public/assets/map/TDM.glb`)
- **TDM gameplay**: traversal-only blockout for now, with no targets, no loot spawns, and a coarse authored collision/bounds pass
- Placeholder geometry still used for weapon pickups and target dummies
- Audio uses WebAudio synth fallback unless files are added

## Asset Locations

- Practice maps: `public/assets/map/`
- Models: `public/assets/models/`
- Character textures: `public/assets/models/character/Trooper/tactical guy.fbm/`
- Animations: `public/assets/animations/` (`movement/standing`, `movement/crouch`, `rifle/aim`, `rifle/ready`)
- Audio: `public/assets/audio/`
- Attribution file: `public/assets/ATTRIBUTION.md`

## Rules

- Use only free assets with commercial-friendly licenses (`CC0`, `CC BY`, or similarly permissive)
- Record source + license in `public/assets/ATTRIBUTION.md`
- If the license requires attribution, ship the credit text with the build instead of pretending QA will remember it later
- Prefer keeping originals and documenting edits/conversions

## Import Pipeline

### Practice Maps

- `Range` remains procedural and keeps the existing stress-box test path
- `TDM` loads from `public/assets/map/TDM.glb` through `loadGlbAsset()`
- `TDM` currently uses authored world bounds, a grounded spawn point, and coarse blocker rectangles in `src/game/scene/practice-maps.ts`
- `TDM` is still scenery-first and movement-focused; the current blocker pass is intentionally rough until the layout settles
- Stress mode stays range-only for now, because one performance fire at a time is enough

### Character Model (FBX)

- Model: `tactical guy.fbx` loaded via `loadFbxAsset()` with `SkeletonUtils.clone()`
- Textures: 7 materials (Body, Bottom, Glove, material/vest, Mask, Shoes, material_6) — each with baseColor + normal map
- FBXLoader can't auto-apply textures (unsupported map channel type) — `applyCharacterTextures()` manually loads them via `TextureLoader` with `encodeURI()` for space-safe URLs
- Texture map defined in `CHARACTER_TEXTURE_MAP` in `Scene.tsx`

### Animations (FBX)

- Mixamo FBX files in `public/assets/animations/`, renamed to kebab-case and grouped by gameplay context
- Each FBX contains a full rig but only `fbx.animations[0]` is extracted
- Bone names normalized via `normalizeBoneName()` (strips `mixamorig:`, `characters3dcom___` prefixes)
- Tracks for bones absent from the model (finger detail) are filtered out before creating actions
- Current clips: movement locomotion, crouch, rifle aim, and rifle ready states
- Unused legacy FBX files were removed to keep the animation set leaner

### Models (GLB)

- Drop `.glb` into `public/assets/models/`
- Load via `src/game/AssetLoader.ts`
- Fallback to placeholder mesh if load fails

### Audio

- Drop audio files into `public/assets/audio/`
- `AudioManager` attempts file load first
- Synth fallback runs if decode/load fails

## Asset Review Checklist

- License checked
- Attribution added
- File size reasonable
- Format works in web + desktop builds
- Gameplay bounds and collision authored if the asset is decorative scenery
- Fallback still works if file is missing

## Trade-off

Bundled scenery gives faster visual payoff, but a traversal-only map is still just staging until collision and gameplay layers exist.
That is acceptable for layout validation, and a lot less dishonest than pretending an unfinished combat map is already playable.
