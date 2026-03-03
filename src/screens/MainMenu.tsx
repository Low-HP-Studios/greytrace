import { useCallback, useEffect, useMemo, useState } from "react";
import { LobbyCharacter } from "./LobbyCharacter";
import { type AudioVolumeSettings, DEFAULT_AUDIO_VOLUMES } from "../game/Audio";
import {
  MenuSection,
  SwitchRow,
  RangeField,
  VolumeSlider,
  type PauseMenuTab,
  menuTitle,
  formatKeyCode,
} from "../game/SettingsPanels";
import {
  type ControlBindings,
  DEFAULT_AIM_SENSITIVITY_SETTINGS,
  DEFAULT_CONTROL_BINDINGS,
  DEFAULT_HUD_OVERLAY_TOGGLES,
  DEFAULT_WEAPON_ALIGNMENT,
  type GameSettings,
  type HudOverlayToggles,
  type PixelRatioScale,
  type StressModeCount,
} from "../game/types";

type MainMenuProps = {
  onStartGame: () => void;
};

type LobbyTab = "play" | "friends" | "store";

const SETTINGS_STORAGE_KEY = "zerohour.settings.v1";

const PIXEL_RATIO_OPTIONS: Array<{ value: PixelRatioScale; label: string }> = [
  { value: 0.5, label: "Low" },
  { value: 0.75, label: "Normal" },
  { value: 1, label: "High" },
];

const SETTINGS_TABS: Array<{ id: PauseMenuTab; label: string }> = [
  { id: "gameplay", label: "Gameplay" },
  { id: "audio", label: "Audio" },
  { id: "controls", label: "Controls" },
  { id: "graphics", label: "Graphics" },
  { id: "hud", label: "HUD" },
];

type BindingKey = keyof ControlBindings;

const BINDING_ROWS: Array<{
  key: BindingKey;
  label: string;
  hint: string;
}> = [
  { key: "moveForward", label: "Move Forward", hint: "Walk forward" },
  { key: "moveBackward", label: "Move Backward", hint: "Backpedal" },
  { key: "moveLeft", label: "Move Left", hint: "Strafe left" },
  { key: "moveRight", label: "Move Right", hint: "Strafe right" },
  { key: "sprint", label: "Sprint", hint: "Hold to sprint" },
  { key: "jump", label: "Jump", hint: "Hop" },
  { key: "toggleView", label: "Toggle View", hint: "FPP / TPP" },
  { key: "shoulderLeft", label: "Shoulder Left", hint: "TPP shoulder" },
  { key: "shoulderRight", label: "Shoulder Right", hint: "TPP shoulder" },
  { key: "equipRifle", label: "Equip Rifle", hint: "Weapon slot" },
  { key: "equipSniper", label: "Equip Sniper", hint: "Weapon slot" },
  { key: "reset", label: "Reset Targets", hint: "Practice reset" },
  { key: "pickup", label: "Pickup", hint: "Pickup weapon" },
  { key: "drop", label: "Drop", hint: "Drop weapon" },
];

const OVERLAY_ROWS: Array<{
  key: keyof HudOverlayToggles;
  label: string;
  hint: string;
}> = [
  { key: "practice", label: "Practice panel", hint: "Top-left range status" },
  { key: "controls", label: "Controls panel", hint: "Bottom-left shortcut list" },
  { key: "settings", label: "Settings panel", hint: "Bottom-right quick settings" },
  { key: "performance", label: "Performance panel", hint: "Top-right perf HUD" },
];

const DEFAULT_GAME_SETTINGS: GameSettings = {
  shadows: false,
  pixelRatioScale: 0.75,
  showR3fPerf: false,
  sensitivity: { ...DEFAULT_AIM_SENSITIVITY_SETTINGS },
  keybinds: { ...DEFAULT_CONTROL_BINDINGS },
  fov: 65,
  weaponAlignment: { ...DEFAULT_WEAPON_ALIGNMENT },
};

