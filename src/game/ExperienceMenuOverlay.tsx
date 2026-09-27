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
  selectedCharacterId: string;
  onCharacterSelect: (characterId: string) => void;
  selectedSkyId: SkyId;
  onSkySelect: (skyId: SkyId) => void;
  selectedMapId: MapId;
  onMapSelect: (mapId: MapId) => void;
};

type LobbyTab = "play" | "collection";
type CollectionTab = "characters" | "skies";

type NavItem = {
  id: LobbyTab;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: "play", label: "Play" },
  { id: "collection", label: "Collection" },
];

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
export function ExperienceMenuOverlay({
  onEnterPractice,
  onOpenSettings,
  selectedCharacterId,
  onCharacterSelect,
  selectedSkyId,
  onSkySelect,
  selectedMapId,
  onMapSelect,
}: ExperienceMenuOverlayProps) {
  const [activeTab, setActiveTab] = useState<LobbyTab>("play");
  const [collectionTab, setCollectionTab] = useState<CollectionTab>("characters");

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
        </div>

        <nav className="lobby-nav-v2" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`lobby-nav-btn-v2 ${activeTab === item.id ? "active" : ""}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.label}
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

      </main>

      <LobbyFpsCounter />
    </div>
  );
}
