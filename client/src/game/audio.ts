// Lightweight WebAudio-based sound manager for the Echo room.
// Uses a handful of real CC0 Kenney SFX samples (see public/assets/CREDITS.md)
// plus a procedurally synthesized ambient drone (no sample needed for that one).

const SFX_URLS = {
  pulse: "/assets/audio/echo-pulse.ogg",
  mark: "/assets/audio/mark-collect.ogg",
  gate: "/assets/audio/gate-open.ogg",
  caught: "/assets/audio/listener-caught.ogg",
  footstep: [
    "/assets/audio/footstep-00.ogg",
    "/assets/audio/footstep-01.ogg",
    "/assets/audio/footstep-02.ogg",
    "/assets/audio/footstep-03.ogg",
  ],
} as const;

export class GameAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneNodes: AudioNode[] = [];
  private muted = false;
  private readonly buffers = new Map<string, AudioBuffer>();
  private lastFootstepAt = 0;
  private unlocking: Promise<void> | null = null;

  /** Must be called from inside a user-gesture handler (keydown, click, etc). */
  unlock(): Promise<void> {
    if (this.ctx) return Promise.resolve();
    if (this.unlocking) return this.unlocking;
    this.unlocking = (async () => {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      this.ctx = ctx;
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.85;
      this.masterGain.connect(ctx.destination);
      this.startDrone();
      await Promise.all([
        this.loadBuffer(SFX_URLS.pulse),
        this.loadBuffer(SFX_URLS.mark),
        this.loadBuffer(SFX_URLS.gate),
        this.loadBuffer(SFX_URLS.caught),
        ...SFX_URLS.footstep.map((url) => this.loadBuffer(url)),
      ]).catch(() => undefined);
    })();
    return this.unlocking;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.08);
    }
  }

  private async loadBuffer(url: string) {
    if (!this.ctx || this.buffers.has(url)) return this.buffers.get(url);
    try {
      const res = await fetch(url);
      const data = await res.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(data);
      this.buffers.set(url, buffer);
      return buffer;
    } catch {
      return undefined;
    }
  }

  private play(url: string, gain = 1, rateJitter = 0.05) {
    const ctx = this.ctx;
    const master = this.masterGain;
    const buffer = this.buffers.get(url);
    if (!ctx || !master || !buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * rateJitter;
    const g = ctx.createGain();
    g.gain.value = gain;
    source.connect(g).connect(master);
    source.start();
  }

  playPulse() { this.play(SFX_URLS.pulse, 0.7); }
  playMark() { this.play(SFX_URLS.mark, 0.85); }
  playGate() { this.play(SFX_URLS.gate, 0.9, 0); }
  playCaught() { this.play(SFX_URLS.caught, 0.9, 0); }

  playFootstep(now: number) {
    if (now - this.lastFootstepAt < 0.34) return;
    this.lastFootstepAt = now;
    const url = SFX_URLS.footstep[Math.floor(Math.random() * SFX_URLS.footstep.length)];
    this.play(url, 0.32, 0.1);
  }

  private startDrone() {
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master) return;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.05;
    this.droneGain.connect(master);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 220;
    filter.connect(this.droneGain);

    [55, 55 * 1.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.02;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 4;
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.connect(filter);
      osc.start();
      lfo.start();
      this.droneNodes.push(osc, lfo);
    });
  }

  dispose() {
    this.droneNodes.forEach((node) => {
      if (node instanceof OscillatorNode) {
        try { node.stop(); } catch { /* already stopped */ }
      }
      node.disconnect();
    });
    this.droneNodes = [];
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.masterGain = null;
    this.droneGain = null;
    this.buffers.clear();
    this.unlocking = null;
  }
}
