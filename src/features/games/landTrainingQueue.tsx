import {trainingDuration,type Building,type LandGame} from './land';
import {CIVS} from './landCivs';
import {formatLandTime} from './land';
export function LandTrainingQueue({game,building}:{game:LandGame;building:Building}){
 if(!building.queue.length)return null;
 const duration=trainingDuration(game,building.owner,building.queue[0]),remaining=Math.max(0,duration-building.qT),c=CIVS[game.sides[building.owner].civ];
 return <div className="land-training-queue" role="status" aria-label="Cola de entrenamiento"><div><b>En fila: {building.queue.length}</b><span>Próximo en {formatLandTime(Math.ceil(remaining))}</span></div><progress value={building.qT} max={duration} aria-label="Entrenamiento actual"/><ol>{building.queue.slice(0,4).map((role,i)=><li key={i} title={`${c.units[role]} · ${i===0?'en entrenamiento':'esperando turno'}`}>{i+1}. {c.units[role]}{i===0?' · creando':''}</li>)}{building.queue.length>4&&<li>+{building.queue.length-4} en espera</li>}</ol></div>;
}