function loadSettings(): {
  settings: GameSettings;
  hudPanels: HudOverlayToggles;
  audioVolumes: AudioVolumeSettings;
} {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        settings: { ...DEFAULT_GAME_SETTINGS, ...parsed.settings },
        hudPanels: { ...DEFAULT_HUD_OVERLAY_TOGGLES, ...parsed.hudPanels },
        audioVolumes: { ...DEFAULT_AUDIO_VOLUMES, ...parsed.audioVolumes },
      };
    }
  } catch {}
  return {
    settings: { ...DEFAULT_GAME_SETTINGS },
    hudPanels: { ...DEFAULT_HUD_OVERLAY_TOGGLES },
    audioVolumes: { ...DEFAULT_AUDIO_VOLUMES },
  };
}

function saveSettings(
  settings: GameSettings,
  hudPanels: HudOverlayToggles,
  audioVolumes: AudioVolumeSettings,
  stressCount: StressModeCount,
) {
  try {
    const current = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const existing = current ? JSON.parse(current) : {};
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...existing, settings, hudPanels, audioVolumes, stressCount }),
    );
  } catch {}
}

export function MainMenu({ onStartGame }: MainMenuProps) {
  const [activeTab, setActiveTab] = useState<LobbyTab>("play");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<PauseMenuTab>("gameplay");
  const [bindingCapture, setBindingCapture] = useState<BindingKey | null>(null);

  const persisted = useMemo(loadSettings, []);
  const [settings, setSettings] = useState<GameSettings>(persisted.settings);
  const [hudPanels, setHudPanels] = useState<HudOverlayToggles>(
    persisted.hudPanels,
  );
  const [audioVolumes, setAudioVolumes] = useState<AudioVolumeSettings>(
    persisted.audioVolumes,
  );

  useEffect(() => {
    saveSettings(settings, hudPanels, audioVolumes, 0);
  }, [settings, hudPanels, audioVolumes]);

  useEffect(() => {
    if (!bindingCapture) return;
    const onCaptureKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === "Escape") {
        setBindingCapture(null);
        return;
      }
      setSettings((prev) => ({
        ...prev,
        keybinds: { ...prev.keybinds, [bindingCapture]: event.code },
      }));
      setBindingCapture(null);
    };
    window.addEventListener("keydown", onCaptureKey, true);
    return () => window.removeEventListener("keydown", onCaptureKey, true);
  }, [bindingCapture]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape" && settingsOpen) {
        setSettingsOpen(false);
        setBindingCapture(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  const duplicateBindingCodes = useMemo(() => {
    const codeCounts = new Map<string, number>();
    for (const code of Object.values(settings.keybinds)) {
      codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
    }
    return new Set(
      [...codeCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([code]) => code),
    );
  }, [settings.keybinds]);

  const effectiveRifleAds = (
    settings.sensitivity.look * settings.sensitivity.rifleAds
  ).toFixed(2);
  const effectiveSniperAds = (
    settings.sensitivity.look * settings.sensitivity.sniperAds
  ).toFixed(2);

  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false);
    setBindingCapture(null);
  }, []);

  return (
    <div className="lobby-screen">
      <LobbyCharacter />

      <div className="lobby-ui">
        <nav className="lobby-topbar">
          <div className="lobby-brand">
            <img
              src="/assets/branding/logo.svg"
              alt=""
              className="lobby-logo-img"
              draggable={false}
            />
            <span className="lobby-title">ZERO HOUR</span>
          </div>
          <div className="lobby-nav-tabs">
            <button
              type="button"
              className={`lobby-nav-tab ${activeTab === "play" ? "active" : ""}`}
              onClick={() => setActiveTab("play")}
            >
              PLAY
            </button>
            <button
              type="button"
              className={`lobby-nav-tab ${activeTab === "friends" ? "active" : ""}`}
              onClick={() => setActiveTab("friends")}
            >
              FRIENDS
            </button>
            <button
              type="button"
              className={`lobby-nav-tab ${activeTab === "store" ? "active" : ""}`}
              onClick={() => setActiveTab("store")}
            >
              STORE
            </button>
          </div>
          <div className="lobby-topbar-right">
            <span className="lobby-alpha-badge">ALPHA v0.1</span>
          </div>
        </nav>

        <div className="lobby-center">
          {activeTab !== "play" && (
            <div className="lobby-coming-soon-panel">
              <div className="coming-soon-icon">&#128679;</div>
              <h2 className="coming-soon-title">
                {activeTab === "friends" ? "Friends" : "Store"}
              </h2>
              <p className="coming-soon-text">
                Currently in Alpha stage. This feature is under development.
              </p>
              <span className="coming-soon-badge">COMING SOON</span>
            </div>
          )}
        </div>

        <div className="lobby-bottom">
          <button
            type="button"
            className="lobby-settings-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings</span>
          </button>

          <div className="lobby-play-section">
            <span className="lobby-mode-label">Practice Mode</span>
            <button
              type="button"
              className="lobby-play-btn"
              onClick={onStartGame}
            >
              START PRACTICE
            </button>
          </div>

          <div className="lobby-bottom-right">
            <span className="lobby-version">Low Hp Studios</span>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <div className="lobby-settings-overlay" onClick={handleSettingsClose}>
          <div
            className="lobby-settings-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Settings"
          >
            <div className="lobby-settings-header">
              <h2>{menuTitle(settingsTab)}</h2>
              <button
                type="button"
                className="lobby-settings-close"
                onClick={handleSettingsClose}
              >
                ×
              </button>
            </div>
            <div className="lobby-settings-body">
              <aside className="lobby-settings-sidebar">
                {SETTINGS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`lobby-settings-tab ${settingsTab === tab.id ? "active" : ""}`}
                    onClick={() => {
                      setSettingsTab(tab.id);
                      setBindingCapture(null);
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </aside>
              <section className="lobby-settings-content">
                {settingsTab === "gameplay" && (
                  <div className="menu-sections">
                    <MenuSection title="Look Sensitivity">
                      <RangeField
                        label="Camera / Free Look"
                        value={settings.sensitivity.look}
                        min={0.05}
                        max={3}
                        step={0.01}
                        onChange={(value) =>
                          setSettings((prev) => ({
                            ...prev,
                            sensitivity: { ...prev.sensitivity, look: value },
                          }))
                        }
                      />
                      <RangeField
                        label="Rifle ADS"
                        value={settings.sensitivity.rifleAds}
                        min={0.05}
                        max={2.5}
                        step={0.01}
                        onChange={(value) =>
                          setSettings((prev) => ({
                            ...prev,
                            sensitivity: {
                              ...prev.sensitivity,
                              rifleAds: value,
                            },
                          }))
                        }
                      />
                      <RangeField
                        label="Sniper ADS"
                        value={settings.sensitivity.sniperAds}
                        min={0.05}
                        max={2}
                        step={0.01}
                        onChange={(value) =>
                          setSettings((prev) => ({
                            ...prev,
                            sensitivity: {
                              ...prev.sensitivity,
                              sniperAds: value,
                            },
                          }))
                        }
                      />
                      <RangeField
                        label="Vertical Multiplier"
                        value={settings.sensitivity.vertical}
                        min={0.3}
                        max={2}
                        step={0.01}
                        onChange={(value) =>
                          setSettings((prev) => ({
                            ...prev,
                            sensitivity: {
                              ...prev.sensitivity,
                              vertical: value,
                            },
                          }))
                        }
                      />
                      <div className="settings-chip-wrap">
                        <span className="pill-chip">
                          Effective Rifle ADS: {effectiveRifleAds}
                        </span>
                        <span className="pill-chip">
                          Effective Sniper ADS: {effectiveSniperAds}
                        </span>
                      </div>
                    </MenuSection>
                    <MenuSection title="Field of View">
                      <RangeField
                        label="Base FOV"
                        value={settings.fov}
                        min={40}
                        max={120}
                        step={1}
                        suffix="°"
                        onChange={(value) =>
                          setSettings((prev) => ({ ...prev, fov: value }))
                        }
                      />
                    </MenuSection>
                  </div>
                )}

                {settingsTab === "audio" && (
                  <div className="menu-sections">
                    <MenuSection title="Volume Mixer">
                      <VolumeSlider
                        label="Master"
                        value={audioVolumes.master}
                        onChange={(value) =>
                          setAudioVolumes((prev) => ({
                            ...prev,
                            master: value,
                          }))
                        }
                      />
                      <VolumeSlider
                        label="Gunshots"
                        value={audioVolumes.gunshot}
                        onChange={(value) =>
                          setAudioVolumes((prev) => ({
                            ...prev,
                            gunshot: value,
                          }))
                        }
                      />
                      <VolumeSlider
                        label="Footsteps"
                        value={audioVolumes.footsteps}
                        onChange={(value) =>
                          setAudioVolumes((prev) => ({
                            ...prev,
                            footsteps: value,
                          }))
                        }
                      />
                      <VolumeSlider
                        label="Hit / Kill"
                        value={audioVolumes.hit}
                        onChange={(value) =>
                          setAudioVolumes((prev) => ({ ...prev, hit: value }))
                        }
                      />
                    </MenuSection>
                  </div>
                )}

                {settingsTab === "controls" && (
                  <div className="menu-sections">
                    <MenuSection title="Keyboard Shortcuts">
                      <div className="keybind-grid">
                        {BINDING_ROWS.map((row) => {
                          const code = settings.keybinds[row.key];
                          const duplicated = duplicateBindingCodes.has(code);
                          return (
                            <div
                              key={row.key}
                              className={`keybind-row ${bindingCapture === row.key ? "capturing" : ""} ${duplicated ? "duplicate" : ""}`}
                            >
                              <div>
                                <div className="keybind-label">{row.label}</div>
                                <div className="keybind-hint">{row.hint}</div>
                              </div>
                              <button
                                type="button"
                                className={`keybind-btn ${bindingCapture === row.key ? "active" : ""}`}
                                onClick={() =>
                                  setBindingCapture((prev) =>
                                    prev === row.key ? null : row.key,
                                  )
                                }
                              >
                                {bindingCapture === row.key
                                  ? "Press key..."
                                  : formatKeyCode(code)}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </MenuSection>
                  </div>
                )}

                {settingsTab === "graphics" && (
                  <div className="menu-sections">
                    <MenuSection title="Render Quality">
                      <SwitchRow
                        label="Shadows"
                        hint="Sun shadow maps for scene and targets"
                        checked={settings.shadows}
                        onChange={(checked) =>
                          setSettings((prev) => ({
                            ...prev,
                            shadows: checked,
                          }))
                        }
                      />
                      <SwitchRow
                        label="r3f-perf Overlay"
                        hint="Developer perf overlay"
                        checked={settings.showR3fPerf}
                        onChange={(checked) =>
                          setSettings((prev) => ({
                            ...prev,
                            showR3fPerf: checked,
                          }))
                        }
                      />
                      <div className="field-row">
                        <div>
                          <div className="field-label">Pixel Ratio</div>
                          <div className="field-hint">
                            Render scale multiplier
                          </div>
                        </div>
                        <div className="segmented-row compact">
                          {PIXEL_RATIO_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={`chip-btn ${settings.pixelRatioScale === option.value ? "active" : ""}`}
                              onClick={() =>
                                setSettings((prev) => ({
                                  ...prev,
                                  pixelRatioScale: option.value,
                                }))
                              }
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </MenuSection>
                  </div>
                )}

                {settingsTab === "hud" && (
                  <div className="menu-sections">
                    <MenuSection title="Overlay Panels">
                      {OVERLAY_ROWS.map((row) => (
                        <SwitchRow
                          key={row.key}
                          label={row.label}
                          hint={row.hint}
                          checked={hudPanels[row.key]}
                          onChange={(checked) =>
                            setHudPanels((prev) => ({
                              ...prev,
                              [row.key]: checked,
                            }))
                          }
                        />
                      ))}
                    </MenuSection>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
