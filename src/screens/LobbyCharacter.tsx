import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { loadFbxAsset, loadFbxAnimation } from "../game/AssetLoader";

const CHARACTER_MODEL_URL =
  "/assets/models/character/Trooper/tactical guy.fbx";
const IDLE_ANIM_URL = "/assets/animations/walking/Idle.fbx";
const CHARACTER_TARGET_HEIGHT = 1.65;
const TEXTURE_BASE =
  "/assets/models/character/Trooper/tactical guy.fbm/";

const TEXTURE_MAP: Record<string, { base: string; normal: string }> = {
  Body: { base: "Body_baseColor_0.png", normal: "Body_normal_1.png" },
  Bottom: { base: "Bottom_baseColor_2.png", normal: "Bottom_normal_3.png" },
  Glove: { base: "Glove_baseColor_4.png", normal: "Glove_normal_5.png" },
  material: {
    base: "material_baseColor_6.png",
    normal: "material_normal_7.png",
  },
  Mask: { base: "Mask_baseColor_8.png", normal: "Mask_normal_9.png" },
  Shoes: { base: "Shoes_baseColor_10.png", normal: "Shoes_normal_11.png" },
  material_6: {
    base: "material_6_baseColor_12.png",
    normal: "material_6_normal_13.png",
  },
};

async function applyTextures(model: THREE.Group) {
  const loader = new THREE.TextureLoader();
  const load = (file: string) =>
    new Promise<THREE.Texture>((resolve) => {
      loader.load(TEXTURE_BASE + file, resolve, undefined, () =>
        resolve(new THREE.Texture()),
      );
    });

  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const name = mat.name || mesh.name;
    const entry = Object.entries(TEXTURE_MAP).find(([key]) =>
      name.includes(key),
    );
    if (!entry) return;
    const [, files] = entry;
    load(files.base).then((tex) => {
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      mat.map = tex;
      mat.needsUpdate = true;
    });
    load(files.normal).then((tex) => {
      tex.flipY = false;
      mat.normalMap = tex;
      mat.needsUpdate = true;
    });
  });
}

function LobbyModel() {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const [fbx, idleClip, SkeletonUtils] = await Promise.all([
        loadFbxAsset(CHARACTER_MODEL_URL),
        loadFbxAnimation(IDLE_ANIM_URL, "idle"),
        import("three/examples/jsm/utils/SkeletonUtils.js"),
      ]);
      if (disposed || !fbx) return;

      const clone = SkeletonUtils.clone(fbx) as THREE.Group;

      const box = new THREE.Box3().setFromObject(clone);
      const size = new THREE.Vector3();
      box.getSize(size);
      const scale = size.y > 0 ? CHARACTER_TARGET_HEIGHT / size.y : 1;
      clone.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(clone);
      clone.position.y = -scaledBox.min.y;

      clone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      await applyTextures(clone);

      const mixer = new THREE.AnimationMixer(clone);
      mixerRef.current = mixer;

      if (idleClip) {
        const action = mixer.clipAction(idleClip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
      }

      setModel(clone);
    })();
    return () => {
      disposed = true;
    };
  }, []);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  if (!model) return null;

  return (
    <group ref={groupRef} rotation={[0, Math.PI, 0]}>
      <primitive object={model} />
    </group>
  );
}

function SlowOrbit() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime() * 0.08;
      groupRef.current.rotation.y = Math.sin(t) * 0.15;
    }
  });

  return <group ref={groupRef}><LobbyModel /></group>;
}

export function LobbyCharacter() {
  return (
    <div className="lobby-character-viewport">
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0.9, 2.8], fov: 40 }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[3, 4, 2]}
          intensity={1.2}
          castShadow={false}
        />
        <directionalLight
          position={[-2, 3, -1]}
          intensity={0.4}
          color="#5ab8ff"
        />
        <pointLight
          position={[0, 1, -2]}
          intensity={0.6}
          color="#ffab42"
        />
        <pointLight
          position={[-1.5, 0.5, 1]}
          intensity={0.3}
          color="#0091ff"
        />
        <SlowOrbit />
      </Canvas>
    </div>
  );
}
