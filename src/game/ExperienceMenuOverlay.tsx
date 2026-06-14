import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHARACTER_REGISTRY,
  getCharacterById,
  isCharacterSelectable,
} from "./characters";
import { SKY_OPTIONS, getSkyById, type SkyId } from "./sky-registry";
import { PRACTICE_MAP_OPTIONS, getPracticeMapById } from "./scene/practice-maps";
import type { MapId } from "./types";

type ExperienceMenuOverlayProps = {
  onEnterPractice: () => void;
  onOpenSettings: () => void;
  updateReadyToInstall: boolean;
  updateTargetVersion?: string;
  installingUpdate: boolean;
  onInstallUpdate: () => void;
  selectedCharacterId: string;
  onCharacterSelect: (characterId: string) => void;
  selectedSkyId: SkyId;
  onSkySelect: (skyId: SkyId) => void;
  selectedMapId: MapId;
  onMapSelect: (mapId: MapId) => void;
  updaterStatus: UpdaterStatusPayload;
  updaterBusyAction: "check" | "install" | "repair" | null;
  updaterAvailable: boolean;
  onCheckForUpdates: () => void;
};

type LobbyTab = "play" | "collection" | "updates";
type CollectionTab = "characters" | "skies";

type NavItem = {
  id: LobbyTab;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: "play", label: "Play" },
  { id: "collection", label: "Collection" },
  { id: "updates", label: "Updates" },
];

