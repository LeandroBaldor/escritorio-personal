import {useId} from 'react';
import reference from './assets/land/hud-reference.png';
export function LandReferenceCommandIcon({index}:{index:number}){return <svg className="land-reference-command-icon" viewBox="0 0 46 42" preserveAspectRatio="none" aria-hidden="true"><image href={reference} x={-(1414+index%4*62)} y={-(749+Math.floor(index/4)*59)} width="1672" height="941"/></svg>;}
// Se muestran los píxeles originales del marco; las ventanas dejan pasar controles y datos reales.
export function LandReferenceFrame({production=false}:{production?:boolean}){const id=useId().replaceAll(':','');return <svg className="land-reference-frame" viewBox="0 0 1342 261" preserveAspectRatio="none" aria-hidden="true"><defs><mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="1342" height="261"><rect width="1342" height="261" fill="black"/><path fill="white" d="M0 31 26 5 186 5 229 35 239 55 301 55 321 46 551 46 584 25 725 25 762 50 1007 50 1034 31 1063 31 1080 39 1213 36 1231 25 1331 25 1342 44 1342 246 1324 261 18 261 0 245Z"/>
<rect x="17" y="52" width="202" height="187" fill="black"/><rect x="27" y="15" width="78" height="22" fill="black"/><rect x="120" y="15" width="78" height="22" fill="black"/>
{[99,146,193].map(y=><rect key={y} x="237" y={y} width="35" height="31" fill="black"/>)}
<rect x="296" y="85" width="409" height="153" fill="black"/><rect x="720" y="85" width="306" height="153" fill="black"/>
{!production&&<><rect x="724" y="90" width="103" height="148" fill="white"/><rect x="728" y="94" width="95" height="140" fill="black"/></>}
{[0,1,2].flatMap(row=>[0,1,2,3].map(col=><rect key={row*4+col} x={1084+col*62} y={69+row*59} width="46" height="42" rx="2" fill="black"/>))}</mask></defs><image href={reference} x="-330" y="-680" width="1672" height="941" mask={`url(#${id})`}/></svg>;}
