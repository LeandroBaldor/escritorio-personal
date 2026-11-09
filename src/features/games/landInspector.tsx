import {LandCost} from './landResource';
import {useState} from 'react';
import {LandBasePanel} from './landBasePanel';
import {unitLabel,costDescription} from './landBalance';
import {BUILD_STATS,buildingStats,unitStats,type LandGame,type Unit,type Building,type BKind} from './land';
import {CIVS,TRAINING_ROLE,TRAINING_KIND,BUILD_TEXT,attackText} from './landCivs';
import {improvementProgress,unitImprovementTip,buildingAdvice} from './landInspection';
import {FOOD_NAMES,unitFoodRate,FOOD_CAPACITY,MAX_EVOLUTION,evolutionCost,evolutionLevel,evolutionTime,EVOLUTION_NAMES,foodBlocked,foodRate,HARVEST_TIME} from './landProvision';
import {Sprite,BuildingSprite} from './landSprite';
import {roleIdx} from './landArt';
import {LandTrainingQueue} from './landTrainingQueue';
import {LandBarracksPanel} from './landBarracksPanel';
import {LandCommandPanel} from './landCommandPanel';

export function LandInspector({game,unit,building,count,planned}:{game:LandGame;unit?:Unit;building?:Building;count:number;planned?:BKind}){
  const [more,setMore]=useState(false);
  const owner=unit?.owner??building?.owner??0,civ=game.sides[owner].civ,c=CIVS[civ];
  const kind=planned??building?.kind,role=unit?.role??(kind?TRAINING_ROLE[kind]:undefined),level=role?evolutionLevel(game,owner,role):0;
  const title=planned?`A construir: ${c.buildings[planned]}`:unit?unitLabel(game,owner,unit.role):building?c.buildings[building.kind]:'Seleccioná una unidad o construcción';
  const p=role?improvementProgress(game,owner,role):null,s=role?unitStats(game,owner,role):null,max=role?unitStats(game,owner,role,MAX_EVOLUTION):null;
  const attrs=s&&max?[{label:'Resistencia',value:s.hp,max:max.hp,unit:'PV'},{label:'Ataque',value:s.dmg,max:max.dmg,unit:'daño'},{label:'Velocidad',value:s.speed,max:max.speed,unit:'u/s'},{label:'Distancia',value:s.range,max:max.range,unit:'u'},{label:'Fuerza',value:s.dmg*(s.vsBuild??1)*(role==='worker'?.3:1),max:max.dmg*(max.vsBuild??1)*(role==='worker'?.3:1),unit:'daño'},{label:'Cadencia',value:1/s.cool,max:1/max.cool,unit:'/s'}]:[];
  if(building&&building.built>=1&&!unit&&!planned){if(building.kind==='base')return <LandCommandPanel key={building.id} game={game} building={building}/>;if(role)return <LandBarracksPanel key={building.id} game={game} building={building} role={role}/>;}
  return <section className={`land-selection-inspector land-card-unit land-inspector17${more?' land-show-more':''}${building||planned?' land-building-info':''}`} aria-label="Información de selección">
    <header><div>{unit&&!planned?<Sprite civ={civ} idx={roleIdx(unit.role)} level={level} w={108} h={148} portrait/>:kind?<BuildingSprite civ={civ} kind={kind} w={76} h={54}/>:null}</div><div><h3>{title}{unit&&count>1?` ×${count}`:''}</h3><span>{owner>0?`Rival · ${c.name} · `:''}{!planned&&(unit||building)?`Vida ${Math.ceil(unit?.hp??building!.hp)} / ${Math.ceil(unit?.maxHp??building!.maxHp)}`:''}</span></div></header>
    {planned?<><p>{BUILD_TEXT[planned]}</p><p>Construcción: {buildingStats(game,owner,planned).time} s · <LandCost cost={BUILD_STATS[planned].cost}/></p></>:building&&building.built<1?<><p>Construcción: {Math.floor(building.built*100)}% · Asigná trabajadores para terminarla.</p><progress max={1} value={building.built}/></>:building?.kind==='base'?<LandBasePanel game={game} building={building}/>:role&&s&&p?<>
      <div className="land-unit-capacity"><b>{EVOLUTION_NAMES[level]} · Nivel {level} / {MAX_EVOLUTION}</b><strong>{p.percent} / 100</strong><div role="progressbar" aria-label="Progreso total de mejoras" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent}><i style={{width:p.percent+'%'}}/></div></div>
      {building?<div className="land-evolution-previews" aria-label="Cuatro diseños de evolución">{[1,2,3,4].map(lv=><figure key={lv} className={lv===level?'on':''} title={lv===1?'Nivel 1: disponible al iniciar, sin costo de investigación.':`${EVOLUTION_NAMES[lv]}: Nivel ${lv}. Requiere nivel ${lv-1} e investigar por ${costDescription(evolutionCost(lv-1,role))}.`}><Sprite civ={civ} idx={roleIdx(role)} level={lv} w={66} h={58}/><figcaption>Nivel {lv}</figcaption></figure>)}</div>:<div className="land-attributes">{attrs.map(a=><div key={a.label} title={`${a.label==='Fuerza'?'Daño contra construcciones':a.label}: ${a.value.toFixed(1)} de ${a.max.toFixed(1)} al máximo nivel`}><span>{a.label}</span><b>{Math.round(a.value*10)/10} / {Math.round(a.max*10)/10} <small>{a.unit}</small></b><meter min={0} max={a.max} value={a.value} aria-label={a.label}/></div>)}</div>}
      <div className="land-unit-details"><span>Disponibles: {game.units.filter(u=>u.owner===owner&&!u.dead&&u.role===role).length}{building?` · En cola: ${building.queue.length}`:''}</span><span>{foodBlocked(game,owner,role)?'Sin alimento: detenido':`Comida: ${(unitFoodRate(game,owner,role)).toFixed(1)} / min`}</span><span title={attackText(civ,role,s.range)}>{s.range>60?`A distancia: ${Math.round(s.range)} u`:'Cuerpo a cuerpo'}</span>{role==='special'&&c.special==='heal'&&<span>Curación: {Math.round(s.heal??0)} PV</span>}</div>
      <button type="button" className="land-more-button" aria-expanded={more} onClick={()=>setMore(v=>!v)}>{more?'Ver estado':'Ver mejoras'}</button>
      <div className="land-evolution-gain">{level<4?(()=>{const next=unitStats(game,owner,role,level+1);return <>Próximo nivel: Vida {Math.round(s.hp)} → {Math.round(next.hp)} · Daño {Math.round(s.dmg*10)/10} → {Math.round(next.dmg*10)/10} · Velocidad {Math.round(s.speed)} → {Math.round(next.speed)}</>;})():<>Nivel máximo: listo para formar tu ejército.</>}</div>
      {building?.evolving?<p className="land-next-tip">Evolucionando a nivel {level+1}: {Math.min(100,Math.floor(building.rT/evolutionTime(level)*100))}%</p>:<p className="land-next-tip" title={unitImprovementTip(game,role,owner)}>{level===4?'Evolución máxima. Asegurá sus alimentos.':building?`Próxima: ${EVOLUTION_NAMES[level+1]}. Evolucioná desde las órdenes.`:`Evolucioná en ${c.buildings[TRAINING_KIND[role]]}.`}</p>}
    </>:kind?<><p>{BUILD_TEXT[kind]}</p>{kind==='farm'?<div className="land-farm-details"><b>{FOOD_NAMES[civ]}</b><span>Trabajadores: {game.units.filter(u=>!u.dead&&u.order.k==='farm'&&u.order.id===building?.id).length} / 1</span><span>Cosecha: {Math.floor((game.units.find(u=>!u.dead&&u.order.k==='farm'&&u.order.id===building?.id)?.mineT??0)/HARVEST_TIME*100)}% · 60 s por ciclo</span></div>:kind==='storehouse'?<p>Reserva: {Math.floor(game.sides[owner].food)} / {FOOD_CAPACITY} · Consumo: {foodRate(game,owner).toFixed(1)} / min · {FOOD_NAMES[civ]}</p>:<p>{buildingAdvice(game,kind)} · Población aportada: {BUILD_STATS[kind].pop}</p>}</>:<p>Elegí una unidad, estructura o construcción para consultar sus atributos, tareas y próximos pasos.</p>}
    {building&&<LandTrainingQueue game={game} building={building}/>}
  </section>;
}
