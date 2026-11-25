// Tiro al Blanco 2.050: sonidos sintetizados (WebAudio), así no depende de archivos ni de sounds.ts.
import type { WeaponId } from './tiroAlBlanco';

let ac: AudioContext | null = null;
let out: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
function ctx() {
  if (typeof window === 'undefined') return null;
  try {
    if (!ac) {
      const A = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!A) return null;
      ac = new A();
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
      out = ac.createGain(); out.gain.value = 0.55; out.connect(comp); comp.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch { return null; }
}
function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
  const a = ctx(); if (!a || !out) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, vol, 0.004, dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur: number, vol: number, freq: number, q = 1, delay = 0, type: BiquadFilterType = 'bandpass') {
  const a = ctx(); if (!a || !out || !noiseBuf) return;
  const t = a.currentTime + delay, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  env(g, t, vol, 0.003, dur); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

export function unlockTiroAudio() { ctx(); }
export function playTiroShot(w: WeaponId) {
  const v = 0.95 + Math.random() * 0.1;
  if (w === 'escopeta') { noise(0.32, 0.9, 900, 0.6, 0, 'lowpass'); tone('sawtooth', 220 * v, 50, 0.28, 0.35); tone('square', 1400 * v, 300, 0.12, 0.12); }
  if (w === 'ametralladora') { noise(0.07, 0.5, 2400, 0.9); tone('square', 900 * v, 240, 0.07, 0.18); }
  if (w === 'rifle') { noise(0.25, 0.6, 3000, 0.7); tone('sawtooth', 2600 * v, 120, 0.35, 0.3); tone('sine', 90, 40, 0.3, 0.45); }
  if (w === 'pistola') { noise(0.08, 0.4, 3200, 1); tone('square', 1700 * v, 400, 0.1, 0.2); }
  if (w === 'revolver') { noise(0.22, 0.75, 1200, 0.7, 0, 'lowpass'); tone('sawtooth', 600 * v, 70, 0.22, 0.3); }
}
export function playTiroHit(head: boolean) { tone('triangle', head ? 1760 : 1180, head ? 1500 : 1000, head ? 0.35 : 0.22, 0.32); if (head) tone('sine', 2640, 2400, 0.3, 0.18, 0.05); noise(0.05, 0.3, 4000, 2); }
export function playTiroPenalty() { tone('square', 180, 140, 0.45, 0.3); tone('square', 186, 146, 0.45, 0.25); }
export function playTiroFlip() { noise(0.09, 0.45, 600, 1.5, 0.12); tone('sine', 140, 60, 0.12, 0.3, 0.12); }
export function playTiroPop() { noise(0.12, 0.18, 1500, 3); tone('sine', 300, 520, 0.1, 0.06); }
export function playTiroReload() { noise(0.05, 0.35, 2500, 4); tone('sine', 300, 1600, 0.6, 0.08, 0.08); noise(0.05, 0.35, 2000, 4, 0.7); }
export function playTiroDry() { noise(0.03, 0.3, 3500, 6); }
export function playTiroEscape() { tone('sawtooth', 500, 160, 0.3, 0.12); }
export function playTiroAmmo() { [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.12, 0.22, i * 0.07)); }
export function playTiroStreak() { [880, 1108, 1318, 1760].forEach((f, i) => tone('square', f, f, 0.1, 0.12, i * 0.06)); }
export function playTiroCount(go: boolean) { tone('sine', go ? 1320 : 660, go ? 1320 : 660, go ? 0.5 : 0.18, 0.3); }
export function playTiroEnd() { tone('sawtooth', 440, 220, 0.9, 0.25); tone('sawtooth', 554, 277, 0.9, 0.2); }
export function playTiroSwitch() { noise(0.06, 0.3, 1800, 3); tone('sine', 500, 900, 0.12, 0.08, 0.05); }
