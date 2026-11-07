import { characterClipUrl,type CharacterClip,type SoundCue } from './landCharacterClips';
export type SoundChannel='foot'|'call'|'effect';
export interface CharacterSoundOutput {
  unlock():void;preload(clips:CharacterClip[]):Promise<void>;play(clip:CharacterClip,cue:SoundCue,volume:number,pan:number,channel:SoundChannel):boolean;stop():void;dispose():void;
}
export class LandSoundOutput implements CharacterSoundOutput {
  private context:AudioContext|null=null;
  private master:AudioNode|null=null;
  private buffers=new Map<string,AudioBuffer>();
  private pending=new Map<string,Promise<void>>();
  private sources=new Map<AudioBufferSourceNode,SoundChannel>();
  private disposed=false;
  unlock(){
    if(this.disposed)return;
    try{
      if(!this.context){
        this.context=new AudioContext();const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-12;limiter.ratio.value=8;limiter.connect(this.context.destination);this.master=limiter;
      }
      if(this.context.state!=='running')void this.context.resume().catch(()=>{});
    }catch{/* El juego sigue funcionando si no hay salida de audio. */}
  }
  async preload(clips:CharacterClip[]){
    if(!this.context||this.disposed)return;
    await Promise.all(clips.map(clip=>{
      if(this.buffers.has(clip.hash))return;
      const old=this.pending.get(clip.hash);if(old)return old;
      const context=this.context!;
      const request=fetch(characterClipUrl(clip)).then(r=>{if(!r.ok)throw new Error('Audio no disponible');return r.arrayBuffer();}).then(bytes=>context.decodeAudioData(bytes)).then(buffer=>{
        if(this.disposed)return;
        // Limitar memoria y reutilizar grabaciones idénticas por su hash.
        if(this.buffers.size>=24)this.buffers.delete(this.buffers.keys().next().value!);
        this.buffers.set(clip.hash,buffer);
      }).catch(()=>{}).finally(()=>{this.pending.delete(clip.hash);});
      this.pending.set(clip.hash,request);return request;
    }));
  }
  play(clip:CharacterClip,cue:SoundCue,volume:number,pan:number,channel:SoundChannel){
    const c=this.context,buffer=this.buffers.get(clip.hash);if(!c||c.state!=='running'||!buffer||this.disposed)return false;
    const cap=channel==='foot'?3:channel==='call'?1:2;
    if([...this.sources.values()].filter(k=>k===channel).length>=cap)return false;
    const length=Math.min(cue.duration,buffer.duration-cue.start);if(length<=.02)return false;
    const source=c.createBufferSource(),gain=c.createGain(),position=c.createStereoPanner();source.buffer=buffer;
    const level=volume*Math.min(2,Math.max(.35,.12/Math.max(.015,cue.rms))),t=c.currentTime,fade=Math.min(channel==='foot'?.018:.12,length/3);
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(level,t+fade);gain.gain.setValueAtTime(level,t+length-fade);gain.gain.linearRampToValueAtTime(0,t+length);
    position.pan.value=Math.max(-.8,Math.min(.8,pan));source.connect(gain).connect(position).connect(this.master!);
    this.sources.set(source,channel);source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();position.disconnect();};
    source.start(t,cue.start,length);return true;
  }
  stop(){for(const source of this.sources.keys()){try{source.stop();}catch{/* Ya terminó. */}}this.sources.clear();}
  dispose(){this.disposed=true;this.stop();this.buffers.clear();this.pending.clear();if(this.context)void this.context.close().catch(()=>{});this.context=null;this.master=null;}
}
