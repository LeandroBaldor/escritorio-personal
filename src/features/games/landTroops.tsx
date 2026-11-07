import { useState } from 'react';
import type { LandGame, Unit } from './land';
import { CIVS } from './landCivs';
import { roleIdx } from './landArt';
import { Sprite } from './landSprite';
import { troopActivity } from './landActivity';
export function LandTroops({game,selected,onSelect}:{game:LandGame;selected:number[];onSelect:(unit:Unit)=>void}){
  const [filter,setFilter]=useState<'all'|'army'|'workers'>('all');
  const own=game.units.filter(u=>u.owner===0&&!u.dead),army=own.filter(u=>u.role!=='worker'),workers=own.length-army.length;
  const rows=own.filter(u=>filter==='all'||(filter==='workers'?u.role==='worker':u.role!=='worker')).map(u=>({u,activity:troopActivity(game,u)}));
  const rank={attack:0,build:1,gather:2,move:3,idle:4};rows.sort((a,b)=>rank[a.activity.kind]-rank[b.activity.kind]||a.u.id-b.u.id);
  return <section className="land-troops" aria-label="Tropas y actividad">
    <header className="land-troops-heading"><div><small>ESTADO EN TIEMPO REAL</small><h3>TUS TROPAS <span>{own.length}</span></h3></div><i aria-hidden="true"/></header>
    <div className="land-troops-filters" role="group" aria-label="Filtrar tropas">{([['all',`Todas ${own.length}`],['army',`Ejército ${army.length}`],['workers',`Trabajadores ${workers}`]] as const).map(([k,label])=><button type="button" key={k} aria-pressed={filter===k} onClick={()=>setFilter(k)}>{label}</button>)}</div>
    <div className="land-troops-list" role="list" aria-label="Actividad de tus unidades">{rows.map(({u,activity})=><div role="listitem" key={u.id}>
      <button type="button" className={`land-troop-row land-activity-${activity.kind}`} aria-pressed={selected.includes(u.id)} onClick={()=>onSelect(u)} aria-label={`${CIVS[game.sides[0].civ].units[u.role]} ${u.id}: ${activity.label}. ${activity.detail}`}>
        <Sprite civ={game.sides[0].civ} idx={roleIdx(u.role)} w={45} h={54}/>
        <span className="land-troop-copy"><b>{CIVS[game.sides[0].civ].units[u.role]} <small>#{u.id}</small></b><span className="land-troop-status"><i/>{activity.label}</span><span className="land-troop-detail">{activity.detail}</span><span className="land-troop-health" aria-label={`Vida ${Math.ceil(u.hp)} de ${Math.ceil(u.maxHp)}`}><i style={{width:`${Math.max(0,Math.min(100,u.hp/u.maxHp*100))}%`}}/></span></span>
      </button>
    </div>)}</div>
    {!rows.length&&<p className="land-troops-empty">{filter==='army'?'Todavía no hay soldados. Entrenalos en el cuartel.':'No hay unidades en esta categoría.'}</p>}
    <footer>Seleccioná una unidad para verla en el escenario.</footer>
  </section>;
}
