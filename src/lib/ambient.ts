// Ambient soundscapes: real looped recordings for nature/café, synthesized noise for white/brown.
import type { AmbientSound } from './types';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let nodes: AudioNode[] = [];
let timers: ReturnType<typeof setTimeout>[] = [];
let current: AmbientSound = 'none';

const getCtx = () => {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
};

type NoiseColor = 'white' | 'pink' | 'brown';
function noiseBuffer(c: AudioContext, color: NoiseColor, seconds = 4) {
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'white') d[i] = w * 0.5;
      else if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    }
  }
  return buf;
}

function noiseSource(c: AudioContext, color: NoiseColor) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, color);
  src.loop = true;
  src.start();
  nodes.push(src);
  return src;
}

function filter(c: AudioContext, type: BiquadFilterType, freq: number, q = 0.7) {
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  nodes.push(f);
  return f;
}

function gain(c: AudioContext, v: number) {
  const g = c.createGain();
  g.gain.value = v;
  nodes.push(g);
  return g;
}

// Real field recordings (Mixkit free license), pre-trimmed into seamless loops
// with a baked-in crossfade and normalized to the same loudness. See public/sounds.
const SAMPLED: Partial<Record<AmbientSound, string>> = {
  rain: 'sounds/rain.ogg',
  ocean: 'sounds/ocean.ogg',
  forest: 'sounds/forest.ogg',
  fire: 'sounds/fire.ogg',
  cafe: 'sounds/cafe.ogg',
};
const bufferCache = new Map<string, Promise<AudioBuffer>>();
function loadBuffer(c: AudioContext, path: string) {
  let p = bufferCache.get(path);
  if (!p) {
    p = fetch(`/${path}`)
      .then((r) => { if (!r.ok) throw new Error(`${r.status} ${path}`); return r.arrayBuffer(); })
      .then((b) => c.decodeAudioData(b));
    p.catch(() => bufferCache.delete(path));
    bufferCache.set(path, p);
  }
  return p;
}

function build(c: AudioContext, sound: AmbientSound, out: AudioNode) {
  const sample = SAMPLED[sound];
  if (sample) {
    const token = out;
    void loadBuffer(c, sample).then((buf) => {
      if (master !== token) return; // switched or stopped while loading
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const fade = gain(c, 0);
      fade.gain.linearRampToValueAtTime(1, c.currentTime + 1.2);
      src.connect(fade).connect(out);
      src.start();
      nodes.push(src);
    }).catch((e) => console.warn('[ambient] failed to load', sample, e));
    return;
  }
  switch (sound) {
    case 'white':
      noiseSource(c, 'white').connect(filter(c, 'lowpass', 9000)).connect(gain(c, 0.35)).connect(out);
      break;
    case 'brown':
      noiseSource(c, 'brown').connect(gain(c, 0.8)).connect(out);
      break;
  }
}

export function playAmbient(sound: AmbientSound, volume = 0.5) {
  if (sound === current && master) { setAmbientVolume(volume); return; }
  stopAmbient();
  if (sound === 'none') return;
  const c = getCtx();
  master = c.createGain();
  master.gain.setValueAtTime(0, c.currentTime);
  master.gain.linearRampToValueAtTime(volume, c.currentTime + 1.5);
  master.connect(c.destination);
  build(c, sound, master);
  current = sound;
}

export function setAmbientVolume(v: number) {
  if (master && ctx) master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.1);
}

export function stopAmbient() {
  timers.forEach(clearTimeout);
  timers = [];
  const m = master;
  const old = nodes;
  nodes = [];
  master = null;
  current = 'none';
  if (m && ctx) {
    m.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => {
      old.forEach((n) => { try { (n as AudioScheduledSourceNode).stop?.(); } catch { /* */ } n.disconnect(); });
      m.disconnect();
    }, 800);
  }
}

export const ambientPlaying = () => current;

/** Gentle three-note completion chime. */
export function playChime(volume = 0.4) {
  const c = getCtx();
  const t = c.currentTime;
  [659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * 0.18);
    g.gain.linearRampToValueAtTime(volume * 0.5, t + i * 0.18 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 1.2);
    o.connect(g).connect(c.destination);
    o.start(t + i * 0.18);
    o.stop(t + i * 0.18 + 1.3);
  });
}

export const AMBIENT_OPTIONS: { value: AmbientSound; label: string; emoji: string }[] = [
  { value: 'none', label: 'Silence', emoji: '🔇' },
  { value: 'rain', label: 'Rain', emoji: '🌧️' },
  { value: 'ocean', label: 'Ocean', emoji: '🌊' },
  { value: 'forest', label: 'Forest', emoji: '🌲' },
  { value: 'fire', label: 'Fireplace', emoji: '🔥' },
  { value: 'cafe', label: 'Café', emoji: '☕' },
  { value: 'white', label: 'White noise', emoji: '〰️' },
  { value: 'brown', label: 'Brown noise', emoji: '🟤' },
];
