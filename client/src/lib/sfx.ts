// Sentezlenmiş oyun efektleri (Web Audio API) — hiçbir harici ses dosyasına bağımlı değil,
// bu yüzden lisans/asset-pipeline riski taşımaz. Yalnız `enabled` true iken ve tarayıcı
// AudioContext destekliyorsa ses üretir; ilk çağrıda lazy olarak tek bir context açılır.

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedContext) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    sharedContext = new Ctor();
  }
  if (sharedContext.state === "suspended") sharedContext.resume().catch(() => {});
  return sharedContext;
}

function tone(freq: number, duration: number, type: OscillatorType, peakGain: number, when = 0, glideTo?: number) {
  const audio = getContext();
  if (!audio) return;
  const start = audio.currentTime + when;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + Math.min(.012, duration * .3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + .02);
}

export function playStamp(enabled: boolean, comboLevel = 0) {
  if (!enabled) return;
  const freq = 640 + Math.min(comboLevel, 9) * 42;
  tone(freq, .09, "triangle", .16);
  tone(freq * 1.5, .07, "sine", .09, .02);
}

export function playHit(enabled: boolean) {
  if (!enabled) return;
  tone(170, .22, "sawtooth", .2, 0, 55);
  tone(85, .18, "square", .13, .02, 40);
}

export function playThrust(enabled: boolean) {
  if (!enabled) return;
  tone(210, .06, "square", .035);
}

export function playComplete(enabled: boolean) {
  if (!enabled) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => tone(freq, .17, "triangle", .15, index * .09));
}

export function playFail(enabled: boolean) {
  if (!enabled) return;
  tone(220, .45, "sawtooth", .16, 0, 60);
}
