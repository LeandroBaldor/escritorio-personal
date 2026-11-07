import data from './assets/land/voices/combat/cues.json';
import type {CharacterClip} from './landCharacterClips';
import type {CivId} from './landCivs';
import type {Role} from './land';
export const COMBAT_CLIPS=data as Record<CombatSound,CharacterClip>;
export type CombatSound='acid'|'machine'|'gun'|'cannon'|'arrow'|'fire'|'laser'|'building'|'death';
// Se elige el arma del personaje, no una grabación distinta por civilización.
export function weaponSound(civ:CivId,role:Role):CombatSound{
  if(civ==='humano')return role==='heavy'?'cannon':role==='ranged'||role==='elite'?'machine':'gun';
  if(civ==='enanos')return role==='heavy'?'cannon':role==='ranged'?'gun':'laser';
  if(civ==='mecanico')return role==='heavy'?'cannon':role==='melee'?'machine':'laser';
  if(civ==='zergano')return 'acid';
  if(civ==='infernal')return 'fire';
  if(civ==='elfos')return role==='elite'?'fire':'arrow';
  if(civ==='orcos')return role==='special'||role==='elite'?'fire':'arrow';
  if(civ==='sauriano')return 'arrow';
  if(civ==='nomuerta')return 'laser';
  return role==='special'?'laser':'acid';
}
