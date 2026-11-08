import {evolutionLevel} from './landBalance';
import { useState } from 'react';
import type { LandGame, Unit } from './land';
import { CIVS } from './landCivs';
import { roleIdx } from './landArt';
import { Sprite } from './landSprite';
import { troopGroups, troopGroupName } from './landActivity';
export function LandTroops({game,selected,onSelect}:{game:LandGame;selected:number[];onSelect:(units:Unit[])=>void}){
  const [filter,setFilter]=useState<'all'|'army'|'workers'>('all');
  const own=game.units.filter(u=>u.owner===0&&!u.dead),army=own.filter(u=>u.role!=='worker'),workers=own.length-army.length;
  const rows=troopGroups(game).filter(group=>filter==='all'||(filter==='workers'?group.role==='worker':group.role!=='worker'));
  return <section className="land-troops" aria-label="Tropas y actividad">
    <header className="land-troops-heading"><div><small>ESTADO EN TIEMPO REAL</small><h3>TUS TROPAS <span>{own.length}</span></h3></div><i aria-hidden="true"/></header>
    <div className="land-troops-filters" role="group" aria-label="Filtrar tropas">{([['all',`Todas ${own.length}`],['army',`Ejército ${army.length}`],['workers',`Trabajadores ${workers}`]] as const).map(([k,label])=><button type="button" key={k} aria-pressed={filter===k} onClick={()=>setFilter(k)}>{label}</button>)}</div>
    <div className="land-troops-list" role="list" aria-label="Resumen de tropas por tarea">{rows.map(group=>{const title=`${troopGroupName(CIVS[game.sides[0].civ].units[group.role],group.units.length)} (${group.units.length})`;return <div role="listitem" key={group.key}>
      <button type="button" className={`land-troop-row land-troop-summary land-activity-${group.kind}`} aria-pressed={group.units.every(u=>selected.includes(u.id))} onClick={()=>onSelect(group.units)} aria-label={`${title}: ${group.task}`}>
        <Sprite civ={game.sides[0].civ} idx={roleIdx(group.role)} level={evolutionLevel(game,0,group.role)} w={45} h={54}/>
        <span className="land-troop-copy"><b>{title}: <small>Nivel {evolutionLevel(game,0,group.role)}</small></b><span className="land-troop-status"><i/>{group.task}</span></span>
      </button>
    </div>;})}</div>
    {!rows.length&&<p className="land-troops-empty">{filter==='army'?'Todavía no hay soldados. Entrenalos en el cuartel.':'No hay unidades en esta categoría.'}</p>}
    <footer>Seleccioná un bloque para elegir ese grupo.</footer>
  </section>;
}
