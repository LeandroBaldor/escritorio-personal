import { describe, expect, it } from 'vitest';
import { addBuilding, addUnit, BUILD_STATS, castPower, newLandGame, orderMove, placeBuilding, stepLand } from './land';
import { GROUND, findPath, walkable } from './landMap';
import { wallAcross, wallNavigation } from './landWalls';
import { deathStyle } from './landDeath';
import { attackText } from './landCivs';

function sandbox() {
  const g = newLandGame('humano','orcos',1,'normal',42,'small');
  g.terrain.cells.fill(GROUND);g.units=[];g.nodes=[];g.ai.t=Infinity;g.sides[0].stone=1000;
  return g;
}
describe('Land revisión 8',()=>{
  it('construye una cadena de muros con el mismo trabajador y cobra cada tramo',()=>{
    const g=sandbox(),u=addUnit(g,0,'worker',280,440);
    const a=placeBuilding(g,0,'wall',430,430,[u.id])!,b=placeBuilding(g,0,'wall',510,430,[u.id])!;
    expect(a).toMatchObject({x:440,y:440,built:0});expect(u.buildQueue).toEqual([b.id]);
    expect(g.sides[0].stone).toBe(1000-2*BUILD_STATS.wall.cost.stone);
    for(let i=0;i<350;i++)stepLand(g,.1);
    expect(a.built).toBe(1);expect(b.built).toBe(1);
    expect(walkable(wallNavigation(g),u.x,u.y)).toBe(true);
  });
  it('un muro terminado bloquea el paso y los caminos lo rodean',()=>{
    const g=sandbox(),w=addBuilding(g,0,'wall',440,440);w.built=1;w.hp=w.maxHp;
    const nav=wallNavigation(g);expect(walkable(nav,440,440)).toBe(false);expect(walkable(g.terrain,440,440)).toBe(true);
    const path=findPath(nav,300,440,600,440);expect(path.length).toBeGreaterThan(1);
    const u=addUnit(g,0,'worker',300,440);orderMove(g,[u.id],600,440);
    for(let i=0;i<100;i++){stepLand(g,.1);expect(walkable(wallNavigation(g),u.x,u.y)).toBe(true);}
    expect(u.x).toBeGreaterThan(550);
  });
  it('los ataques destruyen el muro y vuelven a abrir el paso',()=>{
    const g=sandbox(),w=addBuilding(g,0,'wall',440,440);w.built=1;w.hp=1;
    expect(walkable(wallNavigation(g),440,440)).toBe(false);
    g.sides[1].civ='humano';g.sides[1].power=100;castPower(g,1,440,440);
    expect(w.dead).toBeGreaterThan(0);expect(walkable(wallNavigation(g),440,440)).toBe(true);
  });
  it('un atacante cuerpo a cuerpo golpea la muralla que protege a su objetivo',()=>{
    const g=sandbox(),w=addBuilding(g,0,'wall',440,440);w.built=1;w.hp=w.maxHp;
    const foe=addUnit(g,1,'melee',340,440),target=addUnit(g,0,'worker',560,440);
    expect(wallAcross(g,foe,target)?.id).toBe(w.id);foe.order={k:'attack',id:target.id};stepLand(g,.05);
    expect(foe.order).toEqual({k:'attack',id:w.id});
    for(let i=0;i<60;i++)stepLand(g,.1);expect(w.hp).toBeLessThan(w.maxHp);expect(target.hp).toBe(target.maxHp);
  });
  it('no permite obras sin un constructor propio vivo ni muros sobre personajes',()=>{
    const g=sandbox(),enemy=addUnit(g,1,'worker',200,200);expect(placeBuilding(g,0,'wall',440,440,[enemy.id])).toBeNull();
    const u=addUnit(g,0,'worker',440,440);expect(placeBuilding(g,0,'wall',440,440,[u.id])).toBeNull();
  });
  it('distingue sangre verde, sangre de la especie y explosiones mecánicas',()=>{
    expect(deathStyle('humano','ranged')).toEqual({fire:false,color:'#d92132'});
    expect(deathStyle('elfos','melee').color).toBe('#d92132');
    expect(deathStyle('enanos','melee').color).toBe('#d92132');
    expect(deathStyle('abisal','heavy')).toEqual({fire:false,color:'#32bfd0'});
    expect(deathStyle('mecanico','worker').fire).toBe(true);expect(deathStyle('humano','heavy').fire).toBe(true);
  });
  it('explica la distancia real del ataque y la función de apoyo',()=>{
    expect(attackText('humano','melee',110)).toContain('A distancia');
    expect(attackText('elfos','melee',30)).toContain('Cuerpo a cuerpo');
    expect(attackText('elfos','special',140)).toContain('cura aliados');
  });
});
