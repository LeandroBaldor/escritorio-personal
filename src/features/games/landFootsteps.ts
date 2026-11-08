import data from './assets/land/voices/footsteps/cues.json';
import type {CharacterClip} from './landCharacterClips';
import type {CivId} from './landCivs';
import type {Role} from './land';
import {STEP_DISTANCE} from './landMotion';
export const FOOTSTEP_CLIP=data as CharacterClip;
const LEGS:Record<CivId,Record<Role,number>>={
  humano:{worker:2,melee:2,ranged:2,special:2,heavy:0,elite:0},
  elfos:{worker:2,melee:2,ranged:2,special:2,heavy:2,elite:0},
  enanos:{worker:2,melee:2,ranged:2,special:2,heavy:0,elite:0},
  mecanico:{worker:0,melee:0,ranged:0,special:0,heavy:0,elite:0},
  nomuerta:{worker:2,melee:2,ranged:0,special:2,heavy:2,elite:0},
  sauriano:{worker:2,melee:2,ranged:2,special:2,heavy:4,elite:2},
  orcos:{worker:2,melee:2,ranged:2,special:2,heavy:2,elite:4},
  infernal:{worker:2,melee:2,ranged:2,special:2,heavy:2,elite:2},
  zergano:{worker:6,melee:2,ranged:4,special:4,heavy:4,elite:6},
  abisal:{worker:6,melee:2,ranged:0,special:0,heavy:6,elite:0},
};
export const legCount=(civ:CivId,role:Role)=>LEGS[civ][role];
export const audibleLegs=(civ:CivId,role:Role)=>(civ==='humano'||civ==='elfos')?legCount(civ,role):0;
export const stepContact=(distance:number,legs:number)=>Math.floor(distance*Math.max(1,legs/2)/STEP_DISTANCE+.5);
export const stepVolume=(legs:number)=>.032/Math.sqrt(Math.max(1,legs/2));
