import {useState} from 'react';
import {unitStats,type LandGame,type Building,type Role} from './land';
import {CIVS} from './landCivs';
import {BuildingSprite,Sprite} from './landSprite';
import {roleIdx} from './landArt';
import {evolutionLevel,evolutionCost,evolutionTime,EVOLUTION_NAMES} from './landProvision';
import {costDescription} from './landBalance';
import {LandTrainingQueue} from './landTrainingQueue';
import {barracksMembers,unitScores} from './landVillageCards';
export function LandBarracksPanel({game,building,role}:{game:LandGame;building:Building;role:Role}){
 const [more,setMore]=useState(false),civ=game.sides[building.owner].civ,c=CIVS[civ],level=evolutionLevel(game,building.owner,role),s=unitStats(game,building.owner,role),available=game.units.filter(u=>u.owner===building.owner&&!u.dead&&u.role===role).length;
 const scores=unitScores(game,building.owner,role),local=barracksMembers(game,building).length;
 const attributes=[['Resistencia',scores.resistance,`${Math.round(s.hp)} PV`],['Fuerza',scores.force,`${Math.round(s.dmg*(s.vsBuild??1)*(role==='worker'?.3:1)*10)/10} de daño contra edificios`],['Poder',scores.power,`${Math.round(Math.max(s.dmg,s.heal??0)*10)/10} de daño o curación`]] as const;
 return <section className="land-selection-inspector land-barracks-panel" aria-label="Información de selección">
  <div className="land-barracks-sheet">
   <header><h3>{c.buildings[building.kind]}</h3><span>Vida de la construcción: {Math.ceil(building.hp)} / {Math.ceil(building.maxHp)}</span></header>
   <div className="land-barracks-body"><div className="land-barracks-art"><BuildingSprite civ={civ} kind={building.kind} w={180} h={166}/></div>
    <div className="land-barracks-details"><h4>{c.units[role]}</h4><b className="land-barracks-count">Este cuartel: {local}</b><span className="land-barracks-total">Disponibles: {available} en la aldea</span><div className="land-barracks-level"><span>Nivel {level} / 4</span><b>{level*25}%</b><div role="progressbar" aria-label="Progreso total de mejoras" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level*25}><i style={{width:level*25+'%'}}/></div></div>
    {more?<div className="land-evolution-previews" aria-label="Cuatro diseños de evolución">{[1,2,3,4].map(lv=><figure key={lv} className={lv===level?'on':''} title={lv===1?'Nivel inicial':`${EVOLUTION_NAMES[lv]} · ${costDescription(evolutionCost(lv-1,role))}`}><Sprite civ={civ} idx={roleIdx(role)} level={lv} w={54} h={43}/><figcaption>Nivel {lv}</figcaption></figure>)}</div>:<dl className="land-barracks-attributes land-score-attributes">{attributes.map(([name,value,tip])=><div key={name} title={`${tip}. Escala común: 100 = mejor atributo entre todas las unidades al nivel 4.`}><dt>{name}</dt><dd>{value} / 100</dd><meter aria-label={name} min={0} max={100} value={value}/></div>)}</dl>}
    </div>
   </div>
   <footer><button type="button" aria-expanded={more} onClick={()=>setMore(v=>!v)}>{more?'Ver características':'Ver mejoras'}</button>{building.evolving&&<span>Evolucionando: {Math.min(100,Math.floor(building.rT/evolutionTime(level)*100))}%</span>}</footer>
  </div>
  <LandTrainingQueue game={game} building={building} cards/>
 </section>;
}
