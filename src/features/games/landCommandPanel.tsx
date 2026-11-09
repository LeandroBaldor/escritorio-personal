import {popCap,popUsed,type LandGame,type Building} from './land';
import {CIVS} from './landCivs';
import {LandBasePanel} from './landBasePanel';
import {BuildingSprite} from './landSprite';
import {villageRoster} from './landVillageCards';
import {LandTrainingQueue} from './landTrainingQueue';
export function LandCommandPanel({game,building}:{game:LandGame;building:Building}){
 const civ=game.sides[building.owner].civ,c=CIVS[civ],rows=villageRoster(game,building.owner),total=rows.reduce((n,r)=>n+r.units.length,0);
 return <section className="land-selection-inspector land-command-panel" aria-label="Información de selección">
  <LandBasePanel game={game} building={building}/>
  <div className="land-census" aria-label="Población de toda la aldea"><header><BuildingSprite civ={civ} kind="base" w={88} h={72}/><div><h3>{c.buildings.base}</h3><span>Vida {Math.ceil(building.hp)} / {Math.ceil(building.maxHp)}</span><b>Total de habitantes: {total}</b><span>Población: {popUsed(game,building.owner)} / {popCap(game,building.owner)}</span></div></header><div className="land-census-list" role="list" aria-label="Personajes de toda la aldea">{rows.map(row=><div role="listitem" key={row.role}><span>{c.units[row.role]}</span><b>{row.units.length}</b></div>)}</div><LandTrainingQueue game={game} building={building}/></div>
 </section>;
}
