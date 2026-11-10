import sound1 from './assets/factory/fart-1.mp3';
import sound2 from './assets/factory/fart-2.mp3';
import sound3 from './assets/factory/fart-3.mp3';
import sound4 from './assets/factory/fart-4.mp3';
import sound5 from './assets/factory/fart-5.mp3';
import sound6 from './assets/factory/fart-6.mp3';
import sound7 from './assets/factory/fart-7.mp3';
import sound8 from './assets/factory/fart-8.mp3';
import sound9 from './assets/factory/fart-9.mp3';
import sound10 from './assets/factory/fart-10.mp3';
import explosion from './assets/sonidos/bomba.mp3';
import splat from './assets/factory/caca_cae.mp3';
import ambience from './assets/factory/maquina.mp3';
import { FACTORY_FART_LENGTHS } from './factoryFartTiming';

// Index matches FOODS: every meal always uses the same supplied recording.
export const FACTORY_FART_SOUNDS = [sound1, sound2, sound3, sound4, sound5, sound6, sound7, sound8, sound9, sound10];
export class FactorySound {
  private context: AudioContext | null = null;
  private buffers: AudioBuffer[] = [];
  private voices = new Set<AudioBufferSourceNode>();
  private loading: Promise<void> | null = null;
  private muted = false;
  private playing = false;
  private ambient: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  prepare() {
    if (this.loading) return this.loading;
    if (!window.AudioContext) return Promise.resolve();
    const context = new AudioContext(); this.context = context;
    this.loading = Promise.all([...FACTORY_FART_SOUNDS, explosion, splat, ambience].map(async url => {
      const response = await fetch(url); if (!response.ok) throw new Error('No se pudo cargar un sonido.');
      return context.decodeAudioData(await response.arrayBuffer());
    })).then(buffers => { this.buffers = buffers; });
    return this.loading;
  }
  unlock() {
    if (this.context?.state === 'suspended') return this.context.resume().then(() => this.startAmbient()).catch(() => {});
    this.startAmbient(); return Promise.resolve();
  }
  durations() { return this.buffers.length >= 10 ? this.buffers.slice(0, 10).map(buffer => buffer.duration) : FACTORY_FART_LENGTHS; }
  setPlaying(value: boolean) { this.playing = value; if (value) this.unlock(); else this.stopAmbient(); }
  private startAmbient() {
    const context = this.context, buffer = this.buffers[12];
    if (this.ambient || !this.playing || this.muted || !context || context.state !== 'running' || !buffer) return;
    const source = context.createBufferSource(), gain = context.createGain(); source.buffer = buffer; source.loop = true;
    gain.gain.setValueAtTime(0, context.currentTime); gain.gain.linearRampToValueAtTime(0.18, context.currentTime + 0.25);
    source.connect(gain); gain.connect(context.destination); this.ambient = source; this.ambientGain = gain; source.start();
  }
  private stopAmbient() { this.ambient?.stop(); this.ambient?.disconnect(); this.ambientGain?.disconnect(); this.ambient = null; this.ambientGain = null; }
  explode() { this.play(10); }
  impact() { this.play(11); }
  play(food: number) {
    const context = this.context, buffer = this.buffers[food];
    if (this.muted || !context || !buffer || context.state === 'closed') return;
    if (context.state !== 'running') {
      void context.resume().then(() => { if (this.context === context && this.playing && !this.muted) this.play(food); }).catch(() => {});
      return;
    }
    if (this.voices.size >= 2) { const oldest = this.voices.values().next().value; oldest?.stop(); if (oldest) this.voices.delete(oldest); }
    const source = context.createBufferSource(), gain = context.createGain(); source.buffer = buffer; gain.gain.value = 0.6;
    source.connect(gain); gain.connect(context.destination); this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); }; source.start();
  }
  private stopVoices() { for (const voice of this.voices) voice.stop(); this.voices.clear(); }
  stop() { this.playing = false; this.stopVoices(); this.stopAmbient(); }
  mute(value: boolean) { this.muted = value; if (value) { this.stopVoices(); this.stopAmbient(); } else this.unlock(); }
  dispose() { this.stop(); if (this.context) void this.context.close().catch(() => {}); this.context = null; this.buffers = []; this.loading = null; }
}
