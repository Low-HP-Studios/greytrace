import { useEffect, useRef } from "react";

type LobbyMusicControllerProps = {
  active: boolean;
  musicVolume: number;
};

type WindowWithPassiveListener = Window & typeof globalThis;

const LOBBY_TRACKS = [
  "/assets/audio/lobby/lobby1.mp3",
  "/assets/audio/lobby/lobby2.wav",
  "/assets/audio/lobby/lobby3.wav",
] as const;
const LOBBY_MUSIC_FADE_OUT_MS = 320;

let lobbyAudioSingleton: HTMLAudioElement | null = null;
let lobbyTrackIndex = 0;
let lobbyRetryArmed = false;
let lobbyShouldPlay = false;
let lobbyDesiredVolume = 0.2;
let lobbyFadeFrame = 0;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function cancelLobbyFade() {
  if (lobbyFadeFrame === 0) {
    return;
  }

  window.cancelAnimationFrame(lobbyFadeFrame);
  lobbyFadeFrame = 0;
}

function detachLobbyRetryListeners() {
  if (!lobbyRetryArmed || typeof window === "undefined") {
    return;
  }

  lobbyRetryArmed = false;
  const retryWindow = window as WindowWithPassiveListener;
  retryWindow.removeEventListener("pointerdown", retryLobbyPlayback);
  retryWindow.removeEventListener("keydown", retryLobbyPlayback);
}

function attachLobbyRetryListeners() {
  if (lobbyRetryArmed || typeof window === "undefined") {
    return;
  }

  lobbyRetryArmed = true;
  const retryWindow = window as WindowWithPassiveListener;
  retryWindow.addEventListener("pointerdown", retryLobbyPlayback, {
    passive: true,
  });
  retryWindow.addEventListener("keydown", retryLobbyPlayback);
}

function getLobbyAudio() {
  if (!lobbyAudioSingleton) {
    const audio = new Audio(LOBBY_TRACKS[lobbyTrackIndex]);
    audio.preload = "auto";
    audio.loop = false;
    audio.volume = lobbyDesiredVolume;
    audio.addEventListener("ended", handleLobbyTrackEnded);
    lobbyAudioSingleton = audio;
  }

  return lobbyAudioSingleton;
}

function setLobbyTrack(index: number) {
  const audio = getLobbyAudio();
  lobbyTrackIndex = (index + LOBBY_TRACKS.length) % LOBBY_TRACKS.length;
  audio.src = LOBBY_TRACKS[lobbyTrackIndex];
  audio.currentTime = 0;
  audio.load();
}

function advanceLobbyTrack() {
  setLobbyTrack(lobbyTrackIndex + 1);
}

function primeLobbyAudio() {
  const audio = getLobbyAudio();
  audio.load();
}

function syncLobbyVolume() {
  if (!lobbyAudioSingleton) {
    return;
  }
  const audio = lobbyAudioSingleton;
  audio.volume = lobbyDesiredVolume;
}

async function playLobbyAudio() {
  const audio = getLobbyAudio();
  cancelLobbyFade();
  audio.volume = lobbyDesiredVolume;

  if (!lobbyShouldPlay) {
    return;
  }

  try {
    await audio.play();
    detachLobbyRetryListeners();
  } catch {
    attachLobbyRetryListeners();
  }
}

function retryLobbyPlayback() {
  detachLobbyRetryListeners();
  void playLobbyAudio();
}

function handleLobbyTrackEnded() {
  advanceLobbyTrack();

  if (lobbyShouldPlay) {
    void playLobbyAudio();
  }
}

function fadeOutLobbyAudio() {
  if (typeof window === "undefined") {
    return;
  }

  if (!lobbyAudioSingleton) {
    return;
  }

  const audio = lobbyAudioSingleton;
  if (audio.paused || audio.volume <= 0.001) {
    audio.pause();
    audio.volume = lobbyDesiredVolume;
    return;
  }

  cancelLobbyFade();
  const startVolume = audio.volume;
  const startedAt = performance.now();

  const step = (now: number) => {
    const progress = clamp01((now - startedAt) / LOBBY_MUSIC_FADE_OUT_MS);
    audio.volume = startVolume * (1 - progress);

    if (progress < 1) {
      lobbyFadeFrame = window.requestAnimationFrame(step);
      return;
    }

    lobbyFadeFrame = 0;
    audio.pause();
    audio.volume = lobbyDesiredVolume;
  };

  lobbyFadeFrame = window.requestAnimationFrame(step);
}

export function LobbyMusicController({
  active,
  musicVolume,
}: LobbyMusicControllerProps) {
  const wasActiveRef = useRef(false);
  const hasStartedSessionRef = useRef(false);

  useEffect(() => {
    lobbyDesiredVolume = clamp01(musicVolume);
    syncLobbyVolume();
  }, [musicVolume]);

  useEffect(() => {
    if (!active) {
      wasActiveRef.current = false;
      lobbyShouldPlay = false;
      detachLobbyRetryListeners();
      fadeOutLobbyAudio();
      return;
    }

    if (!wasActiveRef.current) {
      if (hasStartedSessionRef.current) {
        advanceLobbyTrack();
      } else {
        setLobbyTrack(lobbyTrackIndex);
        hasStartedSessionRef.current = true;
      }
    }

    wasActiveRef.current = true;
    lobbyShouldPlay = true;
    primeLobbyAudio();
    void playLobbyAudio();
  }, [active]);

  useEffect(() => {
    return () => {
      lobbyShouldPlay = false;
      wasActiveRef.current = false;
      detachLobbyRetryListeners();
      cancelLobbyFade();
    };
  }, []);

  return null;
}
