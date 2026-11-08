import {it,expect} from 'vitest';
import {newLandGame,addBuilding,addUnit,orderMove,stepLand} from './land';
import {GROUND,walkable} from './landMap';
import {wallNavigation} from './landWalls';
it('las cosechas de frutos no bloquean el suelo ni impiden atravesarlas',()=>{const g=newLandGame('humano','orcos',5,'normal',42,'small');g.ais.forEach(a=>a.t=Infinity);g.terrain.cells.fill(GROUND);g.units=[];g.buildings=[];g.nodes=[];const farm=addBuilding(g,0,'farm',1200,1200);farm.built=1;const nav=wallNavigation(g);expect(walkable(nav,1200,1200)).toBe(true);const u=addUnit(g,0,'melee',1000,1200);orderMove(g,[u.id],1400,1200);let crossed=false;for(let i=0;i<120;i++){stepLand(g,.05);if(Math.abs(u.x-farm.x)<20&&Math.abs(u.y-farm.y)<20)crossed=true;}expect(crossed).toBe(true);expect(u.x).toBeGreaterThan(1380);});
