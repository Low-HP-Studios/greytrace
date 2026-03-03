import { useCallback, useEffect, useRef, useState } from "react";
import { loadFbxAsset, loadFbxAnimation } from "../game/AssetLoader";

type LoadingScreenProps = {
  onComplete: () => void;
};

const PRELOAD_TASKS: { label: string; load: () => Promise<unknown> }[] = [
  {
    label: "Character model",
    load: () =>
      loadFbxAsset("/assets/models/character/Trooper/tactical guy.fbx"),
  },
  {
    label: "Idle animation",
    load: () => loadFbxAnimation("/assets/animations/walking/Idle.fbx", "idle"),
  },
  {
    label: "Walk animation",
    load: () =>
      loadFbxAnimation(
        "/assets/animations/walking/Walk Forward.fbx",
        "walk",
      ),
  },
  {
    label: "Rifle idle",
    load: () =>
      loadFbxAnimation(
        "/assets/animations/walking with gun/Rifle Aim Idle.fbx",
        "rifleIdle",
      ),
  },
  {
    label: "Rifle",
    load: () => loadFbxAsset("/assets/weapons/pack/FBX/AssaultRifle_01.fbx"),
  },
  {
    label: "Sniper",
    load: () => loadFbxAsset("/assets/weapons/pack/FBX/SniperRifle_01.fbx"),
  },
];

const MIN_DISPLAY_MS = 3000;

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const mountTime = useRef(performance.now());
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setFadingOut(true);
    setTimeout(onComplete, 600);
  }, [onComplete]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const total = PRELOAD_TASKS.length;
      let loaded = 0;

      const promises = PRELOAD_TASKS.map(async (task) => {
        await task.load();
        if (cancelled) return;
        loaded++;
        setProgress(loaded / total);
      });

      await Promise.all(promises);
      if (cancelled) return;

      const elapsed = performance.now() - mountTime.current;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
      setTimeout(() => {
        if (!cancelled) finish();
      }, remaining);
    })();

    return () => {
      cancelled = true;
    };
  }, [finish]);

  const pct = Math.round(progress * 100);

  return (
    <div className={`loading-screen ${fadingOut ? "fade-out" : ""}`}>
      <div className="loading-ambient" />
      <div className="loading-content">
        <img
          src="/assets/branding/logo.svg"
          alt="Zero Hour"
          className="loading-logo"
          draggable={false}
        />
        <h1 className="loading-title">ZERO HOUR</h1>
        <p className="loading-studio">Low Hp Studios</p>
      </div>
      <div className="loading-bottom">
        <div className="loading-bar-track">
          <div
            className="loading-bar-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="loading-pct">{pct}%</span>
      </div>
    </div>
  );
}
