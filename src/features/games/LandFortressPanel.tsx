import {buildingStats,formatLandTime,type LandGame,type Building} from './land';
import {CIVS} from './landCivs';
import {BuildingSprite} from './landSprite';
import {LandCost} from './landResource';
export function LandFortressPanel({game,building,kind}:{game:LandGame;building?:Building;kind:'castle'|'energyTower'}){
 const owner=building?.owner??0,civ=game.sides[owner].civ,s=buildingStats(game,owner,kind),wait=Math.max(0,(s.unlockAt??0)-game.t),built=building?.built??0;
 return <section className="land-selection-inspector land-fortress-panel" aria-label="Información de selección"><div className="land-fortress-art"><BuildingSprite civ={civ} kind={kind} w={125} h={100}/></div><div className="land-fortress-body"><h3>{building?'':'A construir: '}{CIVS[civ].buildings[kind]}</h3><span>{building?`Vida ${Math.ceil(building.hp)} / ${Math.ceil(building.maxHp)}`:`Construcción: ${s.time} s`}</span><dl><div><dt>Resistencia</dt><dd>{s.hp} PV</dd></div><div><dt>Daño</dt><dd>{s.dmg}</dd></div><div><dt>Alcance</dt><dd>{s.range}</dd></div><div><dt>Población</dt><dd>+{s.pop}</dd></div></dl>{building?built<1?<div className="land-fortress-progress"><span>Obra: {Math.floor(built*100)}%</span><progress aria-label="Construcción de fortaleza" value={built} max={1}/></div>:<p>Defensa automática · Ráfaga cada {s.cool} s · Fortificación {game.sides[owner].infrastructure.fortification}/3</p>:<><LandCost cost={s.cost}/><p>{wait?`Disponible en ${formatLandTime(Math.ceil(wait))} · Desde 10:00`:'Disponible · Asigná trabajadores para construir.'}</p></>}</div></section>;
}
