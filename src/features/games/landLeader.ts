import {CIVS} from './landCivs';
import {type Cost,type LandEvent,type LandGame} from './land';
export interface LeaderMessage {id:number;time:number;text:string}
export function missingResources(g:LandGame,cost:Cost){
  const s=g.sides[0],missing=([['stone','cristales azules'],['gem','cristales dorados'],['energy','cristales verdes']] as const).filter(([k])=>s[k]<(cost[k]??0)).map(([k,name])=>`${Math.ceil((cost[k]??0)-s[k])} ${name}`);
  return missing.length?`Nos faltan ${missing.join(' y ')} para completar esta orden.`:'';
}
export function readySoldiers(g:LandGame){return g.units.filter(u=>u.owner===0&&!u.dead&&u.role!=='worker'&&!(u.role==='special'&&CIVS[g.sides[0].civ].special==='heal')).length;}
export class LandLeaderReports{
  private warned=new Map<number,number>();
  private battle:{last:number;report:number;own:number;foes:number;dirty:boolean}|null=null;
  private incomingAt=-Infinity;
  private economyAt=-Infinity;
  private lastTick=-Infinity;
  event(g:LandGame,e:LandEvent){
    const combat=e.type==='attacked'||e.type==='die'&&!e.building;
    if(!combat)return;
    // Contar únicamente bajas de enfrentamientos en los que participa el jugador.
    if(e.type==='die'&&e.owner!==0&&(e.by!==undefined?e.by!==0:!g.units.some(u=>u.owner===0&&!u.dead&&Math.hypot(u.x-e.x,u.y-e.y)<600)&&!g.buildings.some(b=>b.owner===0&&!b.dead&&Math.hypot(b.x-e.x,b.y-e.y)<600)))return;
    if(!this.battle)this.battle={last:g.t,report:g.t,own:0,foes:0,dirty:false};
    this.battle.last=g.t;
    if(e.type==='die'){if(e.owner===0)this.battle.own++;else this.battle.foes++;this.battle.dirty=true;}
  }
  tick(g:LandGame):string[]{
    if(g.phase==='play'&&g.t-this.lastTick<1)return [];this.lastTick=g.t;const messages:string[]=[];
    const defenders=[...g.units.filter(u=>u.owner===0&&!u.dead),...g.buildings.filter(b=>b.owner===0&&!b.dead)];
    const threats=g.units.filter(u=>u.owner>0&&!u.dead&&u.role!=='worker'&&defenders.some(p=>Math.hypot(p.x-u.x,p.y-u.y)<450)&&(u.order.k==='attack'||u.order.k==='move'&&u.order.attack));
    const fresh=threats.filter(u=>g.t-(this.warned.get(u.id)??-Infinity)>60);
    if(fresh.length&&g.t-this.incomingAt>=8){
      const groups=new Map<string,number>();for(const u of fresh){const key=`${CIVS[g.sides[u.owner].civ].units[u.role]} (${CIVS[g.sides[u.owner].civ].name})`;groups.set(key,(groups.get(key)??0)+1);this.warned.set(u.id,g.t);}
      messages.push(`Detecté tropas enemigas que vienen a atacar: ${[...groups].map(([name,n])=>`${n} × ${name}`).join('; ')}. Prepará nuestras defensas.`);this.incomingAt=g.t;
    }
    const ids=new Set(g.units.filter(u=>!u.dead).map(u=>u.id));for(const id of this.warned.keys())if(!ids.has(id))this.warned.delete(id);
    if(g.t>15&&g.t-this.economyAt>=60){
      const s=g.sides[0],low=[s.stone<50?'cristales azules':null,s.gem<25?'cristales dorados':null,s.energy<16?'cristales verdes':null].filter(Boolean);
      if(low.length){messages.push(`Nuestras reservas de ${low.join(', ')} son bajas. Necesitamos enviar trabajadores a recolectar.`);this.economyAt=g.t;}
    }
    const b=this.battle;if(b){const ended=g.t-b.last>=12||g.phase!=='play';if((b.dirty&&g.t-b.report>=4)||ended){messages.push(`${ended?'Terminó el enfrentamiento':'Balance del ataque'}: ${b.own} bajas propias y ${b.foes} bajas enemigas. Tenemos ${readySoldiers(g)} soldados listos para luchar.`);b.report=g.t;b.dirty=false;}if(ended)this.battle=null;}
    return messages;
  }
}
