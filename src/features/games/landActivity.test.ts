import { describe,expect,it } from 'vitest';
import { addBuilding,addUnit,newLandGame } from './land';
import { troopActivity } from './landActivity';
import { THEMES } from './landMap';
describe('Actividad de las tropas',()=>{
  it('distingue espera, marcha y combate con el nombre real del objetivo',()=>{
    const g=newLandGame('humano','orcos',1,'normal',9,'small'),u=addUnit(g,0,'ranged',400,400),enemy=addUnit(g,1,'melee',500,400);
    expect(troopActivity(g,u).label).toBe('En espera');u.order={k:'move',x:700,y:700};expect(troopActivity(g,u).label).toBe('Marchando');
    u.order={k:'attack',id:enemy.id};expect(troopActivity(g,u)).toMatchObject({kind:'attack',label:'Combatiendo',detail:'Objetivo: Guerrero Orco'});
  });
  it('muestra el color del recurso, extracción y transporte',()=>{
    const g=newLandGame('humano','orcos',1,'normal',9,'small'),u=g.units[0],node=g.nodes.find(n=>n.kind==='energy')!;
    u.order={k:'gather',node:node.id};u.x=node.x+100;u.y=node.y;expect(troopActivity(g,u)).toMatchObject({label:'Buscando recursos',detail:'Cristales verdes'});
    u.x=node.x;expect(troopActivity(g,u).label).toBe('Recolectando');u.carry=8;u.carryKind='energy';expect(troopActivity(g,u)).toMatchObject({label:'Transportando recursos',detail:'8 cristales verdes hacia un depósito'});
  });
  it('muestra el edificio y su progreso mientras lo construyen',()=>{
    const g=newLandGame('humano','orcos',1,'normal',9,'small'),u=g.units[0],b=addBuilding(g,0,'barracks',400,400);b.built=.5;u.order={k:'build',id:b.id};u.x=400;u.y=400;
    expect(troopActivity(g,u)).toMatchObject({label:'Construyendo',detail:'Cuartel · 50%'});u.x=900;expect(troopActivity(g,u).label).toBe('Yendo a la obra');
  });
  it('ningún escenario genera huesos como decoración',()=>{for(const theme of THEMES)expect(theme.decor).not.toContain('bone');});
});
