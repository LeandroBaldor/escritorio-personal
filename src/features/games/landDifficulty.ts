import type {Difficulty} from './land';
export const LAND_DIFFICULTY={
 veryEasy:{prepare:660,workers:8,army:10,reinforce:420,think:2.5,income:.65,construction:1.5,unitLevel:1,structureLevel:0,description:'Economía lenta, ejércitos pequeños y sin evoluciones. Prepara su base antes de atacar; primera ofensiva desde el minuto 11.'},
 easy:{prepare:600,workers:10,army:16,reinforce:300,think:2,income:.85,construction:1.2,unitLevel:2,structureLevel:1,description:'Expansión moderada, grupos pequeños y evoluciones hasta nivel 2. Primera ofensiva desde el minuto 10.'},
 normal:{prepare:540,workers:14,army:24,reinforce:210,think:1.25,income:1,construction:1,unitLevel:3,structureLevel:2,description:'Economía equilibrada, tropas variadas y evoluciones hasta nivel 3. Primera ofensiva desde el minuto 9.'},
 hard:{prepare:480,workers:18,army:34,reinforce:150,think:.75,income:1.2,construction:.9,unitLevel:4,structureLevel:3,description:'Economía rápida, ejércitos grandes, refuerzos frecuentes y nivel 4. Primera ofensiva desde el minuto 8.'},
} as const satisfies Record<Difficulty,{prepare:number;workers:number;army:number;reinforce:number;think:number;income:number;construction:number;unitLevel:number;structureLevel:number;description:string}>;
