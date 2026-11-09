import {useEffect,useRef,useState} from 'react';
import {LeaderPortrait} from './landInfographic';
import {CIVS,type CivId} from './landCivs';
import {formatLandTime} from './land';
import type {LeaderMessage} from './landLeader';
export function LandLeaderPanel({civ,messages,ready,onWriting}:{civ:CivId;messages:LeaderMessage[];ready:number;onWriting:(on:boolean)=>void}){
  const log=useRef<HTMLDivElement>(null);
  const latest=messages.at(-1),[typed,setTyped]=useState({id:0,length:0});
  useEffect(()=>{if(!latest)return;let length=0;onWriting(true);const timer=setInterval(()=>{length=Math.min(latest.text.length,length+3);setTyped({id:latest.id,length});if(length===latest.text.length){clearInterval(timer);onWriting(false);}},30);return()=>{clearInterval(timer);onWriting(false);};},[latest,onWriting]);
  useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;},[messages,typed]);
  return <section className="land-intel-card land-command-card" aria-label="Comunicaciones del líder">
    <div className="land-command-heading"><LeaderPortrait civ={civ}/><div><small>CANAL DEL LÍDER</small><h3>{CIVS[civ].name}</h3><span>{ready} {ready===1?'soldado listo':'soldados listos'} para luchar</span></div></div>
    <div className="land-leader-log" role="log" aria-label="Mensajes del líder" aria-live="polite" aria-relevant="additions" ref={log}>
      {messages.map(m=><article key={m.id}><time>{formatLandTime(m.time)}</time><b>Líder</b><p>{m.id===latest?.id?(typed.id===m.id?m.text.slice(0,typed.length):''):m.text}{m.id===latest?.id&&(typed.id!==m.id||typed.length<m.text.length)&&<span className="land-terminal-caret" aria-hidden="true">▋</span>}</p></article>)}
    </div>
  </section>;
}