// Ring buffer of speed samples for the download graph
const SPEED_SAMPLES = 40;
const MANUAL_RELEASES_URL = "https://github.com/Low-HP-Studios/greytrace/releases";

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      className="btn-icon-expressive"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function getCatalogMonogram(label: string) {
  return label
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function formatCatalogIndex(index: number) {
  return String(index + 1).padStart(2, "0");
}

function LobbyFpsCounter() {
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafIdRef = useRef(0);

  useEffect(() => {
    const loop = () => {
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastTimeRef.current >= 1000) {
        setFps(Math.round(frameCountRef.current * 1000 / (now - lastTimeRef.current)));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      rafIdRef.current = requestAnimationFrame(loop);
    };
    rafIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  return <div className="lobby-fps-counter">{fps} fps</div>;
}

// SVG sparkline for download speed history
function DownloadSpeedGraph({ samples }: { samples: number[] }) {
  const W = 360;
  const H = 72;
  const pad = 4;

  if (samples.length < 2) {
    return (
      <div className="updates-graph-wrap-v2">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2}
            stroke="rgba(147,220,192,0.12)" strokeWidth="1" strokeDasharray="4 4" />
        </svg>
        <span className="updates-graph-idle-v2">No download activity</span>
      </div>
    );
  }

  const max = Math.max(...samples, 0.01);
  const pts = samples.map((v, i) => {
    const x = pad + (i / (samples.length - 1)) * (W - pad * 2);
    const y = H - pad - (v / max) * (H - pad * 2);
    return `${x},${y}`;
  });

  const polyline = pts.join(" ");
  const areaPoints = [
    `${pad},${H - pad}`,
    ...pts,
    `${W - pad},${H - pad}`,
  ].join(" ");

  const currentRate = samples[samples.length - 1] ?? 0;

  return (
    <div className="updates-graph-wrap-v2">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="speed-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93dcc0" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#93dcc0" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#speed-grad)" />
        <polyline points={polyline} fill="none" stroke="#93dcc0" strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="updates-graph-rate-v2">
        {currentRate.toFixed(1)} <em>%/s</em>
      </span>
    </div>
  );
}

export function ExperienceMenuOverlay({
  onEnterPractice,
  onOpenSettings,
  updateReadyToInstall,
  updateTargetVersion,
  installingUpdate,
  onInstallUpdate,
  selectedCharacterId,
  onCharacterSelect,
  selectedSkyId,
  onSkySelect,
  selectedMapId,
  onMapSelect,
  updaterStatus,
  updaterBusyAction,
  updaterAvailable,
  onCheckForUpdates,
}: ExperienceMenuOverlayProps) {
  const [activeTab, setActiveTab] = useState<LobbyTab>("play");
  const [collectionTab, setCollectionTab] = useState<CollectionTab>("characters");

  // Track download speed as %/sec samples
  const speedSamplesRef = useRef<number[]>([]);
  const lastProgressRef = useRef<{ progress: number; time: number } | null>(null);
  const [speedSamples, setSpeedSamples] = useState<number[]>([]);

  useEffect(() => {
    if (updaterStatus.phase !== "downloading" || typeof updaterStatus.progress !== "number") {
      if (updaterStatus.phase !== "downloading") {
        lastProgressRef.current = null;
      }
      return;
    }

    const now = performance.now();
    const current = updaterStatus.progress;

    if (lastProgressRef.current !== null) {
      const dt = (now - lastProgressRef.current.time) / 1000;
      if (dt > 0.05) {
        const rate = (current - lastProgressRef.current.progress) / dt;
        const clamped = Math.max(0, rate);
        const next = [...speedSamplesRef.current, clamped].slice(-SPEED_SAMPLES);
        speedSamplesRef.current = next;
        setSpeedSamples([...next]);
        lastProgressRef.current = { progress: current, time: now };
      }
    } else {
      lastProgressRef.current = { progress: current, time: now };
    }
  }, [updaterStatus.phase, updaterStatus.progress]);

  const handleCharacterAction = useCallback((characterId: string) => {
    if (!isCharacterSelectable(characterId)) {
      return;
    }
    onCharacterSelect(characterId);
  }, [onCharacterSelect]);

  const selectedCharacterDef = getCharacterById(selectedCharacterId);
  const selectedCharacterIndex = Math.max(
    0,
    CHARACTER_REGISTRY.findIndex((char) => char.id === selectedCharacterId),
  );
  const selectedSky = getSkyById(selectedSkyId);
  const selectedSkyIndex = Math.max(
    0,
    SKY_OPTIONS.findIndex((sky) => sky.id === selectedSkyId),
  );
  const selectedMap = getPracticeMapById(selectedMapId);

  const isDownloading = updaterStatus.phase === "downloading";
  const progress = typeof updaterStatus.progress === "number" ? updaterStatus.progress : null;
  const platformLabel = window.electronAPI?.platform ?? "web";
  const isMacPlatform = platformLabel === "darwin" ||
    platformLabel.toLowerCase().includes("mac");
  const selectedCharacterMonogram = getCatalogMonogram(
    selectedCharacterDef.displayName,
  );
  const selectedSkyMonogram = getCatalogMonogram(selectedSky.label);

  return (
    <div className="lobby-layout-v2 lobby-layout-v3">
      <header className="lobby-topbar-v2">
        <div className="lobby-brand-v2">
          <h1 className="lobby-logo-v2">GrayTrace</h1>
          <span className="lobby-alpha-chip-v2">β</span>
          {updateReadyToInstall && (
            <button
              type="button"
              className="lobby-update-ready-btn-v2"
              onClick={onInstallUpdate}
              disabled={installingUpdate}
            >
              {installingUpdate
                ? "Restarting..."
                : `Restart to install${updateTargetVersion ? ` ${updateTargetVersion}` : ""}`}
            </button>
          )}
        </div>

        <nav className="lobby-nav-v2" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`lobby-nav-btn-v2 ${activeTab === item.id ? "active" : ""}${item.id === "updates" && isDownloading ? " downloading" : ""}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.label}
              {item.id === "updates" && isDownloading && (
                <span className="lobby-nav-dl-dot-v2" />
              )}
            </button>
          ))}
        </nav>

        <div className="lobby-utilities-v2">
          <button
            type="button"
            className="lobby-settings-btn-v2"
            onClick={onOpenSettings}
            aria-label="Settings"
          >
            <SettingsIcon />
            <span>Settings</span>
          </button>
        </div>
      </header>

      <main className="lobby-main-v2">
        {activeTab === "play" && (
          <div className="lobby-play-stage-v3">
            <section className="lobby-panel-v3 lobby-play-hero-v3">
              <div className="lobby-map-grid-v3" role="group" aria-label="Practice maps">
                {PRACTICE_MAP_OPTIONS.map((option) => {
                  const selected = selectedMapId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`lobby-map-card-v3 ${selected ? "selected" : ""}`}
                      aria-pressed={selected}
                      aria-label={`${option.label} map${selected ? ", selected" : ""}`}
                      onClick={() => onMapSelect(option.id)}
                    >
                      <span className="lobby-map-card-title-v3">{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="lobby-play-btn-v2 lobby-play-command-v3"
                data-controller-default-focus="true"
                onClick={onEnterPractice}
              >
                <span>Enter {selectedMap.label}</span>
                <ArrowIcon />
              </button>
            </section>
          </div>
        )}

        {activeTab === "collection" && (
          <div className="lobby-collection-v2 lobby-collection-v3">
            <div className="lobby-collection-list-v2 lobby-panel-v3">
              <div className="lobby-collection-list-header-v2">
                <h2>{collectionTab === "characters" ? "Characters" : "Skies"}</h2>
                <span className="lobby-collection-count-v2">
                  {collectionTab === "characters" ? CHARACTER_REGISTRY.length : SKY_OPTIONS.length}
                </span>
              </div>
              <div className="lobby-collection-catalog-tabs-v3" role="tablist" aria-label="Collection categories">
                <button
                  type="button"
                  role="tab"
                  aria-selected={collectionTab === "characters"}
                  className={`lobby-collection-catalog-tab-v3 ${collectionTab === "characters" ? "active" : ""}`}
                  onClick={() => setCollectionTab("characters")}
                >
                  Characters
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={collectionTab === "skies"}
                  className={`lobby-collection-catalog-tab-v3 ${collectionTab === "skies" ? "active" : ""}`}
                  onClick={() => setCollectionTab("skies")}
                >
                  Skies
                </button>
              </div>
              <div className="lobby-collection-grid-v2">
                {collectionTab === "characters"
                  ? CHARACTER_REGISTRY.map((char, index) => {
                    const isEquipped = selectedCharacterId === char.id;
                    return (
                      <button
                        key={char.id}
                        type="button"
                        className={`lobby-char-card-v2 ${isEquipped ? "equipped" : ""}`.trim()}
                        onClick={() => handleCharacterAction(char.id)}
                        aria-pressed={isEquipped}
                      >
                        <span className="lobby-char-index-v3">
                          {formatCatalogIndex(index)}
                        </span>
                        <span className="lobby-char-name-v2">{char.displayName}</span>
                        <span className="lobby-char-equipped-v2">
                          {isEquipped ? "Equipped" : "Equip"}
                        </span>
                      </button>
                    );
                  })
                  : SKY_OPTIONS.map((sky) => (
                    <button
                      key={sky.id}
                      type="button"
                      className={`lobby-sky-card-v3 ${selectedSkyId === sky.id ? "equipped" : ""}`}
                      onClick={() => onSkySelect(sky.id)}
                    >
                      <span className="lobby-sky-name-v3">{sky.label}</span>
                      <span className="lobby-sky-copy-v3">{sky.description}</span>
                      {selectedSkyId === sky.id && (
                        <span className="lobby-char-equipped-v2">Equipped</span>
                      )}
                    </button>
                  ))}
              </div>
            </div>
            {collectionTab === "characters"
              ? (
                <section className="lobby-panel-v3 lobby-character-dossier-v3">
                  <div className="lobby-character-mark-v3">
                    {selectedCharacterMonogram}
                  </div>
                  <span className="lobby-section-label-v3">Selected Operative</span>
                  <h2 className="lobby-character-title-v3">{selectedCharacterDef.displayName}</h2>
                  <p className="lobby-character-copy-v3">
                    Select any operative for the lobby and practice targets.
                  </p>
                  <div className="lobby-character-facts-v3">
                    <article className="lobby-meta-card-v3">
                      <span>Registry</span>
                      <strong>
                        {formatCatalogIndex(selectedCharacterIndex)}/{CHARACTER_REGISTRY.length}
                      </strong>
                    </article>
                    <article className="lobby-meta-card-v3">
                      <span>Status</span>
                      <strong>Equipped</strong>
                    </article>
                    <article className="lobby-meta-card-v3">
                      <span>Presentation</span>
                      <strong>Noir live feed</strong>
                    </article>
                  </div>
                </section>
              )
              : (
                <section className="lobby-panel-v3 lobby-character-dossier-v3 lobby-sky-dossier-v3">
                  <div className="lobby-character-mark-v3 lobby-sky-mark-v3">
                    {selectedSkyMonogram}
                  </div>
                  <span className="lobby-section-label-v3">Active Sky</span>
                  <h2 className="lobby-character-title-v3">{selectedSky.label}</h2>
                  <p className="lobby-character-copy-v3">
                    {selectedSky.description} Clicking a card swaps the live lobby backdrop
                    immediately, because extra confirmation buttons are just paperwork in disguise.
                  </p>
                  <div className="lobby-character-facts-v3">
                    <article className="lobby-meta-card-v3">
                      <span>Registry</span>
                      <strong>
                        {formatCatalogIndex(selectedSkyIndex)}/{SKY_OPTIONS.length}
                      </strong>
                    </article>
                    <article className="lobby-meta-card-v3">
                      <span>Status</span>
                      <strong>Equipped</strong>
                    </article>
                    <article className="lobby-meta-card-v3">
                      <span>Scope</span>
                      <strong>Lobby + Practice</strong>
                    </article>
                  </div>
                </section>
              )}
          </div>
        )}

        {activeTab === "updates" && (
          <div className="updates-page-v2 updates-page-v3">
            <section className="updates-shell-v3">
              <div className="updates-hero-v3">
                <span className="lobby-section-label-v3">Build Channel</span>
                <div className="updates-title-row-v3">
                  <h2 className="updates-title-v3">Updates</h2>
                  <span className={`updates-status-pill-v3 phase-${updaterStatus.phase}`}>
                    {updaterStatus.phase}
                  </span>
                </div>
                <p className="updates-copy-v3">
                  Keep GreyTrace current. Auto-update stays available where the signed
                  installer flow supports it.
                </p>
              </div>

              <div className="updates-actions-v2">
                <button
                  type="button"
                  className="updates-action-btn-v2"
                  onClick={onCheckForUpdates}
                  disabled={!updaterAvailable || updaterBusyAction !== null}
                >
                  {updaterBusyAction === "check" ? "Checking..." : "Check for updates"}
                </button>
                <button
                  type="button"
                  className="updates-action-btn-v2 primary"
                  onClick={onInstallUpdate}
                  disabled={!updaterAvailable || !updateReadyToInstall || updaterBusyAction !== null}
                >
                  {updaterBusyAction === "install" ? "Installing..." : "Restart to install"}
                </button>
                <button
                  type="button"
                  className="updates-action-btn-v2 danger"
                  disabled
                  title="Cancel not yet supported by the updater API"
                >
                  Cancel download
                </button>
              </div>
            </section>

            {isMacPlatform && (
              <section className="updates-manual-card-v3">
                <div>
                  <span className="updates-manual-kicker-v3">macOS manual install</span>
                  <p>
                    Automatic updates can fail on macOS while the app is unsigned.
                    Continue with manual installs from GitHub Releases.
                  </p>
                </div>
                <a
                  className="updates-manual-link-v3"
                  href={MANUAL_RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open releases
                  <ArrowIcon />
                </a>
              </section>
            )}

            <section className="updates-version-grid-v2" aria-label="Update details">
              <div className="updates-metric-v2">
                <span>Current build</span>
                <strong>{updaterStatus.currentVersion}</strong>
              </div>
              <div className="updates-metric-v2">
                <span>Latest known</span>
                <strong>{updaterStatus.targetVersion ?? "—"}</strong>
              </div>
              <div className="updates-metric-v2">
                <span>Platform</span>
                <strong>{platformLabel}</strong>
              </div>
              <div className="updates-metric-v2">
                <span>Install state</span>
                <strong className={`updates-phase-label-v2 phase-${updaterStatus.phase}`}>
                  {updateReadyToInstall ? "Ready" : updaterStatus.phase}
                </strong>
              </div>
            </section>

            <section className="updates-download-section-v2">
              <div className="updates-download-header-v2">
                <span className="updates-download-title-v2">Download progress</span>
                <span className="updates-download-pct-v2">
                  {progress !== null ? `${progress.toFixed(1)}%` : "Idle"}
                </span>
              </div>
              <div className="updates-progress-bar-v2">
                <div
                  className="updates-progress-fill-v2"
                  style={{ width: `${progress ?? 0}%` }}
                />
              </div>
              <DownloadSpeedGraph samples={speedSamples} />

              {isDownloading && (
                <p className="updates-download-note-v2">
                  Downloading update — do not quit the application.
                </p>
              )}
            </section>

            {updaterStatus.message && (
              <p className="updates-message-v2">{updaterStatus.message}</p>
            )}

            {!updaterAvailable && (
              <p className="updates-warning-v2">
                Updater API unavailable — running outside Electron or preload not loaded.
              </p>
            )}
          </div>
        )}
      </main>

      <LobbyFpsCounter />
    </div>
  );
}
