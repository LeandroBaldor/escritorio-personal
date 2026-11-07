import data from './assets/land/voices/cues.json';
import type { CivId } from './landCivs';
import type { Role } from './land';
export interface SoundCue {start:number;duration:number;rms:number}
export type SoundPurpose='foot'|'call'|'effect';
export interface CharacterClip {civ:CivId;role:Role|'acid';variant:number;purpose:SoundPurpose;hash:string;file:string;source:string;duration:number;peak:number;rms:number;phrases:SoundCue[];steps:SoundCue[]}
export const CHARACTER_CLIPS=data.clips as CharacterClip[];
export const CHARACTER_SOUND_GAPS=data.missing;
const urls=import.meta.glob('./assets/land/voices/**/*.mp3',{eager:true,import:'default'}) as Record<string,string>;
export const characterClipUrl=(clip:CharacterClip)=>urls['./assets/land/voices/'+clip.file];
export const characterClips=(civ:CivId,role:Role|'acid',purpose:SoundPurpose)=>CHARACTER_CLIPS.filter(c=>c.civ===civ&&c.role===role&&c.purpose===purpose);
