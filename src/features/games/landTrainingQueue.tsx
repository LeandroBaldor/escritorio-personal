import {trainingDuration,type Building,type LandGame} from './land';
import {CIVS} from './landCivs';
import {formatLandTime} from './land';
import {useState} from 'react';
import {Sprite} from './landSprite';
import {roleIdx} from './landArt';
import {evolutionLevel} from './landProvision';
export function LandTrainingQueue({game,building,cards=false}:{game:LandGame;building:Building;cards?:boolean}){
 if(cards)return <TrainingCards key={building.id} game={game} building={building}/>;
 if(!building.queue.length)return null;
 const duration=trainingDuration(game,building.owner,building.queue[0]),remaining=Math.max(0,duration-building.qT),c=CIVS[game.sides[building.owner].civ];
 return <div className="land-training-queue" role="status" aria-label="Cola de entrenamiento"><div><b>En fila: {building.queue.length}</b><span>Próximo en {formatLandTime(Math.ceil(remaining))}</span></div><progress value={building.qT} max={duration} aria-label="Entrenamiento actual"/><ol>{building.queue.slice(0,4).map((role,i)=><li key={i} title={`${c.units[role]} · ${i===0?'en entrenamiento':'esperando turno'}`}>{i+1}. {c.units[role]}{i===0?' · creando':''}</li>)}{building.queue.length>4&&<li>+{building.queue.length-4} en espera</li>}</ol></div>;
}
function queueEntries(game:LandGame,building:Building){
 let total=-building.qT;return building.queue.map((role,index)=>{const duration=trainingDuration(game,building.owner,role);total+=duration;return {role,index,duration,remaining:Math.max(0,total),elapsed:index===0?Math.min(duration,building.qT):0};});
}
function TrainingCards({game,building}:{game:LandGame;building:Building}){
 const [page,setPage]=useState(0),pageSize=3,pages=Math.max(1,Math.ceil(building.queue.length/pageSize)),current=Math.min(page,pages-1),civ=game.sides[building.owner].civ,c=CIVS[civ];
 const entries=queueEntries(game,building);
 return <section className="land-training-cards" role="status" aria-label="Cola de entrenamiento"><header><b>En fila: {entries.length}</b><span>{entries.length?`Próximo en ${formatLandTime(Math.ceil(entries[0].remaining))}`:'Sin encargos'}</span></header>
  {entries.length?<ol>{entries.slice(current*pageSize,(current+1)*pageSize).map(e=><li key={e.index} data-active={e.index===0} aria-label={`${c.units[e.role]} · Puesto ${e.index+1} · ${e.index===0?'Entrenando':'En espera'} · Sale en ${formatLandTime(Math.ceil(e.remaining))}`} title={`${c.units[e.role]} Nivel ${evolutionLevel(game,building.owner,e.role)}. ${e.index===0?'Entrenando':'En espera'}. Sale en ${formatLandTime(Math.ceil(e.remaining))}. Entrenamiento: ${Math.ceil(e.duration)} s.`}><span className="land-queue-position">{e.index+1}</span><Sprite civ={civ} idx={roleIdx(e.role)} level={evolutionLevel(game,building.owner,e.role)} w={64} h={64}/><time>{formatLandTime(Math.ceil(e.remaining))}</time><progress aria-label={`Entrenamiento del puesto ${e.index+1}`} max={e.duration} value={e.elapsed}/></li>)}</ol>:<p className="land-queue-empty">Elegí Entrenar para agregar personajes a la fila.</p>}
  <nav aria-label="Páginas de la cola"><button type="button" aria-label="Cola anterior" disabled={!current} onClick={()=>setPage(current-1)}>‹</button><span>{entries.length?`${current*pageSize+1}–${Math.min(entries.length,(current+1)*pageSize)} de ${entries.length}`:'Cola vacía'}</span><button type="button" aria-label="Cola siguiente" disabled={current>=pages-1} onClick={()=>setPage(current+1)}>›</button></nav>
 </section>;
}
