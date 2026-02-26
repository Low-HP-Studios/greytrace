import { loadAudioBuffer } from "./AssetLoader";
import type { WeaponKind } from "./Weapon";

export type AudioVolumeSettings = {
  master: number;
  gunshot: number;
  footsteps: number;
  hit: number;
};

type LoadedBuffers = {
  gunshot: AudioBuffer | null;
  footstep: AudioBuffer | null;
  hit: AudioBuffer | null;
};

export const DEFAULT_AUDIO_VOLUMES: AudioVolumeSettings = {
  master: 0.8,
  gunshot: 0.85,
  footsteps: 0.32,
  hit: 0.42,
};

export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private gunGain: GainNode | null = null;
  private footstepGain: GainNode | null = null;
  private hitGain: GainNode | null = null;
  private gunVoicePool: GainNode[] = [];
  private nextGunVoiceIndex = 0;
  private buffers: LoadedBuffers = {
    gunshot: null,
    footstep: null,
    hit: null,
  };
  private volumes: AudioVolumeSettings = { ...DEFAULT_AUDIO_VOLUMES };
  private nextFootstepAtSeconds = 0;
  private whiteNoiseBuffer: AudioBuffer | null = null;

  ensureStarted() {
    if (!this.context) {
      const ContextCtor = getAudioContextConstructor();
      if (!ContextCtor) {
        return;
      }

      this.context = new ContextCtor();
      this.masterGain = this.context.createGain();
      this.gunGain = this.context.createGain();
      this.footstepGain = this.context.createGain();
      this.hitGain = this.context.createGain();

      this.masterGain.connect(this.context.destination);
      this.gunGain.connect(this.masterGain);
      this.footstepGain.connect(this.masterGain);
      this.hitGain.connect(this.masterGain);

      this.gunVoicePool = Array.from({ length: 8 }, () => {
        const voiceGain = this.context!.createGain();
        voiceGain.gain.value = 0;
        voiceGain.connect(this.gunGain!);
        return voiceGain;
      });

      this.applyVolumeSettings();
      this.whiteNoiseBuffer = createWhiteNoiseBuffer(this.context, 0.2);
      void this.preloadBuffers();
    }

    if (this.context.state !== "running") {
      void this.context.resume();
    }
  }

  setVolumes(next: Partial<AudioVolumeSettings>) {
    this.volumes = {
      ...this.volumes,
      ...next,
    };
    this.applyVolumeSettings();
  }

  update(nowSeconds: number, moving: boolean, sprinting: boolean) {
    if (!this.context || this.context.state !== "running") {
      return;
    }

    if (!moving) {
      this.nextFootstepAtSeconds = 0;
      return;
    }

    if (this.nextFootstepAtSeconds <= 0) {
      this.nextFootstepAtSeconds = nowSeconds;
    }

    const stepInterval = sprinting ? 0.27 : 0.4;
    if (nowSeconds >= this.nextFootstepAtSeconds) {
      this.playFootstepInternal(sprinting);
      this.nextFootstepAtSeconds = nowSeconds + stepInterval;
    }
  }

  playGunshot(kind: WeaponKind = "rifle") {
    if (!this.context || this.context.state !== "running" || !this.gunGain) {
      return;
    }

    const now = this.context.currentTime;
    const voice = this.gunVoicePool[this.nextGunVoiceIndex];
    this.nextGunVoiceIndex = (this.nextGunVoiceIndex + 1) % this.gunVoicePool.length;

    voice.gain.cancelScheduledValues(now);
    voice.gain.setValueAtTime(0, now);

    if (this.buffers.gunshot) {
      const source = this.context.createBufferSource();
      source.buffer = this.buffers.gunshot;
      source.playbackRate.value =
        kind === "sniper"
          ? 0.66 + Math.random() * 0.06
          : 0.96 + Math.random() * 0.1;
      source.connect(voice);
      voice.gain.setValueAtTime(1, now);
      voice.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "sniper" ? 0.32 : 0.18));
      source.start(now);
      source.stop(now + Math.min(kind === "sniper" ? 0.5 : 0.35, source.buffer.duration));
      return;
    }

    if (kind === "sniper") {
      voice.gain.setValueAtTime(1, now);
      voice.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      const thump = this.context.createOscillator();
      const thumpGain = this.context.createGain();
      thump.type = "triangle";
      thump.frequency.setValueAtTime(130 + Math.random() * 18, now);
      thump.frequency.exponentialRampToValueAtTime(42, now + 0.14);
      thumpGain.gain.setValueAtTime(0.001, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.5, now + 0.004);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      thump.connect(thumpGain);
      thumpGain.connect(voice);
      thump.start(now);
      thump.stop(now + 0.18);

      const crack = this.context.createOscillator();
      const crackGain = this.context.createGain();
      crack.type = "square";
      crack.frequency.setValueAtTime(880 + Math.random() * 110, now);
      crack.frequency.exponentialRampToValueAtTime(220, now + 0.045);
      crackGain.gain.setValueAtTime(0.001, now);
      crackGain.gain.exponentialRampToValueAtTime(0.22, now + 0.002);
      crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      crack.connect(crackGain);
      crackGain.connect(voice);
      crack.start(now);
      crack.stop(now + 0.06);

      if (this.whiteNoiseBuffer) {
        const noiseSource = this.context.createBufferSource();
        noiseSource.buffer = this.whiteNoiseBuffer;
        const highpass = this.context.createBiquadFilter();
        const noiseGain = this.context.createGain();
        highpass.type = "highpass";
        highpass.frequency.value = 1400;
        noiseGain.gain.setValueAtTime(0.001, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.38, now + 0.003);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
        noiseSource.connect(highpass);
        highpass.connect(noiseGain);
        noiseGain.connect(voice);
        noiseSource.start(now);
        noiseSource.stop(now + 0.09);
      }
      return;
    }

    voice.gain.setValueAtTime(1, now);
    voice.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    const osc = this.context.createOscillator();
    const oscGain = this.context.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.07);
    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.exponentialRampToValueAtTime(0.35, now + 0.005);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(oscGain);
    oscGain.connect(voice);

    if (this.whiteNoiseBuffer) {
      const noiseSource = this.context.createBufferSource();
      noiseSource.buffer = this.whiteNoiseBuffer;
      const bandpass = this.context.createBiquadFilter();
      const noiseGain = this.context.createGain();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 1600 + Math.random() * 600;
      bandpass.Q.value = 0.6;
      noiseGain.gain.setValueAtTime(0.001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.55, now + 0.003);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      noiseSource.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(voice);
      noiseSource.start(now);
      noiseSource.stop(now + 0.07);
    }

    osc.start(now);
    osc.stop(now + 0.09);
  }

  playHit(kind: "body" | "head" = "body") {
    if (!this.context || this.context.state !== "running" || !this.hitGain) {
      return;
    }

    const now = this.context.currentTime;

    if (this.buffers.hit) {
      const source = this.context.createBufferSource();
      source.buffer = this.buffers.hit;
      source.playbackRate.value =
        kind === "head"
          ? 1.2 + Math.random() * 0.08
          : 0.95 + Math.random() * 0.15;
      const gain = this.context.createGain();
      gain.gain.value = kind === "head" ? 1.05 : 0.9;
      source.connect(gain);
      gain.connect(this.hitGain);
      source.start(now);
      source.stop(now + Math.min(0.2, source.buffer.duration));
      return;
    }

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(kind === "head" ? 1120 : 720, now);
    osc.frequency.exponentialRampToValueAtTime(kind === "head" ? 620 : 480, now + 0.05);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(kind === "head" ? 0.32 : 0.25, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.hitGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playKill() {
    if (!this.context || this.context.state !== "running" || !this.hitGain) {
      return;
    }

    const now = this.context.currentTime;
    const gain = this.context.createGain();
    gain.gain.value = 0.55;
    gain.connect(this.hitGain);

    const low = this.context.createOscillator();
    low.type = "triangle";
    low.frequency.setValueAtTime(420, now);
    low.frequency.exponentialRampToValueAtTime(520, now + 0.05);
    const lowGain = this.context.createGain();
    lowGain.gain.setValueAtTime(0.001, now);
    lowGain.gain.exponentialRampToValueAtTime(0.16, now + 0.006);
    lowGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    low.connect(lowGain);
    lowGain.connect(gain);

    const high = this.context.createOscillator();
    high.type = "sine";
    high.frequency.setValueAtTime(980, now + 0.028);
    high.frequency.exponentialRampToValueAtTime(1240, now + 0.085);
    const highGain = this.context.createGain();
    highGain.gain.setValueAtTime(0.001, now + 0.02);
    highGain.gain.exponentialRampToValueAtTime(0.2, now + 0.03);
    highGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    high.connect(highGain);
    highGain.connect(gain);

    low.start(now);
    low.stop(now + 0.1);
    high.start(now + 0.018);
    high.stop(now + 0.13);
  }

  dispose() {
    this.gunVoicePool = [];
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
    this.masterGain = null;
    this.gunGain = null;
    this.footstepGain = null;
    this.hitGain = null;
    this.whiteNoiseBuffer = null;
    this.nextFootstepAtSeconds = 0;
  }

  private async preloadBuffers() {
    if (!this.context) {
      return;
    }

    const [gunshot, footstep, hit] = await Promise.all([
      loadAudioBuffer(this.context, "/assets/audio/gunshot.wav"),
      loadAudioBuffer(this.context, "/assets/audio/footstep.wav"),
      loadAudioBuffer(this.context, "/assets/audio/hit.wav"),
    ]);

    this.buffers = {
      gunshot,
      footstep,
      hit,
    };
  }

  private playFootstepInternal(sprinting: boolean) {
    if (!this.context || this.context.state !== "running" || !this.footstepGain) {
      return;
    }

    const now = this.context.currentTime;
    const stepGainBoost = sprinting ? 1.18 : 1;

    if (this.buffers.footstep) {
      const source = this.context.createBufferSource();
      source.buffer = this.buffers.footstep;
      source.playbackRate.value = sprinting ? 1.18 : 0.9;
      const gain = this.context.createGain();
      const tone = this.context.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = sprinting ? 1500 : 1100;
      gain.gain.value = sprinting ? 0.34 : 0.26;
      source.connect(tone);
      tone.connect(gain);
      gain.connect(this.footstepGain);
      source.start(now);
      source.stop(now + Math.min(0.14, source.buffer.duration));
    }

    const heel = this.context.createOscillator();
    const heelGain = this.context.createGain();
    const heelFilter = this.context.createBiquadFilter();
    heel.type = "triangle";
    heel.frequency.setValueAtTime(sprinting ? 112 : 88, now);
    heel.frequency.exponentialRampToValueAtTime(42, now + 0.055);
    heelFilter.type = "lowpass";
    heelFilter.frequency.value = 240;
    heelGain.gain.setValueAtTime(0.001, now);
    heelGain.gain.exponentialRampToValueAtTime((sprinting ? 0.11 : 0.08) * stepGainBoost, now + 0.004);
    heelGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    heel.connect(heelFilter);
    heelFilter.connect(heelGain);
    heelGain.connect(this.footstepGain);
    heel.start(now);
    heel.stop(now + 0.08);

    if (this.whiteNoiseBuffer) {
      const crunch = this.context.createBufferSource();
      crunch.buffer = this.whiteNoiseBuffer;
      crunch.playbackRate.value = sprinting ? 1.35 + Math.random() * 0.2 : 1.02 + Math.random() * 0.18;
      const crunchHigh = this.context.createBiquadFilter();
      const crunchBand = this.context.createBiquadFilter();
      const crunchLow = this.context.createBiquadFilter();
      const crunchGain = this.context.createGain();
      crunchHigh.type = "highpass";
      crunchHigh.frequency.value = sprinting ? 260 : 220;
      crunchBand.type = "bandpass";
      crunchBand.frequency.value = 1400 + Math.random() * 700;
      crunchBand.Q.value = 0.75;
      crunchLow.type = "lowpass";
      crunchLow.frequency.value = 2800;
      crunchGain.gain.setValueAtTime(0.001, now);
      crunchGain.gain.exponentialRampToValueAtTime((sprinting ? 0.18 : 0.13) * stepGainBoost, now + 0.005);
      crunchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
      crunch.connect(crunchHigh);
      crunchHigh.connect(crunchBand);
      crunchBand.connect(crunchLow);
      crunchLow.connect(crunchGain);
      crunchGain.connect(this.footstepGain);
      crunch.start(now);
      crunch.stop(now + 0.1);

      const scrape = this.context.createBufferSource();
      scrape.buffer = this.whiteNoiseBuffer;
      scrape.playbackRate.value = sprinting ? 0.95 : 0.8;
      const scrapeHigh = this.context.createBiquadFilter();
      const scrapeLow = this.context.createBiquadFilter();
      const scrapeGain = this.context.createGain();
      scrapeHigh.type = "highpass";
      scrapeHigh.frequency.value = 120;
      scrapeLow.type = "lowpass";
      scrapeLow.frequency.value = 760;
      scrapeGain.gain.setValueAtTime(0.001, now + 0.01);
      scrapeGain.gain.exponentialRampToValueAtTime((sprinting ? 0.08 : 0.055) * stepGainBoost, now + 0.02);
      scrapeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      scrape.connect(scrapeHigh);
      scrapeHigh.connect(scrapeLow);
      scrapeLow.connect(scrapeGain);
      scrapeGain.connect(this.footstepGain);
      scrape.start(now);
      scrape.stop(now + 0.11);
    }

    if (Math.random() < 0.45) {
      const grit = this.context.createOscillator();
      const gritGain = this.context.createGain();
      grit.type = "triangle";
      grit.frequency.setValueAtTime(1700 + Math.random() * 800, now);
      grit.frequency.exponentialRampToValueAtTime(820 + Math.random() * 240, now + 0.03);
      gritGain.gain.setValueAtTime(0.001, now);
      gritGain.gain.exponentialRampToValueAtTime((sprinting ? 0.03 : 0.02) * stepGainBoost, now + 0.003);
      gritGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
      grit.connect(gritGain);
      gritGain.connect(this.footstepGain);
      grit.start(now);
      grit.stop(now + 0.04);
    }
  }

  private applyVolumeSettings() {
    if (!this.masterGain || !this.gunGain || !this.footstepGain || !this.hitGain) {
      return;
    }

    this.masterGain.gain.value = this.volumes.master;
    this.gunGain.gain.value = this.volumes.gunshot;
    this.footstepGain.gain.value = this.volumes.footsteps;
    this.hitGain.gain.value = this.volumes.hit;
  }
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const maybeWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  return globalThis.AudioContext ?? maybeWindow.webkitAudioContext ?? null;
}

function createWhiteNoiseBuffer(context: AudioContext, lengthSeconds: number): AudioBuffer {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * lengthSeconds));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
  }

  return buffer;
}
