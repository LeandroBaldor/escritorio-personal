export const POPULATION_LIMITS=[100,300,1000,3000] as const;
export type PopulationLimit=typeof POPULATION_LIMITS[number];
export const MINERAL_OPTIONS=[['few','Pocos',.5],['normal','Normal',1],['many','Muchos',2],['full','Repleto',4]] as const;
export type MineralAbundance=typeof MINERAL_OPTIONS[number][0];
export interface LandOptions{populationLimit:PopulationLimit;mineralAbundance:MineralAbundance}
export const DEFAULT_LAND_OPTIONS:LandOptions={populationLimit:300,mineralAbundance:'normal'};
export function mineralMultiplier(abundance:MineralAbundance){return MINERAL_OPTIONS.find(o=>o[0]===abundance)?.[2]??1;}
export function resolveLandOptions(options:Partial<LandOptions>):LandOptions{return {populationLimit:POPULATION_LIMITS.includes(options.populationLimit as PopulationLimit)?options.populationLimit!:300,mineralAbundance:MINERAL_OPTIONS.some(o=>o[0]===options.mineralAbundance)?options.mineralAbundance!:'normal'};}
