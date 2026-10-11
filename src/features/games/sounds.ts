// Efectos de sonido de los juegos, generados con Web Audio (sin archivos de audio).
// El contexto se crea recién con un clic o una tecla: los navegadores no dejan sonar nada antes.
type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };
let ctx: AudioContext | null = null;

export function unlockSounds() {
  try {
    const Ctor = globalThis.AudioContext ?? (globalThis as WithWebkit).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* sin audio: el juego sigue en silencio */ }
}

// Salto: un "boing" corto que sube de tono, a volumen bajo.
export function playJump() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(330, t);
  osc.frequency.exponentialRampToValueAtTime(760, t + 0.11);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.15);
}
