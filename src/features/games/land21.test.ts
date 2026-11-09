import {describe,it,expect} from 'vitest';
import {newLandGame,addUnit,addBuilding,stepLand,assignFarm} from './land';
import {CIV_IDS} from './landCivs';
import {GROUND} from './landMap';
import {animationFrame,unitAnimation} from './landAnimation';
import {landHudHeight} from './landLayout';
describe('Land: secuencias de acción y HUD de referencia',()=>{
  it('mantiene el marco en su proporción original y adapta el área del mapa',()=>{expect(landHudHeight(1672)).toBe(261);expect(landHudHeight(1280)).toBe(185);expect(landHudHeight(393)).toBe(440);});
  it('recorre los cuadros en orden, cierra ciclos y conserva el último cuadro de ataque',()=>{expect([0,.25,.5,.75].map(p=>animationFrame(p,4))).toEqual([0,1,2,3]);expect(animationFrame(1,4)).toBe(0);expect(animationFrame(1,4,false)).toBe(3);expect(animationFrame(-.25,4)).toBe(3);});
  it.each(CIV_IDS)('%s: anima cosecha de rodillas y se levanta al transportar',civ=>{const g=newLandGame(civ,'orcos',5,'normal',42,'small');g.ais.forEach(a=>a.t=Infinity);g.terrain.cells.fill(GROUND);g.units=[];g.buildings=[];g.nodes=[];const farm=addBuilding(g,0,'farm',1000,1000);farm.built=1;const u=addUnit(g,0,'worker',1000,1000);assignFarm(g,u.id,farm.id);for(let i=0;i<7;i++)stepLand(g,.05);expect(u.kneel).toBe(1);expect(unitAnimation(g,u).action).toBe('harvest');u.carry=60;u.carryKind='food';for(let i=0;i<4;i++)stepLand(g,.05);expect(u.kneel).toBe(0);expect(unitAnimation(g,u).action).not.toBe('harvest');});
  it('separa marcha, extracción y ataque sin cambiar las órdenes del juego',()=>{const g=newLandGame('humano','orcos',5,'normal',42,'small'),u=g.units[0];u.moving=true;u.walk=17;expect(unitAnimation(g,u)).toEqual({action:'walk',phase:.25,facing:'front'});u.moving=false;u.carry=0;g.nodes=[{id:999,kind:'gem',x:u.x+20,y:u.y,amount:200}];u.order={k:'gather',node:999};u.mineT=.4;expect(unitAnimation(g,u)).toEqual({action:'mine',phase:.5});u.order={k:'attack',id:g.units.find(q=>q.owner!==u.owner)!.id};u.atkT=.175;expect(unitAnimation(g,u)).toEqual({action:'attack',phase:.5});u.atkT=-1;expect(unitAnimation(g,u).action).toBe('idle');});
});
