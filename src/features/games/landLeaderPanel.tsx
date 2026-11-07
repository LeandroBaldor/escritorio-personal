import {useEffect,useRef} from 'react';
import {LeaderPortrait} from './landInfographic';
import {CIVS,type CivId} from './landCivs';
import {formatLandTime} from './land';
import type {LeaderMessage} from './landLeader';
export function LandLeaderPanel({civ,messages,ready}:{civ:CivId;messages:LeaderMessage[];ready:number}){
  const log=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;},[messages]);
  return <section className="land-intel-card land-command-card" aria-label="Comunicaciones del líder">
    <div className="land-command-heading"><LeaderPortrait civ={civ}/><div><small>CANAL DEL LÍDER</small><h3>{CIVS[civ].name}</h3><span>{ready} {ready===1?'soldado listo':'soldados listos'} para luchar</span></div></div>
    <div className="land-leader-log" role="log" aria-label="Mensajes del líder" aria-live="polite" aria-relevant="additions" ref={log}>
      {messages.map(m=><article key={m.id}><time>{formatLandTime(m.time)}</time><b>Líder</b><p>{m.text}</p></article>)}
    </div>
  </section>;
}
