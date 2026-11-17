import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

class Sample {
  duration = 7.008;
  constructor(public label: string) {}
}
const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
class Gain {
  gain = parameter();
  connect(node: unknown) { return node; }
}
class Source {
  buffer: Sample | null = null;
  playbackRate = parameter(); loop = false; onended: (() => void) | null = null;
  output: Gain | null = null;
  start = vi.fn(); stop = vi.fn();
  connect(node: Gain) { this.output = node; return node; }
}
class Audio {
  static current: Audio;
  currentTime = 10; state = 'running'; destination = {};
  sources: Source[] = []; decoded: string[] = [];
  constructor() { Audio.current = this; }
  resume = vi.fn(async () => {});
  createDynamicsCompressor() { return { threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter(), connect() {} }; }
  createGain() { return new Gain(); }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  async decodeAudioData(bytes: ArrayBuffer) { const label = new TextDecoder().decode(bytes); this.decoded.push(label); return new Sample(label); }
}
let sounds: typeof import('./sounds');
beforeAll(async () => {
  vi.stubGlobal('AudioContext', Audio); vi.stubGlobal('AudioBuffer', Sample);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ arrayBuffer: async () => new TextEncoder().encode(url).buffer })));
  sounds = await import('./sounds'); sounds.unlockSounds(); sounds.preloadPenaltySounds();
  await vi.waitFor(() => expect(Audio.current.decoded.length).toBeGreaterThanOrEqual(14));
}, 30_000);
beforeEach(() => { Audio.current.currentTime = 10; Audio.current.state = 'running'; Audio.current.sources = []; });
afterEach(() => { sounds?.syncPenDeathAudio(null); sounds?.setKfMusic(false); });
afterAll(() => vi.unstubAllGlobals());

describe('audio de Kombat Penales', () => {
  it('mantiene las cenizas hasta terminar la animación y reanuda desde el mismo punto', () => {
    const audio = Audio.current;
    sounds.syncPenDeathAudio('ash', 1.2);
    const first = audio.sources[0]; expect(first.buffer?.label).toContain('pen-cenizas'); expect(first.loop).toBe(true); expect(first.start).toHaveBeenCalledWith(10, 1.2);
    audio.currentTime = 30; // Ni el retraso de cuadros ni una pista corta deben cortar el sonido.
    sounds.syncPenDeathAudio('ash', 5.19); expect(first.stop).not.toHaveBeenCalled();
    sounds.syncPenDeathAudio(null); expect(first.stop).toHaveBeenCalledOnce();
    sounds.syncPenDeathAudio('ash', 2.3);
    const resumed = audio.sources[1]; expect(resumed.start).toHaveBeenCalledWith(30, 2.3); expect(resumed.loop).toBe(true);
    sounds.syncPenDeathAudio('ash', 5.2); expect(resumed.stop).toHaveBeenCalledOnce();
  });
  it('mezcla los dos archivos pedidos en cada llamada de explosión', () => {
    sounds.playPenExplosion();
    expect(Audio.current.sources.map(s => s.buffer?.label)).toEqual([expect.stringContaining('pen-explosion-jugador'), expect.stringContaining('pen-explosion-sangre')]);
    expect(Audio.current.sources.every(s => s.output?.gain.value === 1)).toBe(true);
  });
  it('libera el bucle al salir aunque el navegador haya suspendido el audio', () => {
    sounds.syncPenDeathAudio('ash', 1);
    const audio = Audio.current, source = audio.sources[0]; audio.state = 'suspended';
    sounds.syncPenDeathAudio(null); expect(source.stop).toHaveBeenCalledWith(audio.currentTime);
    audio.state = 'running'; sounds.syncPenDeathAudio('ash', 2);
    expect(audio.sources).toHaveLength(2); expect(audio.sources[1].start).toHaveBeenCalledWith(10, 2);
  });
  it('usa electricidad al achicarse y congelamiento al helarse', () => {
    sounds.playPenDeathStart('violet'); sounds.playPenDeathStart('ice');
    expect(Audio.current.sources.map(s => s.buffer?.label)).toEqual([expect.stringContaining('pen-electricidad'), expect.stringContaining('pen-congelamiento')]);
    expect(Audio.current.sources[0].stop).toHaveBeenCalledOnce();
  });
  it('aumenta la música de Penales exactamente un 50% y conserva el volumen normal de los otros juegos', async () => {
    sounds.setKfMusic(true);
    await vi.waitFor(() => expect(Audio.current.sources.length).toBe(1));
    const music = Audio.current.sources[0], gain = music.output!.gain;
    expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(0.15, 10, 0.3);
    sounds.setPenMusic(true); expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(0.15 * 1.5, 10, 0.3);
    sounds.setKfMusic(true); expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(0.15, 10, 0.3);
  });
});
