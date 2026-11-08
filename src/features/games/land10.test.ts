import { describe,expect,it } from 'vitest';
import { addBuilding,BUILD_STATS,BKINDS,newLandGame,ROLES,train } from './land';
import { CIV_IDS,CIVS,TRAINING_KIND } from './landCivs';
import { bIdx } from './landArt';
describe('Cuarteles exclusivos por personaje',()=>{
  it.each(CIV_IDS)('%s: seis cuarteles con nombre y un solo personaje entrenable',civ=>{
    const g=newLandGame(civ,'orcos',5,'normal',42,'small');g.sides[0].stone=g.sides[0].gem=g.sides[0].energy=100000;
    const base=g.buildings.find(b=>b.owner===0)!;
    for(let i=0;i<6;i++)addBuilding(g,0,'depot',base.x+i*100,base.y+300).built=1;
    expect(new Set(Object.values(TRAINING_KIND)).size).toBe(6);
    for(const role of ROLES){
      const kind=TRAINING_KIND[role],b=addBuilding(g,0,kind,base.x+300,base.y);b.built=1;
      expect(CIVS[civ].buildings[kind]).toBe(`Cuartel ${CIVS[civ].units[role]}`);expect(BUILD_STATS[kind].makes).toEqual([role]);
      expect(train(g,b.id,role)).toBe(true);expect(train(g,b.id,role)).toBe(true);
      for(const other of ROLES)if(other!==role){
        const resources={...g.sides[0]},queue=[...b.queue];expect(train(g,b.id,other)).toBe(false);expect(g.sides[0]).toEqual(resources);expect(b.queue).toEqual(queue);
      }
    }
    for(const kind of ['base','tower','depot','wall'] as const)expect(BUILD_STATS[kind].makes).toEqual([]);
    expect(train(g,base.id,'worker')).toBe(false);
  });
  it('todos los edificios conservan un recorte válido del arte de su civilización',()=>{
    for(const kind of BKINDS)expect(bIdx(kind)).toBeGreaterThanOrEqual(6);
    for(const kind of BKINDS)expect(bIdx(kind)).toBeLessThanOrEqual(13);
  });
});
