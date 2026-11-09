import type {LandGame,Unit} from './land';
import {CIVS} from './landCivs';
import {villageRoster} from './landVillageCards';
export function LandTroops({game,selected,onSelect}:{game:LandGame;selected:number[];onSelect:(units:Unit[])=>void}){
 const rows=villageRoster(game),ids=new Set(selected),total=rows.reduce((n,r)=>n+r.units.length,0),c=CIVS[game.sides[0].civ];
 return <section className="land-troops land-troops-roster" aria-label="Tropas y actividad">
  <header className="land-troops-heading"><div><small>ESTADO EN TIEMPO REAL</small><h3>TUS TROPAS <span>{total}</span></h3></div><i aria-hidden="true"/></header>
  <div className="land-roster-columns" aria-hidden="true"><span>Personaje</span><span>Nivel</span><span>Cant.</span></div>
  <div className="land-troops-list" role="list" aria-label="Todos los tipos de personajes">{rows.map(row=><div role="listitem" key={row.role}><button type="button" className="land-troop-row land-roster-row" disabled={!row.units.length} aria-label={`${c.units[row.role]} · Nivel ${row.level} · Cantidad ${row.units.length}`} aria-pressed={row.units.length>0&&row.units.every(u=>ids.has(u.id))} onClick={()=>onSelect(row.units)}><b>{c.units[row.role]}</b><span>{row.level}</span><strong>{row.units.length}</strong></button></div>)}</div>
  <footer>Seleccioná una fila para elegir ese tipo.</footer>
 </section>;
}
